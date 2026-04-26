// src/utils/logger.js
import { createLogger, format, transports } from 'winston';
import { config } from '../config.js';

const { combine, timestamp, colorize, printf, json } = format;

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${extra}`;
  }),
);

const prodFormat = combine(timestamp(), json());

export const logger = createLogger({
  level: config.logLevel,
  format: config.nodeEnv === 'production' ? prodFormat : devFormat,
  transports: [new transports.Console()],
});
