import request from "supertest";
import { createApp, type App } from "./app";
import type { MakeWithVehicleTypes } from "./domain/types";
import { IngestionService } from "./ingestion/ingestionService";
import { createSilentLogger } from "./infrastructure/logging/logger";
import { InMemoryVehicleRepository } from "./test/inMemoryRepository";
import { makesXml, sampleMakes, sampleTypesByMake, vehicleTypesXml } from "./test/xmlFixtures";

const seed: MakeWithVehicleTypes[] = [
  {
    makeId: 440,
    makeName: "ASTON MARTIN",
    vehicleTypes: [{ typeId: 2, typeName: "Passenger Car" }],
  },
  { makeId: 441, makeName: "TESLA", vehicleTypes: [{ typeId: 2, typeName: "Passenger Car" }] },
  {
    makeId: 442,
    makeName: "JAGUAR",
    vehicleTypes: [
      { typeId: 2, typeName: "Passenger Car" },
      { typeId: 7, typeName: "Multipurpose Passenger Vehicle (MPV)" },
    ],
  },
  { makeId: 443, makeName: "MARTIN MOTORS", vehicleTypes: [] },
];

let built: App;
let repository: InMemoryVehicleRepository;
let ingestion: IngestionService;

const graphql = (query: string, variables?: Record<string, unknown>) =>
  request(built.app).post("/graphql").send({ query, variables });

beforeAll(async () => {
  repository = new InMemoryVehicleRepository(seed);
  ingestion = new IngestionService({
    source: {
      getAllMakesXml: async () => makesXml(sampleMakes),
      getVehicleTypesForMakeXml: async (makeId) =>
        vehicleTypesXml(makeId, sampleTypesByMake[makeId] ?? []),
    },
    repository,
    logger: createSilentLogger(),
    options: { concurrency: 2 },
  });
  built = await createApp({
    nodeEnv: "test",
    logger: createSilentLogger(),
    repository,
    ingestion,
  });
});

afterAll(async () => {
  await built.apollo.stop();
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(built.app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });
});

describe("unknown routes", () => {
  it("return a JSON 404", async () => {
    const res = await request(built.app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});

describe("Query.makes", () => {
  const MAKES = /* GraphQL */ `
    query Makes($limit: Int, $offset: Int, $search: String) {
      makes(limit: $limit, offset: $offset, search: $search) {
        totalCount
        limit
        offset
        items {
          makeId
          makeName
          vehicleTypes {
            typeId
            typeName
          }
        }
      }
    }
  `;

  it("returns makes ordered by name with their vehicle types", async () => {
    const res = await graphql(MAKES);

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    const { makes } = res.body.data;
    expect(makes.totalCount).toBe(4);
    expect(makes.limit).toBe(50);
    expect(makes.items.map((m: { makeName: string }) => m.makeName)).toEqual([
      "ASTON MARTIN",
      "JAGUAR",
      "MARTIN MOTORS",
      "TESLA",
    ]);
    expect(makes.items[1].vehicleTypes).toEqual([
      { typeId: 2, typeName: "Passenger Car" },
      { typeId: 7, typeName: "Multipurpose Passenger Vehicle (MPV)" },
    ]);
  });

  it("paginates", async () => {
    const res = await graphql(MAKES, { limit: 2, offset: 2 });

    const { makes } = res.body.data;
    expect(makes.items.map((m: { makeId: number }) => m.makeId)).toEqual([443, 441]);
    expect(makes.totalCount).toBe(4);
    expect(makes.offset).toBe(2);
  });

  it("searches case-insensitively by name", async () => {
    const res = await graphql(MAKES, { search: "martin" });

    const { makes } = res.body.data;
    expect(makes.totalCount).toBe(2);
    expect(makes.items.map((m: { makeName: string }) => m.makeName)).toEqual([
      "ASTON MARTIN",
      "MARTIN MOTORS",
    ]);
  });

  it("rejects an out-of-range limit with BAD_USER_INPUT", async () => {
    const res = await graphql(MAKES, { limit: 500 });

    expect(res.body.data).toBeNull();
    expect(res.body.errors[0].extensions.code).toBe("BAD_USER_INPUT");
    expect(res.body.errors[0].message).toMatch(/limit/);
  });

  it("rejects a negative offset", async () => {
    const res = await graphql(MAKES, { offset: -1 });
    expect(res.body.errors[0].extensions.code).toBe("BAD_USER_INPUT");
  });
});

describe("Query.make", () => {
  const MAKE = /* GraphQL */ `
    query Make($makeId: Int!) {
      make(makeId: $makeId) {
        makeId
        makeName
        vehicleTypes {
          typeId
        }
      }
    }
  `;

  it("returns a single make", async () => {
    const res = await graphql(MAKE, { makeId: 440 });
    expect(res.body.data.make).toEqual({
      makeId: 440,
      makeName: "ASTON MARTIN",
      vehicleTypes: [{ typeId: 2 }],
    });
  });

  it("returns null for an unknown make", async () => {
    const res = await graphql(MAKE, { makeId: 999999 });
    expect(res.body.data.make).toBeNull();
    expect(res.body.errors).toBeUndefined();
  });

  it("fails validation when makeId is missing", async () => {
    const res = await graphql(`
      query {
        make {
          makeId
        }
      }
    `);
    expect(res.body.errors[0].extensions.code).toBe("GRAPHQL_VALIDATION_FAILED");
  });
});

describe("ingestion via GraphQL", () => {
  it("reports null status before any run, then reflects a triggered run", async () => {
    const STATUS = /* GraphQL */ `
      query {
        ingestionStatus {
          id
          status
          makesProcessed
          makesFailed
          finishedAt
          errorMessage
        }
      }
    `;

    expect((await graphql(STATUS)).body.data.ingestionStatus).toBeNull();

    const trigger = await graphql(`
      mutation {
        triggerIngestion {
          id
          status
          startedAt
        }
      }
    `);
    expect(trigger.body.errors).toBeUndefined();
    expect(trigger.body.data.triggerIngestion).toMatchObject({ id: 1, status: "RUNNING" });
    expect(trigger.body.data.triggerIngestion.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await ingestion.waitForActiveRun();

    const status = await graphql(STATUS);
    expect(status.body.data.ingestionStatus).toMatchObject({
      id: 1,
      status: "SUCCEEDED",
      makesProcessed: 3,
      makesFailed: 0,
      errorMessage: null,
    });
    expect(status.body.data.ingestionStatus.finishedAt).not.toBeNull();
  });
});
