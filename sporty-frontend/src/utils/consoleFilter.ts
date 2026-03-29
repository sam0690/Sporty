type ConsoleMethod = "log" | "info" | "warn" | "error";

export function withConsoleFilter<T>(blockedWords: string[], run: () => T): T {
  const originalMethods: Partial<
    Record<ConsoleMethod, (...args: unknown[]) => void>
  > = {};

  const shouldBlock = (args: unknown[]) => {
    const text = args
      .map((arg) => String(arg))
      .join(" ")
      .toLowerCase();
    return blockedWords.some((word) => text.includes(word.toLowerCase()));
  };

  (["log", "info", "warn", "error"] as ConsoleMethod[]).forEach((method) => {
    originalMethods[method] = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      if (shouldBlock(args)) {
        return;
      }
      originalMethods[method]?.(...args);
    };
  });

  try {
    return run();
  } finally {
    (["log", "info", "warn", "error"] as ConsoleMethod[]).forEach((method) => {
      if (originalMethods[method]) {
        console[method] = originalMethods[
          method
        ] as (typeof console)[ConsoleMethod];
      }
    });
  }
}
