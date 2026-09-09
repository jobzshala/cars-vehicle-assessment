export interface VehicleType {
  typeId: number;
  typeName: string;
}

export interface Make {
  makeId: number;
  makeName: string;
}

// The unified shape required by the challenge (see README "Data model").
export interface MakeWithVehicleTypes extends Make {
  vehicleTypes: VehicleType[];
}

export type IngestionStatus = "running" | "succeeded" | "failed";

export interface IngestionRun {
  id: number;
  status: IngestionStatus;
  startedAt: Date;
  finishedAt: Date | null;
  makesProcessed: number;
  makesFailed: number;
  errorMessage: string | null;
}
