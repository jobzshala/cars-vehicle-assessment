import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CarList } from "./CarList";
import { mockCars } from "../test/fixtures";

describe("CarList", () => {
  it("shows a spinner while loading", () => {
    render(<CarList cars={[]} loading />);
    expect(screen.getByLabelText("Loading cars")).toBeInTheDocument();
    expect(screen.queryByTestId("car-card")).not.toBeInTheDocument();
  });

  it("shows the error message when loading fails", () => {
    render(<CarList cars={[]} error={new Error("Boom")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load cars: Boom");
  });

  it("shows an empty state when there are no cars", () => {
    render(<CarList cars={[]} />);
    expect(screen.getByText("No cars found.")).toBeInTheDocument();
  });

  it("renders one card per car in the given order", () => {
    render(<CarList cars={mockCars} />);

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(["Audi Q5", "Audi A3", "Audi R8"]);
    expect(screen.getAllByTestId("car-card")).toHaveLength(3);
  });
});
