import type { HttpClient, RequestOptions } from "../client.js";
import type {
  FileMetadata, FileWithUploadUrl, FileCreateInput,
  ApiResponse,
} from "../types.js";

export class FilesResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Create a file metadata + presigned upload URL.
   * After receiving the response, PUT the file binary to `upload_url`.
   */
  async create(input: FileCreateInput, opts?: RequestOptions): Promise<FileWithUploadUrl> {
    const r = await this.client.request<ApiResponse<FileWithUploadUrl>>(
      "POST",
      "/v1/files",
      { body: input, ...opts },
    );
    return r.data;
  }

  async get(fileId: string, opts?: RequestOptions): Promise<FileMetadata> {
    const r = await this.client.request<ApiResponse<FileMetadata>>(
      "GET",
      `/v1/files/${encodeURIComponent(fileId)}`,
      opts,
    );
    return r.data;
  }

  async delete(fileId: string, opts?: RequestOptions): Promise<{ id: string; deleted: boolean }> {
    const r = await this.client.request<ApiResponse<{ id: string; deleted: boolean }>>(
      "DELETE",
      `/v1/files/${encodeURIComponent(fileId)}`,
      opts,
    );
    return r.data;
  }
}
