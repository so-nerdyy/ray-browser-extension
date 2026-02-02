/**
 * Centralized error handling utilities
 */

import { RayError } from '../shared/contracts';
import { Logger, LogLevel, defaultLogger } from './logger';

export interface ErrorHandlerConfig {
  enableErrorReporting: boolean;
  enableUserNotifications: boolean;
  enableErrorRecovery: boolean;
  maxRetryAttempts: number;
  retryDelay: number;
  enableFallback: boolean;
}

export interface ErrorContext {
  component: string;
  operation: string;
  userId?: string;
  sessionId?: string;
  timestamp?: number;
  additionalData?: any;
}

export interface ErrorRecoveryStrategy {
  canRecover: (error: any) => boolean;
  recover: (error: any, context: ErrorContext) => Promise<any>;
  maxAttempts?: number;
  delay?: number;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private config: ErrorHandlerConfig;
  private logger: Logger;
  private recoveryStrategies: Map<string, ErrorRecoveryStrategy> = new Map();
  private errorCounts: Map<string, number> = new Map();

  private constructor(config: Partial<ErrorHandlerConfig> = {}, logger?: Logger) {
    this.config = {
      enableErrorReporting: true,
      enableUserNotifications: true,
      enableErrorRecovery: true,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      enableFallback: true,
      ...config,
    };

    this.logger = logger || defaultLogger;
    this.initializeDefaultStrategies();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<ErrorHandlerConfig>, logger?: Logger): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(config, logger);
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle error with context
   */
  async handleError(error: any, context: ErrorContext): Promise<RayError> {
    const rayError = this.normalizeError(error, context);
    
    // Log the error
    this.logger.error(context.component, `${context.operation} failed`, rayError);

    // Track error count
    this.trackError(rayError);

    // Try recovery if enabled
    if (this.config.enableErrorRecovery) {
      const recovered = await this.tryRecovery(rayError, context);
      if (recovered) {
        return recovered;
      }
    }

    // Report error if enabled
    if (this.config.enableErrorReporting) {
      await this.reportError(rayError, context);
    }

    // Notify user if enabled
    if (this.config.enableUserNotifications) {
      this.notifyUser(rayError, context);
    }

    return rayError;
  }

  /**
   * Handle error with retry
   */
  async handleWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxAttempts?: number
  ): Promise<T> {
    const attempts = maxAttempts || this.config.maxRetryAttempts;
    let lastError: any;

    for (let i = 1; i <= attempts; i++) {
      try {
        this.logger.debug(context.component, `Attempt ${i}/${attempts} for ${context.operation}`);
        const result = await operation();
        
        if (i > 1) {
          this.logger.info(context.component, `Operation succeeded on attempt ${i}: ${context.operation}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (i < attempts) {
          const delay = this.config.retryDelay * i; // Exponential backoff
          this.logger.warn(context.component, `Attempt ${i} failed, retrying in ${delay}ms`, {
            attempt: i,
            maxAttempts: attempts,
            error: error.message,
          });
          
          await this.sleep(delay);
        } else {
          this.logger.error(context.component, `All ${attempts} attempts failed for ${context.operation}`, error);
        }
      }
    }

    // Handle the final error
    throw await this.handleError(lastError, context);
  }

  /**
   * Handle error with fallback
   */
  async handleWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (primaryError) {
      if (!this.config.enableFallback) {
        throw await this.handleError(primaryError, context);
      }

      this.logger.warn(context.component, `Primary operation failed, trying fallback: ${context.operation}`, primaryError);
      
      try {
        const result = await fallbackOperation();
        this.logger.info(context.component, `Fallback operation succeeded: ${context.operation}`);
        return result;
      } catch (fallbackError) {
        this.logger.error(context.component, `Both primary and fallback operations failed: ${context.operation}`, {
          primaryError: primaryError.message,
          fallbackError: fallbackError.message,
        });
        
        // Handle the fallback error
        throw await this.handleError(fallbackError, context);
      }
    }
  }

  /**
   * Register error recovery strategy
   */
  registerRecoveryStrategy(errorType: string, strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.set(errorType, strategy);
  }

  /**
   * Wrap function with error handling
   */
  wrapFunction<T extends (...args: any[]) => any>(
    fn: T,
    context: ErrorContext
  ): (...args: Parameters<T>) => ReturnType<T> {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      try {
        const result = await fn(...args);
        return result;
      } catch (error) {
        const rayError = await this.handleError(error, context);
        throw rayError;
      }
    };
  }

  /**
   * Normalize error to RayError format
   */
  private normalizeError(error: any, context: ErrorContext): RayError {
    if (error && error.code && error.message && error.timestamp) {
      // Already a RayError
      return error as RayError;
    }

    // Create RayError from any error
    const rayError: RayError = {
      code: this.generateErrorCode(error),
      message: error?.message || 'Unknown error occurred',
      timestamp: Date.now(),
      details: {
        component: context.component,
        operation: context.operation,
        originalError: error,
        ...context.additionalData,
      },
    };

    // Add stack trace if available
    if (error instanceof Error && error.stack) {
      rayError.stack = error.stack;
    }

    return rayError;
  }

  /**
   * Generate error code from error
   */
  private generateErrorCode(error: any): string {
    if (error?.code) {
      return error.code;
    }

    if (error instanceof Error) {
      return error.name.replace(/\s+/g, '_').toUpperCase();
    }

    if (typeof error === 'string') {
      return error.substring(0, 50).replace(/\s+/g, '_').toUpperCase();
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Track error count
   */
  private trackError(error: RayError): void {
    const key = `${error.code}_${error.details?.component}_${error.details?.operation}`;
    const currentCount = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, currentCount + 1);

    // Log if error is occurring frequently
    if (currentCount > 0 && currentCount % 5 === 0) {
      this.logger.warn('ERROR_TRACKING', `Error occurred ${currentCount + 1} times`, {
        errorCode: error.code,
        component: error.details?.component,
        operation: error.details?.operation,
        count: currentCount + 1,
      });
    }
  }

  /**
   * Try error recovery
   */
  private async tryRecovery(error: RayError, context: ErrorContext): Promise<RayError | null> {
    const strategy = this.recoveryStrategies.get(error.code);
    
    if (!strategy || !strategy.canRecover(error)) {
      return null;
    }

    const maxAttempts = strategy.maxAttempts || this.config.maxRetryAttempts;
    const delay = strategy.delay || this.config.retryDelay;

    for (let i = 1; i <= maxAttempts; i++) {
      try {
        this.logger.info(context.component, `Attempting recovery (${i}/${maxAttempts}): ${context.operation}`);
        
        const result = await strategy.recover(error, context);
        
        this.logger.info(context.component, `Recovery successful: ${context.operation}`);
        
        // Return success error with recovery information
        return {
          ...error,
          code: 'RECOVERY_SUCCESS',
          message: 'Operation recovered successfully',
          details: {
            ...error.details,
            recoveryAttempts: i,
            recoveryResult: result,
          },
        };
      } catch (recoveryError) {
        this.logger.warn(context.component, `Recovery attempt ${i} failed`, recoveryError);
        
        if (i < maxAttempts) {
          await this.sleep(delay * i); // Exponential backoff
        }
      }
    }

    this.logger.error(context.component, `All recovery attempts failed: ${context.operation}`);
    return null;
  }

  /**
   * Report error to external service
   */
  private async reportError(error: RayError, context: ErrorContext): Promise<void> {
    try {
      // This would integrate with error reporting service
      // For now, just log the reporting attempt
      this.logger.info('ERROR_REPORTING', 'Error reported', {
        errorCode: error.code,
        component: context.component,
        operation: context.operation,
      });
    } catch (reportingError) {
      this.logger.error('ERROR_REPORTING', 'Failed to report error', reportingError);
    }
  }

  /**
   * Notify user of error
   */
  private notifyUser(error: RayError, context: ErrorContext): void {
    try {
      // This would integrate with UI notification system
      // For now, just log the notification attempt
      this.logger.info('USER_NOTIFICATION', 'User notified of error', {
        errorCode: error.code,
        message: error.message,
        component: context.component,
      });
    } catch (notificationError) {
      this.logger.error('USER_NOTIFICATION', 'Failed to notify user', notificationError);
    }
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeDefaultStrategies(): void {
    // Network error recovery
    this.registerRecoveryStrategy('NETWORK_ERROR', {
      canRecover: (error) => error.code === 'NETWORK_ERROR',
      recover: async (error, context) => {
        // Wait for network to be available
        await this.waitForNetwork();
        // Retry the operation
        return { recovered: true };
      },
      maxAttempts: 3,
      delay: 2000,
    });

    // Timeout error recovery
    this.registerRecoveryStrategy('TIMEOUT', {
      canRecover: (error) => error.code === 'TIMEOUT',
      recover: async (error, context) => {
        // Wait a bit longer and retry
        await this.sleep(5000);
        return { recovered: true };
      },
      maxAttempts: 2,
      delay: 5000,
    });

    // API error recovery
    this.registerRecoveryStrategy('API_ERROR', {
      canRecover: (error) => error.code === 'API_ERROR',
      recover: async (error, context) => {
        // Check if it's a rate limit error
        if (error.details?.status === 429) {
          await this.sleep(60000); // Wait 1 minute for rate limit
          return { recovered: true };
        }
        return { recovered: false };
      },
      maxAttempts: 2,
      delay: 1000,
    });
  }

  /**
   * Wait for network to be available
   */
  private async waitForNetwork(): Promise<void> {
    // Simple implementation - in real scenario would check network status
    await this.sleep(1000);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCode: Record<string, number>;
    errorsByComponent: Record<string, number>;
  } {
    const errorsByCode: Record<string, number> = {};
    const errorsByComponent: Record<string, number> = {};

    this.errorCounts.forEach((count, key) => {
      const [code, component] = key.split('_');
      errorsByCode[code] = (errorsByCode[code] || 0) + count;
      errorsByComponent[component] = (errorsByComponent[component] || 0) + count;
    });

    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);

    return {
      totalErrors,
      errorsByCode,
      errorsByComponent,
    };
  }

  /**
   * Clear error statistics
   */
  clearErrorStatistics(): void {
    this.errorCounts.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Error boundary class for wrapping operations
 */
export class ErrorBoundary {
  private errorHandler: ErrorHandler;

  constructor(errorHandler?: ErrorHandler) {
    this.errorHandler = errorHandler || ErrorHandler.getInstance();
  }

  /**
   * Execute operation with error handling
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const rayError = await this.errorHandler.handleError(error, context);
      throw rayError;
    }
  }

  /**
   * Execute operation with retry
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxAttempts?: number
  ): Promise<T> {
    return this.errorHandler.handleWithRetry(operation, context, maxAttempts);
  }

  /**
   * Execute operation with fallback
   */
  async executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    return this.errorHandler.handleWithFallback(primaryOperation, fallbackOperation, context);
  }
}

/**
 * Decorator for adding error handling to methods
 */
export function withErrorHandling(
  component: string,
  operation?: string,
  maxAttempts?: number
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const errorHandler = ErrorHandler.getInstance();

    descriptor.value = async function (...args: any[]) {
      const context: ErrorContext = {
        component,
        operation: operation || propertyKey,
        timestamp: Date.now(),
        additionalData: { args },
      };

      if (maxAttempts && maxAttempts > 1) {
        return errorHandler.handleWithRetry(
          () => originalMethod.apply(this, args),
          context,
          maxAttempts
        );
      } else {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          const rayError = await errorHandler.handleError(error, context);
          throw rayError;
        }
      }
    };

    return descriptor;
  };
}

// Create default instances
export const defaultErrorHandler = ErrorHandler.getInstance();
export const defaultErrorBoundary = new ErrorBoundary(defaultErrorHandler); * Centralized error handling utilities
 */

import { RayError } from '../shared/contracts';
import { Logger, LogLevel, defaultLogger } from './logger';

export interface ErrorHandlerConfig {
  enableErrorReporting: boolean;
  enableUserNotifications: boolean;
  enableErrorRecovery: boolean;
  maxRetryAttempts: number;
  retryDelay: number;
  enableFallback: boolean;
}

export interface ErrorContext {
  component: string;
  operation: string;
  userId?: string;
  sessionId?: string;
  timestamp?: number;
  additionalData?: any;
}

export interface ErrorRecoveryStrategy {
  canRecover: (error: any) => boolean;
  recover: (error: any, context: ErrorContext) => Promise<any>;
  maxAttempts?: number;
  delay?: number;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private config: ErrorHandlerConfig;
  private logger: Logger;
  private recoveryStrategies: Map<string, ErrorRecoveryStrategy> = new Map();
  private errorCounts: Map<string, number> = new Map();

  private constructor(config: Partial<ErrorHandlerConfig> = {}, logger?: Logger) {
    this.config = {
      enableErrorReporting: true,
      enableUserNotifications: true,
      enableErrorRecovery: true,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      enableFallback: true,
      ...config,
    };

    this.logger = logger || defaultLogger;
    this.initializeDefaultStrategies();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<ErrorHandlerConfig>, logger?: Logger): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(config, logger);
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle error with context
   */
  async handleError(error: any, context: ErrorContext): Promise<RayError> {
    const rayError = this.normalizeError(error, context);
    
    // Log the error
    this.logger.error(context.component, `${context.operation} failed`, rayError);

    // Track error count
    this.trackError(rayError);

    // Try recovery if enabled
    if (this.config.enableErrorRecovery) {
      const recovered = await this.tryRecovery(rayError, context);
      if (recovered) {
        return recovered;
      }
    }

    // Report error if enabled
    if (this.config.enableErrorReporting) {
      await this.reportError(rayError, context);
    }

    // Notify user if enabled
    if (this.config.enableUserNotifications) {
      this.notifyUser(rayError, context);
    }

    return rayError;
  }

  /**
   * Handle error with retry
   */
  async handleWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxAttempts?: number
  ): Promise<T> {
    const attempts = maxAttempts || this.config.maxRetryAttempts;
    let lastError: any;

    for (let i = 1; i <= attempts; i++) {
      try {
        this.logger.debug(context.component, `Attempt ${i}/${attempts} for ${context.operation}`);
        const result = await operation();
        
        if (i > 1) {
          this.logger.info(context.component, `Operation succeeded on attempt ${i}: ${context.operation}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (i < attempts) {
          const delay = this.config.retryDelay * i; // Exponential backoff
          this.logger.warn(context.component, `Attempt ${i} failed, retrying in ${delay}ms`, {
            attempt: i,
            maxAttempts: attempts,
            error: error.message,
          });
          
          await this.sleep(delay);
        } else {
          this.logger.error(context.component, `All ${attempts} attempts failed for ${context.operation}`, error);
        }
      }
    }

    // Handle the final error
    throw await this.handleError(lastError, context);
  }

  /**
   * Handle error with fallback
   */
  async handleWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (primaryError) {
      if (!this.config.enableFallback) {
        throw await this.handleError(primaryError, context);
      }

      this.logger.warn(context.component, `Primary operation failed, trying fallback: ${context.operation}`, primaryError);
      
      try {
        const result = await fallbackOperation();
        this.logger.info(context.component, `Fallback operation succeeded: ${context.operation}`);
        return result;
      } catch (fallbackError) {
        this.logger.error(context.component, `Both primary and fallback operations failed: ${context.operation}`, {
          primaryError: primaryError.message,
          fallbackError: fallbackError.message,
        });
        
        // Handle the fallback error
        throw await this.handleError(fallbackError, context);
      }
    }
  }

  /**
   * Register error recovery strategy
   */
  registerRecoveryStrategy(errorType: string, strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.set(errorType, strategy);
  }

  /**
   * Wrap function with error handling
   */
  wrapFunction<T extends (...args: any[]) => any>(
    fn: T,
    context: ErrorContext
  ): (...args: Parameters<T>) => ReturnType<T> {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      try {
        const result = await fn(...args);
        return result;
      } catch (error) {
        const rayError = await this.handleError(error, context);
        throw rayError;
      }
    };
  }

  /**
   * Normalize error to RayError format
   */
  private normalizeError(error: any, context: ErrorContext): RayError {
    if (error && error.code && error.message && error.timestamp) {
      // Already a RayError
      return error as RayError;
    }

    // Create RayError from any error
    const rayError: RayError = {
      code: this.generateErrorCode(error),
      message: error?.message || 'Unknown error occurred',
      timestamp: Date.now(),
      details: {
        component: context.component,
        operation: context.operation,
        originalError: error,
        ...context.additionalData,
      },
    };

    // Add stack trace if available
    if (error instanceof Error && error.stack) {
      rayError.stack = error.stack;
    }

    return rayError;
  }

  /**
   * Generate error code from error
   */
  private generateErrorCode(error: any): string {
    if (error?.code) {
      return error.code;
    }

    if (error instanceof Error) {
      return error.name.replace(/\s+/g, '_').toUpperCase();
    }

    if (typeof error === 'string') {
      return error.substring(0, 50).replace(/\s+/g, '_').toUpperCase();
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Track error count
   */
  private trackError(error: RayError): void {
    const key = `${error.code}_${error.details?.component}_${error.details?.operation}`;
    const currentCount = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, currentCount + 1);

    // Log if error is occurring frequently
    if (currentCount > 0 && currentCount % 5 === 0) {
      this.logger.warn('ERROR_TRACKING', `Error occurred ${currentCount + 1} times`, {
        errorCode: error.code,
        component: error.details?.component,
        operation: error.details?.operation,
        count: currentCount + 1,
      });
    }
  }

  /**
   * Try error recovery
   */
  private async tryRecovery(error: RayError, context: ErrorContext): Promise<RayError | null> {
    const strategy = this.recoveryStrategies.get(error.code);
    
    if (!strategy || !strategy.canRecover(error)) {
      return null;
    }

    const maxAttempts = strategy.maxAttempts || this.config.maxRetryAttempts;
    const delay = strategy.delay || this.config.retryDelay;

    for (let i = 1; i <= maxAttempts; i++) {
      try {
        this.logger.info(context.component, `Attempting recovery (${i}/${maxAttempts}): ${context.operation}`);
        
        const result = await strategy.recover(error, context);
        
        this.logger.info(context.component, `Recovery successful: ${context.operation}`);
        
        // Return success error with recovery information
        return {
          ...error,
          code: 'RECOVERY_SUCCESS',
          message: 'Operation recovered successfully',
          details: {
            ...error.details,
            recoveryAttempts: i,
            recoveryResult: result,
          },
        };
      } catch (recoveryError) {
        this.logger.warn(context.component, `Recovery attempt ${i} failed`, recoveryError);
        
        if (i < maxAttempts) {
          await this.sleep(delay * i); // Exponential backoff
        }
      }
    }

    this.logger.error(context.component, `All recovery attempts failed: ${context.operation}`);
    return null;
  }

  /**
   * Report error to external service
   */
  private async reportError(error: RayError, context: ErrorContext): Promise<void> {
    try {
      // This would integrate with error reporting service
      // For now, just log the reporting attempt
      this.logger.info('ERROR_REPORTING', 'Error reported', {
        errorCode: error.code,
        component: context.component,
        operation: context.operation,
      });
    } catch (reportingError) {
      this.logger.error('ERROR_REPORTING', 'Failed to report error', reportingError);
    }
  }

  /**
   * Notify user of error
   */
  private notifyUser(error: RayError, context: ErrorContext): void {
    try {
      // This would integrate with UI notification system
      // For now, just log the notification attempt
      this.logger.info('USER_NOTIFICATION', 'User notified of error', {
        errorCode: error.code,
        message: error.message,
        component: context.component,
      });
    } catch (notificationError) {
      this.logger.error('USER_NOTIFICATION', 'Failed to notify user', notificationError);
    }
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeDefaultStrategies(): void {
    // Network error recovery
    this.registerRecoveryStrategy('NETWORK_ERROR', {
      canRecover: (error) => error.code === 'NETWORK_ERROR',
      recover: async (error, context) => {
        // Wait for network to be available
        await this.waitForNetwork();
        // Retry the operation
        return { recovered: true };
      },
      maxAttempts: 3,
      delay: 2000,
    });

    // Timeout error recovery
    this.registerRecoveryStrategy('TIMEOUT', {
      canRecover: (error) => error.code === 'TIMEOUT',
      recover: async (error, context) => {
        // Wait a bit longer and retry
        await this.sleep(5000);
        return { recovered: true };
      },
      maxAttempts: 2,
      delay: 5000,
    });

    // API error recovery
    this.registerRecoveryStrategy('API_ERROR', {
      canRecover: (error) => error.code === 'API_ERROR',
      recover: async (error, context) => {
        // Check if it's a rate limit error
        if (error.details?.status === 429) {
          await this.sleep(60000); // Wait 1 minute for rate limit
          return { recovered: true };
        }
        return { recovered: false };
      },
      maxAttempts: 2,
      delay: 1000,
    });
  }

  /**
   * Wait for network to be available
   */
  private async waitForNetwork(): Promise<void> {
    // Simple implementation - in real scenario would check network status
    await this.sleep(1000);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCode: Record<string, number>;
    errorsByComponent: Record<string, number>;
  } {
    const errorsByCode: Record<string, number> = {};
    const errorsByComponent: Record<string, number> = {};

    this.errorCounts.forEach((count, key) => {
      const [code, component] = key.split('_');
      errorsByCode[code] = (errorsByCode[code] || 0) + count;
      errorsByComponent[component] = (errorsByComponent[component] || 0) + count;
    });

    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);

    return {
      totalErrors,
      errorsByCode,
      errorsByComponent,
    };
  }

  /**
   * Clear error statistics
   */
  clearErrorStatistics(): void {
    this.errorCounts.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Error boundary class for wrapping operations
 */
export class ErrorBoundary {
  private errorHandler: ErrorHandler;

  constructor(errorHandler?: ErrorHandler) {
    this.errorHandler = errorHandler || ErrorHandler.getInstance();
  }

  /**
   * Execute operation with error handling
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const rayError = await this.errorHandler.handleError(error, context);
      throw rayError;
    }
  }

  /**
   * Execute operation with retry
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxAttempts?: number
  ): Promise<T> {
    return this.errorHandler.handleWithRetry(operation, context, maxAttempts);
  }

  /**
   * Execute operation with fallback
   */
  async executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    return this.errorHandler.handleWithFallback(primaryOperation, fallbackOperation, context);
  }
}

/**
 * Decorator for adding error handling to methods
 */
export function withErrorHandling(
  component: string,
  operation?: string,
  maxAttempts?: number
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const errorHandler = ErrorHandler.getInstance();

    descriptor.value = async function (...args: any[]) {
      const context: ErrorContext = {
        component,
        operation: operation || propertyKey,
        timestamp: Date.now(),
        additionalData: { args },
      };

      if (maxAttempts && maxAttempts > 1) {
        return errorHandler.handleWithRetry(
          () => originalMethod.apply(this, args),
          context,
          maxAttempts
        );
      } else {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          const rayError = await errorHandler.handleError(error, context);
          throw rayError;
        }
      }
    };

    return descriptor;
  };
}

// Create default instances
export const defaultErrorHandler = ErrorHandler.getInstance();
export const defaultErrorBoundary = new ErrorBoundary(defaultErrorHandler);
