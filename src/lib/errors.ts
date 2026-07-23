/** Typed errors that API routes translate into HTTP responses. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }

  static unauthorized(msg = "Not authenticated.") {
    return new ApiError(401, msg);
  }
  static forbidden(msg = "You don't have permission to do that.") {
    return new ApiError(403, msg);
  }
  static notFound(msg = "Not found.") {
    return new ApiError(404, msg);
  }
  static badRequest(msg = "Invalid request.") {
    return new ApiError(400, msg);
  }
  static conflict(msg = "Conflict.") {
    return new ApiError(409, msg);
  }
  static tooManyRequests(msg = "Too many requests. Please try again shortly.") {
    return new ApiError(429, msg);
  }
}
