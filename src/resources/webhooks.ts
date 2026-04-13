import type { HttpClient, RequestOptions } from "../client.js";
import type {
  WebhookSubscription, WebhookSubscriptionWithSecret, WebhookCreateInput,
  WebhookUpdateInput, WebhookDelivery, ListParams,
  ApiResponse, ApiList,
} from "../types.js";

export class WebhooksResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Create a webhook subscription.
   * The response includes `secret` — save it. Lectico cannot retrieve it again.
   */
  async create(input: WebhookCreateInput, opts?: RequestOptions): Promise<WebhookSubscriptionWithSecret> {
    const r = await this.client.request<ApiResponse<WebhookSubscriptionWithSecret>>(
      "POST",
      "/v1/webhooks",
      { body: input, ...opts },
    );
    return r.data;
  }

  async list(params: ListParams = {}, opts?: RequestOptions): Promise<ApiList<WebhookSubscription>> {
    return this.client.request<ApiList<WebhookSubscription>>("GET", "/v1/webhooks", {
      query: { limit: params.limit, starting_after: params.starting_after },
      ...opts,
    });
  }

  async get(webhookId: string, opts?: RequestOptions): Promise<WebhookSubscription> {
    const r = await this.client.request<ApiResponse<WebhookSubscription>>(
      "GET",
      `/v1/webhooks/${encodeURIComponent(webhookId)}`,
      opts,
    );
    return r.data;
  }

  async update(webhookId: string, patch: WebhookUpdateInput, opts?: RequestOptions): Promise<WebhookSubscription> {
    const r = await this.client.request<ApiResponse<WebhookSubscription>>(
      "PATCH",
      `/v1/webhooks/${encodeURIComponent(webhookId)}`,
      { body: patch, ...opts },
    );
    return r.data;
  }

  async delete(webhookId: string, opts?: RequestOptions): Promise<{ id: string; deleted: boolean }> {
    const r = await this.client.request<ApiResponse<{ id: string; deleted: boolean }>>(
      "DELETE",
      `/v1/webhooks/${encodeURIComponent(webhookId)}`,
      opts,
    );
    return r.data;
  }

  async deliveries(
    webhookId: string,
    params: ListParams & { status?: string } = {},
    opts?: RequestOptions,
  ): Promise<ApiList<WebhookDelivery>> {
    return this.client.request<ApiList<WebhookDelivery>>(
      "GET",
      `/v1/webhooks/${encodeURIComponent(webhookId)}/deliveries`,
      {
        query: { limit: params.limit, starting_after: params.starting_after, status: params.status },
        ...opts,
      },
    );
  }

  /**
   * Trigger a synthetic webhook.test event for endpoint verification.
   * Returns immediately with `delivery_id` — the actual delivery happens within
   * ~1 minute via the dispatcher.
   */
  async test(webhookId: string, opts?: RequestOptions): Promise<{ delivery_id: string; scheduled_at: string; status: string; info: string }> {
    const r = await this.client.request<ApiResponse<{ delivery_id: string; scheduled_at: string; status: string; info: string }>>(
      "POST",
      `/v1/webhooks/${encodeURIComponent(webhookId)}/test`,
      opts,
    );
    return r.data;
  }
}
