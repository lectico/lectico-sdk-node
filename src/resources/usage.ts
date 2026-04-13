import type { HttpClient, RequestOptions } from "../client.js";
import type { UsageSummary, ApiResponse } from "../types.js";

export class UsageResource {
  constructor(private readonly client: HttpClient) {}

  /** Get current usage + plan + subscription summary */
  async summary(opts?: RequestOptions): Promise<UsageSummary> {
    const r = await this.client.request<ApiResponse<UsageSummary>>("GET", "/v1/usage", opts);
    return r.data;
  }
}
