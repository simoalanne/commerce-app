import { Resend } from "resend";

import type { EmailServiceProvider, SendEmailInput } from "./email.provider.ts";

type ResendEmailAdapterConfig = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
};

const RESEND_TAG_CHARACTER_PATTERN = /[^A-Za-z0-9_-]+/g;

const formatSender = ({ fromEmail, fromName }: ResendEmailAdapterConfig) =>
  `${fromName} <${fromEmail}>`;

const formatRecipient = ({ email, name }: SendEmailInput["to"]) =>
  name?.trim() ? `${name.trim()} <${email}>` : email;

const normalizeTagPart = (value: string) =>
  value.replace(RESEND_TAG_CHARACTER_PATTERN, "-").replace(/-+/g, "-");

const normalizeTags = (tags: SendEmailInput["tags"]) =>
  tags?.map((tag) => ({
    name: normalizeTagPart(tag.name),
    value: normalizeTagPart(tag.value),
  }));

export class ResendEmailAdapter implements EmailServiceProvider {
  private readonly resendClient: Resend;
  private readonly from: string;
  private readonly defaultReplyTo?: string;

  constructor(config: ResendEmailAdapterConfig) {
    this.resendClient = new Resend(config.apiKey);
    this.from = formatSender(config);
    this.defaultReplyTo = config.replyTo;
  }

  async sendEmail(input: SendEmailInput) {
    const response = await this.resendClient.emails.send(
      {
        from: this.from,
        to: formatRecipient(input.to),
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo ?? this.defaultReplyTo,
        tags: normalizeTags(input.tags),
        attachments: input.attachments,
      },
      {
        idempotencyKey: input.idempotencyKey,
      },
    );

    if (response.error) {
      throw response.error;
    }
  }
}
