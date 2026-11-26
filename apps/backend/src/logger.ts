import winston from "winston";

import { getRequestId } from "./utils/requestContext.ts";

// Reads the environment itself instead of importing config.ts, so route
// modules can import the logger without requiring a valid environment.
type LogLevel = "none" | "minimal" | "all";

// Map custom levels to Winston levels
const logMap: Record<LogLevel, string> = {
  none: "silent",
  minimal: "info",
  all: "debug",
};

const logFormat = ({
  level,
  message,
  stack,
  timestamp,
  ...meta
}: winston.Logform.TransformableInfo) => {
  const requestId = getRequestId();
  const requestIdString = requestId ? `[reqId:${requestId}]` : "";
  const base = `[${timestamp}] [${level.toUpperCase()}] ${requestIdString}: ${message}`;
  const metaString = Object.keys(meta).length ? `\nDetails: ${JSON.stringify(meta, null, 2)}` : "";
  const errorString = stack ? `\nError: ${stack}` : "";
  return `\n${base}${metaString}${errorString}`;
};

const createLogger = (logLevel: LogLevel) => {
  const level = logMap[logLevel];
  // Same detection as config.ts, which forces NODE_ENV "test" under the test runner.
  const isTestRunner =
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    process.argv.some((arg) => arg.endsWith(".test.ts")) ||
    process.execArgv.includes("--test");
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({
          format: "DD-MM-YYYY HH:mm:ss",
        }),
        winston.format.errors({ stack: true }),
        winston.format.printf(logFormat),
        winston.format.colorize({ all: true }),
      ),
    }),
  ];

  if (!isTestRunner) {
    transports.push(
      new winston.transports.File({
        filename: "logs/backend.log",
        format: winston.format.combine(
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          winston.format.printf(logFormat),
        ),
      }),
    );
  }

  return winston.createLogger({
    level: isTestRunner ? "silent" : level,
    transports,
  });
};

const isLogLevel = (value: string | undefined): value is LogLevel =>
  value !== undefined && value in logMap;

const logger = createLogger(isLogLevel(process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : "minimal");

export default logger;
