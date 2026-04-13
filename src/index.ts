// REQ-083 — @lectico/api SDK entry point

import { HttpClient, type LecticoOptions } from "./client.js";
import { AgentsResource } from "./resources/agents.js";
import { KnowledgeResource } from "./resources/knowledge.js";
import { ConversationsResource } from "./resources/conversations.js";
import { LeadsResource } from "./resources/leads.js";
import { WebhooksResource } from "./resources/webhooks.js";
import { FilesResource } from "./resources/files.js";
import { UsageResource } from "./resources/usage.js";

export default class Lectico {
  readonly agents: AgentsResource;
  readonly knowledge: KnowledgeResource;
  readonly conversations: ConversationsResource;
  readonly leads: LeadsResource;
  readonly webhooks: WebhooksResource;
  readonly files: FilesResource;
  readonly usage: UsageResource;

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
  }
}

export { Lectico };
export * from "./errors.js";
export * from "./types.js";
export { constructEvent, WebhookSignatureError } from "./webhooks.js";
export type { StreamEvent } from "./resources/agents.js";
