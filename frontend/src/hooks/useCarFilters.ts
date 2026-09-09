import { useMemo, useState } from "react";
import type { Car } from "../types";

export type SortOption = "model-asc" | "model-desc" | "year-asc" | "year-desc";
export type YearFilter = number | "all";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "model-asc", label: "Model (A–Z)" },
  { value: "model-desc", label: "Model (Z–A)" },
  { value: "year-desc", label: "Year (newest)" },
  { value: "year-asc", label: "Year (oldest)" },
];

export function filterCars(
  cars: Car[],
  { search, year }: { search: string; year: YearFilter },
): Car[] {
  const term = search.trim().toLowerCase();
  return cars.filter(
    (car) =>
      (term === "" || car.model.toLowerCase().includes(term)) &&
      (year === "all" || car.year === year),
  );
}

export function sortCars(cars: Car[], sort: SortOption): Car[] {
  const sorted = [...cars];
  switch (sort) {
    case "model-asc":
      return sorted.sort((a, b) => a.model.localeCompare(b.model));
    case "model-desc":
      return sorted.sort((a, b) => b.model.localeCompare(a.model));
    case "year-asc":
      return sorted.sort((a, b) => a.year - b.year);
    case "year-desc":
      return sorted.sort((a, b) => b.year - a.year);
  }
}

export function useCarFilters(cars: Car[]) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("model-asc");
  const [year, setYear] = useState<YearFilter>("all");

  const availableYears = useMemo(
    () => Array.from(new Set(cars.map((car) => car.year))).sort((a, b) => b - a),
    [cars],
  );

  const filteredCars = useMemo(
    () => sortCars(filterCars(cars, { search, year }), sort),
    [cars, search, year, sort],
  );

  return {
    search,
    setSearch,
    sort,
    setSort,
    year,
    setYear,
    availableYears,
    filteredCars,
  };
}
