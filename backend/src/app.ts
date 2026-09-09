import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginLandingPageDisabled } from "@apollo/server/plugin/disabled";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { expressMiddleware } from "@as-integrations/express5";
import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { pinoHttp } from "pino-http";
import type { VehicleRepository } from "./domain/repository";
import { resolvers, type GraphqlContext } from "./graphql/resolvers";
import { typeDefs } from "./graphql/typeDefs";
import type { IngestionService } from "./ingestion/ingestionService";
import type { Logger } from "./infrastructure/logging/logger";

export interface AppDependencies {
  nodeEnv: "development" | "test" | "production";
  logger: Logger;
  repository: VehicleRepository;
  ingestion: IngestionService;
}

export interface App {
  app: Express;
  apollo: ApolloServer<GraphqlContext>;
}

export async function createApp(deps: AppDependencies): Promise<App> {
  const { logger, repository, ingestion, nodeEnv } = deps;
  const isProduction = nodeEnv === "production";
  const app = express();
  app.disable("x-powered-by");

  app.use(
    pinoHttp({
      logger: logger.child({ module: "http" }),
      autoLogging: { ignore: (req) => req.url === "/health" },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
  });

  const apollo = new ApolloServer<GraphqlContext>({
    typeDefs,
    resolvers,
    introspection: true,
    plugins: [
      isProduction
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
    formatError: (formattedError, error) => {
      const code = formattedError.extensions?.code;
      const isClientError =
        code === "BAD_USER_INPUT" ||
        code === "GRAPHQL_VALIDATION_FAILED" ||
        code === "GRAPHQL_PARSE_FAILED";
      if (isClientError) return formattedError;

      logger.error({ err: error, path: formattedError.path }, "GraphQL resolver error");
      return isProduction
        ? { ...formattedError, message: "Internal server error" }
        : formattedError;
    },
  });
  await apollo.start();

  app.use(
    "/graphql",
    cors(),
    express.json({ limit: "1mb" }),
    expressMiddleware(apollo, {
      context: async () => ({ repository, ingestion, logger }),
    }),
  );

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
    req.log.error({ err: error }, "Unhandled request error");
    res.status(500).json({ error: "Internal server error" });
  });

  return { app, apollo };
}
