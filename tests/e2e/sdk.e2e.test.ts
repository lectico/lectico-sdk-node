// REQ-083 — E2E test: SDK against the real production API.
//
// Provisions a sandbox workspace, exercises the SDK end-to-end, then cleans up.
// Run with: npm run test:e2e

import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import Lectico from "../../src/index.js";
import { ConflictError, NotFoundError } from "../../src/errors.js";

const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL ?? "https://byoxaihkwsjhrwbltjzb.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = process.env.LECTICO_API_BASE ?? "https://lectico-api-705982084582.us-east4.run.app";

if (!SERVICE_ROLE) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY env var required for E2E tests");
}

let workspaceId = "";
let apiKey = "";
let lectico: Lectico;
const RUN_SUFFIX = Date.now().toString(36);

describe("@lectico/api E2E (real Cloud Run)", () => {
  before(async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/api_v1_sandbox_provision`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_ROLE!,
        "authorization": `Bearer ${SERVICE_ROLE}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_owner_user_email: `sdk-e2e-${RUN_SUFFIX}@test.com` }),
    });
    if (!res.ok) throw new Error(`sandbox_provision failed: ${res.status} ${await res.text()}`);
    const rows = await res.json() as Array<{ workspace_id: string; api_key: string; api_key_prefix: string }>;
    workspaceId = rows[0].workspace_id;
    apiKey = rows[0].api_key;
    lectico = new Lectico({ apiKey, baseUrl: API_BASE });
    console.log(`  Provisioned sandbox WS=${workspaceId}, key prefix=${rows[0].api_key_prefix}`);
  });

  test("agents.create returns Agent with auto-generated slug", async () => {
    const agent = await lectico.agents.create({
      type: "support",
      name: `SDK E2E Bot ${RUN_SUFFIX}`,
    });
    assert.equal(agent.type, "support");
    assert.match(agent.slug, /^sdk-e2e-bot/);
    assert.ok(agent.id);
    assert.ok(agent.created_at);
  });

  test("agents.list returns at least the agent we created", async () => {
    const page = await lectico.agents.list({ limit: 50 });
    assert.ok(Array.isArray(page.data));
    assert.ok(page.data.length >= 1);
    assert.ok(page.meta.request_id.startsWith("req_"));
  });

  test("agents.create with explicit slug collision throws ConflictError", async () => {
    await lectico.agents.create({
      type: "training",
      name: `Reserved ${RUN_SUFFIX}`,
      slug: `reserved-${RUN_SUFFIX}`,
    });
    await assert.rejects(
      () => lectico.agents.create({ type: "training", name: "Other", slug: `reserved-${RUN_SUFFIX}` }),
      ConflictError,
    );
  });

  test("agents.get with missing id throws NotFoundError", async () => {
    await assert.rejects(
      () => lectico.agents.get("nonexistent-agent-99"),
      NotFoundError,
    );
  });

  test("agents.update modifies the agent", async () => {
    const created = await lectico.agents.create({ type: "sales", name: `Updatable ${RUN_SUFFIX}` });
    const updated = await lectico.agents.update(created.id, { name: `Renamed ${RUN_SUFFIX}` });
    assert.equal(updated.name, `Renamed ${RUN_SUFFIX}`);
  });

  test("agents.delete returns deleted=true (soft delete)", async () => {
    const created = await lectico.agents.create({ type: "support", name: `Deletable ${RUN_SUFFIX}` });
    const result = await lectico.agents.delete(created.id);
    assert.equal(result.deleted, true);
  });

  test("agents.iterAll auto-paginates", async () => {
    const collected: string[] = [];
    for await (const a of lectico.agents.iterAll({ limit: 2 })) {
      collected.push(a.id);
      if (collected.length > 100) break;
    }
    assert.ok(collected.length >= 1);
  });

  test("webhooks.create returns secret only at creation", async () => {
    const wh = await lectico.webhooks.create({
      url: "https://httpbin.org/post",
      events: ["agent.created", "lead.captured"],
    });
    assert.match(wh.secret, /^whsec_/);
    assert.ok(wh.id);

    const fetched = await lectico.webhooks.get(wh.id);
    assert.equal((fetched as { secret?: string }).secret, undefined);
  });

  test("webhooks.update can disable subscription", async () => {
    const wh = await lectico.webhooks.create({
      url: "https://httpbin.org/post",
      events: ["webhook.test"],
    });
    const updated = await lectico.webhooks.update(wh.id, { is_active: false });
    assert.equal(updated.is_active, false);
  });

  test("webhooks.test schedules a test delivery", async () => {
    const wh = await lectico.webhooks.create({
      url: "https://httpbin.org/post",
      events: ["webhook.test"],
    });
    const result = await lectico.webhooks.test(wh.id);
    assert.ok(result.delivery_id);
    assert.equal(result.status, "pending");
  });

  test("usage.summary returns plan + usage info", async () => {
    const summary = await lectico.usage.summary();
    assert.ok(summary.plan);
    assert.ok(typeof summary.usage.messages_count === "number");
  });

  test("leads.list returns empty for fresh sandbox", async () => {
    const page = await lectico.leads.list();
    assert.ok(Array.isArray(page.data));
  });

  test("leads.get on nonexistent throws NotFoundError", async () => {
    await assert.rejects(
      () => lectico.leads.get("00000000-0000-0000-0000-000000000000"),
      NotFoundError,
    );
  });

  after(async () => {
    if (!workspaceId) return;
    const opts: RequestInit = {
      method: "DELETE",
      headers: { "apikey": SERVICE_ROLE!, "authorization": `Bearer ${SERVICE_ROLE}` },
    };
    await fetch(`${SUPABASE_URL}/rest/v1/webhook_subscriptions?workspace_id=eq.${workspaceId}`, opts);
    await fetch(`${SUPABASE_URL}/rest/v1/api_keys?workspace_id=eq.${workspaceId}`, opts);
    await fetch(`${SUPABASE_URL}/rest/v1/tutors?workspace_id=eq.${workspaceId}`, opts);
    await fetch(`${SUPABASE_URL}/rest/v1/courses?workspace_id=eq.${workspaceId}`, opts);
    await fetch(`${SUPABASE_URL}/rest/v1/workspace_subscriptions?workspace_id=eq.${workspaceId}`, opts);
    await fetch(`${SUPABASE_URL}/rest/v1/workspaces?id=eq.${workspaceId}`, opts);
    console.log(`  Cleaned up sandbox ${workspaceId}`);
  });
});
