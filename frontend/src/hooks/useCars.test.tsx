import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import type { ReactNode } from "react";
import { useCars } from "./useCars";
import { GET_CARS } from "../graphql/queries";
import { mockCarsWithTypename } from "../test/fixtures";

const makeWrapper =
  (mocks: MockedResponse[]) =>
  ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks}>{children}</MockedProvider>
  );

describe("useCars", () => {
  it("returns an empty list while loading, then the fetched cars", async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: GET_CARS },
        result: { data: { cars: mockCarsWithTypename } },
      },
    ];

    const { result } = renderHook(() => useCars(), { wrapper: makeWrapper(mocks) });

    expect(result.current.loading).toBe(true);
    expect(result.current.cars).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeUndefined();
    expect(result.current.cars).toHaveLength(3);
    expect(result.current.cars[0]).toMatchObject({
      id: "1",
      make: "Audi",
      model: "Q5",
      mobile: "https://img.test/q5-mobile.jpg",
    });
  });

  it("exposes the error when the query fails", async () => {
    const mocks: MockedResponse[] = [
      { request: { query: GET_CARS }, error: new Error("Network down") },
    ];

    const { result } = renderHook(() => useCars(), { wrapper: makeWrapper(mocks) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error?.message).toBe("Network down");
    expect(result.current.cars).toEqual([]);
  });
});
