/**
 * Structured request logger.
 * Logs method, path, status and duration using only the Node built-in console.
 * The log line always carries the requestId so it can be correlated with error responses.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    console[level](
      JSON.stringify({
        level,
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms,
        ts: new Date().toISOString(),
      }),
    );
  });
  next();
}
