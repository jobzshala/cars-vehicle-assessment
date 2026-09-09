// Integration test against a real PostgreSQL database. Runs only when
// TEST_DATABASE_URL is set (CI provides one; locally: docker compose up -d db,
// then point TEST_DATABASE_URL at it and run `prisma migrate deploy`).
import { PrismaClient } from "@prisma/client";
import { PersistenceError } from "../../domain/errors";
import type { MakeWithVehicleTypes } from "../../domain/types";
import { PrismaVehicleRepository } from "./prismaVehicleRepository";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("PrismaVehicleRepository (integration)", () => {
  let prisma: PrismaClient;
  let repository: PrismaVehicleRepository;

  const seed: MakeWithVehicleTypes[] = [
    {
      makeId: 440,
      makeName: "ASTON MARTIN",
      vehicleTypes: [
        { typeId: 2, typeName: "Passenger Car" },
        { typeId: 7, typeName: "Multipurpose Passenger Vehicle (MPV)" },
      ],
    },
    { makeId: 441, makeName: "TESLA", vehicleTypes: [{ typeId: 2, typeName: "Passenger Car" }] },
    { makeId: 442, makeName: "JAGUAR", vehicleTypes: [] },
  ];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    repository = new PrismaVehicleRepository(prisma, 2); // small batch size to exercise chunking
  });

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.makeVehicleType.deleteMany(),
      prisma.make.deleteMany(),
      prisma.vehicleType.deleteMany(),
      prisma.ingestionRun.deleteMany(),
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists makes with their vehicle types and reads them back", async () => {
    await repository.upsertMakes(seed);

    expect(await repository.countMakes()).toBe(3);
    expect(await repository.getMake(440)).toEqual(seed[0]);
    expect(await repository.getMake(442)).toEqual({
      makeId: 442,
      makeName: "JAGUAR",
      vehicleTypes: [],
    });
    expect(await repository.getMake(1)).toBeNull();
    expect(await prisma.vehicleType.count()).toBe(2);
  });

  it("is idempotent: re-ingesting updates names and replaces vehicle types", async () => {
    await repository.upsertMakes(seed);
    await repository.upsertMakes([
      {
        makeId: 440,
        makeName: "ASTON MARTIN LAGONDA",
        vehicleTypes: [{ typeId: 3, typeName: "Truck" }],
      },
    ]);

    expect(await repository.getMake(440)).toEqual({
      makeId: 440,
      makeName: "ASTON MARTIN LAGONDA",
      vehicleTypes: [{ typeId: 3, typeName: "Truck" }],
    });
    expect(await repository.countMakes()).toBe(3);
    expect(await repository.getMake(441)).toEqual(seed[1]);
  });

  it("lists makes ordered by name with pagination and case-insensitive search", async () => {
    await repository.upsertMakes(seed);

    const page = await repository.listMakes({ limit: 2, offset: 0 });
    expect(page.totalCount).toBe(3);
    expect(page.items.map((m) => m.makeName)).toEqual(["ASTON MARTIN", "JAGUAR"]);

    const next = await repository.listMakes({ limit: 2, offset: 2 });
    expect(next.items.map((m) => m.makeName)).toEqual(["TESLA"]);

    const search = await repository.listMakes({ limit: 10, offset: 0, search: "martin" });
    expect(search.totalCount).toBe(1);
    expect(search.items[0]?.vehicleTypes).toHaveLength(2);
  });

  it("handles an empty upsert without touching the database", async () => {
    await expect(repository.upsertMakes([])).resolves.toBeUndefined();
    expect(await repository.countMakes()).toBe(0);
  });

  it("tracks ingestion runs", async () => {
    expect(await repository.getLatestIngestionRun()).toBeNull();

    const started = await repository.startIngestionRun();
    expect(started).toMatchObject({ status: "running", finishedAt: null, makesProcessed: 0 });

    const finished = await repository.finishIngestionRun(started.id, {
      status: "succeeded",
      makesProcessed: 12,
      makesFailed: 1,
    });
    expect(finished).toMatchObject({ id: started.id, status: "succeeded", makesProcessed: 12 });
    expect(finished.finishedAt).toBeInstanceOf(Date);

    const latest = await repository.getLatestIngestionRun();
    expect(latest?.id).toBe(started.id);
  });

  it("wraps database failures in PersistenceError", async () => {
    const broken = new PrismaVehicleRepository(
      new PrismaClient({ datasourceUrl: "postgresql://nobody:wrong@localhost:1/none" }),
    );

    await expect(broken.countMakes()).rejects.toBeInstanceOf(PersistenceError);
  });
});
