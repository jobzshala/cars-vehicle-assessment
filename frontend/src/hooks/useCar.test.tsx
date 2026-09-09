import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import type { ReactNode } from "react";
import { useCar } from "./useCar";
import { GET_CAR } from "../graphql/queries";
import { mockCarsWithTypename } from "../test/fixtures";

const makeWrapper =
  (mocks: MockedResponse[]) =>
  ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks}>{children}</MockedProvider>
  );

describe("useCar", () => {
  it("fetches a single car matching the given criteria", async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: GET_CAR, variables: { model: "R8", year: 2024 } },
        result: { data: { car: mockCarsWithTypename[2] } },
      },
    ];

    const { result } = renderHook(() => useCar({ model: "R8", year: 2024 }), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.car).toMatchObject({ id: "3", model: "R8", year: 2024 });
  });

  it("returns null when nothing matches", async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: GET_CAR, variables: { make: "Ferrari" } },
        result: { data: { car: null } },
      },
    ];

    const { result } = renderHook(() => useCar({ make: "Ferrari" }), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.car).toBeNull();
  });

  it("skips the query when no criteria are provided", () => {
    const { result } = renderHook(() => useCar({}), { wrapper: makeWrapper([]) });

    expect(result.current.loading).toBe(false);
    expect(result.current.car).toBeNull();
  });
});
