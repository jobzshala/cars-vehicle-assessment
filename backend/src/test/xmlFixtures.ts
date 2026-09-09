const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const envelope = (
  count: number,
  results: string,
  extra = "",
) => `<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Count>${count}</Count>
  <Message>Response returned successfully</Message>${extra}
  <Results>${results}</Results>
</Response>`;

export function makesXml(makes: { id: number | string; name: string }[]): string {
  const items = makes
    .map(
      (make) => `
    <AllVehicleMakes>
      <Make_ID>${make.id}</Make_ID>
      <Make_Name>${escapeXml(make.name)}</Make_Name>
    </AllVehicleMakes>`,
    )
    .join("");
  return envelope(makes.length, items);
}

export function vehicleTypesXml(
  makeId: number,
  types: { id: number | string; name: string }[],
): string {
  const items = types
    .map(
      (type) => `
    <VehicleTypesForMakeIds>
      <VehicleTypeId>${type.id}</VehicleTypeId>
      <VehicleTypeName>${escapeXml(type.name)}</VehicleTypeName>
    </VehicleTypesForMakeIds>`,
    )
    .join("");
  return envelope(types.length, items, `\n  <SearchCriteria>Make ID: ${makeId}</SearchCriteria>`);
}

export const sampleMakes = [
  { id: 440, name: "ASTON MARTIN" },
  { id: 441, name: "TESLA" },
  { id: 442, name: "JAGUAR" },
];

export const sampleTypesByMake: Record<number, { id: number; name: string }[]> = {
  440: [
    { id: 2, name: "Passenger Car" },
    { id: 7, name: "Multipurpose Passenger Vehicle (MPV)" },
  ],
  441: [{ id: 2, name: "Passenger Car" }],
  442: [
    { id: 2, name: "Passenger Car" },
    { id: 7, name: "Multipurpose Passenger Vehicle (MPV)" },
    { id: 3, name: "Truck" },
  ],
};
