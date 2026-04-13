import type { HttpClient, RequestOptions } from "../client.js";
import type {
  QA, QACategory, QAUpdateInput, QACategoryCreateInput, QACategoryUpdateInput,
  QARegenerateResult, ListParams, ApiResponse, ApiList,
} from "../types.js";

/**
 * REQ-092.4 — Q&A management for soporte/sales agents. Q&A pairs are
 * generated automatically by the source-processing pipeline. This resource
 * lets you read, edit, regenerate them and manage their categories.
 */
export class QAResource {
  constructor(private readonly client: HttpClient) {}

  // ------------------------------------------------------------------
  // Q&A pairs
  // ------------------------------------------------------------------

  async list(agentId: string, params: ListParams = {}, opts?: RequestOptions): Promise<ApiList<QA>> {
    return this.client.request<ApiList<QA>>(
      "GET",
      `/v1/agents/${encodeURIComponent(agentId)}/qa`,
      { query: { limit: params.limit, starting_after: params.starting_after }, ...opts },
    );
  }

  async get(agentId: string, qaId: string, opts?: RequestOptions): Promise<QA> {
    const r = await this.client.request<ApiResponse<QA>>(
      "GET",
      `/v1/agents/${encodeURIComponent(agentId)}/qa/${encodeURIComponent(qaId)}`,
      opts,
    );
    return r.data;
  }

  async update(agentId: string, qaId: string, input: QAUpdateInput, opts?: RequestOptions): Promise<QA> {
    const r = await this.client.request<ApiResponse<QA>>(
      "PATCH",
      `/v1/agents/${encodeURIComponent(agentId)}/qa/${encodeURIComponent(qaId)}`,
      { body: input, ...opts },
    );
    return r.data;
  }

  async delete(agentId: string, qaId: string, opts?: RequestOptions): Promise<{ id: string; deleted: boolean; deleted_at: string }> {
    const r = await this.client.request<ApiResponse<{ id: string; deleted: boolean; deleted_at: string }>>(
      "DELETE",
      `/v1/agents/${encodeURIComponent(agentId)}/qa/${encodeURIComponent(qaId)}`,
      opts,
    );
    return r.data;
  }

  /**
   * Trigger an async regeneration of all Q&A from the agent's sources.
   * Returns a `job_id`; subscribe to the `qa.regenerated` webhook event
   * for completion, or list `/qa` periodically.
   */
  async regenerate(agentId: string, opts?: RequestOptions): Promise<QARegenerateResult> {
    const r = await this.client.request<ApiResponse<QARegenerateResult>>(
      "POST",
      `/v1/agents/${encodeURIComponent(agentId)}/qa/regenerate`,
      { body: {}, ...opts },
    );
    return r.data;
  }

  // ------------------------------------------------------------------
  // Categories
  // ------------------------------------------------------------------

  async listCategories(agentId: string, opts?: RequestOptions): Promise<QACategory[]> {
    const r = await this.client.request<ApiResponse<QACategory[]>>(
      "GET",
      `/v1/agents/${encodeURIComponent(agentId)}/categories`,
      opts,
    );
    return r.data;
  }

  async createCategory(agentId: string, input: QACategoryCreateInput, opts?: RequestOptions): Promise<QACategory> {
    const r = await this.client.request<ApiResponse<QACategory>>(
      "POST",
      `/v1/agents/${encodeURIComponent(agentId)}/categories`,
      { body: input, ...opts },
    );
    return r.data;
  }

  async updateCategory(agentId: string, categoryId: string, input: QACategoryUpdateInput, opts?: RequestOptions): Promise<QACategory> {
    const r = await this.client.request<ApiResponse<QACategory>>(
      "PATCH",
      `/v1/agents/${encodeURIComponent(agentId)}/categories/${encodeURIComponent(categoryId)}`,
      { body: input, ...opts },
    );
    return r.data;
  }

  async deleteCategory(agentId: string, categoryId: string, opts?: RequestOptions): Promise<{ id: string; deleted: boolean; deleted_at: string; moved_to: string }> {
    const r = await this.client.request<ApiResponse<{ id: string; deleted: boolean; deleted_at: string; moved_to: string }>>(
      "DELETE",
      `/v1/agents/${encodeURIComponent(agentId)}/categories/${encodeURIComponent(categoryId)}`,
      opts,
    );
    return r.data;
  }
}
