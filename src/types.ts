// REQ-083 — Types for the public API v1.0
// Mirrors openapi-v1.yaml schemas. Keep in sync.

export type AgentType = "sales" | "support" | "training";

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  slug: string;
  system_prompt?: string;
  config?: Record<string, unknown>;
  skills?: {
    expert_mode?: { enabled: boolean; model?: string };
    human_escalation?: { enabled: boolean; email?: string };
    conversation_transcript?: { enabled: boolean };
  };
  created_at: string;
  updated_at: string;
}

export interface AgentCreateInput {
  type: AgentType;
  name: string;
  /** Optional URL-safe identifier. Auto-generated from `name` if omitted. */
  slug?: string;
  system_prompt?: string;
  config?: Record<string, unknown>;
  skills?: Agent["skills"];
}

export interface AgentUpdateInput {
  name?: string;
  system_prompt?: string;
  config?: Record<string, unknown>;
  skills?: Agent["skills"];
}

export type KnowledgeStatus = "processing" | "done" | "error" | "review";

export interface KnowledgeSource {
  id: string;
  agent_id: string;
  type: "text" | "url" | "file" | "csv_qa";
  name?: string | null;
  url?: string | null;
  storage_key?: string | null;
  status: KnowledgeStatus;
  /** REQ-092.3: enriched job state for client UX. */
  phase?: string | null;
  progress?: number | null;
  attempts?: number;
  next_attempt_at?: string | null;
  qa_count?: number;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface KnowledgeCreateTextInput {
  type: "text";
  name?: string;
  content: string;
}

export interface KnowledgeCreateUrlInput {
  type: "url";
  url: string;
  name?: string;
}

export interface KnowledgeCreateFileInput {
  type: "file_id";
  file_id: string;
  name?: string;
}

/** REQ-092.2 — bypass LLM, import pre-formulated Q&A from CSV. */
export interface KnowledgeCreateCsvQaInput {
  type: "csv_qa";
  content: string;
  name?: string;
  filename?: string;
}

export type KnowledgeCreateInput =
  | KnowledgeCreateTextInput
  | KnowledgeCreateUrlInput
  | KnowledgeCreateFileInput
  | KnowledgeCreateCsvQaInput;

// REQ-092.4 — Q&A management
export interface QACategory {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  status?: string;
  auto_added?: boolean;
  created_at: string;
}

export interface QA {
  id: string;
  question: string;
  answer: string;
  confirmed: boolean;
  ai_confidence?: number;
  source?: string;
  source_id?: string | null;
  sort_order?: number;
  category: { id: string; key: string; label: string };
  created_at: string;
  updated_at: string;
}

export interface QAUpdateInput {
  question?: string;
  answer?: string;
  confirmed?: boolean;
  category_id?: string;
  sort_order?: number;
}

export interface QACategoryCreateInput {
  label: string;
  key?: string;
  sort_order?: number;
}

export interface QACategoryUpdateInput {
  label?: string;
  sort_order?: number;
}

export interface QARegenerateResult {
  job_id: string;
  agent_id: string;
  sources_count: number;
  status: "processing";
  started_at: string;
}

// REQ-092.5 — Training agents
export interface Module {
  module_number: number;
  title: string;
  description?: string | null;
  created_at: string;
}

export interface ModuleCreateInput {
  title: string;
  description?: string;
  module_number?: number;
}

export interface ModuleUpdateInput {
  title?: string;
  description?: string;
}

export interface Lesson {
  module_number: number;
  lesson_number: number;
  title: string;
  created_at: string;
}

export interface LessonCreateInput {
  title: string;
  lesson_number?: number;
}

export interface LessonUpdateInput {
  title?: string;
}

export interface LessonSource {
  id: string;
  module_number: number;
  lesson_number: number;
  filename: string;
  file_type: "text" | "pdf" | "image" | "audio" | "video";
  mime_type: string;
  storage_key: string;
  source_type: string;
  is_primary: boolean;
  status: KnowledgeStatus;
  error_message?: string | null;
  chunk_count?: number;
  audio_duration_seconds?: number | null;
  created_at: string;
  updated_at: string;
}

export interface LessonSourceCreateInput {
  file_id: string;
}

// REQ-092.6 — Glossary
export interface Glossary {
  terms: string[];
  language: string;
  auto_process: boolean;
  common_errors?: Record<string, string>;
  updated_at: string | null;
}

export interface GlossaryPutInput {
  terms: string[];
  language?: string;
  auto_process?: boolean;
  common_errors?: Record<string, string>;
}

export interface GlossaryPatchInput {
  language?: string;
  auto_process?: boolean;
}

export interface Conversation {
  id: string;
  agent_id: string;
  message_count: number;
  has_lead: boolean;
  has_escalation: boolean;
  started_at: string;
  last_message_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  response_type?: "normal" | "expert_mode" | "escalation";
  sources_count?: number;
  created_at: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: ChatMessage[];
  has_more_messages: boolean;
}

export interface MessageInput {
  message: string;
  conversation_id?: string;
  visitor_name?: string;
  lesson_context?: {
    moduleNumber?: number;
    lessonNumber?: number;
    lessonTitle?: string;
  };
  /** When true (default), receive Server-Sent Events stream. When false, receive a single JSON response. */
  stream?: boolean;
}

export interface Lead {
  id: string;
  agent_id: string;
  conversation_id: string;
  visitor_name: string;
  visitor_email: string;
  source: string;
  created_at: string;
}

export type WebhookEventType =
  | "agent.created" | "agent.updated" | "agent.deleted"
  | "agent.knowledge.search.no_results"
  | "conversation.started" | "conversation.message.sent" | "conversation.ended"
  | "knowledge.source.added" | "knowledge.source.processing"
  | "knowledge.source.indexed" | "knowledge.source.failed"
  | "lead.captured"
  | "crawl.started" | "crawl.progress" | "crawl.completed" | "crawl.failed"
  | "transcription.started" | "transcription.completed" | "transcription.failed"
  | "usage.threshold_reached"
  | "subscription.paused" | "subscription.resumed"
  | "webhook.test"
  // REQ-092 events
  | "qa.regenerated"
  | "course.lesson.source.indexed" | "course.lesson.source.failed";

export interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEventType[];
  description?: string;
  is_active: boolean;
  last_delivery_at?: string | null;
  last_delivery_status?: string | null;
  created_at: string;
}

export interface WebhookSubscriptionWithSecret extends WebhookSubscription {
  /** HMAC secret. Returned ONLY at creation. Save it — Lectico cannot retrieve it again. */
  secret: string;
}

export interface WebhookCreateInput {
  url: string;
  events: WebhookEventType[];
  description?: string;
}

export interface WebhookUpdateInput {
  url?: string;
  events?: WebhookEventType[];
  description?: string;
  is_active?: boolean;
}

export interface WebhookDelivery {
  id: string;
  event_type: WebhookEventType;
  status: "pending" | "in_flight" | "delivered" | "failed_retrying" | "failed_dead";
  attempt_count: number;
  last_attempted_at?: string | null;
  delivered_at?: string | null;
  last_response_status?: number | null;
  last_error?: string | null;
  created_at: string;
}

export interface FileMetadata {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: "pending" | "uploaded" | "deleted";
  download_url?: string | null;
  created_at: string;
  uploaded_at?: string | null;
}

export interface FileWithUploadUrl extends FileMetadata {
  upload_url: string;
  upload_method: "PUT";
  upload_headers: Record<string, string>;
  expires_at: string;
}

export interface FileCreateInput {
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface UsageSummary {
  plan: {
    id: string;
    name: string;
    limits: Record<string, unknown>;
    features: Record<string, unknown>;
  };
  usage: {
    messages_count: number;
    expert_count: number;
    escalation_count: number;
    credits_used?: number;
    credits_available?: number;
    cap_status?: string;
  };
  subscription: {
    status: "active" | "paused" | "canceled" | "unknown";
    current_period_end?: string;
  };
}

// ---------------------------------------------------------------------------
// API response envelopes
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  data: T;
  meta: { request_id: string };
}

export interface ApiList<T> {
  data: T[];
  meta: {
    request_id: string;
    pagination: { has_more: boolean; next_cursor: string | null };
  };
}

export interface ApiErrorBody {
  error: {
    type:
      | "invalid_request" | "authentication_error" | "payment_required"
      | "permission_denied" | "not_found" | "conflict" | "validation_error"
      | "rate_limit_exceeded" | "internal_error" | "service_unavailable";
    code: string;
    message: string;
    param?: string;
    doc_url?: string;
  };
  meta?: { request_id?: string };
}

// ---------------------------------------------------------------------------
// Pagination params (used by list calls)
// ---------------------------------------------------------------------------

export interface ListParams {
  /** Items per page (1-100, default 20) */
  limit?: number;
  /** Cursor from the previous response's `meta.pagination.next_cursor` */
  starting_after?: string;
}

export interface ListLeadsParams extends ListParams {
  agent_id?: string;
  created_after?: string;  // ISO 8601
  created_before?: string;
}

export interface ListConversationsParams extends ListLeadsParams {}

export interface ListAgentsParams extends ListParams {
  type?: AgentType;
}

// ---------------------------------------------------------------------------
// Webhook event payloads (received by your webhook endpoint)
// ---------------------------------------------------------------------------

export interface WebhookEventBody<TData = unknown> {
  id: string;             // evt_*
  type: WebhookEventType;
  created: number;        // unix timestamp
  data: TData;
  workspace_id: string;
  api_version: "v1";
}
