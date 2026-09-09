import { ExternalApiError } from "../domain/errors";
import { createSilentLogger } from "../infrastructure/logging/logger";
import { InMemoryVehicleRepository } from "../test/inMemoryRepository";
import { makesXml, sampleMakes, sampleTypesByMake, vehicleTypesXml } from "../test/xmlFixtures";
import { IngestionService, type VehicleDataSource } from "./ingestionService";

function fakeSource(overrides: Partial<VehicleDataSource> = {}): VehicleDataSource {
  return {
    getAllMakesXml: vi.fn(async () => makesXml(sampleMakes)),
    getVehicleTypesForMakeXml: vi.fn(async (makeId: number) =>
      vehicleTypesXml(makeId, sampleTypesByMake[makeId] ?? []),
    ),
    ...overrides,
  };
}

function createService(
  source: VehicleDataSource,
  repository = new InMemoryVehicleRepository(),
  options: { concurrency?: number; makeLimit?: number } = {},
) {
  const service = new IngestionService({
    source,
    repository,
    logger: createSilentLogger(),
    options: { concurrency: options.concurrency ?? 2, makeLimit: options.makeLimit },
  });
  return { service, repository };
}

describe("IngestionService", () => {
  it("fetches, transforms, combines and persists all makes", async () => {
    const source = fakeSource();
    const { service, repository } = createService(source);

    const run = await service.run();

    expect(run.status).toBe("succeeded");
    expect(run.makesProcessed).toBe(3);
    expect(run.makesFailed).toBe(0);
    expect(run.finishedAt).toBeInstanceOf(Date);

    expect(source.getAllMakesXml).toHaveBeenCalledTimes(1);
    expect(source.getVehicleTypesForMakeXml).toHaveBeenCalledTimes(3);

    expect(await repository.getMake(440)).toEqual({
      makeId: 440,
      makeName: "ASTON MARTIN",
      vehicleTypes: [
        { typeId: 2, typeName: "Passenger Car" },
        { typeId: 7, typeName: "Multipurpose Passenger Vehicle (MPV)" },
      ],
    });
    expect(await repository.countMakes()).toBe(3);
  });

  it("skips makes whose vehicle types fail and records the failure count", async () => {
    const source = fakeSource({
      getVehicleTypesForMakeXml: vi.fn(async (makeId: number) => {
        if (makeId === 441) throw new ExternalApiError("NHTSA down");
        return vehicleTypesXml(makeId, sampleTypesByMake[makeId] ?? []);
      }),
    });
    const { service, repository } = createService(source);

    const run = await service.run();

    expect(run.status).toBe("succeeded");
    expect(run.makesProcessed).toBe(2);
    expect(run.makesFailed).toBe(1);
    expect(await repository.getMake(441)).toBeNull();
    expect(await repository.getMake(442)).not.toBeNull();
  });

  it("skips makes whose vehicle-type XML is malformed", async () => {
    const source = fakeSource({
      getVehicleTypesForMakeXml: vi.fn(async (makeId: number) =>
        makeId === 440 ? "<Response><Results>" : vehicleTypesXml(makeId, []),
      ),
    });
    const { service } = createService(source);

    const run = await service.run();

    expect(run.makesProcessed).toBe(2);
    expect(run.makesFailed).toBe(1);
  });

  it("marks the run as failed when the makes list cannot be fetched", async () => {
    const source = fakeSource({
      getAllMakesXml: vi.fn(async () => {
        throw new ExternalApiError("NHTSA request failed: /getallmakes");
      }),
    });
    const { service, repository } = createService(source);

    const run = await service.run();

    expect(run.status).toBe("failed");
    expect(run.errorMessage).toMatch(/getallmakes/);
    expect(repository.upsertCalls).toHaveLength(0);
  });

  it("marks the run as failed when every make fails", async () => {
    const source = fakeSource({
      getVehicleTypesForMakeXml: vi.fn(async () => {
        throw new ExternalApiError("boom");
      }),
    });
    const { service, repository } = createService(source);

    const run = await service.run();

    expect(run.status).toBe("failed");
    expect(run.makesFailed).toBe(3);
    expect(run.errorMessage).toMatch(/All 3 makes failed/);
    expect(repository.upsertCalls).toHaveLength(0);
  });

  it("marks the run as failed when persistence fails", async () => {
    const repository = new InMemoryVehicleRepository();
    repository.failNextUpsert = new Error("connection refused");
    const { service } = createService(fakeSource(), repository);

    const run = await service.run();

    expect(run.status).toBe("failed");
    expect(run.errorMessage).toBe("connection refused");
  });

  it("honours the make limit", async () => {
    const source = fakeSource();
    const { service, repository } = createService(source, undefined, { makeLimit: 2 });

    const run = await service.run();

    expect(run.makesProcessed).toBe(2);
    expect(source.getVehicleTypesForMakeXml).toHaveBeenCalledTimes(2);
    expect(await repository.countMakes()).toBe(2);
  });

  it("does not start a second run while one is active", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const source = fakeSource({
      getAllMakesXml: vi.fn(async () => {
        await gate;
        return makesXml(sampleMakes);
      }),
    });
    const { service, repository } = createService(source);

    const first = await service.trigger();
    const second = await service.trigger();
    expect(service.isRunning()).toBe(true);
    expect(second.id).toBe(first.id);
    expect(repository.runs).toHaveLength(1);

    release();
    const finished = await service.waitForActiveRun();
    expect(finished?.status).toBe("succeeded");
    expect(service.isRunning()).toBe(false);
    expect(source.getAllMakesXml).toHaveBeenCalledTimes(1);
    expect(repository.runs).toHaveLength(1);
  });

  it("starts exactly one run when triggered concurrently", async () => {
    const source = fakeSource();
    const { service, repository } = createService(source);

    const [a, b, c] = await Promise.all([service.trigger(), service.trigger(), service.trigger()]);

    expect(b.id).toBe(a.id);
    expect(c.id).toBe(a.id);
    await service.waitForActiveRun();
    expect(repository.runs).toHaveLength(1);
    expect(source.getAllMakesXml).toHaveBeenCalledTimes(1);
  });

  it("propagates a failure to start a run and stays idle", async () => {
    const repository = new InMemoryVehicleRepository();
    repository.startIngestionRun = async () => {
      throw new Error("db unavailable");
    };
    const { service } = createService(fakeSource(), repository);

    await expect(service.trigger()).rejects.toThrow("db unavailable");
    expect(service.isRunning()).toBe(false);
  });

  it("uses the configured concurrency", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const source = fakeSource({
      getVehicleTypesForMakeXml: vi.fn(async (makeId: number) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return vehicleTypesXml(makeId, []);
      }),
    });
    const { service } = createService(source, undefined, { concurrency: 1 });

    await service.run();

    expect(maxInFlight).toBe(1);
  });
});
