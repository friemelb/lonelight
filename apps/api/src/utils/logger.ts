/**
 * Structured logging utility for observability
 * Outputs JSON-formatted logs for easy parsing and monitoring
 */

export interface LogContext {
  documentId?: string;
  operation?: string;
  duration?: number;
  error?: any;
  [key: string]: any;
}

export class Logger {
  /**
   * Log an informational message
   */
  static info(message: string, context?: LogContext): void {
    console.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date().toISOString(),
        message,
        ...context
      })
    );
  }

  /**
   * Log an error with stack trace
   */
  static error(message: string, error: Error, context?: LogContext): void {
    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        message,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        ...context
      })
    );
  }

  /**
   * Log a metric or measurement
   */
  static metric(metricType: string, value: number, context?: LogContext): void {
    console.log(
      JSON.stringify({
        level: 'metric',
        timestamp: new Date().toISOString(),
        metricType,
        value,
        ...context
      })
    );
  }

  /**
   * Log a warning
   */
  static warn(message: string, context?: LogContext): void {
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: new Date().toISOString(),
        message,
        ...context
      })
    );
  }

  /**
   * Log a debug message (only in development)
   */
  static debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        JSON.stringify({
          level: 'debug',
          timestamp: new Date().toISOString(),
          message,
          ...context
        })
      );
    }
  }

  /**
   * Log the start of an operation (returns start time for duration calculation)
   */
  static startOperation(operation: string, context?: LogContext): number {
    const startTime = Date.now();
    this.info(`Starting ${operation}`, { operation, ...context });
    return startTime;
  }

  /**
   * Log the end of an operation with duration
   */
  static endOperation(operation: string, startTime: number, context?: LogContext): void {
    const duration = Date.now() - startTime;
    this.info(`Completed ${operation}`, { operation, duration, ...context });
    this.metric(`${operation}_duration_ms`, duration, context);
  }
}
