import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

import type {
  GetPresignedUrlInput,
  GetPresignedUrlResult,
  ObjectStorageProvider,
  PutObjectInput,
} from "./objectStorage.provider.ts";

const uploadUrlExpiresInSeconds = 15 * 60;

// Matches the "/storage/*" route key below.
const filesystemStoragePathPrefix = "/storage/";

type ObjectMeta = { contentType: string; cacheControl?: string };

/**
 * Local development storage: objects are files under `rootDir`, served and
 * uploaded through the backend's own `/storage/*` routes. Upload URLs are
 * signed like R2's presigned URLs, with a per-process secret, so an upload
 * URL stops working when the server restarts.
 */
export class FilesystemObjectStorageProvider implements ObjectStorageProvider {
  private readonly rootDir: string;
  private readonly baseUrl: string;
  private readonly secret = randomBytes(32);

  constructor({ rootDir, publicBaseUrl }: { rootDir: string; publicBaseUrl: string }) {
    this.rootDir = resolve(rootDir);
    this.baseUrl = new URL(filesystemStoragePathPrefix, publicBaseUrl).toString();
  }

  private pathFor(objectKey: string) {
    const path = resolve(this.rootDir, objectKey);
    if (!path.startsWith(this.rootDir + sep)) {
      throw new Error(`Invalid object key: ${objectKey}`);
    }
    return path;
  }

  private sign(objectKey: string, contentType: string, contentLength: number, expires: number) {
    return createHmac("sha256", this.secret)
      .update(`${objectKey}\n${contentType}\n${contentLength}\n${expires}`)
      .digest("hex");
  }

  async getPresignedUrl({
    contentType,
    contentLength,
  }: GetPresignedUrlInput): Promise<GetPresignedUrlResult> {
    const objectKey = `images/${randomUUID()}`;
    const expires = Math.floor(Date.now() / 1000) + uploadUrlExpiresInSeconds;
    const uploadUrl = new URL(objectKey, this.baseUrl);
    uploadUrl.searchParams.set("length", String(contentLength));
    uploadUrl.searchParams.set("expires", String(expires));
    uploadUrl.searchParams.set(
      "signature",
      this.sign(objectKey, contentType, contentLength, expires),
    );

    return {
      objectKey,
      uploadUrl: uploadUrl.toString(),
      publicUrl: this.getPublicUrl(objectKey),
      uploadMethod: "PUT",
      uploadHeaders: { "Content-Type": contentType },
      expiresAt: new Date(expires * 1000).toISOString(),
    };
  }

  getPublicUrl(objectKey: string): string {
    return new URL(objectKey, this.baseUrl).toString();
  }

  async putObject({ objectKey, body, contentType, cacheControl }: PutObjectInput): Promise<void> {
    const path = this.pathFor(objectKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    await writeFile(`${path}.meta.json`, JSON.stringify({ contentType, cacheControl }));
  }

  async objectExists(objectKey: string): Promise<boolean> {
    return stat(this.pathFor(objectKey)).then(
      () => true,
      () => false,
    );
  }

  async deleteObject(objectKey: string): Promise<void> {
    const path = this.pathFor(objectKey);
    await rm(path, { force: true });
    await rm(`${path}.meta.json`, { force: true });
  }

  /** Bun routes serving and accepting objects, mounted beside the API. */
  routes(): Record<
    string,
    Record<"OPTIONS" | "GET" | "PUT", (request: Request) => Promise<Response>>
  > {
    const corsHeaders = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,PUT",
      "access-control-allow-headers": "content-type",
    };

    const objectKeyOf = (request: Request) =>
      decodeURIComponent(new URL(request.url).pathname.slice(filesystemStoragePathPrefix.length));

    return {
      "/storage/*": {
        OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

        GET: async (request: Request) => {
          let path: string;
          try {
            path = this.pathFor(objectKeyOf(request));
          } catch {
            return new Response("Not Found", { status: 404 });
          }
          if (!(await this.objectExists(objectKeyOf(request)))) {
            return new Response("Not Found", { status: 404 });
          }
          const meta = JSON.parse(await readFile(`${path}.meta.json`, "utf8")) as ObjectMeta;
          return new Response(await readFile(path), {
            headers: {
              ...corsHeaders,
              "content-type": meta.contentType,
              ...(meta.cacheControl ? { "cache-control": meta.cacheControl } : {}),
            },
          });
        },

        PUT: async (request: Request) => {
          const url = new URL(request.url);
          const objectKey = objectKeyOf(request);
          const contentType = request.headers.get("content-type") ?? "";
          const contentLength = Number(url.searchParams.get("length"));
          const expires = Number(url.searchParams.get("expires"));
          const signature = Buffer.from(url.searchParams.get("signature") ?? "", "hex");
          const expected = Buffer.from(
            this.sign(objectKey, contentType, contentLength, expires),
            "hex",
          );

          if (
            signature.length !== expected.length ||
            !timingSafeEqual(signature, expected) ||
            expires < Date.now() / 1000
          ) {
            return new Response("Forbidden", { status: 403, headers: corsHeaders });
          }

          const body = new Uint8Array(await request.arrayBuffer());
          if (body.byteLength !== contentLength) {
            return new Response("Content length mismatch", { status: 400, headers: corsHeaders });
          }

          await this.putObject({ objectKey, body, contentType });
          return new Response(null, { status: 200, headers: corsHeaders });
        },
      },
    };
  }
}
