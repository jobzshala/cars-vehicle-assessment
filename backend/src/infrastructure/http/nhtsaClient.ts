import { ExternalApiError, errorMessage } from "../../domain/errors";
import type { Logger } from "../logging/logger";

export interface NhtsaClientOptions {
  baseUrl: string;
  timeoutMs: number;
  retries: number;
  retryBaseDelayMs: number;
  logger: Logger;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

type Attempt =
  { ok: true; body: string } | { ok: false; error: ExternalApiError; retriable: boolean };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class NhtsaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly retryBaseDelayMs: number;
  private readonly logger: Logger;
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(options: NhtsaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs;
    this.retries = options.retries;
    this.retryBaseDelayMs = options.retryBaseDelayMs;
    this.logger = options.logger.child({ module: "nhtsa-client" });
    this.fetchFn = options.fetchFn ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
  }

  getAllMakesXml(): Promise<string> {
    return this.getXml("/getallmakes?format=XML");
  }

  async getVehicleTypesForMakeXml(makeId: number): Promise<string> {
    if (!Number.isInteger(makeId) || makeId < 0) {
      throw new ExternalApiError(`Invalid make id: ${makeId}`);
    }
    return this.getXml(`/GetVehicleTypesForMakeId/${makeId}?format=xml`);
  }

  private async getXml(path: string): Promise<string> {
    const url = `${this.baseUrl}${path}`;
    let lastError: ExternalApiError | undefined;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const result = await this.attempt(url);
      if (result.ok) return result.body;

      lastError = result.error;
      const attemptsLeft = this.retries - attempt;
      if (!result.retriable || attemptsLeft === 0) break;

      const delay = this.backoffDelay(attempt);
      this.logger.warn(
        { url, attempt: attempt + 1, attemptsLeft, delayMs: delay, err: result.error },
        "NHTSA request failed, retrying",
      );
      await this.sleep(delay);
    }

    this.logger.error({ url, err: lastError }, "NHTSA request failed permanently");
    throw new ExternalApiError(`NHTSA request failed: ${path}`, {
      cause: lastError,
      context: { url, attempts: this.retries + 1 },
    });
  }

  private async attempt(url: string): Promise<Attempt> {
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: { accept: "application/xml" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      return {
        ok: false,
        retriable: true,
        error: new ExternalApiError(
          timedOut ? `Request timed out after ${this.timeoutMs}ms` : errorMessage(error),
          { cause: error, context: { url } },
        ),
      };
    }

    if (response.ok) {
      return { ok: true, body: await response.text() };
    }

    const retriable = response.status >= 500 || response.status === 429;
    return {
      ok: false,
      retriable,
      error: new ExternalApiError(`NHTSA responded with HTTP ${response.status}`, {
        context: { url, status: response.status },
      }),
    };
  }

  private backoffDelay(attempt: number): number {
    const exponential = this.retryBaseDelayMs * 2 ** attempt;
    const jitter = exponential * 0.2 * this.random();
    return Math.round(exponential + jitter);
  }
}
