export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  source: T,
  keys: K[],
): Pick<T, K> {
  return keys.reduce(
    (result, key) => {
      result[key] = source[key];
      return result;
    },
    {} as Pick<T, K>,
  );
}

export function omit<T extends Record<string, unknown>, K extends keyof T>(
  source: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...source };
  keys.forEach((key) => {
    delete result[key];
  });
  return result;
}
