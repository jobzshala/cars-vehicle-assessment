import { XmlParseError } from "../../domain/errors";
import { parseXml } from "./xmlParser";
import { makesXml } from "../../test/xmlFixtures";

describe("parseXml", () => {
  it("parses a valid NHTSA document and always wraps repeated elements in arrays", () => {
    const parsed = parseXml(makesXml([{ id: 440, name: "ASTON MARTIN" }])) as {
      Response: { Count: string; Results: { AllVehicleMakes: unknown[] } };
    };

    expect(parsed.Response.Count).toBe("1");
    expect(Array.isArray(parsed.Response.Results.AllVehicleMakes)).toBe(true);
    expect(parsed.Response.Results.AllVehicleMakes[0]).toEqual({
      Make_ID: "440",
      Make_Name: "ASTON MARTIN",
    });
  });

  it("ignores attributes and the XML declaration", () => {
    const parsed = parseXml(makesXml([])) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(["Response"]);
  });

  it("throws XmlParseError for empty input", () => {
    expect(() => parseXml("")).toThrow(XmlParseError);
    expect(() => parseXml("   \n")).toThrow(XmlParseError);
  });

  it("throws XmlParseError with position info for malformed XML", () => {
    let caught: unknown;
    try {
      parseXml("<Response><Results><AllVehicleMakes></Results></Response>");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(XmlParseError);
    expect((caught as XmlParseError).message).toMatch(/Invalid XML/);
    expect((caught as XmlParseError).context).toHaveProperty("line");
  });

  it("throws XmlParseError for an HTML error page", () => {
    expect(() => parseXml("<html><body>503 Service Unavailable</body>")).toThrow(XmlParseError);
  });
});
