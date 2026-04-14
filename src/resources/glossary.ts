import type { HttpClient, RequestOptions } from "../client.js";
import type { Glossary, GlossaryPutInput, GlossaryPatchInput, ApiResponse } from "../types.js";

/**
 * REQ-092.6 — Glossary per agent. Injected as `prompt` to the speech-to-text
 * pipeline to improve transcription quality for technical vocabulary (product
 * names, jargon, brand names).
 */
export class GlossaryResource {
  constructor(private readonly client: HttpClient) {}

  async get(agentId: string, opts?: RequestOptions): Promise<Glossary> {
    const r = await this.client.request<ApiResponse<Glossary>>(
      "GET",
      `/v1/agents/${encodeURIComponent(agentId)}/glossary`,
      opts,
    );
    return r.data;
  }

  /** Replace the full term list (max 1000). */
  async put(agentId: string, input: GlossaryPutInput, opts?: RequestOptions): Promise<Glossary> {
    const r = await this.client.request<ApiResponse<Glossary>>(
      "PUT",
      `/v1/agents/${encodeURIComponent(agentId)}/glossary`,
      { body: input, ...opts },
    );
    return r.data;
  }

  /** Add a single term (idempotent — duplicates ignored). */
  async addTerm(agentId: string, term: string, opts?: RequestOptions): Promise<Glossary> {
    const r = await this.client.request<ApiResponse<Glossary>>(
      "POST",
      `/v1/agents/${encodeURIComponent(agentId)}/glossary/terms`,
      { body: { term }, ...opts },
    );
    return r.data;
  }

  async removeTerm(agentId: string, term: string, opts?: RequestOptions): Promise<Glossary> {
    const r = await this.client.request<ApiResponse<Glossary>>(
      "DELETE",
      `/v1/agents/${encodeURIComponent(agentId)}/glossary/terms/${encodeURIComponent(term)}`,
      opts,
    );
    return r.data;
  }

  /** Toggle `auto_process` or change `language`. */
  async patch(agentId: string, input: GlossaryPatchInput, opts?: RequestOptions): Promise<Glossary> {
    const r = await this.client.request<ApiResponse<Glossary>>(
      "PATCH",
      `/v1/agents/${encodeURIComponent(agentId)}/glossary`,
      { body: input, ...opts },
    );
    return r.data;
  }
}
