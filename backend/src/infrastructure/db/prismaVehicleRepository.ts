import { Prisma, type PrismaClient } from "@prisma/client";
import { PersistenceError } from "../../domain/errors";
import type {
  IngestionRunResult,
  MakeListQuery,
  MakeListResult,
  VehicleRepository,
} from "../../domain/repository";
import type { IngestionRun, IngestionStatus, MakeWithVehicleTypes } from "../../domain/types";

const makeWithTypes = Prisma.validator<Prisma.MakeDefaultArgs>()({
  include: { vehicleTypes: { include: { vehicleType: true }, orderBy: { vehicleTypeId: "asc" } } },
});
type MakeRow = Prisma.MakeGetPayload<typeof makeWithTypes>;

const INGESTION_STATUSES: ReadonlySet<string> = new Set(["running", "succeeded", "failed"]);

function toDomainMake(row: MakeRow): MakeWithVehicleTypes {
  return {
    makeId: row.id,
    makeName: row.name,
    vehicleTypes: row.vehicleTypes.map((link) => ({
      typeId: link.vehicleType.id,
      typeName: link.vehicleType.name,
    })),
  };
}

function toDomainRun(row: {
  id: number;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  makesProcessed: number;
  makesFailed: number;
  errorMessage: string | null;
}): IngestionRun {
  if (!INGESTION_STATUSES.has(row.status)) {
    throw new PersistenceError(`Unknown ingestion status "${row.status}" for run ${row.id}`);
  }
  return { ...row, status: row.status as IngestionStatus };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function guard<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof PersistenceError) throw error;
    throw new PersistenceError(`${operation} failed`, { cause: error });
  }
}

export class PrismaVehicleRepository implements VehicleRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly batchSize = 500,
  ) {}

  async upsertMakes(makes: MakeWithVehicleTypes[]): Promise<void> {
    for (const batch of chunk(makes, this.batchSize)) {
      await this.upsertBatch(batch);
    }
  }

  // Set-based upsert: one round-trip per table per batch instead of one per row.
  // Join rows for the batch are replaced wholesale so removed types disappear.
  private async upsertBatch(batch: MakeWithVehicleTypes[]): Promise<void> {
    const makeIds = batch.map((make) => make.makeId);
    const makeNames = batch.map((make) => make.makeName);

    const typesById = new Map<number, string>();
    const linkMakeIds: number[] = [];
    const linkTypeIds: number[] = [];
    for (const make of batch) {
      for (const type of make.vehicleTypes) {
        typesById.set(type.typeId, type.typeName);
        linkMakeIds.push(make.makeId);
        linkTypeIds.push(type.typeId);
      }
    }
    const typeIds = [...typesById.keys()];
    const typeNames = [...typesById.values()];

    await guard(`Persisting batch of ${batch.length} makes`, () =>
      this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO "Make" ("id", "name", "updatedAt")
          SELECT u.id, u.name, now()
          FROM unnest(${makeIds}::int[], ${makeNames}::text[]) AS u(id, name)
          ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = now()`;

        if (typeIds.length > 0) {
          await tx.$executeRaw`
            INSERT INTO "VehicleType" ("id", "name")
            SELECT u.id, u.name
            FROM unnest(${typeIds}::int[], ${typeNames}::text[]) AS u(id, name)
            ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name"`;
        }

        await tx.$executeRaw`
          DELETE FROM "MakeVehicleType" WHERE "makeId" = ANY(${makeIds}::int[])`;

        if (linkMakeIds.length > 0) {
          await tx.$executeRaw`
            INSERT INTO "MakeVehicleType" ("makeId", "vehicleTypeId")
            SELECT u.make_id, u.type_id
            FROM unnest(${linkMakeIds}::int[], ${linkTypeIds}::int[]) AS u(make_id, type_id)
            ON CONFLICT DO NOTHING`;
        }
      }),
    );
  }

  countMakes(): Promise<number> {
    return guard("Counting makes", () => this.prisma.make.count());
  }

  async listMakes({ limit, offset, search }: MakeListQuery): Promise<MakeListResult> {
    const where: Prisma.MakeWhereInput =
      search && search.trim() !== ""
        ? { name: { contains: search.trim(), mode: "insensitive" } }
        : {};

    return guard("Listing makes", async () => {
      const [rows, totalCount] = await this.prisma.$transaction([
        this.prisma.make.findMany({
          ...makeWithTypes,
          where,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: offset,
          take: limit,
        }),
        this.prisma.make.count({ where }),
      ]);
      return { items: rows.map(toDomainMake), totalCount };
    });
  }

  async getMake(makeId: number): Promise<MakeWithVehicleTypes | null> {
    return guard(`Loading make ${makeId}`, async () => {
      const row = await this.prisma.make.findUnique({ ...makeWithTypes, where: { id: makeId } });
      return row ? toDomainMake(row) : null;
    });
  }

  async startIngestionRun(): Promise<IngestionRun> {
    return guard("Starting ingestion run", async () =>
      toDomainRun(await this.prisma.ingestionRun.create({ data: { status: "running" } })),
    );
  }

  async finishIngestionRun(id: number, result: IngestionRunResult): Promise<IngestionRun> {
    return guard(`Finishing ingestion run ${id}`, async () =>
      toDomainRun(
        await this.prisma.ingestionRun.update({
          where: { id },
          data: {
            status: result.status,
            makesProcessed: result.makesProcessed,
            makesFailed: result.makesFailed,
            errorMessage: result.errorMessage ?? null,
            finishedAt: new Date(),
          },
        }),
      ),
    );
  }

  async getLatestIngestionRun(): Promise<IngestionRun | null> {
    return guard("Loading latest ingestion run", async () => {
      const row = await this.prisma.ingestionRun.findFirst({ orderBy: { startedAt: "desc" } });
      return row ? toDomainRun(row) : null;
    });
  }
}
