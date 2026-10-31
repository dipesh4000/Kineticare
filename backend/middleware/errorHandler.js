/**
 * Central error-handling middleware.
 *
 * Every error response conforms to the envelope:
 *   { code, message, requestId }
 *
 * Operational errors (status < 500) expose their message.
 * Unexpected errors (status >= 500) are opaque to callers; the real message
 * is written to the server log.
 */

/**
 * Create an operational AppError that travels through Express without leaking
 * internal detail. Any code can do:
 *
 *   throw new AppError('Patient access denied.', 403, 'PATIENT_ACCESS_DENIED');
 */
export class AppError extends Error {
  /** @param {string} message @param {number} [status=400] @param {string} [code] */
  constructor(message, status = 400, code) {
    super(message);
    this.status = status;
    this.code = code ?? httpCodeName(status);
    this.isOperational = true;
  }
}

function httpCodeName(status) {
  const map = {
    400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN',
    404: 'NOT_FOUND', 405: 'METHOD_NOT_ALLOWED', 409: 'CONFLICT',
    422: 'UNPROCESSABLE', 429: 'RATE_LIMITED', 500: 'INTERNAL_ERROR',
    502: 'BAD_GATEWAY', 503: 'SERVICE_UNAVAILABLE',
  };
  return map[status] ?? 'ERROR';
}

/**
 * Express 4-argument error handler — must be the last app.use() call.
 * @type {import('express').ErrorRequestHandler}
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status ?? err.statusCode ?? 500;
  const isOperational = err.isOperational === true || status < 500;
  const code = err.code ?? httpCodeName(status);

  if (!isOperational) {
    // Log the real error server-side; never surface it to the caller.
    console.error(
      JSON.stringify({
        level: 'error',
        requestId: req.requestId,
        message: err.message,
        stack: err.stack,
        ts: new Date().toISOString(),
      }),
    );
  }

  res.status(status).json({
    code,
    message: isOperational ? err.message : 'An unexpected error occurred. Please try again.',
    requestId: req.requestId,
  });
}

/**
 * 404 catch-all — mount after all other routes.
 * @type {import('express').RequestHandler}
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found.`,
    requestId: req.requestId,
  });
}

/**
 * Wraps an async route handler so that any rejected promise is forwarded to
 * the central error handler instead of causing an unhandled rejection.
 *
 * Usage:
 *   router.get('/path', asyncRoute(async (req, res) => { ... }));
 *
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<void>} fn
 * @returns {import('express').RequestHandler}
 */
export const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
