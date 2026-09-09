import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CarCard } from "./CarCard";
import { useDeviceType } from "../hooks/useDeviceType";
import { mockCars } from "../test/fixtures";

vi.mock("../hooks/useDeviceType", () => ({
  useDeviceType: vi.fn(),
}));

const car = mockCars[0];

describe("CarCard", () => {
  beforeEach(() => {
    vi.mocked(useDeviceType).mockReturnValue("desktop");
  });

  it("renders make, model, year and color", () => {
    render(<CarCard car={car} />);

    expect(screen.getByRole("heading", { name: "Audi Q5" })).toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
  });

  it.each([
    ["mobile", car.mobile],
    ["tablet", car.tablet],
    ["desktop", car.desktop],
  ] as const)("uses the %s image for that device type", (deviceType, expectedSrc) => {
    vi.mocked(useDeviceType).mockReturnValue(deviceType);

    render(<CarCard car={car} />);

    expect(screen.getByRole("img", { name: "Audi Q5" })).toHaveAttribute("src", expectedSrc);
  });
});
