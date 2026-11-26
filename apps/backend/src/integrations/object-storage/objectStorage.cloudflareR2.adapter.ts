import { randomUUID } from "node:crypto";

import {
  S3Client as AwsS3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import logger from "#src/logger.ts";

import type {
  GetPresignedUrlInput,
  GetPresignedUrlResult,
  ObjectStorageProvider,
  PutObjectInput,
} from "./objectStorage.provider.ts";

const uploadUrlExpiresInSeconds = 15 * 60;

export type CloudflareR2ObjectStorageConfig = {
  accountId: string;
  accessKeyId: string;
  bucket: string;
  publicBaseUrl: string;
  secretAccessKey: string;
};

const ensureTrailingSlash = (value: string) => (value.endsWith("/") ? value : `${value}/`);

const createObjectKey = () => `images/${randomUUID()}`;

export class CloudflareR2ObjectStorageProvider implements ObjectStorageProvider {
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly client: S3Client;

  constructor({
    accountId,
    accessKeyId,
    bucket,
    publicBaseUrl,
    secretAccessKey,
  }: CloudflareR2ObjectStorageConfig) {
    this.bucket = bucket;
    this.publicBaseUrl = publicBaseUrl;
    this.client = new AwsS3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async getPresignedUrl({
    contentLength,
    contentType,
  }: GetPresignedUrlInput): Promise<GetPresignedUrlResult> {
    const objectKey = createObjectKey();
    const uploadCommand = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    const uploadUrl = await getSignedUrl(this.client, uploadCommand, {
      expiresIn: uploadUrlExpiresInSeconds,
    });

    return {
      objectKey,
      uploadUrl,
      publicUrl: new URL(objectKey, ensureTrailingSlash(this.publicBaseUrl)).toString(),
      uploadMethod: "PUT",
      uploadHeaders: {
        "Content-Type": contentType,
      },
      expiresAt: new Date(Date.now() + uploadUrlExpiresInSeconds * 1000).toISOString(),
    };
  }

  getPublicUrl(objectKey: string): string {
    return new URL(objectKey, ensureTrailingSlash(this.publicBaseUrl)).toString();
  }

  async putObject({ objectKey, body, contentType, cacheControl }: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      }),
    );
  }

  async objectExists(objectKey: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      return true;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode;
      if (status === 404 || (error as Error)?.name === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      );
    } catch (error) {
      logger.warn("Failed to delete R2 object", {
        objectKey,
        error,
      });
      throw new Error("Failed to delete object from storage");
    }
  }
}
