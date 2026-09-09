import { mapWithConcurrency } from "./mapWithConcurrency";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("mapWithConcurrency", () => {
  it("maps every item and preserves input order", async () => {
    const result = await mapWithConcurrency([3, 1, 2], 2, async (n) => {
      await new Promise((resolve) => setTimeout(resolve, n * 5));
      return n * 10;
    });

    expect(result).toEqual([30, 10, 20]);
  });

  it("never runs more than `limit` tasks at once", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      3,
      async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await tick();
        inFlight--;
      },
    );

    expect(maxInFlight).toBe(3);
  });

  it("passes the index to the mapper", async () => {
    const indexes = await mapWithConcurrency(["a", "b", "c"], 5, async (_, i) => i);
    expect(indexes).toEqual([0, 1, 2]);
  });

  it("returns an empty array for no items", async () => {
    const fn = vi.fn();
    await expect(mapWithConcurrency([], 4, fn)).resolves.toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("rejects with the first error and stops starting new work", async () => {
    const started: number[] = [];

    const promise = mapWithConcurrency([1, 2, 3, 4, 5, 6], 1, async (n) => {
      started.push(n);
      if (n === 2) throw new Error("boom");
    });

    await expect(promise).rejects.toThrow("boom");
    expect(started).toEqual([1, 2]);
  });

  it("rejects an invalid limit", async () => {
    await expect(mapWithConcurrency([1], 0, async (n) => n)).rejects.toThrow(RangeError);
    await expect(mapWithConcurrency([1], 1.5, async (n) => n)).rejects.toThrow(RangeError);
  });
});
