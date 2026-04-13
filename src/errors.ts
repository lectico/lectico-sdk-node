// REQ-083 — SDK error classes (typed by API error type)

import type { ApiErrorBody } from "./types.js";

export class LecticoError extends Error {
  readonly type: ApiErrorBody["error"]["type"];
  readonly code: string;
  readonly status: number;
  readonly param?: string;
  readonly docUrl?: string;
  readonly requestId?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = "LecticoError";
    this.type = body.error.type;
    this.code = body.error.code;
    this.status = status;
    this.param = body.error.param;
    this.docUrl = body.error.doc_url;
    this.requestId = body.meta?.request_id;
  }
}

/** 401 — invalid or missing API key */
export class AuthenticationError extends LecticoError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body);
    this.name = "AuthenticationError";
  }
}

/** 402 — out of credits / plan limit reached */
export class PaymentRequiredError extends LecticoError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body);
    this.name = "PaymentRequiredError";
  }
}

/** 403 — API key lacks scope */
export class PermissionDeniedError extends LecticoError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body);
    this.name = "PermissionDeniedError";
  }
}

/** 404 — resource not found */
export class NotFoundError extends LecticoError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body);
    this.name = "NotFoundError";
  }
}

/** 409 — conflict (idempotency mismatch, slug collision, etc.) */
export class ConflictError extends LecticoError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body);
    this.name = "ConflictError";
  }
}

/** 400 / 422 — invalid input */
export class InvalidRequestError extends LecticoError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body);
    this.name = "InvalidRequestError";
  }
}

/** 429 — rate limit exceeded */
export class RateLimitError extends LecticoError {
  readonly retryAfterSeconds?: number;
  constructor(status: number, body: ApiErrorBody, retryAfter?: string | null) {
    super(status, body);
    this.name = "RateLimitError";
    if (retryAfter) {
      const parsed = Number.parseInt(retryAfter, 10);
      if (!Number.isNaN(parsed)) this.retryAfterSeconds = parsed;
    }
  }
}

/** 5xx — Lectico-side internal error */
export class InternalServerError extends LecticoError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body);
    this.name = "InternalServerError";
  }
}

/** Map an HTTP status + parsed body to the correct error class */
export function mapHttpToError(
  status: number,
  body: ApiErrorBody,
  retryAfterHeader?: string | null,
): LecticoError {
  switch (status) {
    case 400:
    case 422:
      return new InvalidRequestError(status, body);
    case 401:
      return new AuthenticationError(status, body);
    case 402:
      return new PaymentRequiredError(status, body);
    case 403:
      return new PermissionDeniedError(status, body);
    case 404:
      return new NotFoundError(status, body);
    case 409:
      return new ConflictError(status, body);
    case 429:
      return new RateLimitError(status, body, retryAfterHeader);
    default:
      return new InternalServerError(status, body);
  }
}
