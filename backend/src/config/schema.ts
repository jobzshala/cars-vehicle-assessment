import { z } from "zod";

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

const booleanFlag = z.enum(["true", "false"]).transform((value) => value === "true");

export const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url({ error: "DATABASE_URL must be a valid PostgreSQL connection URL" }),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),

  NHTSA_BASE_URL: z.url().default("https://vpic.nhtsa.dot.gov/api/vehicles"),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  HTTP_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  HTTP_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(0).default(300),

  INGEST_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(10),
  INGEST_BATCH_SIZE: z.coerce.number().int().min(1).max(5000).default(500),
  INGEST_MAKE_LIMIT: z.coerce.number().int().positive().optional(),
  INGEST_ON_STARTUP: booleanFlag.default(true),
});

export type AppConfig = z.infer<typeof configSchema>;
