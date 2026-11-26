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

// Local default: prints the email so flows like order confirmation can be
// followed without an email account.
const consoleEmailService: EmailServiceProvider = {
  async sendEmail(input) {
    if (envConfig.NODE_ENV === "test") {
      return;
    }
    const attachments = input.attachments?.map((attachment) => attachment.filename).join(", ");
    console.info(
      [
        "",
        "──── email (not sent: RESEND_API_KEY is not set) ────",
        `To:      ${input.to.name ? `${input.to.name} <${input.to.email}>` : input.to.email}`,
        `Subject: ${input.subject}`,
        ...(input.scheduledAt ? [`Send at: ${input.scheduledAt}`] : []),
        ...(attachments ? [`Attachments: ${attachments}`] : []),
        "",
        input.text,
        "─────────────────────────────────────────────────────",
      ].join("\n"),
    );
  },
};

const canEnableResend =
  envConfig.RESEND_API_KEY && envConfig.RESEND_FROM_EMAIL && envConfig.RESEND_FROM_NAME;

if (!canEnableResend && envConfig.NODE_ENV === "development") {
  logger.info("Resend is not configured; emails are printed to the console");
}

const resendAdapter =
  envConfig.RESEND_API_KEY && envConfig.RESEND_FROM_EMAIL && envConfig.RESEND_FROM_NAME
    ? new ResendEmailAdapter({
        apiKey: envConfig.RESEND_API_KEY,
        fromEmail: envConfig.RESEND_FROM_EMAIL,
        fromName: envConfig.RESEND_FROM_NAME,
        replyTo: envConfig.RESEND_REPLY_TO_EMAIL,
      })
    : consoleEmailService;

export const EmailService: EmailServiceProvider = resendAdapter;
