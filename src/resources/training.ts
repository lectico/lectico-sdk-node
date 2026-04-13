import type { HttpClient, RequestOptions } from "../client.js";
import type {
  Module, ModuleCreateInput, ModuleUpdateInput,
  Lesson, LessonCreateInput, LessonUpdateInput,
  LessonSource, LessonSourceCreateInput,
  ApiResponse,
} from "../types.js";

/**
 * REQ-092.5 — Training agents API. Only valid for agents with `type:"training"`.
 * Calling these methods on `support` or `sales` agents raises `wrong_agent_type`.
 *
 * Hierarchy: agent → modules → lessons → sources (file uploads).
 */
export class TrainingResource {
  constructor(private readonly client: HttpClient) {}

  // ------------------------------------------------------------------
  // Modules
  // ------------------------------------------------------------------

  async listModules(agentId: string, opts?: RequestOptions): Promise<Module[]> {
    const r = await this.client.request<ApiResponse<Module[]>>(
      "GET",
      `/v1/agents/${encodeURIComponent(agentId)}/modules`,
      opts,
    );
    return r.data;
  }

  async createModule(agentId: string, input: ModuleCreateInput, opts?: RequestOptions): Promise<Module> {
    const r = await this.client.request<ApiResponse<Module>>(
      "POST",
      `/v1/agents/${encodeURIComponent(agentId)}/modules`,
      { body: input, ...opts },
    );
    return r.data;
  }

  async updateModule(agentId: string, moduleNumber: number, input: ModuleUpdateInput, opts?: RequestOptions): Promise<Module> {
    const r = await this.client.request<ApiResponse<Module>>(
      "PATCH",
      `/v1/agents/${encodeURIComponent(agentId)}/modules/${moduleNumber}`,
      { body: input, ...opts },
    );
    return r.data;
  }

  async deleteModule(agentId: string, moduleNumber: number, opts?: RequestOptions):
    Promise<{ module_number: number; deleted: boolean; lessons_deleted: number; sources_deleted: number; chunks_deleted: number }> {
    const r = await this.client.request<ApiResponse<any>>(
      "DELETE",
      `/v1/agents/${encodeURIComponent(agentId)}/modules/${moduleNumber}`,
      opts,
    );
    return r.data;
  }

  // ------------------------------------------------------------------
  // Lessons
  // ------------------------------------------------------------------

  async listLessons(agentId: string, moduleNumber: number, opts?: RequestOptions): Promise<Lesson[]> {
    const r = await this.client.request<ApiResponse<Lesson[]>>(
      "GET",
      `/v1/agents/${encodeURIComponent(agentId)}/modules/${moduleNumber}/lessons`,
      opts,
    );
    return r.data;
  }

  async createLesson(agentId: string, moduleNumber: number, input: LessonCreateInput, opts?: RequestOptions): Promise<Lesson> {
    const r = await this.client.request<ApiResponse<Lesson>>(
      "POST",
      `/v1/agents/${encodeURIComponent(agentId)}/modules/${moduleNumber}/lessons`,
      { body: input, ...opts },
    );
    return r.data;
  }

  async updateLesson(agentId: string, moduleNumber: number, lessonNumber: number, input: LessonUpdateInput, opts?: RequestOptions): Promise<Lesson> {
    const r = await this.client.request<ApiResponse<Lesson>>(
      "PATCH",
      `/v1/agents/${encodeURIComponent(agentId)}/modules/${moduleNumber}/lessons/${lessonNumber}`,
      { body: input, ...opts },
    );
    return r.data;
  }

  async deleteLesson(agentId: string, moduleNumber: number, lessonNumber: number, opts?: RequestOptions):
    Promise<{ module_number: number; lesson_number: number; deleted: boolean; sources_deleted: number; chunks_deleted: number }> {
    const r = await this.client.request<ApiResponse<any>>(
      "DELETE",
      `/v1/agents/${encodeURIComponent(agentId)}/modules/${moduleNumber}/lessons/${lessonNumber}`,
      opts,
    );
    return r.data;
  }

  // ------------------------------------------------------------------
  // Lesson sources (file_id-based, async pipeline)
  // ------------------------------------------------------------------

  async listSources(agentId: string, moduleNumber: number, lessonNumber: number, opts?: RequestOptions): Promise<LessonSource[]> {
    const r = await this.client.request<ApiResponse<LessonSource[]>>(
      "GET",
      `/v1/agents/${encodeURIComponent(agentId)}/modules/${moduleNumber}/lessons/${lessonNumber}/sources`,
      opts,
    );
    return r.data;
  }

  async createSource(agentId: string, moduleNumber: number, lessonNumber: number, input: LessonSourceCreateInput, opts?: RequestOptions): Promise<LessonSource> {
    const r = await this.client.request<ApiResponse<LessonSource>>(
      "POST",
      `/v1/agents/${encodeURIComponent(agentId)}/modules/${moduleNumber}/lessons/${lessonNumber}/sources`,
      { body: input, ...opts },
    );
    return r.data;
  }

  async getSource(agentId: string, moduleNumber: number, lessonNumber: number, sourceId: string, opts?: RequestOptions): Promise<LessonSource> {
    const r = await this.client.request<ApiResponse<LessonSource>>(
      "GET",
      `/v1/agents/${encodeURIComponent(agentId)}/modules/${moduleNumber}/lessons/${lessonNumber}/sources/${encodeURIComponent(sourceId)}`,
      opts,
    );
    return r.data;
  }

  async deleteSource(agentId: string, moduleNumber: number, lessonNumber: number, sourceId: string, opts?: RequestOptions):
    Promise<{ id: string; deleted: boolean; chunks_deleted: number; deleted_at: string }> {
    const r = await this.client.request<ApiResponse<any>>(
      "DELETE",
      `/v1/agents/${encodeURIComponent(agentId)}/modules/${moduleNumber}/lessons/${lessonNumber}/sources/${encodeURIComponent(sourceId)}`,
      opts,
    );
    return r.data;
  }

  /** Polls {@link getSource} until status is `done`, `error` or `review`. */
  async waitUntilDone(
    agentId: string, moduleNumber: number, lessonNumber: number, sourceId: string,
    options: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<LessonSource> {
    const interval = options.intervalMs ?? 3000;
    const deadline = Date.now() + (options.timeoutMs ?? 10 * 60 * 1000);
    while (true) {
      if (options.signal?.aborted) throw new Error("Aborted");
      const src = await this.getSource(agentId, moduleNumber, lessonNumber, sourceId, { signal: options.signal });
      if (src.status === "done" || src.status === "error" || src.status === "review") return src;
      if (Date.now() > deadline) {
        throw new Error(`waitUntilDone timed out after ${options.timeoutMs ?? 600000}ms (status=${src.status})`);
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  }
}
