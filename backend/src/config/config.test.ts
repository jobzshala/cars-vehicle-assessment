import { ConfigError, loadConfig } from "./index";

const validEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/vehicles",
};

describe("loadConfig", () => {
  it("applies defaults and coerces numeric values", () => {
    const config = loadConfig({ ...validEnv, PORT: "4000", INGEST_CONCURRENCY: "5" });

    expect(config.NODE_ENV).toBe("development");
    expect(config.PORT).toBe(4000);
    expect(config.INGEST_CONCURRENCY).toBe(5);
    expect(config.LOG_LEVEL).toBe("info");
    expect(config.NHTSA_BASE_URL).toBe("https://vpic.nhtsa.dot.gov/api/vehicles");
    expect(config.HTTP_RETRIES).toBe(3);
    expect(config.INGEST_ON_STARTUP).toBe(true);
    expect(config.INGEST_MAKE_LIMIT).toBeUndefined();
  });

  it("parses feature flags and optional limits", () => {
    const config = loadConfig({ ...validEnv, INGEST_ON_STARTUP: "false", INGEST_MAKE_LIMIT: "25" });

    expect(config.INGEST_ON_STARTUP).toBe(false);
    expect(config.INGEST_MAKE_LIMIT).toBe(25);
  });

  it("treats empty strings as unset so defaults still apply", () => {
    const config = loadConfig({ ...validEnv, PORT: "", INGEST_MAKE_LIMIT: "" });

    expect(config.PORT).toBe(3000);
    expect(config.INGEST_MAKE_LIMIT).toBeUndefined();
  });

  it("ignores unrelated environment variables", () => {
    const config = loadConfig({ ...validEnv, PATH: "/usr/bin", HOME: "/home/x" });

    expect(config).not.toHaveProperty("PATH");
  });

  it("fails when DATABASE_URL is missing", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("reports every invalid value in one error", () => {
    expect(() =>
      loadConfig({ ...validEnv, PORT: "abc", LOG_LEVEL: "loud", HTTP_RETRIES: "99" }),
    ).toThrow(/PORT[\s\S]*LOG_LEVEL[\s\S]*HTTP_RETRIES/);
  });

  it("rejects a malformed NHTSA base URL", () => {
    expect(() => loadConfig({ ...validEnv, NHTSA_BASE_URL: "not a url" })).toThrow(
      /NHTSA_BASE_URL/,
    );
  });
});
