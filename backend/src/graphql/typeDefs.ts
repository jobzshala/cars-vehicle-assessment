export const typeDefs = /* GraphQL */ `
  """
  A vehicle manufacturer as published by the NHTSA vPIC API.
  """
  type Make {
    "NHTSA Make_ID"
    makeId: Int!
    "NHTSA Make_Name"
    makeName: String!
    "Vehicle types this make produces, ordered by typeId"
    vehicleTypes: [VehicleType!]!
  }

  """
  A category of vehicle (e.g. "Passenger Car", "Truck").
  """
  type VehicleType {
    "NHTSA VehicleTypeId"
    typeId: Int!
    "NHTSA VehicleTypeName"
    typeName: String!
  }

  """
  A page of makes plus the total number of makes matching the query.
  """
  type MakeConnection {
    items: [Make!]!
    totalCount: Int!
    limit: Int!
    offset: Int!
  }

  enum IngestionStatus {
    RUNNING
    SUCCEEDED
    FAILED
  }

  """
  Metadata about one execution of the XML ingestion pipeline.
  """
  type IngestionRun {
    id: Int!
    status: IngestionStatus!
    "ISO-8601 timestamp"
    startedAt: String!
    "ISO-8601 timestamp; null while the run is in progress"
    finishedAt: String
    "Makes persisted with their vehicle types"
    makesProcessed: Int!
    "Makes skipped because their vehicle types could not be fetched"
    makesFailed: Int!
    errorMessage: String
  }

  type Query {
    """
    Paginated list of makes ordered by name. Use \`search\` for a case-insensitive
    substring match on the make name. \`limit\` is capped at 200.
    """
    makes(limit: Int = 50, offset: Int = 0, search: String): MakeConnection!

    "A single make by its NHTSA Make_ID, or null if unknown."
    make(makeId: Int!): Make

    "The most recent ingestion run, or null if ingestion has never run."
    ingestionStatus: IngestionRun
  }

  type Mutation {
    """
    Starts the ingestion pipeline in the background and returns the run record.
    If a run is already active, that run is returned instead of starting a new one.
    """
    triggerIngestion: IngestionRun!
  }
`;
