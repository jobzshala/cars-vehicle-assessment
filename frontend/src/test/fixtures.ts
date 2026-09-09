import type { Car } from "../types";

export const mockCars: Car[] = [
  {
    id: "1",
    make: "Audi",
    model: "Q5",
    year: 2023,
    color: "Blue",
    mobile: "https://img.test/q5-mobile.jpg",
    tablet: "https://img.test/q5-tablet.jpg",
    desktop: "https://img.test/q5-desktop.jpg",
  },
  {
    id: "2",
    make: "Audi",
    model: "A3",
    year: 2022,
    color: "Red",
    mobile: "https://img.test/a3-mobile.jpg",
    tablet: "https://img.test/a3-tablet.jpg",
    desktop: "https://img.test/a3-desktop.jpg",
  },
  {
    id: "3",
    make: "Audi",
    model: "R8",
    year: 2024,
    color: "White",
    mobile: "https://img.test/r8-mobile.jpg",
    tablet: "https://img.test/r8-tablet.jpg",
    desktop: "https://img.test/r8-desktop.jpg",
  },
];

// Apollo's MockedProvider needs __typename to resolve the CarFields fragment
export const mockCarsWithTypename = mockCars.map((car) => ({
  __typename: "Car",
  ...car,
}));
