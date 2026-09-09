import { PrismaClient } from "@prisma/client";
import type { Logger } from "../logging/logger";

export function createPrismaClient(databaseUrl: string, logger: Logger): PrismaClient {
  const log = logger.child({ module: "prisma" });
  const prisma = new PrismaClient({
    datasourceUrl: databaseUrl,
    log: [
      { level: "warn", emit: "event" },
      { level: "error", emit: "event" },
    ],
  });

  prisma.$on("warn", (event) => log.warn({ target: event.target }, event.message));
  prisma.$on("error", (event) => log.error({ target: event.target }, event.message));

  return prisma;
}
