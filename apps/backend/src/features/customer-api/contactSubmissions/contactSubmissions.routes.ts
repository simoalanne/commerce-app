import z from "zod";

import { customerRoute } from "#src/routing/base.ts";
import { MINUTE_MS, type RateLimitPolicy } from "#src/routing/rateLimit.ts";

const ContactSubmissionSchema = z
  .object({
    name: z.string().min(1).max(255),
    email: z.email().nullable(),
    phone: z.string().min(1).max(20).nullable(),
    message: z.string().min(1).max(5000),
  })
  .refine((data) => data.email !== null || data.phone !== null, {
    message: "EMAIL_OR_PHONE_REQUIRED",
  });

const contactSubmissionRateLimit = {
  name: "contactSubmission",
  windowMs: 10 * MINUTE_MS,
  max: 5,
} satisfies RateLimitPolicy;

export const contactSubmissionsRoutes = {
  submitContact: customerRoute
    .post("/contact-submissions/contact")
    .meta({ rateLimit: contactSubmissionRateLimit })
    .body(ContactSubmissionSchema)
    .handler(async ({ body, context }) => {
      await context.db.contactSubmission.create({
        data: {
          topic: "CONTACT",
          name: body.name,
          email: body.email,
          phone: body.phone,
          message: body.message,
          locale: context.locale,
        },
      });
    }),

  submitVendorApplication: customerRoute
    .post("/contact-submissions/vendor-application")
    .meta({ rateLimit: contactSubmissionRateLimit })
    .body(ContactSubmissionSchema)
    .handler(async ({ body, context }) => {
      await context.db.contactSubmission.create({
        data: {
          topic: "VENDOR_APPLICATION",
          name: body.name,
          email: body.email,
          phone: body.phone,
          message: body.message,
          locale: context.locale,
        },
      });
    }),
};
