export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (code: string, msg: string, details?: unknown) =>
  new ApiError(400, code, msg, details);
export const unauthorized = (msg = 'unauthorized') =>
  new ApiError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'forbidden') => new ApiError(403, 'FORBIDDEN', msg);
export const notFound = (code: string, msg: string) => new ApiError(404, code, msg);
export const conflict = (code: string, msg: string) => new ApiError(409, code, msg);
