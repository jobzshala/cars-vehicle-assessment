import pino, { type Logger } from "pino";

export type { Logger };

export interface LoggerOptions {
  level: string;
  pretty: boolean;
}

export function createLogger({ level, pretty }: LoggerOptions): Logger {
  return pino({
    level,
    base: { service: "vehicle-data-service" },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    ...(pretty && {
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
      },
    }),
  });
}

export function createSilentLogger(): Logger {
  return pino({ enabled: false });
}
