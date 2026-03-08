type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerOptions {
  prefix?: string;
  level?: LogLevel;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function createLogger(options: LoggerOptions = {}) {
  const { prefix = "better-media", level = "info" } = options;
  const minLevel = LEVEL_PRIORITY[level];

  function log(level: LogLevel, ...args: unknown[]) {
    if (LEVEL_PRIORITY[level] >= minLevel) {
      const timestamp = new Date().toISOString();
      console[level === "debug" ? "log" : level](`[${timestamp}] [${prefix}]`, ...args);
    }
  }

  return {
    debug: (...args: unknown[]) => log("debug", ...args),
    info: (...args: unknown[]) => log("info", ...args),
    warn: (...args: unknown[]) => log("warn", ...args),
    error: (...args: unknown[]) => log("error", ...args),
  };
}
