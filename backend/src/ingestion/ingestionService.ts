import { errorMessage } from "../domain/errors";
import type { VehicleRepository } from "../domain/repository";
import { combine, mapMakes, mapVehicleTypes } from "../domain/transform";
import type { IngestionRun, Make, VehicleType } from "../domain/types";
import type { Logger } from "../infrastructure/logging/logger";
import { parseXml } from "../infrastructure/xml/xmlParser";
import { mapWithConcurrency } from "./mapWithConcurrency";

export interface VehicleDataSource {
  getAllMakesXml(): Promise<string>;
  getVehicleTypesForMakeXml(makeId: number): Promise<string>;
}

export interface IngestionOptions {
  concurrency: number;
  makeLimit?: number | undefined;
  progressEvery?: number;
}

export interface IngestionServiceDeps {
  source: VehicleDataSource;
  repository: VehicleRepository;
  logger: Logger;
  options: IngestionOptions;
}

interface ActiveRun {
  run: IngestionRun;
  completion: Promise<IngestionRun>;
}

export class IngestionService {
  private readonly source: VehicleDataSource;
  private readonly repository: VehicleRepository;
  private readonly logger: Logger;
  private readonly options: {
    concurrency: number;
    makeLimit: number | undefined;
    progressEvery: number;
  };
  private active: Promise<ActiveRun> | null = null;

  constructor({ source, repository, logger, options }: IngestionServiceDeps) {
    this.source = source;
    this.repository = repository;
    this.logger = logger.child({ module: "ingestion" });
    this.options = {
      concurrency: options.concurrency,
      makeLimit: options.makeLimit,
      progressEvery: options.progressEvery ?? 500,
    };
  }

  isRunning(): boolean {
    return this.active !== null;
  }

  // Starts a run in the background (if none is active) and returns its record
  // immediately. Callers that need the final result await `run()` instead.
  async trigger(): Promise<IngestionRun> {
    return (await this.startIfIdle()).run;
  }

  async run(): Promise<IngestionRun> {
    return (await this.startIfIdle()).completion;
  }

  // Resolves when the currently active run (if any) has finished.
  async waitForActiveRun(): Promise<IngestionRun | null> {
    return this.active ? (await this.active).completion : null;
  }

  // `this.active` is assigned synchronously so two concurrent callers can never
  // both pass the idle check and start duplicate runs.
  private startIfIdle(): Promise<ActiveRun> {
    if (this.active) return this.active;

    const active = (async (): Promise<ActiveRun> => {
      const run = await this.repository.startIngestionRun();
      const completion = this.execute(run).finally(() => {
        if (this.active === active) this.active = null;
      });
      completion.catch((error) =>
        this.logger.error({ err: error, runId: run.id }, "Ingestion run crashed unexpectedly"),
      );
      return { run, completion };
    })();

    this.active = active;
    active.catch(() => {
      if (this.active === active) this.active = null;
    });
    return active;
  }

  private async execute(run: IngestionRun): Promise<IngestionRun> {
    const log = this.logger.child({ runId: run.id });
    const startedAt = Date.now();
    let makes: Make[] = [];

    try {
      log.info("Ingestion started");

      makes = mapMakes(parseXml(await this.source.getAllMakesXml()));
      log.info({ totalMakes: makes.length }, "Fetched and transformed makes");

      const { makeLimit } = this.options;
      if (makeLimit !== undefined && makes.length > makeLimit) {
        makes = makes.slice(0, makeLimit);
        log.warn({ makeLimit }, "INGEST_MAKE_LIMIT applied; only a subset will be ingested");
      }

      const { typesByMakeId, failed } = await this.fetchVehicleTypes(makes, log);
      const combined = combine(makes, typesByMakeId);

      if (makes.length > 0 && combined.length === 0) {
        throw new Error(`All ${makes.length} makes failed while fetching vehicle types`);
      }

      await this.repository.upsertMakes(combined);

      const finished = await this.repository.finishIngestionRun(run.id, {
        status: "succeeded",
        makesProcessed: combined.length,
        makesFailed: failed,
      });
      log.info(
        {
          makesProcessed: combined.length,
          makesFailed: failed,
          durationMs: Date.now() - startedAt,
        },
        "Ingestion finished",
      );
      return finished;
    } catch (error) {
      log.error({ err: error, durationMs: Date.now() - startedAt }, "Ingestion failed");
      return this.repository.finishIngestionRun(run.id, {
        status: "failed",
        makesProcessed: 0,
        makesFailed: makes.length,
        errorMessage: errorMessage(error),
      });
    }
  }

  private async fetchVehicleTypes(
    makes: Make[],
    log: Logger,
  ): Promise<{ typesByMakeId: Map<number, VehicleType[]>; failed: number }> {
    const typesByMakeId = new Map<number, VehicleType[]>();
    let failed = 0;

    await mapWithConcurrency(makes, this.options.concurrency, async (make, index) => {
      try {
        const xml = await this.source.getVehicleTypesForMakeXml(make.makeId);
        typesByMakeId.set(make.makeId, mapVehicleTypes(parseXml(xml)));
      } catch (error) {
        failed++;
        log.warn(
          { makeId: make.makeId, makeName: make.makeName, err: error },
          "Skipping make: vehicle types could not be fetched or transformed",
        );
      }

      const done = index + 1;
      if (done % this.options.progressEvery === 0 || done === makes.length) {
        log.info({ done, total: makes.length, failed }, "Vehicle type fetch progress");
      }
    });

    return { typesByMakeId, failed };
  }
}
