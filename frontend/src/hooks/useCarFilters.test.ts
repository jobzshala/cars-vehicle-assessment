import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { filterCars, sortCars, useCarFilters } from "./useCarFilters";
import { mockCars } from "../test/fixtures";

const models = (cars: { model: string }[]) => cars.map((car) => car.model);

describe("filterCars", () => {
  it("returns all cars when search is empty and year is 'all'", () => {
    expect(filterCars(mockCars, { search: "", year: "all" })).toHaveLength(3);
  });

  it("filters by model, case-insensitively and ignoring surrounding whitespace", () => {
    expect(models(filterCars(mockCars, { search: "  q5 ", year: "all" }))).toEqual(["Q5"]);
  });

  it("matches partial model names", () => {
    expect(models(filterCars(mockCars, { search: "3", year: "all" }))).toEqual(["A3"]);
  });

  it("filters by year", () => {
    expect(models(filterCars(mockCars, { search: "", year: 2024 }))).toEqual(["R8"]);
  });

  it("combines model search and year filter", () => {
    expect(filterCars(mockCars, { search: "R8", year: 2022 })).toHaveLength(0);
    expect(models(filterCars(mockCars, { search: "R8", year: 2024 }))).toEqual(["R8"]);
  });
});

describe("sortCars", () => {
  it("sorts by model ascending", () => {
    expect(models(sortCars(mockCars, "model-asc"))).toEqual(["A3", "Q5", "R8"]);
  });

  it("sorts by model descending", () => {
    expect(models(sortCars(mockCars, "model-desc"))).toEqual(["R8", "Q5", "A3"]);
  });

  it("sorts by year ascending", () => {
    expect(models(sortCars(mockCars, "year-asc"))).toEqual(["A3", "Q5", "R8"]);
  });

  it("sorts by year descending", () => {
    expect(models(sortCars(mockCars, "year-desc"))).toEqual(["R8", "Q5", "A3"]);
  });

  it("does not mutate the input array", () => {
    const input = [...mockCars];
    sortCars(input, "model-desc");
    expect(models(input)).toEqual(["Q5", "A3", "R8"]);
  });
});

describe("useCarFilters", () => {
  it("defaults to model ascending with no filters", () => {
    const { result } = renderHook(() => useCarFilters(mockCars));
    expect(result.current.search).toBe("");
    expect(result.current.sort).toBe("model-asc");
    expect(result.current.year).toBe("all");
    expect(models(result.current.filteredCars)).toEqual(["A3", "Q5", "R8"]);
  });

  it("exposes available years, newest first, without duplicates", () => {
    const withDuplicateYear = [...mockCars, { ...mockCars[0], id: "4" }];
    const { result } = renderHook(() => useCarFilters(withDuplicateYear));
    expect(result.current.availableYears).toEqual([2024, 2023, 2022]);
  });

  it("applies search, year and sort together", () => {
    const { result } = renderHook(() => useCarFilters(mockCars));

    act(() => result.current.setSort("year-desc"));
    expect(models(result.current.filteredCars)).toEqual(["R8", "Q5", "A3"]);

    act(() => result.current.setSearch("a"));
    expect(models(result.current.filteredCars)).toEqual(["A3"]);

    act(() => result.current.setSearch(""));
    act(() => result.current.setYear(2023));
    expect(models(result.current.filteredCars)).toEqual(["Q5"]);
  });

  it("recomputes when the input list changes", () => {
    const { result, rerender } = renderHook(({ cars }) => useCarFilters(cars), {
      initialProps: { cars: mockCars },
    });
    expect(result.current.filteredCars).toHaveLength(3);

    rerender({ cars: mockCars.slice(0, 1) });
    expect(result.current.filteredCars).toHaveLength(1);
  });
});
