import { graphql, HttpResponse, delay } from "msw";
import { v4 as uuid } from "uuid";
import type { Car, NewCarInput } from "../types";

export const carList: Car[] = [
  {
    id: "1",
    make: "Audi",
    model: "Q5",
    year: 2023,
    color: "Blue",
    mobile:
      "https://media.audi.com/is/image/audi/nemo/uk/models/q5-tfsi-e/2023-trims/mobile/q5_sportback_tfsie_sport_1280x1080px.png?width=300",
    tablet:
      "https://media.audi.com/is/image/audi/nemo/uk/models/q5-tfsi-e/2023-trims/mobile/q5_sportback_tfsie_sport_1280x1080px.png?width=900",
    desktop:
      "https://media.audi.com/is/image/audi/nemo/uk/models/q5-tfsi-e/2023-trims/mobile/q5_sportback_tfsie_sport_1280x1080px.png?width=1280",
  },
  {
    id: "2",
    make: "Audi",
    model: "A3",
    year: 2022,
    color: "Red",
    mobile:
      "https://nar.media.audi.com/is/image/audinar/nemo/ca/Models/a3/MY25/1920x1920-A3-P1.jpg?width=300",
    tablet:
      "https://nar.media.audi.com/is/image/audinar/nemo/ca/Models/a3/MY25/1920x1920-A3-P1.jpg?width=900",
    desktop:
      "https://nar.media.audi.com/is/image/audinar/nemo/ca/Models/a3/MY25/1920x1920-A3-P1.jpg?width=1200",
  },
  {
    id: "3",
    make: "Audi",
    model: "R8",
    year: 2024,
    color: "White",
    mobile:
      "https://www.intotheblue.co.uk/images/Suppliers/6thGear/6th-Gear-Experience---Audi-Thrill-2024/r8-white-600X600-1.jpg?width=300",
    tablet:
      "https://www.intotheblue.co.uk/images/Suppliers/6thGear/6th-Gear-Experience---Audi-Thrill-2024/r8-white-600X600-1.jpg?width=900",
    desktop:
      "https://www.intotheblue.co.uk/images/Suppliers/6thGear/6th-Gear-Experience---Audi-Thrill-2024/r8-white-600X600-1.jpg?width=1200",
  },
];

interface GetCarVariables {
  make?: string;
  model?: string;
  year?: number;
  color?: string;
}

const matchesIgnoreCase = (value: string, filter?: string) =>
  filter === undefined || value.toLowerCase() === filter.toLowerCase();

// Apollo needs __typename to resolve fragments like `...CarFields on Car`
const withTypename = (car: Car) => ({ __typename: "Car" as const, ...car });

export const handlers = [
  graphql.query("GetCars", () => {
    return HttpResponse.json({ data: { cars: carList.map(withTypename) } });
  }),

  graphql.query<{ car: Car | null }, GetCarVariables>("GetCar", ({ variables }) => {
    const { make, model, year, color } = variables;
    const car =
      carList.find(
        (c) =>
          matchesIgnoreCase(c.make, make) &&
          matchesIgnoreCase(c.model, model) &&
          (year === undefined || c.year === year) &&
          matchesIgnoreCase(c.color, color),
      ) ?? null;
    return HttpResponse.json({ data: { car: car ? withTypename(car) : null } });
  }),

  graphql.mutation<{ createCar: Car }, { input: NewCarInput }>(
    "CreateCar",
    async ({ variables }) => {
      await delay(500);
      const createdCar: Car = { id: uuid(), ...variables.input };
      return HttpResponse.json({ data: { createCar: withTypename(createdCar) } });
    },
  ),
];
