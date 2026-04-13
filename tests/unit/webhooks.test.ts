// REQ-083 — Unit tests for webhook signature verification

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { constructEvent, WebhookSignatureError } from "../../src/webhooks.js";

function sign(secret: string, ts: number, body: string): string {
  return `t=${ts},v1=${createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")}`;
}

describe("constructEvent", () => {
  const SECRET = "whsec_test_secret_abc123";
  const PAYLOAD = JSON.stringify({
    id: "evt_xyz",
    type: "agent.created",
    created: Math.floor(Date.now() / 1000),
    data: { agent: { id: "agt_123", type: "support", name: "Test" } },
    workspace_id: "ws_abc",
    api_version: "v1",
  });

  test("verifies a valid signature", () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = sign(SECRET, ts, PAYLOAD);
    const event = constructEvent(PAYLOAD, sig, SECRET);
    assert.equal(event.type, "agent.created");
    assert.equal(event.workspace_id, "ws_abc");
  });

  test("accepts Buffer payload", () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = sign(SECRET, ts, PAYLOAD);
    const event = constructEvent(Buffer.from(PAYLOAD, "utf-8"), sig, SECRET);
    assert.equal(event.type, "agent.created");
  });

  test("rejects missing signature header", () => {
    assert.throws(
      () => constructEvent(PAYLOAD, null, SECRET),
      WebhookSignatureError,
    );
  });

  test("rejects malformed signature header", () => {
    assert.throws(
      () => constructEvent(PAYLOAD, "garbage", SECRET),
      WebhookSignatureError,
    );
  });

  test("rejects wrong secret", () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = sign(SECRET, ts, PAYLOAD);
    assert.throws(
      () => constructEvent(PAYLOAD, sig, "whsec_WRONG_secret"),
      WebhookSignatureError,
    );
  });

  test("rejects tampered payload", () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = sign(SECRET, ts, PAYLOAD);
    const tampered = PAYLOAD.replace("agt_123", "agt_HACKED");
    assert.throws(
      () => constructEvent(tampered, sig, SECRET),
      WebhookSignatureError,
    );
  });

  test("rejects timestamp outside tolerance (replay protection)", () => {
    const oldTs = Math.floor(Date.now() / 1000) - 600;  // 10 min ago
    const sig = sign(SECRET, oldTs, PAYLOAD);
    assert.throws(
      () => constructEvent(PAYLOAD, sig, SECRET, { toleranceSeconds: 300 }),
      WebhookSignatureError,
    );
  });

  test("accepts old timestamp with custom tolerance", () => {
    const oldTs = Math.floor(Date.now() / 1000) - 600;
    const sig = sign(SECRET, oldTs, PAYLOAD);
    const event = constructEvent(PAYLOAD, sig, SECRET, { toleranceSeconds: 1200 });
    assert.equal(event.type, "agent.created");
  });

  test("rejects payload that is not valid JSON (after signature is valid)", () => {
    const garbageBody = "not json";
    const ts = Math.floor(Date.now() / 1000);
    const sig = sign(SECRET, ts, garbageBody);
    assert.throws(
      () => constructEvent(garbageBody, sig, SECRET),
      WebhookSignatureError,
    );
  });

  test("provides typed event.data", () => {
    interface AgentCreatedData { agent: { id: string; type: string; name: string } }
    const ts = Math.floor(Date.now() / 1000);
    const sig = sign(SECRET, ts, PAYLOAD);
    const event = constructEvent<AgentCreatedData>(PAYLOAD, sig, SECRET);
    assert.equal(event.data.agent.id, "agt_123");
  });
});
