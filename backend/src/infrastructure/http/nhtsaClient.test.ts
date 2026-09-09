import { ExternalApiError } from "../../domain/errors";
import { createSilentLogger } from "../logging/logger";
import { NhtsaClient } from "./nhtsaClient";

const BASE_URL = "https://vpic.example.test/api/vehicles/";

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "application/xml" } });
}

const mockFetch = (...responses: Array<Response | Error>) => {
  const fetchFn = vi.fn<typeof fetch>();
  for (const response of responses) {
    if (response instanceof Error) fetchFn.mockRejectedValueOnce(response);
    else fetchFn.mockResolvedValueOnce(response);
  }
  return fetchFn;
};

function createClient(fetchFn: typeof fetch, overrides: Partial<{ retries: number }> = {}) {
  const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
  const client = new NhtsaClient({
    baseUrl: BASE_URL,
    timeoutMs: 50,
    retries: overrides.retries ?? 2,
    retryBaseDelayMs: 100,
    logger: createSilentLogger(),
    fetchFn,
    sleep,
    random: () => 0,
  });
  return { client, sleep };
}

describe("NhtsaClient", () => {
  it("fetches all makes from the correct URL and returns the XML body", async () => {
    const fetchFn = mockFetch(xmlResponse("<Response/>"));
    const { client } = createClient(fetchFn);

    await expect(client.getAllMakesXml()).resolves.toBe("<Response/>");

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://vpic.example.test/api/vehicles/getallmakes?format=XML");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("builds the vehicle-types URL from the make id", async () => {
    const fetchFn = mockFetch(xmlResponse("<Response/>"));
    const { client } = createClient(fetchFn);

    await client.getVehicleTypesForMakeXml(440);

    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "https://vpic.example.test/api/vehicles/GetVehicleTypesForMakeId/440?format=xml",
    );
  });

  it("rejects an invalid make id without making a request", async () => {
    const fetchFn = mockFetch();
    const { client } = createClient(fetchFn);

    await expect(client.getVehicleTypesForMakeXml(1.5)).rejects.toThrow(ExternalApiError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("retries on 5xx with exponential backoff and succeeds", async () => {
    const fetchFn = mockFetch(
      xmlResponse("boom", 503),
      xmlResponse("boom", 500),
      xmlResponse("<Response/>"),
    );
    const { client, sleep } = createClient(fetchFn);

    await expect(client.getAllMakesXml()).resolves.toBe("<Response/>");

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([100, 200]);
  });

  it("retries on network errors and timeouts", async () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    const fetchFn = mockFetch(new TypeError("fetch failed"), timeout, xmlResponse("<Response/>"));
    const { client } = createClient(fetchFn);

    await expect(client.getAllMakesXml()).resolves.toBe("<Response/>");
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("gives up after the configured number of retries", async () => {
    const fetchFn = mockFetch(
      xmlResponse("down", 502),
      xmlResponse("down", 502),
      xmlResponse("down", 502),
    );
    const { client, sleep } = createClient(fetchFn, { retries: 2 });

    const promise = client.getAllMakesXml();
    await expect(promise).rejects.toThrow(ExternalApiError);
    await expect(promise).rejects.toThrow(/getallmakes/);

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 4xx responses", async () => {
    const fetchFn = mockFetch(xmlResponse("nope", 404));
    const { client, sleep } = createClient(fetchFn);

    await expect(client.getAllMakesXml()).rejects.toThrow(ExternalApiError);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("wraps the last failure as the cause with request context", async () => {
    const fetchFn = mockFetch(xmlResponse("down", 500));
    const { client } = createClient(fetchFn, { retries: 0 });

    let caught: unknown;
    try {
      await client.getAllMakesXml();
    } catch (error) {
      caught = error;
    }

    const error = caught as ExternalApiError;
    expect(error.code).toBe("EXTERNAL_API_ERROR");
    expect(error.context).toMatchObject({ attempts: 1 });
    expect((error.cause as ExternalApiError).context).toMatchObject({ status: 500 });
  });
});
