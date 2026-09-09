import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDeviceType } from "./useDeviceType";

function stubViewportWidth(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches =
      (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useDeviceType", () => {
  it.each([
    [320, "mobile"],
    [640, "mobile"],
    [641, "tablet"],
    [800, "tablet"],
    [1023, "tablet"],
    [1024, "desktop"],
    [1920, "desktop"],
  ])("returns %s px -> %s", (width, expected) => {
    stubViewportWidth(width);
    const { result } = renderHook(() => useDeviceType());
    expect(result.current).toBe(expected);
  });
});
