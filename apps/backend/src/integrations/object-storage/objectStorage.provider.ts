import { fileURLToPath } from "node:url";

import envConfig from "#src/config.ts";
import logger from "#src/logger.ts";

import {
  type CloudflareR2ObjectStorageConfig,
  CloudflareR2ObjectStorageProvider,
} from "./objectStorage.cloudflareR2.adapter.ts";
import { FilesystemObjectStorageProvider } from "./objectStorage.filesystem.adapter.ts";

export type GetPresignedUrlInput = {
  contentType: string;
  contentLength: number;
};

export type GetPresignedUrlResult = {
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
  uploadMethod: "PUT";
  uploadHeaders: Record<string, string>;
  expiresAt: string;
};

export type PutObjectInput = {
  objectKey: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
};

export interface ObjectStorageProvider {
  getPresignedUrl(input: GetPresignedUrlInput): Promise<GetPresignedUrlResult>;
  getPublicUrl(objectKey: string): string;
  deleteObject(objectKey: string): Promise<void>;
  putObject(input: PutObjectInput): Promise<void>;
  objectExists(objectKey: string): Promise<boolean>;
}

const r2Config: CloudflareR2ObjectStorageConfig | null =
  envConfig.OBJECT_STORAGE_R2_ACCOUNT_ID &&
  envConfig.OBJECT_STORAGE_R2_ACCESS_KEY_ID &&
  envConfig.OBJECT_STORAGE_R2_BUCKET &&
  envConfig.OBJECT_STORAGE_R2_PUBLIC_BASE_URL &&
  envConfig.OBJECT_STORAGE_R2_SECRET_ACCESS_KEY
    ? {
        accountId: envConfig.OBJECT_STORAGE_R2_ACCOUNT_ID,
        accessKeyId: envConfig.OBJECT_STORAGE_R2_ACCESS_KEY_ID,
        bucket: envConfig.OBJECT_STORAGE_R2_BUCKET,
        publicBaseUrl: envConfig.OBJECT_STORAGE_R2_PUBLIC_BASE_URL,
        secretAccessKey: envConfig.OBJECT_STORAGE_R2_SECRET_ACCESS_KEY,
      }
    : null;

// Deployments require R2 (see config.ts), so the filesystem is local development only.
export const ObjectStorage: ObjectStorageProvider = r2Config
  ? new CloudflareR2ObjectStorageProvider(r2Config)
  : new FilesystemObjectStorageProvider({
      rootDir: fileURLToPath(new URL("../../../.local/storage", import.meta.url)),
      publicBaseUrl: envConfig.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
    });

export const filesystemObjectStorage =
  ObjectStorage instanceof FilesystemObjectStorageProvider ? ObjectStorage : null;

if (filesystemObjectStorage && envConfig.NODE_ENV === "development") {
  logger.info("R2 is not configured; storing objects under apps/backend/.local/storage");
}
