import { z } from "zod";
import { TransformError } from "./errors";
import type { Make, MakeWithVehicleTypes, VehicleType } from "./types";

// NHTSA XML, once parsed, looks like:
//   { Response: { Count, Message, Results: { AllVehicleMakes: [ { Make_ID, Make_Name } ] } } }
// Results is "" when empty, so it's validated loosely and items strictly.

const responseEnvelope = z.object({
  Response: z.object({ Results: z.unknown() }),
});

const rawMake = z.object({
  Make_ID: z.coerce.number().int(),
  Make_Name: z.coerce.string().trim().min(1),
});

const rawVehicleType = z.object({
  VehicleTypeId: z.coerce.number().int(),
  VehicleTypeName: z.coerce.string().trim().min(1),
});

function extractResultItems(parsed: unknown, itemKey: string): unknown[] {
  const envelope = responseEnvelope.safeParse(parsed);
  if (!envelope.success) {
    throw new TransformError("XML document does not contain a <Response> with <Results>", {
      context: { issues: envelope.error.issues },
    });
  }

  const results = envelope.data.Response.Results;
  if (results === "" || results === null || results === undefined) return [];
  if (typeof results !== "object") {
    throw new TransformError("<Results> has an unexpected shape", { context: { results } });
  }

  const items = (results as Record<string, unknown>)[itemKey];
  if (items === undefined) return [];
  if (!Array.isArray(items)) {
    throw new TransformError(`<${itemKey}> was not parsed as a list`, { context: { itemKey } });
  }
  return items;
}

function parseItems<T>(items: unknown[], schema: z.ZodType<T>, label: string): T[] {
  return items.map((item, index) => {
    const result = schema.safeParse(item);
    if (!result.success) {
      throw new TransformError(`Invalid ${label} at index ${index}`, {
        context: { index, issues: result.error.issues },
      });
    }
    return result.data;
  });
}

function uniqueBy<T>(items: T[], key: (item: T) => number): T[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function mapMakes(parsedXml: unknown): Make[] {
  const raw = parseItems(extractResultItems(parsedXml, "AllVehicleMakes"), rawMake, "make");
  return uniqueBy(
    raw.map((item) => ({ makeId: item.Make_ID, makeName: item.Make_Name })),
    (make) => make.makeId,
  );
}

export function mapVehicleTypes(parsedXml: unknown): VehicleType[] {
  const raw = parseItems(
    extractResultItems(parsedXml, "VehicleTypesForMakeIds"),
    rawVehicleType,
    "vehicle type",
  );
  return uniqueBy(
    raw.map((item) => ({ typeId: item.VehicleTypeId, typeName: item.VehicleTypeName })),
    (type) => type.typeId,
  );
}

// Makes without an entry in typesByMakeId are omitted: their vehicle-type fetch
// failed, and storing them with an empty list would misrepresent the source data.
export function combine(
  makes: Make[],
  typesByMakeId: ReadonlyMap<number, VehicleType[]>,
): MakeWithVehicleTypes[] {
  const combined: MakeWithVehicleTypes[] = [];
  for (const make of makes) {
    const vehicleTypes = typesByMakeId.get(make.makeId);
    if (vehicleTypes === undefined) continue;
    combined.push({ ...make, vehicleTypes });
  }
  return combined;
}
