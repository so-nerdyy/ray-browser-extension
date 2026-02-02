/**
 * Centralized logging system for the Ray extension
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  stack?: string;
  source: string;
  userId?: string;
  sessionId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStorageSize: number;
  storageKey: string;
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
  enablePerformanceLogging: boolean;
  enableErrorTracking: boolean;
}

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private performanceMarkers: Map<string, number> = new Map();

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableStorage: true,
      maxStorageSize: 1000,
      storageKey: 'ray_logs',
      enableRemoteLogging: false,
      enablePerformanceLogging: true,
      enableErrorTracking: true,
      ...config,
    };

    this.loadStoredLogs();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * Log debug message
   */
  debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  /**
   * Log info message
   */
  info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  /**
   * Log warning message
   */
  warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  /**
   * Log error message
   */
  error(category: string, message: string, error?: Error | any): void {
    let stack: string | undefined;
    let data: any;

    if (error instanceof Error) {
      stack = error.stack;
      data = {
        name: error.name,
        message: error.message,
        ...error,
      };
    } else if (error) {
      data = error;
    }

    this.log(LogLevel.ERROR, category, message, data, stack);
  }

  /**
   * Log fatal error
   */
  fatal(category: string, message: string, error?: Error | any): void {
    let stack: string | undefined;
    let data: any;

    if (error instanceof Error) {
      stack = error.stack;
      data = {
        name: error.name,
        message: error.message,
        ...error,
      };
    } else if (error) {
      data = error;
    }

    this.log(LogLevel.FATAL, category, message, data, stack);
  }

  /**
   * Log performance measurement
   */
  performance(category: string, operation: string, duration: number, data?: any): void {
    if (!this.config.enablePerformanceLogging) {
      return;
    }

    this.log(LogLevel.DEBUG, category, `Performance: ${operation}`, {
      operation,
      duration,
      unit: 'ms',
      ...data,
    });
  }

  /**
   * Start performance measurement
   */
  startPerformanceTimer(marker: string): void {
    if (!this.config.enablePerformanceLogging) {
      return;
    }

    this.performanceMarkers.set(marker, performance.now());
  }

  /**
   * End performance measurement and log
   */
  endPerformanceTimer(category: string, operation: string, marker: string, data?: any): void {
    if (!this.config.enablePerformanceLogging) {
      return;
    }

    const startTime = this.performanceMarkers.get(marker);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.performance(category, operation, duration, data);
      this.performanceMarkers.delete(marker);
    }
  }

  /**
   * Log user action
   */
  userAction(action: string, data?: any): void {
    this.log(LogLevel.INFO, 'USER_ACTION', action, data);
  }

  /**
   * Log API call
   */
  apiCall(endpoint: string, method: string, statusCode?: number, duration?: number, error?: any): void {
    const data: any = {
      endpoint,
      method,
      statusCode,
      duration,
    };

    if (error) {
      data.error = error;
    }

    const level = statusCode && statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, 'API_CALL', `${method} ${endpoint}`, data);
  }

  /**
   * Log command execution
   */
  commandExecution(commandType: string, success: boolean, duration?: number, error?: any): void {
    const data: any = {
      commandType,
      success,
      duration,
    };

    if (error) {
      data.error = error;
    }

    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    this.log(level, 'COMMAND_EXECUTION', `${commandType} ${success ? 'succeeded' : 'failed'}`, data);
  }

  /**
   * Get logs by category
   */
  getLogsByCategory(category: string, level?: LogLevel): LogEntry[] {
    return this.logBuffer.filter(log => 
      log.category === category && 
      (level === undefined || log.level >= level)
    );
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logBuffer.filter(log => log.level >= level);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logBuffer = [];
    this.saveLogsToStorage();
  }

  /**
   * Export logs
   */
  exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, category: string, message: string, data?: any, stack?: string): void {
    if (level < this.config.level) {
      return;
    }

    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      stack,
      source: this.getSource(),
    };

    this.logBuffer.push(logEntry);

    // Trim buffer if it gets too large
    if (this.logBuffer.length > this.config.maxStorageSize) {
      this.logBuffer = this.logBuffer.slice(-this.config.maxStorageSize);
    }

    // Output to console
    if (this.config.enableConsole) {
      this.outputToConsole(logEntry);
    }

    // Save to storage
    if (this.config.enableStorage) {
      this.saveLogsToStorage();
    }

    // Send to remote endpoint
    if (this.config.enableRemoteLogging && this.config.remoteEndpoint) {
      this.sendToRemote(logEntry);
    }
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get source information
   */
  private getSource(): string {
    try {
      const stack = new Error().stack;
      if (stack) {
        const lines = stack.split('\n');
        // Skip the current function and find the caller
        for (let i = 3; i < lines.length; i++) {
          const line = lines[i];
          if (line && !line.includes('logger.ts')) {
            const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):\d+\)/);
            if (match) {
              return `${match[2]}:${match[3]}`;
            }
          }
        }
      }
    } catch (error) {
      // Ignore errors in source detection
    }
    return 'unknown';
  }

  /**
   * Output to console
   */
  private outputToConsole(logEntry: LogEntry): void {
    const { level, category, message, data, stack } = logEntry;
    const timestamp = new Date(logEntry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${LogLevel[level]}] [${category}]`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, data);
        break;
      case LogLevel.INFO:
        console.info(prefix, message, data);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, data);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(prefix, message, data);
        if (stack) {
          console.error(stack);
        }
        break;
    }
  }

  /**
   * Save logs to storage
   */
  private async saveLogsToStorage(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          [this.config.storageKey]: this.logBuffer,
        });
      }
    } catch (error) {
      console.error('Failed to save logs to storage:', error);
    }
  }

  /**
   * Load stored logs
   */
  private async loadStoredLogs(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(this.config.storageKey);
        if (result[this.config.storageKey]) {
          this.logBuffer = result[this.config.storageKey];
        }
      }
    } catch (error) {
      console.error('Failed to load logs from storage:', error);
    }
  }

  /**
   * Send log to remote endpoint
   */
  private async sendToRemote(logEntry: LogEntry): Promise<void> {
    try {
      if (!this.config.remoteEndpoint) {
        return;
      }

      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      console.error('Failed to send log to remote endpoint:', error);
    }
  }
}

/**
 * Error tracking utility
 */
export class ErrorTracker {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || Logger.getInstance();
  }

  /**
   * Track error with context
   */
  trackError(error: Error, context?: any): void {
    this.logger.error('ERROR_TRACKING', 'Tracked error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
    });
  }

  /**
   * Track error with user feedback
   */
  trackErrorWithFeedback(error: Error, userFeedback: string, context?: any): void {
    this.logger.error('ERROR_TRACKING', 'Tracked error with user feedback', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      userFeedback,
      context,
    });
  }

  /**
   * Track performance issue
   */
  trackPerformanceIssue(operation: string, duration: number, threshold: number, context?: any): void {
    if (duration > threshold) {
      this.logger.warn('PERFORMANCE_ISSUE', `Performance issue detected: ${operation}`, {
        operation,
        duration,
        threshold,
        exceededBy: duration - threshold,
        context,
      });
    }
  }
}

/**
 * Performance monitor utility
 */
export class PerformanceMonitor {
  private logger: Logger;
  private timers: Map<string, number> = new Map();

  constructor(logger?: Logger) {
    this.logger = logger || Logger.getInstance();
  }

  /**
   * Start timing an operation
   */
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  /**
   * End timing an operation and log
   */
  endTimer(category: string, name: string, data?: any): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      this.logger.warn('PERFORMANCE', `Timer not found: ${name}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.logger.performance(category, name, duration, data);
    this.timers.delete(name);
    return duration;
  }

  /**
   * Measure function execution time
   */
  measure<T>(category: string, name: string, fn: () => T, data?: any): T {
    this.startTimer(name);
    try {
      const result = fn();
      this.endTimer(category, name, data);
      return result;
    } catch (error) {
      this.endTimer(category, name, { ...data, error: error.message });
      throw error;
    }
  }

  /**
   * Measure async function execution time
   */
  async measureAsync<T>(category: string, name: string, fn: () => Promise<T>, data?: any): Promise<T> {
    this.startTimer(name);
    try {
      const result = await fn();
      this.endTimer(category, name, data);
      return result;
    } catch (error) {
      this.endTimer(category, name, { ...data, error: error.message });
      throw error;
    }
  }
}

// Create default logger instance
export const defaultLogger = Logger.getInstance();
export const errorTracker = new ErrorTracker(defaultLogger);
export const performanceMonitor = new PerformanceMonitor(defaultLogger); * Centralized logging system for the Ray extension
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  stack?: string;
  source: string;
  userId?: string;
  sessionId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStorageSize: number;
  storageKey: string;
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
  enablePerformanceLogging: boolean;
  enableErrorTracking: boolean;
}

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private performanceMarkers: Map<string, number> = new Map();

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableStorage: true,
      maxStorageSize: 1000,
      storageKey: 'ray_logs',
      enableRemoteLogging: false,
      enablePerformanceLogging: true,
      enableErrorTracking: true,
      ...config,
    };

    this.loadStoredLogs();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * Log debug message
   */
  debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  /**
   * Log info message
   */
  info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  /**
   * Log warning message
   */
  warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  /**
   * Log error message
   */
  error(category: string, message: string, error?: Error | any): void {
    let stack: string | undefined;
    let data: any;

    if (error instanceof Error) {
      stack = error.stack;
      data = {
        name: error.name,
        message: error.message,
        ...error,
      };
    } else if (error) {
      data = error;
    }

    this.log(LogLevel.ERROR, category, message, data, stack);
  }

  /**
   * Log fatal error
   */
  fatal(category: string, message: string, error?: Error | any): void {
    let stack: string | undefined;
    let data: any;

    if (error instanceof Error) {
      stack = error.stack;
      data = {
        name: error.name,
        message: error.message,
        ...error,
      };
    } else if (error) {
      data = error;
    }

    this.log(LogLevel.FATAL, category, message, data, stack);
  }

  /**
   * Log performance measurement
   */
  performance(category: string, operation: string, duration: number, data?: any): void {
    if (!this.config.enablePerformanceLogging) {
      return;
    }

    this.log(LogLevel.DEBUG, category, `Performance: ${operation}`, {
      operation,
      duration,
      unit: 'ms',
      ...data,
    });
  }

  /**
   * Start performance measurement
   */
  startPerformanceTimer(marker: string): void {
    if (!this.config.enablePerformanceLogging) {
      return;
    }

    this.performanceMarkers.set(marker, performance.now());
  }

  /**
   * End performance measurement and log
   */
  endPerformanceTimer(category: string, operation: string, marker: string, data?: any): void {
    if (!this.config.enablePerformanceLogging) {
      return;
    }

    const startTime = this.performanceMarkers.get(marker);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.performance(category, operation, duration, data);
      this.performanceMarkers.delete(marker);
    }
  }

  /**
   * Log user action
   */
  userAction(action: string, data?: any): void {
    this.log(LogLevel.INFO, 'USER_ACTION', action, data);
  }

  /**
   * Log API call
   */
  apiCall(endpoint: string, method: string, statusCode?: number, duration?: number, error?: any): void {
    const data: any = {
      endpoint,
      method,
      statusCode,
      duration,
    };

    if (error) {
      data.error = error;
    }

    const level = statusCode && statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, 'API_CALL', `${method} ${endpoint}`, data);
  }

  /**
   * Log command execution
   */
  commandExecution(commandType: string, success: boolean, duration?: number, error?: any): void {
    const data: any = {
      commandType,
      success,
      duration,
    };

    if (error) {
      data.error = error;
    }

    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    this.log(level, 'COMMAND_EXECUTION', `${commandType} ${success ? 'succeeded' : 'failed'}`, data);
  }

  /**
   * Get logs by category
   */
  getLogsByCategory(category: string, level?: LogLevel): LogEntry[] {
    return this.logBuffer.filter(log => 
      log.category === category && 
      (level === undefined || log.level >= level)
    );
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logBuffer.filter(log => log.level >= level);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logBuffer = [];
    this.saveLogsToStorage();
  }

  /**
   * Export logs
   */
  exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, category: string, message: string, data?: any, stack?: string): void {
    if (level < this.config.level) {
      return;
    }

    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      stack,
      source: this.getSource(),
    };

    this.logBuffer.push(logEntry);

    // Trim buffer if it gets too large
    if (this.logBuffer.length > this.config.maxStorageSize) {
      this.logBuffer = this.logBuffer.slice(-this.config.maxStorageSize);
    }

    // Output to console
    if (this.config.enableConsole) {
      this.outputToConsole(logEntry);
    }

    // Save to storage
    if (this.config.enableStorage) {
      this.saveLogsToStorage();
    }

    // Send to remote endpoint
    if (this.config.enableRemoteLogging && this.config.remoteEndpoint) {
      this.sendToRemote(logEntry);
    }
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get source information
   */
  private getSource(): string {
    try {
      const stack = new Error().stack;
      if (stack) {
        const lines = stack.split('\n');
        // Skip the current function and find the caller
        for (let i = 3; i < lines.length; i++) {
          const line = lines[i];
          if (line && !line.includes('logger.ts')) {
            const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):\d+\)/);
            if (match) {
              return `${match[2]}:${match[3]}`;
            }
          }
        }
      }
    } catch (error) {
      // Ignore errors in source detection
    }
    return 'unknown';
  }

  /**
   * Output to console
   */
  private outputToConsole(logEntry: LogEntry): void {
    const { level, category, message, data, stack } = logEntry;
    const timestamp = new Date(logEntry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${LogLevel[level]}] [${category}]`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, data);
        break;
      case LogLevel.INFO:
        console.info(prefix, message, data);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, data);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(prefix, message, data);
        if (stack) {
          console.error(stack);
        }
        break;
    }
  }

  /**
   * Save logs to storage
   */
  private async saveLogsToStorage(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          [this.config.storageKey]: this.logBuffer,
        });
      }
    } catch (error) {
      console.error('Failed to save logs to storage:', error);
    }
  }

  /**
   * Load stored logs
   */
  private async loadStoredLogs(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(this.config.storageKey);
        if (result[this.config.storageKey]) {
          this.logBuffer = result[this.config.storageKey];
        }
      }
    } catch (error) {
      console.error('Failed to load logs from storage:', error);
    }
  }

  /**
   * Send log to remote endpoint
   */
  private async sendToRemote(logEntry: LogEntry): Promise<void> {
    try {
      if (!this.config.remoteEndpoint) {
        return;
      }

      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      console.error('Failed to send log to remote endpoint:', error);
    }
  }
}

/**
 * Error tracking utility
 */
export class ErrorTracker {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || Logger.getInstance();
  }

  /**
   * Track error with context
   */
  trackError(error: Error, context?: any): void {
    this.logger.error('ERROR_TRACKING', 'Tracked error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
    });
  }

  /**
   * Track error with user feedback
   */
  trackErrorWithFeedback(error: Error, userFeedback: string, context?: any): void {
    this.logger.error('ERROR_TRACKING', 'Tracked error with user feedback', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      userFeedback,
      context,
    });
  }

  /**
   * Track performance issue
   */
  trackPerformanceIssue(operation: string, duration: number, threshold: number, context?: any): void {
    if (duration > threshold) {
      this.logger.warn('PERFORMANCE_ISSUE', `Performance issue detected: ${operation}`, {
        operation,
        duration,
        threshold,
        exceededBy: duration - threshold,
        context,
      });
    }
  }
}

/**
 * Performance monitor utility
 */
export class PerformanceMonitor {
  private logger: Logger;
  private timers: Map<string, number> = new Map();

  constructor(logger?: Logger) {
    this.logger = logger || Logger.getInstance();
  }

  /**
   * Start timing an operation
   */
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  /**
   * End timing an operation and log
   */
  endTimer(category: string, name: string, data?: any): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      this.logger.warn('PERFORMANCE', `Timer not found: ${name}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.logger.performance(category, name, duration, data);
    this.timers.delete(name);
    return duration;
  }

  /**
   * Measure function execution time
   */
  measure<T>(category: string, name: string, fn: () => T, data?: any): T {
    this.startTimer(name);
    try {
      const result = fn();
      this.endTimer(category, name, data);
      return result;
    } catch (error) {
      this.endTimer(category, name, { ...data, error: error.message });
      throw error;
    }
  }

  /**
   * Measure async function execution time
   */
  async measureAsync<T>(category: string, name: string, fn: () => Promise<T>, data?: any): Promise<T> {
    this.startTimer(name);
    try {
      const result = await fn();
      this.endTimer(category, name, data);
      return result;
    } catch (error) {
      this.endTimer(category, name, { ...data, error: error.message });
      throw error;
    }
  }
}

// Create default logger instance
export const defaultLogger = Logger.getInstance();
export const errorTracker = new ErrorTracker(defaultLogger);
export const performanceMonitor = new PerformanceMonitor(defaultLogger);
