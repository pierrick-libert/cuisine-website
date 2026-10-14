/** Thrown for any request-input validation failure; handlers map this to HTTP 400. */
export class ValidationError extends Error {}

/** Thrown when a translation request could not be completed; handlers map this to HTTP 502. */
export class TranslationError extends Error {}
