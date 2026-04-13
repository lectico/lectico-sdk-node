# @lectico/api

[![npm](https://img.shields.io/npm/v/@lectico/api.svg)](https://www.npmjs.com/package/@lectico/api)
[![license](https://img.shields.io/npm/l/@lectico/api.svg)](./LICENSE)

Official Node.js SDK for the [Lectico](https://lectico.com) API — create AI assistants trained on your content, manage conversations, capture leads, and receive webhooks.

> **Beta / Early Access.** This SDK is pre-1.0 and the surface may change. Pin to an exact version in production. Breaking changes will be called out in release notes until `1.0.0`.

## Installation

```bash
npm install @lectico/api
```

Requires Node.js 18 or newer. ESM only.

## Quick start

```ts
import Lectico from "@lectico/api";

const lectico = new Lectico({ apiKey: process.env.LECTICO_API_KEY! });

// Create an agent
const agent = await lectico.agents.create({
  type: "support",
  name: "Helpdesk Bot",
});

// Send a message (streaming by default)
const stream = await lectico.agents.messages.create(agent.id, {
  message: "How do I reset my password?",
});

for await (const ev of stream as AsyncIterable<any>) {
  if (ev.type === "token") process.stdout.write(ev.content ?? "");
}
```

Get a test API key (`sk_test_*`) from the [Lectico dashboard](https://app.lectico.com).

## Streaming vs JSON responses

Chat messages stream Server-Sent Events by default. Pass `stream: false` for a single JSON response:

```ts
const reply = await lectico.agents.messages.create(agent.id, {
  message: "Hello",
  stream: false,
});
// reply is a ChatMessage
```

Stream event types include `token`, `sources`, `chunks`, `done`, `expert_thinking`, `escalation_offer`, `support_contact`, `error`.

## Webhook signature verification

Webhooks are signed with HMAC-SHA256. Verify the signature before trusting the payload:

```ts
import express from "express";
import { constructEvent, WebhookSignatureError } from "@lectico/api/webhooks";

const app = express();

app.post(
  "/webhooks/lectico",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const event = constructEvent(
        req.body,                              // Buffer (raw body)
        req.header("Lectico-Signature"),
        process.env.LECTICO_WEBHOOK_SECRET!,   // whsec_... from dashboard
      );

      switch (event.type) {
        case "agent.created":
          // ...
          break;
        case "lead.captured":
          // ...
          break;
      }

      res.status(200).json({ received: true });
    } catch (err) {
      if (err instanceof WebhookSignatureError) {
        return res.status(400).send(`Invalid signature: ${err.message}`);
      }
      throw err;
    }
  },
);
```

`constructEvent` validates the `t=...,v1=...` signature and rejects payloads older than 5 minutes (configurable via `toleranceSeconds`) to prevent replay attacks.

## Pagination

Lists are cursor-paginated. Iterate all results with `iterAll`:

```ts
for await (const agent of lectico.agents.iterAll({ type: "support" })) {
  console.log(agent.id, agent.name);
}
```

Or page manually:

```ts
const page = await lectico.agents.list({ limit: 50 });
if (page.meta.pagination.has_more) {
  const next = await lectico.agents.list({
    limit: 50,
    starting_after: page.meta.pagination.next_cursor,
  });
}
```

## Error handling

All API errors extend `LecticoError`. Check the specific class to react appropriately:

| Class                    | HTTP | Meaning                              |
| ------------------------ | ---- | ------------------------------------ |
| `AuthenticationError`    | 401  | Invalid or missing API key           |
| `PaymentRequiredError`   | 402  | Out of credits / plan limit reached  |
| `PermissionDeniedError`  | 403  | Key lacks permission for the resource|
| `NotFoundError`          | 404  | Resource does not exist              |
| `ConflictError`          | 409  | Slug collision, idempotency mismatch |
| `InvalidRequestError`    | 400  | Bad input — see `.param`             |
| `RateLimitError`         | 429  | Too many requests — see `.retryAfterSeconds` |
| `InternalServerError`    | 5xx  | Transient or unexpected server error |

```ts
import { RateLimitError, NotFoundError } from "@lectico/api";

try {
  await lectico.agents.get("agt_missing");
} catch (err) {
  if (err instanceof NotFoundError) {
    // ...
  } else if (err instanceof RateLimitError) {
    await sleep(err.retryAfterSeconds * 1000);
  } else {
    throw err;
  }
}
```

The client automatically retries `429` and `5xx` responses with exponential backoff (default: 2 retries). Configure with `maxRetries` in the constructor.

## Idempotency

Pass an `idempotencyKey` to safely retry `POST` requests:

```ts
await lectico.agents.create(
  { type: "support", name: "Bot" },
  { idempotencyKey: crypto.randomUUID() },
);
```

## Configuration

```ts
new Lectico({
  apiKey: "sk_live_...",           // required
  baseUrl: "https://api.lectico.com", // default
  timeoutMs: 30000,                // per-request timeout
  maxRetries: 2,                   // 429/5xx retries
});
```

## Resources available

- `agents` — create, list, get, update, delete, `iterAll`, `messages.create` (streaming)
- `knowledge` — list, create, delete
- `conversations` — list, get
- `leads` — list, get, delete
- `webhooks` — create, list, get, update, delete, deliveries, test
- `files` — create (presigned URL), get, delete
- `usage` — summary (plan + usage)

## Documentation

Full API reference: **coming soon at [docs.lectico.com/api](https://docs.lectico.com/api)**.

## License

[MIT](./LICENSE) © Contenfo LLC (Lectico)
