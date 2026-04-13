// REQ-083 — Unit tests for HttpClient (uses mocked fetch, no network)

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { HttpClient } from "../../src/client.js";
import {
  AuthenticationError, NotFoundError, ConflictError,
  RateLimitError, InternalServerError, InvalidRequestError, PaymentRequiredError,
} from "../../src/errors.js";

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return handler as typeof fetch;
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("HttpClient", () => {
  test("throws when apiKey is missing", () => {
    assert.throws(() => new HttpClient({ apiKey: "" }), /apiKey is required/);
  });

  test("attaches Authorization Bearer header", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      fetch: mockFetch(async (_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse({ ok: true });
      }),
    });
    await client.request("GET", "/v1/health");
    assert.equal(capturedHeaders?.["Authorization"], "Bearer sk_test_xyz");
    assert.match(capturedHeaders?.["User-Agent"] ?? "", /lectico-sdk-node/);
  });

  test("builds query string from params", async () => {
    let capturedUrl = "";
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      fetch: mockFetch(async (url) => {
        capturedUrl = url;
        return jsonResponse({ data: [] });
      }),
    });
    await client.request("GET", "/v1/agents", {
      query: { limit: 20, type: "support", missing: undefined, blank: "" },
    });
    assert.match(capturedUrl, /\?limit=20/);
    assert.match(capturedUrl, /type=support/);
    assert.doesNotMatch(capturedUrl, /missing/);
    assert.doesNotMatch(capturedUrl, /blank/);
  });

  test("attaches Idempotency-Key when provided", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      fetch: mockFetch(async (_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse({ ok: true });
      }),
    });
    await client.request("POST", "/v1/agents", {
      body: { type: "support", name: "Bot" },
      idempotencyKey: "abc-123-uuid",
    });
    assert.equal(capturedHeaders?.["Idempotency-Key"], "abc-123-uuid");
  });

  test("returns parsed JSON on 2xx", async () => {
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      fetch: mockFetch(async () => jsonResponse({ data: { id: "agt_1" }, meta: { request_id: "req_x" } })),
    });
    const res = await client.request<{ data: { id: string } }>("GET", "/v1/agents/agt_1");
    assert.equal(res.data.id, "agt_1");
  });

  test("maps 401 to AuthenticationError", async () => {
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      maxRetries: 0,
      fetch: mockFetch(async () => jsonResponse({ error: { type: "authentication_error", code: "invalid_api_key", message: "bad key" } }, 401)),
    });
    await assert.rejects(
      () => client.request("GET", "/v1/agents"),
      AuthenticationError,
    );
  });

  test("maps 402 to PaymentRequiredError", async () => {
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      maxRetries: 0,
      fetch: mockFetch(async () => jsonResponse({ error: { type: "payment_required", code: "out_of_credits", message: "no credits" } }, 402)),
    });
    await assert.rejects(
      () => client.request("POST", "/v1/agents", { body: {} }),
      PaymentRequiredError,
    );
  });

  test("maps 404 to NotFoundError", async () => {
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      maxRetries: 0,
      fetch: mockFetch(async () => jsonResponse({ error: { type: "not_found", code: "agent_not_found", message: "not found" } }, 404)),
    });
    await assert.rejects(
      () => client.request("GET", "/v1/agents/missing"),
      NotFoundError,
    );
  });

  test("maps 409 to ConflictError", async () => {
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      maxRetries: 0,
      fetch: mockFetch(async () => jsonResponse({ error: { type: "conflict", code: "slug_already_exists", message: "exists" } }, 409)),
    });
    await assert.rejects(
      () => client.request("POST", "/v1/agents", { body: {} }),
      ConflictError,
    );
  });

  test("maps 400 to InvalidRequestError with param", async () => {
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      maxRetries: 0,
      fetch: mockFetch(async () => jsonResponse({ error: { type: "invalid_request", code: "invalid_type", message: "bad type", param: "type" } }, 400)),
    });
    try {
      await client.request("POST", "/v1/agents", { body: {} });
      assert.fail("should have thrown");
    } catch (err) {
      assert.ok(err instanceof InvalidRequestError);
      assert.equal(err.param, "type");
      assert.equal(err.code, "invalid_type");
    }
  });

  test("maps 429 to RateLimitError + parses Retry-After", async () => {
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      maxRetries: 0,
      fetch: mockFetch(async () => jsonResponse(
        { error: { type: "rate_limit_exceeded", code: "too_many", message: "slow down" } },
        429,
        { "retry-after": "42" },
      )),
    });
    try {
      await client.request("GET", "/v1/agents");
      assert.fail("should have thrown");
    } catch (err) {
      assert.ok(err instanceof RateLimitError);
      assert.equal(err.retryAfterSeconds, 42);
    }
  });

  test("maps 500 to InternalServerError", async () => {
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      maxRetries: 0,
      fetch: mockFetch(async () => jsonResponse({ error: { type: "internal_error", code: "boom", message: "server crashed" } }, 500)),
    });
    await assert.rejects(
      () => client.request("GET", "/v1/agents"),
      InternalServerError,
    );
  });

  test("retries on 5xx and recovers", async () => {
    let attempts = 0;
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      maxRetries: 2,
      fetch: mockFetch(async () => {
        attempts++;
        if (attempts < 3) {
          return jsonResponse({ error: { type: "internal_error", code: "transient", message: "try again" } }, 503);
        }
        return jsonResponse({ data: { ok: true } });
      }),
    });
    const res = await client.request<{ data: { ok: boolean } }>("GET", "/v1/agents");
    assert.equal(attempts, 3);
    assert.equal(res.data.ok, true);
  });

  test("does NOT retry on 401 (auth errors are permanent)", async () => {
    let attempts = 0;
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      maxRetries: 5,
      fetch: mockFetch(async () => {
        attempts++;
        return jsonResponse({ error: { type: "authentication_error", code: "invalid_api_key", message: "no" } }, 401);
      }),
    });
    await assert.rejects(() => client.request("GET", "/v1/agents"), AuthenticationError);
    assert.equal(attempts, 1, "401 should NOT trigger retries");
  });

  test("returns Response unchanged for stream() — caller consumes the body", async () => {
    const client = new HttpClient({
      apiKey: "sk_test_xyz",
      fetch: mockFetch(async () => new Response("data: {\"type\":\"token\"}\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      })),
    });
    const res = await client.stream("/v1/agents/abc/messages", { message: "hi" });
    assert.equal(res.headers.get("content-type"), "text/event-stream");
    assert.ok(res.body, "response body present");
  });
});
