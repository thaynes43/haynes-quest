export class AppError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 502 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function asAppError(error: unknown): AppError {
  return error instanceof AppError
    ? error
    : new AppError(503, 'SERVICE_UNAVAILABLE', 'Service unavailable');
}
