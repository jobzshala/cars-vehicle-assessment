import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddCarForm } from "./AddCarForm";

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^make/i), "Tesla");
  await user.type(screen.getByLabelText(/^model/i), "Model 3");
  await user.type(screen.getByLabelText(/^year/i), "2025");
  await user.type(screen.getByLabelText(/^color/i), "Black");
}

describe("AddCarForm", () => {
  it("shows validation errors and does not submit when fields are empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddCarForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /add car/i }));

    expect(screen.getByText("Make is required")).toBeInTheDocument();
    expect(screen.getByText("Model is required")).toBeInTheDocument();
    expect(screen.getByText("Year is required")).toBeInTheDocument();
    expect(screen.getByText("Color is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range year", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddCarForm onSubmit={onSubmit} />);

    await fillForm(user);
    await user.clear(screen.getByLabelText(/^year/i));
    await user.type(screen.getByLabelText(/^year/i), "1800");
    await user.click(screen.getByRole("button", { name: /add car/i }));

    expect(screen.getByText(/year must be between 1886/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits trimmed values with a placeholder image when no URL is given, then resets", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AddCarForm onSubmit={onSubmit} />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /add car/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0];
    expect(input).toMatchObject({ make: "Tesla", model: "Model 3", year: 2025, color: "Black" });
    expect(input.mobile).toMatch(/^data:image\/svg\+xml/);
    expect(input.tablet).toBe(input.mobile);
    expect(input.desktop).toBe(input.mobile);

    expect(screen.getByLabelText(/^make/i)).toHaveValue("");
    expect(screen.getByLabelText(/^model/i)).toHaveValue("");
  });

  it("uses the provided image URL for every breakpoint", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddCarForm onSubmit={onSubmit} />);

    await fillForm(user);
    await user.type(screen.getByLabelText(/image url/i), "https://img.test/tesla.jpg");
    await user.click(screen.getByRole("button", { name: /add car/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        mobile: "https://img.test/tesla.jpg",
        tablet: "https://img.test/tesla.jpg",
        desktop: "https://img.test/tesla.jpg",
      }),
    );
  });

  it("disables the button and shows the error while submitting / on failure", () => {
    render(<AddCarForm onSubmit={vi.fn()} submitting error="Server exploded" />);

    expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Server exploded");
  });
});
