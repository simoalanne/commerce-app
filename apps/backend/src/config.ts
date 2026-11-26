import z from "zod";

const RuntimeEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SENTRY_DSN: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYTRAIL_MERCHANT_ID: z.coerce.number().optional(),
  PAYTRAIL_MERCHANT_NAME: z.string().optional(),
  PAYTRAIL_SECRET_KEY: z.string().optional(),
  // Local defaults match the dev ports (backend 3001, store 3000). Set
  // API_PUBLIC_URL too when changing PORT.
  API_PUBLIC_URL: z.url().default("http://localhost:3001"),
  ONLINE_STORE_URL: z.url().default("http://localhost:3000"),
  INTERNAL_API_KEY: z.string().optional(),
  DASHBOARD_URL: z.url().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.email().optional(),
  RESEND_FROM_NAME: z.string().optional(),
  RESEND_REPLY_TO_EMAIL: z.email().optional(),
  COMPANY_LEGAL_NAME: z.string().optional(),
  COMPANY_BUSINESS_ID: z.string().optional(),
  COMPANY_ADDRESS: z.string().optional(),
  COMPANY_CONTACT_EMAIL: z.email().optional(),
  COMPANY_CONTACT_PHONE: z.string().optional(),
  PENDING_ORDER_EXPIRY_MINUTES: z.coerce.number().int().min(1).default(15),
  REVIEW_ORDER_EMAIL_DELAY: z.string().trim().default("0"),
  OBJECT_STORAGE_R2_ACCOUNT_ID: z.string().optional(),
  OBJECT_STORAGE_R2_ACCESS_KEY_ID: z.string().optional(),
  OBJECT_STORAGE_R2_BUCKET: z.string().optional(),
  OBJECT_STORAGE_R2_PUBLIC_BASE_URL: z.url().optional(),
  OBJECT_STORAGE_R2_SECRET_ACCESS_KEY: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["none", "minimal", "all"]).default("minimal"),
  NODE_ENV: z.enum(["development", "staging", "production", "test", "cron"]).default("development"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).optional(),
  PORT: z.coerce.number<number>().int().min(1).default(3001),
  NEW_ORDER_NOTIFICATION_EMAIL_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

const DeploymentEnvSchema = RuntimeEnvSchema.extend({
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  PAYTRAIL_SECRET_KEY: z.string().min(1),
  PAYTRAIL_MERCHANT_NAME: z.string().min(1),
  PAYTRAIL_MERCHANT_ID: z.coerce.number(),
  API_PUBLIC_URL: z.url(),
  ONLINE_STORE_URL: z.url(),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.email(),
  RESEND_FROM_NAME: z.string().min(1),
  RESEND_REPLY_TO_EMAIL: z.email(),
  OBJECT_STORAGE_R2_ACCOUNT_ID: z.string().min(1),
  OBJECT_STORAGE_R2_ACCESS_KEY_ID: z.string().min(1),
  OBJECT_STORAGE_R2_BUCKET: z.string().min(1),
  OBJECT_STORAGE_R2_PUBLIC_BASE_URL: z.url(),
  OBJECT_STORAGE_R2_SECRET_ACCESS_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(1),
});

const mapErrorIssues = (issues: z.core.$ZodIssue[]) =>
  issues.map((issue) => issue.path[0].toString());

// The compose development database; the test runner overrides it below.
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/acme_dev";

// Vitest sets VITEST in every worker.
const isTestRunner = Boolean(process.env.VITEST);

const envToUse = isTestRunner
  ? {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/acme_test",
      JWT_SECRET: "test-secret",
      LOG_LEVEL: "none",
      NODE_ENV: "test",
    }
  : process.env;

const runtimeResult = RuntimeEnvSchema.safeParse(envToUse);

if (!runtimeResult.success) {
  console.error(
    "❌ Invalid or missing environment variables",
    mapErrorIssues(runtimeResult.error.issues),
  );
  throw new Error();
}

if (runtimeResult.data.NODE_ENV === "staging" || runtimeResult.data.NODE_ENV === "production") {
  const deploymentResult = DeploymentEnvSchema.safeParse(envToUse);

  if (!deploymentResult.success) {
    console.error(
      "❌ Invalid or missing deployment environment variables",
      mapErrorIssues(deploymentResult.error.issues),
    );
    throw new Error();
  }
}

const envConfig =
  runtimeResult.data.NODE_ENV === "staging" || runtimeResult.data.NODE_ENV === "production"
    ? (DeploymentEnvSchema.parse(envToUse) as z.infer<typeof DeploymentEnvSchema>)
    : runtimeResult.data;

export default envConfig;

export type EnvConfig = typeof envConfig;
