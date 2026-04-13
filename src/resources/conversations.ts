import type { HttpClient, RequestOptions } from "../client.js";
import type {
  Conversation, ConversationWithMessages, ListConversationsParams,
  ApiResponse, ApiList,
} from "../types.js";

export class ConversationsResource {
  constructor(private readonly client: HttpClient) {}

  async list(params: ListConversationsParams = {}, opts?: RequestOptions): Promise<ApiList<Conversation>> {
    return this.client.request<ApiList<Conversation>>("GET", "/v1/conversations", {
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

  async get(conversationId: string, opts?: RequestOptions): Promise<ConversationWithMessages> {
    const r = await this.client.request<ApiResponse<ConversationWithMessages>>(
      "GET",
      `/v1/conversations/${encodeURIComponent(conversationId)}`,
      opts,
    );
    return r.data;
  }
}
