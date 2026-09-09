import type {
  IngestionRunResult,
  MakeListQuery,
  MakeListResult,
  VehicleRepository,
} from "../domain/repository";
import type { IngestionRun, MakeWithVehicleTypes } from "../domain/types";

export class InMemoryVehicleRepository implements VehicleRepository {
  readonly makes = new Map<number, MakeWithVehicleTypes>();
  readonly runs: IngestionRun[] = [];
  upsertCalls: MakeWithVehicleTypes[][] = [];
  failNextUpsert: Error | null = null;

  constructor(seed: MakeWithVehicleTypes[] = []) {
    for (const make of seed) this.makes.set(make.makeId, structuredClone(make));
  }

  async upsertMakes(makes: MakeWithVehicleTypes[]): Promise<void> {
    if (this.failNextUpsert) {
      const error = this.failNextUpsert;
      this.failNextUpsert = null;
      throw error;
    }
    this.upsertCalls.push(makes);
    for (const make of makes) this.makes.set(make.makeId, structuredClone(make));
  }

  async countMakes(): Promise<number> {
    return this.makes.size;
  }

  async listMakes({ limit, offset, search }: MakeListQuery): Promise<MakeListResult> {
    const term = search?.trim().toLowerCase() ?? "";
    const filtered = [...this.makes.values()]
      .filter((make) => term === "" || make.makeName.toLowerCase().includes(term))
      .sort((a, b) => a.makeName.localeCompare(b.makeName) || a.makeId - b.makeId);
    return {
      items: filtered.slice(offset, offset + limit).map((make) => structuredClone(make)),
      totalCount: filtered.length,
    };
  }

  async getMake(makeId: number): Promise<MakeWithVehicleTypes | null> {
    const make = this.makes.get(makeId);
    return make ? structuredClone(make) : null;
  }

  async startIngestionRun(): Promise<IngestionRun> {
    const run: IngestionRun = {
      id: this.runs.length + 1,
      status: "running",
      startedAt: new Date(),
      finishedAt: null,
      makesProcessed: 0,
      makesFailed: 0,
      errorMessage: null,
    };
    this.runs.push(run);
    return { ...run };
  }

  async finishIngestionRun(id: number, result: IngestionRunResult): Promise<IngestionRun> {
    const run = this.runs.find((candidate) => candidate.id === id);
    if (!run) throw new Error(`No ingestion run with id ${id}`);
    run.status = result.status;
    run.makesProcessed = result.makesProcessed;
    run.makesFailed = result.makesFailed;
    run.errorMessage = result.errorMessage ?? null;
    run.finishedAt = new Date();
    return { ...run };
  }

  async getLatestIngestionRun(): Promise<IngestionRun | null> {
    const latest = this.runs[this.runs.length - 1];
    return latest ? { ...latest } : null;
  }
}
