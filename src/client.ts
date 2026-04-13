// REQ-083 — HTTP client wrapper for the Lectico API

import { mapHttpToError, LecticoError, RateLimitError, InternalServerError } from "./errors.js";
import type { ApiErrorBody, ApiResponse, ApiList } from "./types.js";

const SDK_VERSION = "0.1.0";

export interface LecticoOptions {
  /** API key. Use sk_live_* in production, sk_test_* in sandbox. */
  apiKey: string;
  /** Override the API base URL. Defaults to https://api.lectico.com. */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Default 30000 (30s). */
  timeoutMs?: number;
  /**
   * Maximum number of automatic retries for transient errors (429, 5xx).
   * Default: 2. Set 0 to disable.
   */
  maxRetries?: number;
  /** Custom fetch (for testing). Defaults to global fetch. */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  /** Idempotency-Key header for safe retry of POST requests. */
  idempotencyKey?: string;
  /** Override per-request timeout. */
  timeoutMs?: number;
  /** Override per-request retry count. */
  maxRetries?: number;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: LecticoOptions) {
    if (!opts.apiKey) throw new Error("LecticoClient: apiKey is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://api.lectico.com").replace(/\/+$/, "");
    this.defaultTimeoutMs = opts.timeoutMs ?? 30_000;
    this.defaultMaxRetries = opts.maxRetries ?? 2;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  /** Build standard headers for every request */
  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": `lectico-sdk-node/${SDK_VERSION}`,
      ...extra,
    };
  }

  /**
   * Core fetch with retry on transient errors (429, 5xx).
   * Returns the parsed JSON body. Throws LecticoError on non-2xx after retries.
   */
  async request<T>(
    method: string,
    path: string,
    opts: {
      body?: unknown;
      query?: Record<string, string | number | undefined | null>;
      headers?: Record<string, string>;
    } & RequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, opts.query);
    const headers = this.headers(opts.headers);
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

    const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
    const maxRetries = opts.maxRetries ?? this.defaultMaxRetries;
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;

    let attempt = 0;
    let lastError: LecticoError | undefined;

    while (attempt <= maxRetries) {
      attempt++;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const signal = opts.signal
        ? combineSignals(ctrl.signal, opts.signal)
        : ctrl.signal;

      let res: Response;
      try {
        res = await this.fetchImpl(url, { method, headers, body, signal });
      } catch (err) {
        clearTimeout(timer);
        if (attempt > maxRetries) throw err;
        await sleep(backoffMs(attempt));
        continue;
      }
      clearTimeout(timer);

      if (res.ok) {
        if (res.status === 204) return undefined as T;
        const text = await res.text();
        if (!text) return undefined as T;
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new Error(`Lectico API returned non-JSON response: ${text.slice(0, 200)}`);
        }
      }

      // Non-2xx — parse error body, decide retry
      const errBody = await this.parseErrorBody(res);
      const apiErr = mapHttpToError(res.status, errBody, res.headers.get("retry-after"));
      lastError = apiErr;

      if (attempt > maxRetries || !this.isRetryable(apiErr)) {
        throw apiErr;
      }

      // Wait before retry
      const waitMs = apiErr instanceof RateLimitError && apiErr.retryAfterSeconds
        ? apiErr.retryAfterSeconds * 1000
        : backoffMs(attempt);
      await sleep(waitMs);
    }

    throw lastError ?? new Error("Lectico request failed for unknown reason");
  }

  /** Make a streaming POST request — returns the raw Response. Used by chat. */
  async stream(path: string, body: unknown, opts: RequestOptions = {}): Promise<Response> {
    const url = this.buildUrl(path);
    const headers = this.headers({ "Accept": "text/event-stream" });
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? this.defaultTimeoutMs);
    const signal = opts.signal ? combineSignals(ctrl.signal, opts.signal) : ctrl.signal;

    const res = await this.fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await this.parseErrorBody(res);
      throw mapHttpToError(res.status, errBody, res.headers.get("retry-after"));
    }
    return res;
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined | null>): string {
    let url = `${this.baseUrl}${path.startsWith("/") ? path : "/" + path}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== "") {
          params.set(k, String(v));
        }
      }
      const q = params.toString();
      if (q) url += "?" + q;
    }
    return url;
  }

  private async parseErrorBody(res: Response): Promise<ApiErrorBody> {
    const text = await res.text();
    if (!text) {
      return {
        error: { type: "internal_error", code: "empty_body", message: `HTTP ${res.status}` },
      };
    }
    try {
      const parsed = JSON.parse(text) as Partial<ApiErrorBody>;
      if (parsed.error?.type) return parsed as ApiErrorBody;
      return {
        error: {
          type: "internal_error",
          code: "unknown",
          message: typeof parsed === "string" ? parsed : text.slice(0, 200),
        },
      };
    } catch {
      return {
        error: { type: "internal_error", code: "non_json", message: text.slice(0, 200) },
      };
    }
  }

  private isRetryable(err: LecticoError): boolean {
    // Retry on rate-limit and 5xx
    if (err instanceof RateLimitError) return true;
    if (err instanceof InternalServerError && err.status >= 500) return true;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  // Exponential with jitter: 500ms, 1500ms, 4500ms, ...
  const base = Math.min(500 * Math.pow(3, attempt - 1), 30_000);
  const jitter = Math.random() * 200;
  return base + jitter;
}

/** Combine multiple AbortSignals so the request aborts if ANY fires. */
function combineSignals(...signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1) return signals[0];
  // Node 20+ has AbortSignal.any
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === "function") return anyFn(signals);
  // Fallback for older runtimes
  const ctrl = new AbortController();
  for (const s of signals) {
    if (s.aborted) ctrl.abort(s.reason);
    else s.addEventListener("abort", () => ctrl.abort(s.reason), { once: true });
  }
  return ctrl.signal;
}

// Re-export for convenience
export type { ApiResponse, ApiList };
