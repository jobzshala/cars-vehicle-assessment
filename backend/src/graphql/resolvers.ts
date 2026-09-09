import { GraphQLError } from "graphql";
import type { VehicleRepository } from "../domain/repository";
import type { IngestionRun } from "../domain/types";
import type { IngestionService } from "../ingestion/ingestionService";
import type { Logger } from "../infrastructure/logging/logger";

export interface GraphqlContext {
  repository: VehicleRepository;
  ingestion: IngestionService;
  logger: Logger;
}

export const MAX_PAGE_SIZE = 200;

interface MakesArgs {
  limit?: number | null;
  offset?: number | null;
  search?: string | null;
}

function badInput(message: string, argumentName: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT", argumentName } });
}

function toGraphqlRun(run: IngestionRun) {
  return {
    ...run,
    status: run.status.toUpperCase(),
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}

export const resolvers = {
  Query: {
    async makes(_parent: unknown, args: MakesArgs, { repository }: GraphqlContext) {
      const limit = args.limit ?? 50;
      const offset = args.offset ?? 0;
      if (limit < 1 || limit > MAX_PAGE_SIZE) {
        throw badInput(`limit must be between 1 and ${MAX_PAGE_SIZE}`, "limit");
      }
      if (offset < 0) throw badInput("offset must be zero or greater", "offset");

      const search = args.search ?? undefined;
      const { items, totalCount } = await repository.listMakes({ limit, offset, search });
      return { items, totalCount, limit, offset };
    },

    make(_parent: unknown, args: { makeId: number }, { repository }: GraphqlContext) {
      return repository.getMake(args.makeId);
    },

    async ingestionStatus(_parent: unknown, _args: unknown, { repository }: GraphqlContext) {
      const run = await repository.getLatestIngestionRun();
      return run ? toGraphqlRun(run) : null;
    },
  },

  Mutation: {
    async triggerIngestion(
      _parent: unknown,
      _args: unknown,
      { ingestion, logger }: GraphqlContext,
    ) {
      const run = await ingestion.trigger();
      logger.info({ runId: run.id }, "Ingestion triggered via GraphQL");
      return toGraphqlRun(run);
    },
  },
};
