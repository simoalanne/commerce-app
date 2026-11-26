import envConfig from "#src/config.ts";
import logger from "#src/logger.ts";

import {
  type CloudflareR2ObjectStorageConfig,
  CloudflareR2ObjectStorageProvider,
} from "./objectStorage.cloudflareR2.adapter.ts";

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

const unconfiguredObjectStorage: ObjectStorageProvider = {
  getPresignedUrl(): Promise<GetPresignedUrlResult> {
    throw new Error("Object storage is not configured");
  },
  getPublicUrl(): string {
    throw new Error("Object storage is not configured");
  },
  deleteObject(): Promise<void> {
    throw new Error("Object storage is not configured");
  },
  putObject(): Promise<void> {
    throw new Error("Object storage is not configured");
  },
  objectExists(): Promise<boolean> {
    throw new Error("Object storage is not configured");
  },
};

const canEnableR2 =
  envConfig.OBJECT_STORAGE_R2_ACCOUNT_ID &&
  envConfig.OBJECT_STORAGE_R2_ACCESS_KEY_ID &&
  envConfig.OBJECT_STORAGE_R2_BUCKET &&
  envConfig.OBJECT_STORAGE_R2_PUBLIC_BASE_URL &&
  envConfig.OBJECT_STORAGE_R2_SECRET_ACCESS_KEY;

if (!canEnableR2 && envConfig.NODE_ENV === "development") {
  logger.warn(
    "Object storage provider will be disabled and features depending on it will not work",
  );
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

export const ObjectStorage: ObjectStorageProvider = r2Config
  ? new CloudflareR2ObjectStorageProvider(r2Config)
  : unconfiguredObjectStorage;
