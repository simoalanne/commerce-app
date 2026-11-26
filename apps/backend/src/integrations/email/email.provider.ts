import envConfig from "#src/config.ts";
import logger from "#src/logger.ts";

import { ResendEmailAdapter } from "./resend.adapter.ts";

export type SendEmailInput = {
  to: {
    email: string;
    name?: string | null;
  };
  subject: string;
  html: string;
  text: string;
  locale?: string;
  replyTo?: string;
  idempotencyKey?: string;
  scheduledAt?: string;
  tags?: {
    name: string;
    value: string;
  }[];
  metadata?: Record<string, string>;
  attachments?: {
    filename: string;
    content: Buffer | string;
  }[];
};

export interface EmailServiceProvider {
  sendEmail(input: SendEmailInput): Promise<void>;
}

const mockedService: EmailServiceProvider = {
  async sendEmail(input) {
    logger.warn(
      "EmailService is not configured because RESEND_API_KEY is not set. Email content:",
      {
        to: input.to,
        subject: input.subject,
        locale: input.locale,
        replyTo: input.replyTo,
        idempotencyKey: input.idempotencyKey,
        scheduledAt: input.scheduledAt,
        tags: input.tags,
        metadata: input.metadata,
        attachments: input.attachments?.map((attachment) => ({
          filename: attachment.filename,
          size:
            typeof attachment.content === "string"
              ? attachment.content.length
              : attachment.content.byteLength,
        })),
      },
    );
  },
};

const canEnableResend =
  envConfig.RESEND_API_KEY && envConfig.RESEND_FROM_EMAIL && envConfig.RESEND_FROM_NAME;

if (!canEnableResend && envConfig.NODE_ENV === "development") {
  logger.warn("Email service will be disabled and email related features will not work");
}

const resendAdapter =
  envConfig.RESEND_API_KEY && envConfig.RESEND_FROM_EMAIL && envConfig.RESEND_FROM_NAME
    ? new ResendEmailAdapter({
        apiKey: envConfig.RESEND_API_KEY,
        fromEmail: envConfig.RESEND_FROM_EMAIL,
        fromName: envConfig.RESEND_FROM_NAME,
        replyTo: envConfig.RESEND_REPLY_TO_EMAIL,
      })
    : mockedService;

export const EmailService: EmailServiceProvider = resendAdapter;
