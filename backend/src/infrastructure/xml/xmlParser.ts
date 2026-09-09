import { XMLParser, XMLValidator } from "fast-xml-parser";
import { XmlParseError } from "../../domain/errors";

// Repeated elements that must always be arrays, even when there is exactly one.
const LIST_TAGS = new Set(["AllVehicleMakes", "VehicleTypesForMakeIds"]);

const parser = new XMLParser({
  ignoreAttributes: true,
  ignoreDeclaration: true,
  trimValues: true,
  // Keep values as strings; the domain layer decides what is numeric
  // (a make literally named "123" must stay a string).
  parseTagValue: false,
  isArray: (tagName) => LIST_TAGS.has(tagName),
});

export function parseXml(xml: string): unknown {
  if (typeof xml !== "string" || xml.trim() === "") {
    throw new XmlParseError("XML document is empty");
  }

  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new XmlParseError(`Invalid XML: ${validation.err.msg}`, {
      context: { line: validation.err.line, col: validation.err.col, code: validation.err.code },
    });
  }

  try {
    return parser.parse(xml);
  } catch (error) {
    throw new XmlParseError("Failed to parse XML document", { cause: error });
  }
}
