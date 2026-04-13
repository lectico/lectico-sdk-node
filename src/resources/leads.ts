import type { HttpClient, RequestOptions } from "../client.js";
import type { Lead, ListLeadsParams, ApiResponse, ApiList } from "../types.js";

export class LeadsResource {
  constructor(private readonly client: HttpClient) {}

  async list(params: ListLeadsParams = {}, opts?: RequestOptions): Promise<ApiList<Lead>> {
    return this.client.request<ApiList<Lead>>("GET", "/v1/leads", {
      query: {
        limit: params.limit,
        starting_after: params.starting_after,
        agent_id: params.agent_id,
        created_after: params.created_after,
        created_before: params.created_before,
      },
      ...opts,
    });
  }

  async get(leadId: string, opts?: RequestOptions): Promise<Lead> {
    const r = await this.client.request<ApiResponse<Lead>>(
      "GET",
      `/v1/leads/${encodeURIComponent(leadId)}`,
      opts,
    );
    return r.data;
  }

  /** GDPR right-to-erasure. Removes lead PII (name + email). Conversations are preserved. */
  async delete(leadId: string, opts?: RequestOptions): Promise<{ id: string; deleted: boolean; lead_anonymized_at: string }> {
    const r = await this.client.request<ApiResponse<{ id: string; deleted: boolean; lead_anonymized_at: string }>>(
      "DELETE",
      `/v1/leads/${encodeURIComponent(leadId)}`,
      opts,
    );
    return r.data;
  }
}
