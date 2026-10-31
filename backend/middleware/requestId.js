/**
 * Request-ID middleware.
 * Stamps every request with a UUID so all log lines and error responses share the same correlation handle.
 */
import { randomUUID } from 'node:crypto';

export function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || randomUUID();
  req.requestId = id;
  res.set('X-Request-Id', id);
  next();
}
