import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import { CarsPage } from "./CarsPage";
import { CREATE_CAR, GET_CARS } from "../graphql/queries";
import { mockCarsWithTypename } from "../test/fixtures";

const getCarsMock: MockedResponse = {
  request: { query: GET_CARS },
  result: { data: { cars: mockCarsWithTypename } },
};

const createCarMock: MockedResponse = {
  request: { query: CREATE_CAR },
  variableMatcher: () => true,
  result: {
    data: {
      createCar: {
        __typename: "Car",
        id: "new-1",
        make: "Tesla",
        model: "Model 3",
        year: 2025,
        color: "Black",
        mobile: "data:image/svg+xml,placeholder",
        tablet: "data:image/svg+xml,placeholder",
        desktop: "data:image/svg+xml,placeholder",
      },
    },
  },
};

const cardTitles = () =>
  screen.getAllByTestId("car-card").map((card) => within(card).getByRole("heading").textContent);

function renderPage(mocks: MockedResponse[] = [getCarsMock]) {
  return render(
    <MockedProvider mocks={mocks}>
      <CarsPage />
    </MockedProvider>,
  );
}

describe("CarsPage", () => {
  it("loads cars from GraphQL and shows them sorted by model", async () => {
    renderPage();

    expect(screen.getByLabelText("Loading cars")).toBeInTheDocument();
    await screen.findByText("Audi Q5");

    expect(cardTitles()).toEqual(["Audi A3", "Audi Q5", "Audi R8"]);
  });

  it("filters the list by model search", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Audi Q5");

    await user.type(screen.getByLabelText(/search by model/i), "r8");

    expect(cardTitles()).toEqual(["Audi R8"]);
  });

  it("re-orders the list when the sort option changes", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Audi Q5");

    await user.click(screen.getByRole("combobox", { name: /sort by/i }));
    await user.click(screen.getByRole("option", { name: "Year (newest)" }));

    expect(cardTitles()).toEqual(["Audi R8", "Audi Q5", "Audi A3"]);
  });

  it("filters by year", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Audi Q5");

    await user.click(screen.getByRole("combobox", { name: /year/i }));
    await user.click(screen.getByRole("option", { name: "2022" }));

    expect(cardTitles()).toEqual(["Audi A3"]);
  });

  it("adds a submitted car to the list via the mocked CreateCar mutation", async () => {
    const user = userEvent.setup();
    renderPage([getCarsMock, createCarMock]);
    await screen.findByText("Audi Q5");

    await user.type(screen.getByRole("textbox", { name: /^make/i }), "Tesla");
    await user.type(screen.getByRole("textbox", { name: /^model/i }), "Model 3");
    await user.type(screen.getByRole("spinbutton", { name: /^year/i }), "2025");
    await user.type(screen.getByRole("textbox", { name: /^color/i }), "Black");
    await user.click(screen.getByRole("button", { name: /add car/i }));

    await screen.findByText("Tesla Model 3");
    expect(cardTitles()).toEqual(["Audi A3", "Tesla Model 3", "Audi Q5", "Audi R8"]);
  });
});
