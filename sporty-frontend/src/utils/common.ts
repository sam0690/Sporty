export const noop = (): void => {};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const isBrowser = (): boolean => typeof window !== "undefined";
