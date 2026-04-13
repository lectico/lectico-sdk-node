// REQ-083 — Webhook signature verification helper
//
// Use this in your webhook receiver to verify that an incoming request really
// came from Lectico (and not someone forging it).
//
// Usage in Express:
//   app.post("/webhook", express.raw({type: "application/json"}), (req, res) => {
//     const signature = req.header("Lectico-Signature");
//     const event = lectico.webhooks.constructEvent(req.body, signature, process.env.LECTICO_WEBHOOK_SECRET);
//     // event is now type-checked; do your thing
//     res.sendStatus(200);
//   });

import { createHmac, timingSafeEqual } from "node:crypto";
import type { WebhookEventBody } from "./types.js";

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export interface ConstructEventOptions {
  /** Maximum allowed age of the timestamp in seconds. Default: 300 (5 min). Protects against replay attacks. */
  toleranceSeconds?: number;
}

/**
 * Verify the HMAC-SHA256 signature of an incoming webhook and return the
 * parsed event body. Throws WebhookSignatureError on any failure.
 *
 * @param payload  The raw request body as a string or Buffer (NOT a parsed object — the bytes must match exactly).
 * @param signatureHeader  The `Lectico-Signature` header value (e.g. "t=1234567890,v1=abc...").
 * @param secret  The HMAC secret from your subscription (whsec_...).
 */
export function constructEvent<T = unknown>(
  payload: string | Buffer | Uint8Array,
  signatureHeader: string | null | undefined,
  secret: string,
  opts: ConstructEventOptions = {},
): WebhookEventBody<T> {
  if (!signatureHeader) {
    throw new WebhookSignatureError("Missing Lectico-Signature header");
  }
  if (!secret) {
    throw new WebhookSignatureError("Missing webhook secret");
  }

  // Parse "t=<unix>,v1=<hex>"
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const idx = p.indexOf("=");
      return [p.slice(0, idx).trim(), p.slice(idx + 1).trim()];
    }),
  );

  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) {
    throw new WebhookSignatureError("Malformed signature header (missing t= or v1=)");
  }

  // Replay protection
  const ts = Number.parseInt(timestamp, 10);
  if (Number.isNaN(ts)) {
    throw new WebhookSignatureError("Invalid timestamp in signature header");
  }
  const tolerance = opts.toleranceSeconds ?? 300;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > tolerance) {
    throw new WebhookSignatureError(`Timestamp outside tolerance (${tolerance}s)`);
  }

  // Compute expected signature
  const payloadStr = typeof payload === "string" ? payload : Buffer.from(payload).toString("utf-8");
  const expected = createHmac("sha256", secret).update(`${ts}.${payloadStr}`).digest("hex");

  // Constant-time comparison
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(v1, "hex");
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new WebhookSignatureError("Signature mismatch — request was not sent by Lectico (or secret is wrong)");
  }

  // Parse payload as JSON
  let event: WebhookEventBody<T>;
  try {
    event = JSON.parse(payloadStr) as WebhookEventBody<T>;
  } catch {
    throw new WebhookSignatureError("Payload is not valid JSON");
  }

  return event;
}
