export interface AppErrorOptions {
  cause?: unknown;
  context?: Record<string, unknown>;
}

export abstract class AppError extends Error {
  abstract readonly code: string;
  readonly context: Record<string, unknown> | undefined;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.context = options.context;
  }
}

export class ExternalApiError extends AppError {
  readonly code = "EXTERNAL_API_ERROR";
}

export class XmlParseError extends AppError {
  readonly code = "XML_PARSE_ERROR";
}

export class TransformError extends AppError {
  readonly code = "TRANSFORM_ERROR";
}

export class PersistenceError extends AppError {
  readonly code = "PERSISTENCE_ERROR";
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
