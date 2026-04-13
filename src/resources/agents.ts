import type { HttpClient, RequestOptions } from "../client.js";
import type {
  Agent, AgentCreateInput, AgentUpdateInput, ListAgentsParams,
  ApiResponse, ApiList, MessageInput, ChatMessage,
} from "../types.js";

export class AgentsResource {
  /**
   * Send a message to an agent. Initialized in the constructor.
   * Default streaming returns AsyncIterable; pass `stream: false` for JSON.
   */
  readonly messages: AgentMessagesSubResource;

  constructor(private readonly client: HttpClient) {
    this.messages = new AgentMessagesSubResource(client);
  }

  async create(input: AgentCreateInput, opts?: RequestOptions): Promise<Agent> {
    const r = await this.client.request<ApiResponse<Agent>>("POST", "/v1/agents", { body: input, ...opts });
    return r.data;
  }

  async list(params: ListAgentsParams = {}, opts?: RequestOptions): Promise<ApiList<Agent>> {
    return this.client.request<ApiList<Agent>>("GET", "/v1/agents", {
      query: { limit: params.limit, starting_after: params.starting_after, type: params.type },
      ...opts,
    });
  }

  async get(agentId: string, opts?: RequestOptions): Promise<Agent> {
    const r = await this.client.request<ApiResponse<Agent>>("GET", `/v1/agents/${encodeURIComponent(agentId)}`, opts);
    return r.data;
  }

  async update(agentId: string, patch: AgentUpdateInput, opts?: RequestOptions): Promise<Agent> {
    const r = await this.client.request<ApiResponse<Agent>>(
      "PATCH",
      `/v1/agents/${encodeURIComponent(agentId)}`,
      { body: patch, ...opts },
    );
    return r.data;
  }

  async delete(agentId: string, opts?: RequestOptions): Promise<{ id: string; deleted: boolean; deleted_at: string }> {
    const r = await this.client.request<ApiResponse<{ id: string; deleted: boolean; deleted_at: string }>>(
      "DELETE",
      `/v1/agents/${encodeURIComponent(agentId)}`,
      opts,
    );
    return r.data;
  }

  /** Async iterator over all agents (auto-paginates). */
  async *iterAll(params: Omit<ListAgentsParams, "starting_after"> = {}): AsyncGenerator<Agent, void, void> {
    let cursor: string | undefined;
    while (true) {
      const page = await this.list({ ...params, starting_after: cursor });
      for (const agent of page.data) yield agent;
      if (!page.meta.pagination.has_more || !page.meta.pagination.next_cursor) break;
      cursor = page.meta.pagination.next_cursor;
    }
  }

}

export interface StreamEvent {
  type: "token" | "sources" | "chunks" | "done" | "expert_thinking" | "expert_mode" | "escalation_offer" | "support_contact" | "error" | string;
  content?: string;
  sources?: unknown[];
  chunks?: unknown[];
  conversationId?: string;
  [k: string]: unknown;
}

export class AgentMessagesSubResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Send a message and receive a stream of SSE events.
   * Default `stream: true`. Iterate the result like:
   *
   *   for await (const ev of stream) {
   *     if (ev.type === "token") process.stdout.write(ev.content ?? "");
   *   }
   */
  async create(
    agentId: string,
    input: MessageInput,
    opts?: RequestOptions,
  ): Promise<AsyncIterable<StreamEvent> | ChatMessage> {
    const stream = input.stream ?? true;
    const path = `/v1/agents/${encodeURIComponent(agentId)}/messages`;

    if (!stream) {
      // Non-streaming JSON response
      const r = await this.client.request<ApiResponse<ChatMessage>>("POST", path, {
        body: { ...input, stream: false },
        ...opts,
      });
      return r.data;
    }

    const res = await this.client.stream(path, input, opts);
    if (!res.body) throw new Error("Lectico API returned no response body for streaming chat");
    return parseSSEStream(res.body);
  }
}

/**
 * Parse an SSE stream into an async iterable of events.
 * Handles the standard `data: {...}\n\n` framing.
 */
export async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (!chunk.startsWith("data: ")) continue;
        const jsonStr = chunk.slice(6).trim();
        if (!jsonStr) continue;
        try {
          yield JSON.parse(jsonStr) as StreamEvent;
        } catch {
          // Skip malformed events
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
