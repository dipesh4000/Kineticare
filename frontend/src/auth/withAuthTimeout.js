export async function withAuthTimeout(operation, timeoutMs = 30000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Sign-in is taking too long. Check your connection and try again.')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
