// REQ-083 / REQ-092 — @lectico/api SDK entry point

import { HttpClient, type LecticoOptions } from "./client.js";
import { AgentsResource } from "./resources/agents.js";
import { KnowledgeResource } from "./resources/knowledge.js";
import { ConversationsResource } from "./resources/conversations.js";
import { LeadsResource } from "./resources/leads.js";
import { WebhooksResource } from "./resources/webhooks.js";
import { FilesResource } from "./resources/files.js";
import { UsageResource } from "./resources/usage.js";
import { QAResource } from "./resources/qa.js";
import { TrainingResource } from "./resources/training.js";
import { GlossaryResource } from "./resources/glossary.js";

export default class Lectico {
  readonly agents: AgentsResource;
  readonly knowledge: KnowledgeResource;
  readonly conversations: ConversationsResource;
  readonly leads: LeadsResource;
  readonly webhooks: WebhooksResource;
  readonly files: FilesResource;
  readonly usage: UsageResource;
  /** REQ-092.4 — Q&A pairs and categories for soporte/sales agents. */
  readonly qa: QAResource;
  /** REQ-092.5 — Modules, lessons and lesson sources for training agents. */
  readonly training: TrainingResource;
  /** REQ-092.6 — Per-agent transcription glossary. */
  readonly glossary: GlossaryResource;

  private readonly client: HttpClient;

  constructor(opts: LecticoOptions) {
    this.client = new HttpClient(opts);
    this.agents = new AgentsResource(this.client);
    this.knowledge = new KnowledgeResource(this.client);
    this.conversations = new ConversationsResource(this.client);
    this.leads = new LeadsResource(this.client);
    this.webhooks = new WebhooksResource(this.client);
    this.files = new FilesResource(this.client);
    this.usage = new UsageResource(this.client);
    this.qa = new QAResource(this.client);
    this.training = new TrainingResource(this.client);
    this.glossary = new GlossaryResource(this.client);
  }
}

export { Lectico };
export * from "./errors.js";
export * from "./types.js";
export { constructEvent, WebhookSignatureError } from "./webhooks.js";
export type { StreamEvent } from "./resources/agents.js";
