/**
 * Rejects if `promise` has not settled within `ms`. Used for the wait until a model starts replying,
 * not for the whole stream, so long replies are never cut off.
 */
export function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(message);
      error.code = 'TIMEOUT';
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
