import type { Server } from "node:http";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { IngestionService } from "./ingestion/ingestionService";
import { createPrismaClient } from "./infrastructure/db/prismaClient";
import { PrismaVehicleRepository } from "./infrastructure/db/prismaVehicleRepository";
import { NhtsaClient } from "./infrastructure/http/nhtsaClient";
import { createLogger } from "./infrastructure/logging/logger";

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({
    level: config.LOG_LEVEL,
    pretty: config.NODE_ENV === "development",
  });

  logger.info(
    { nodeEnv: config.NODE_ENV, port: config.PORT, nhtsaBaseUrl: config.NHTSA_BASE_URL },
    "Starting vehicle-data-service",
  );

  const prisma = createPrismaClient(config.DATABASE_URL, logger);
  const repository = new PrismaVehicleRepository(prisma, config.INGEST_BATCH_SIZE);
  const source = new NhtsaClient({
    baseUrl: config.NHTSA_BASE_URL,
    timeoutMs: config.HTTP_TIMEOUT_MS,
    retries: config.HTTP_RETRIES,
    retryBaseDelayMs: config.HTTP_RETRY_BASE_DELAY_MS,
    logger,
  });
  const ingestion = new IngestionService({
    source,
    repository,
    logger,
    options: { concurrency: config.INGEST_CONCURRENCY, makeLimit: config.INGEST_MAKE_LIMIT },
  });

  await prisma.$connect();
  logger.info("Database connection established");

  const { app, apollo } = await createApp({
    nodeEnv: config.NODE_ENV,
    logger,
    repository,
    ingestion,
  });

  const server: Server = await new Promise((resolve) => {
    const listening = app.listen(config.PORT, () => resolve(listening));
  });
  logger.info(
    { port: config.PORT, graphql: `http://localhost:${config.PORT}/graphql` },
    "Server started",
  );

  if (config.INGEST_ON_STARTUP) {
    if ((await repository.countMakes()) === 0) {
      logger.info("Datastore is empty; starting initial ingestion in the background");
      void ingestion.trigger();
    } else {
      logger.info("Datastore already populated; skipping startup ingestion");
    }
  }

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutdown requested");

    const forceExit = setTimeout(() => {
      logger.error("Shutdown timed out; exiting forcefully");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    try {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await apollo.stop();
      await prisma.$disconnect();
      logger.info("Shutdown complete");
      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "Unhandled promise rejection");
    void shutdown("unhandledRejection");
  });
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception");
    process.exit(1);
  });
}

main().catch((error: unknown) => {
  // The logger may not exist yet (e.g. config failed to load), so fall back to stderr.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
