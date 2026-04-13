import type { HttpClient, RequestOptions } from "../client.js";
import type {
  KnowledgeSource, KnowledgeCreateTextInput, ListParams,
  ApiResponse, ApiList,
} from "../types.js";

export class KnowledgeResource {
  constructor(private readonly client: HttpClient) {}

  async list(agentId: string, params: ListParams = {}, opts?: RequestOptions): Promise<ApiList<KnowledgeSource>> {
    return this.client.request<ApiList<KnowledgeSource>>(
      "GET",
      `/v1/agents/${encodeURIComponent(agentId)}/knowledge`,
      { query: { limit: params.limit, starting_after: params.starting_after }, ...opts },
    );
  }

  async create(
    agentId: string,
    input: KnowledgeCreateTextInput,
    opts?: RequestOptions,
  ): Promise<KnowledgeSource> {
    const r = await this.client.request<ApiResponse<KnowledgeSource>>(
      "POST",
      `/v1/agents/${encodeURIComponent(agentId)}/knowledge`,
      { body: input, ...opts },
    );
    return r.data;
  }

  async delete(agentId: string, sourceId: string, opts?: RequestOptions): Promise<{ id: string; deleted: boolean; chunks_removed: number }> {
    const r = await this.client.request<ApiResponse<{ id: string; deleted: boolean; chunks_removed: number }>>(
      "DELETE",
      `/v1/agents/${encodeURIComponent(agentId)}/knowledge/${encodeURIComponent(sourceId)}`,
      opts,
    );
    return r.data;
  }
}
