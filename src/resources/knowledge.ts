import type { HttpClient, RequestOptions } from "../client.js";
import type {
  KnowledgeSource, KnowledgeCreateInput, ListParams,
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

  async get(agentId: string, sourceId: string, opts?: RequestOptions): Promise<KnowledgeSource> {
    const r = await this.client.request<ApiResponse<KnowledgeSource>>(
      "GET",
      `/v1/agents/${encodeURIComponent(agentId)}/knowledge/${encodeURIComponent(sourceId)}`,
      opts,
    );
    return r.data;
  }

  /**
   * Create a knowledge source. Supports `text`, `url`, `file_id`, `csv_qa`.
   * URL and file ingestion are async — poll with {@link get} or {@link waitUntilDone},
   * or subscribe to `knowledge.source.indexed` / `knowledge.source.failed` webhooks.
   */
  async create(
    agentId: string,
    input: KnowledgeCreateInput,
    opts?: RequestOptions,
  ): Promise<KnowledgeSource> {
    const r = await this.client.request<ApiResponse<KnowledgeSource>>(
      "POST",
      `/v1/agents/${encodeURIComponent(agentId)}/knowledge`,
      { body: input, ...opts },
    );
    return r.data;
  }

  async delete(agentId: string, sourceId: string, opts?: RequestOptions):
    Promise<{ id: string; deleted: boolean; chunks_removed: number }> {
    const r = await this.client.request<ApiResponse<{ id: string; deleted: boolean; chunks_removed: number }>>(
      "DELETE",
      `/v1/agents/${encodeURIComponent(agentId)}/knowledge/${encodeURIComponent(sourceId)}`,
      opts,
    );
    return r.data;
  }

  /**
   * Polls {@link get} every `intervalMs` until status is `done` or `error`,
   * or until `timeoutMs` elapses. Default 3s interval, 10 min timeout.
   */
  async waitUntilDone(
    agentId: string,
    sourceId: string,
    options: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<KnowledgeSource> {
    const interval = options.intervalMs ?? 3000;
    const deadline = Date.now() + (options.timeoutMs ?? 10 * 60 * 1000);
    while (true) {
      if (options.signal?.aborted) throw new Error("Aborted");
      const src = await this.get(agentId, sourceId, { signal: options.signal });
      if (src.status === "done" || src.status === "error") return src;
      if (Date.now() > deadline) {
        throw new Error(`waitUntilDone timed out after ${options.timeoutMs ?? 600000}ms (status=${src.status})`);
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  }
}
