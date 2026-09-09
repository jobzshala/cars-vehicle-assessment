import { TransformError } from "./errors";
import { combine, mapMakes, mapVehicleTypes } from "./transform";
import { parseXml } from "../infrastructure/xml/xmlParser";
import { makesXml, vehicleTypesXml } from "../test/xmlFixtures";

describe("mapMakes", () => {
  it("maps parsed NHTSA makes to the domain shape", () => {
    const parsed = parseXml(
      makesXml([
        { id: 12858, name: "#1 ALPINE CUSTOMS" },
        { id: 4877, name: "1/OFF KUSTOMS, LLC" },
      ]),
    );

    expect(mapMakes(parsed)).toEqual([
      { makeId: 12858, makeName: "#1 ALPINE CUSTOMS" },
      { makeId: 4877, makeName: "1/OFF KUSTOMS, LLC" },
    ]);
  });

  it("returns a list even when there is a single make", () => {
    const parsed = parseXml(makesXml([{ id: 1, name: "ONLY ONE" }]));
    expect(mapMakes(parsed)).toEqual([{ makeId: 1, makeName: "ONLY ONE" }]);
  });

  it("returns an empty list for an empty <Results/>", () => {
    expect(mapMakes(parseXml(makesXml([])))).toEqual([]);
  });

  it("keeps numeric-looking names as strings and drops duplicate ids", () => {
    const parsed = parseXml(
      makesXml([
        { id: 5, name: "123" },
        { id: 5, name: "123 AGAIN" },
      ]),
    );
    expect(mapMakes(parsed)).toEqual([{ makeId: 5, makeName: "123" }]);
  });

  it("decodes XML entities in names", () => {
    const parsed = parseXml(makesXml([{ id: 9, name: "A & B <CARS>" }]));
    expect(mapMakes(parsed)[0]?.makeName).toBe("A & B <CARS>");
  });

  it("throws TransformError when the envelope is missing", () => {
    expect(() => mapMakes({ Nope: {} })).toThrow(TransformError);
    expect(() => mapMakes(null)).toThrow(TransformError);
  });

  it("throws TransformError for an item with a non-numeric id", () => {
    const parsed = parseXml(makesXml([{ id: "abc", name: "BAD" }]));
    expect(() => mapMakes(parsed)).toThrow(TransformError);
    expect(() => mapMakes(parsed)).toThrow(/index 0/);
  });

  it("throws TransformError for an item with an empty name", () => {
    const parsed = parseXml(makesXml([{ id: 1, name: "   " }]));
    expect(() => mapMakes(parsed)).toThrow(TransformError);
  });
});

describe("mapVehicleTypes", () => {
  it("maps parsed vehicle types", () => {
    const parsed = parseXml(
      vehicleTypesXml(440, [
        { id: 2, name: "Passenger Car" },
        { id: 7, name: "Multipurpose Passenger Vehicle (MPV)" },
      ]),
    );

    expect(mapVehicleTypes(parsed)).toEqual([
      { typeId: 2, typeName: "Passenger Car" },
      { typeId: 7, typeName: "Multipurpose Passenger Vehicle (MPV)" },
    ]);
  });

  it("handles a single vehicle type and an empty result", () => {
    expect(mapVehicleTypes(parseXml(vehicleTypesXml(1, [{ id: 3, name: "Truck" }])))).toEqual([
      { typeId: 3, typeName: "Truck" },
    ]);
    expect(mapVehicleTypes(parseXml(vehicleTypesXml(1, [])))).toEqual([]);
  });

  it("rejects malformed items", () => {
    const parsed = parseXml(vehicleTypesXml(1, [{ id: "x", name: "Truck" }]));
    expect(() => mapVehicleTypes(parsed)).toThrow(TransformError);
  });
});

describe("combine", () => {
  const makes = [
    { makeId: 1, makeName: "ONE" },
    { makeId: 2, makeName: "TWO" },
    { makeId: 3, makeName: "THREE" },
  ];

  it("produces the unified structure required by the challenge", () => {
    const types = new Map([
      [1, [{ typeId: 2, typeName: "Passenger Car" }]],
      [2, []],
      [3, [{ typeId: 3, typeName: "Truck" }]],
    ]);

    expect(combine(makes, types)).toEqual([
      { makeId: 1, makeName: "ONE", vehicleTypes: [{ typeId: 2, typeName: "Passenger Car" }] },
      { makeId: 2, makeName: "TWO", vehicleTypes: [] },
      { makeId: 3, makeName: "THREE", vehicleTypes: [{ typeId: 3, typeName: "Truck" }] },
    ]);
  });

  it("omits makes whose vehicle types are unknown", () => {
    const types = new Map([[2, [{ typeId: 3, typeName: "Truck" }]]]);
    expect(combine(makes, types).map((m) => m.makeId)).toEqual([2]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(combine(makes, new Map())).toEqual([]);
    expect(combine([], new Map([[1, []]]))).toEqual([]);
  });
});
