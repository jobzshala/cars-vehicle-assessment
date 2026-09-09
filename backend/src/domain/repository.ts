import type { IngestionRun, IngestionStatus, MakeWithVehicleTypes } from "./types";

export interface MakeListQuery {
  limit: number;
  offset: number;
  search?: string | undefined;
}

export interface MakeListResult {
  items: MakeWithVehicleTypes[];
  totalCount: number;
}

export interface IngestionRunResult {
  status: Exclude<IngestionStatus, "running">;
  makesProcessed: number;
  makesFailed: number;
  errorMessage?: string | undefined;
}

// Port implemented by the Prisma adapter (infrastructure/db) and by the
// in-memory double used in tests.
export interface VehicleRepository {
  upsertMakes(makes: MakeWithVehicleTypes[]): Promise<void>;
  countMakes(): Promise<number>;
  listMakes(query: MakeListQuery): Promise<MakeListResult>;
  getMake(makeId: number): Promise<MakeWithVehicleTypes | null>;

  startIngestionRun(): Promise<IngestionRun>;
  finishIngestionRun(id: number, result: IngestionRunResult): Promise<IngestionRun>;
  getLatestIngestionRun(): Promise<IngestionRun | null>;
}
