/**
 * Performance optimization utilities for the Ray extension
 */

import { Logger, defaultLogger } from '../utils/logger';
import { CacheManager, defaultCacheManager } from './cache-manager';

export interface PerformanceConfig {
  enableDebouncing: boolean;
  enableThrottling: boolean;
  enableBatching: boolean;
  enableLazyLoading: boolean;
  enablePrefetching: boolean;
  debounceDelay: number;
  throttleDelay: number;
  batchSize: number;
  maxConcurrentOperations: number;
}

export interface PerformanceMetrics {
  operationCount: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  timestamp: number;
}

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private config: PerformanceConfig;
  private logger: Logger;
  private cacheManager: CacheManager;
  private metrics: PerformanceMetrics;
  private operationTimers: Map<string, number> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private throttleTimers: Map<string, number> = new Map();
  private batchQueues: Map<string, any[]> = new Map();
  private activeOperations: Set<string> = new Set();

  private constructor(config: Partial<PerformanceConfig> = {}, logger?: Logger, cacheManager?: CacheManager) {
    this.config = {
      enableDebouncing: true,
      enableThrottling: true,
      enableBatching: true,
      enableLazyLoading: true,
      enablePrefetching: true,
      debounceDelay: 300,
      throttleDelay: 100,
      batchSize: 10,
      maxConcurrentOperations: 5,
      ...config,
    };

    this.logger = logger || defaultLogger;
    this.cacheManager = cacheManager || defaultCacheManager;
    this.metrics = {
      operationCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      timestamp: Date.now(),
    };

    this.initializePerformanceMonitoring();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<PerformanceConfig>, logger?: Logger, cacheManager?: CacheManager): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer(config, logger, cacheManager);
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * Debounce function execution
   */
  debounce<T extends (...args: any[]) => any>(
    key: string,
    fn: T,
    delay?: number,
    ...args: Parameters<T>
  ): void {
    if (!this.config.enableDebouncing) {
      fn(...args);
      return;
    }

    const debounceDelay = delay || this.config.debounceDelay;

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.executeOperation(key, () => fn(...args));
      this.debounceTimers.delete(key);
    }, debounceDelay);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Throttle function execution
   */
  throttle<T extends (...args: any[]) => any>(
    key: string,
    fn: T,
    delay?: number,
    ...args: Parameters<T>
  ): void {
    if (!this.config.enableThrottling) {
      fn(...args);
      return;
    }

    const throttleDelay = delay || this.config.throttleDelay;
    const now = Date.now();
    const lastExecution = this.throttleTimers.get(key) || 0;

    if (now - lastExecution >= throttleDelay) {
      this.executeOperation(key, () => fn(...args));
      this.throttleTimers.set(key, now);
    }
  }

  /**
   * Batch operations
   */
  batch<T>(key: string, operation: T, options?: { batchSize?: number; delay?: number }): void {
    if (!this.config.enableBatching) {
      this.executeOperation(key, operation);
      return;
    }

    const batchSize = options?.batchSize || this.config.batchSize;
    const delay = options?.delay || this.config.debounceDelay;

    // Get or create queue
    const queue = this.batchQueues.get(key) || [];
    queue.push(operation);
    this.batchQueues.set(key, queue);

    // Process batch if size reached or set timer
    if (queue.length >= batchSize) {
      this.processBatch(key);
    } else {
      // Set timer to process remaining items
      const existingTimer = this.debounceTimers.get(`batch_${key}`);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.processBatch(key);
        this.debounceTimers.delete(`batch_${key}`);
      }, delay);

      this.debounceTimers.set(`batch_${key}`, timer);
    }
  }

  /**
   * Memoize function results
   */
  memoize<T extends (...args: any[]) => any>(
    fn: T,
    keyGenerator?: (...args: Parameters<T>) => string,
    ttl?: number
  ): T {
    return ((...args: Parameters<T>) => {
      const cacheKey = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

      // Check cache first
      return this.cacheManager.get(cacheKey).then(cached => {
        if (cached !== null) {
          this.logger.debug('PERFORMANCE', `Cache hit for memoized function: ${cacheKey}`);
          return cached;
        }

        // Execute function and cache result
        const result = fn(...args);
        const resultPromise = Promise.resolve(result);

        resultPromise.then(resolvedResult => {
          this.cacheManager.set(cacheKey, resolvedResult, ttl);
          this.logger.debug('PERFORMANCE', `Cached result for memoized function: ${cacheKey}`);
        });

        return result;
      }) as ReturnType<T>;
    }) as T;
  }

  /**
   * Lazy load value
   */
  lazy<T>(
    key: string,
    loader: () => Promise<T>,
    options?: { ttl?: number; prefetch?: boolean }
  ): () => Promise<T> {
    const ttl = options?.ttl;
    const prefetch = options?.prefetch || this.config.enablePrefetching;

    return async () => {
      // Check cache first
      const cached = await this.cacheManager.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Load value
      const startTime = performance.now();
      const value = await this.executeOperation(`lazy_${key}`, () => loader());
      const duration = performance.now() - startTime;

      // Cache the result
      await this.cacheManager.set(key, value, ttl);

      // Prefetch related data if enabled
      if (prefetch) {
        this.prefetchRelatedData(key, value);
      }

      this.logger.debug('PERFORMANCE', `Lazy loaded: ${key}`, { duration });
      return value;
    };
  }

  /**
   * Execute operation with performance tracking
   */
  async executeOperation<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // Check concurrent operation limit
    if (this.activeOperations.size >= this.config.maxConcurrentOperations) {
      this.logger.warn('PERFORMANCE', 'Max concurrent operations reached, waiting...');
      await this.waitForSlot();
    }

    const startTime = performance.now();
    this.activeOperations.add(key);
    this.operationTimers.set(key, startTime);

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      // Update metrics
      this.updateMetrics(duration);
      this.logger.debug('PERFORMANCE', `Operation completed: ${key}`, { duration });

      return result;
    } catch (error) {
      this.logger.error('PERFORMANCE', `Operation failed: ${key}`, error);
      throw error;
    } finally {
      this.activeOperations.delete(key);
      this.operationTimers.delete(key);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    // Update memory usage
    if (performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
    }

    // Update cache hit rate
    const cacheStats = this.cacheManager.getStatistics();
    this.metrics.cacheHitRate = cacheStats.hitRate;

    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      operationCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Process batch queue
   */
  private async processBatch(key: string): Promise<void> {
    const queue = this.batchQueues.get(key);
    if (!queue || queue.length === 0) {
      return;
    }

    // Clear queue
    this.batchQueues.set(key, []);

    // Process batch
    await this.executeOperation(`batch_${key}`, async () => {
      this.logger.debug('PERFORMANCE', `Processing batch: ${key}`, { size: queue.length });
      
      // Execute all operations in parallel
      const promises = queue.map(operation => {
        if (typeof operation === 'function') {
          return operation();
        }
        return operation;
      });

      await Promise.allSettled(promises);
    });
  }

  /**
   * Prefetch related data
   */
  private async prefetchRelatedData(key: string, value: any): Promise<void> {
    try {
      // This would be customized based on the type of data
      // For now, just log the prefetch attempt
      this.logger.debug('PERFORMANCE', `Prefetching related data for: ${key}`);
    } catch (error) {
      this.logger.warn('PERFORMANCE', 'Error prefetching related data', error);
    }
  }

  /**
   * Wait for available operation slot
   */
  private async waitForSlot(): Promise<void> {
    return new Promise(resolve => {
      const checkSlot = () => {
        if (this.activeOperations.size < this.config.maxConcurrentOperations) {
          resolve();
        } else {
          setTimeout(checkSlot, 10);
        }
      };
      checkSlot();
    });
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(duration: number): void {
    this.metrics.operationCount++;
    this.metrics.totalExecutionTime += duration;
    this.metrics.averageExecutionTime = this.metrics.totalExecutionTime / this.metrics.operationCount;
    this.metrics.timestamp = Date.now();
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    // Monitor memory usage
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.monitorMemoryUsage();
        this.monitorCachePerformance();
      });
    }

    // Set up periodic metrics reporting
    setInterval(() => {
      this.reportMetrics();
    }, 60000); // Every minute
  }

  /**
   * Monitor memory usage
   */
  private monitorMemoryUsage(): void {
    if (performance.memory) {
      const memoryInfo = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
      };

      this.logger.debug('PERFORMANCE', 'Memory usage', memoryInfo);

      // Trigger cleanup if memory usage is high
      if (memoryInfo.used / memoryInfo.limit > 0.8) {
        this.logger.warn('PERFORMANCE', 'High memory usage detected, triggering cleanup');
        this.cacheManager.cleanup();
      }
    }
  }

  /**
   * Monitor cache performance
   */
  private monitorCachePerformance(): void {
    const stats = this.cacheManager.getStatistics();
    
    this.logger.debug('PERFORMANCE', 'Cache statistics', {
      hitRate: stats.hitRate,
      size: stats.currentSize,
      entries: stats.currentEntries,
    });

    // Trigger cache cleanup if hit rate is low
    if (stats.hitRate < 0.5 && stats.currentEntries > 100) {
      this.logger.info('PERFORMANCE', 'Low cache hit rate detected, optimizing cache');
      this.cacheManager.cleanup();
    }
  }

  /**
   * Report metrics
   */
  private reportMetrics(): void {
    const metrics = this.getMetrics();
    
    this.logger.info('PERFORMANCE', 'Performance metrics', {
      operationCount: metrics.operationCount,
      averageExecutionTime: metrics.averageExecutionTime,
      cacheHitRate: metrics.cacheHitRate,
      memoryUsage: metrics.memoryUsage,
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear all timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.throttleTimers.clear();
    this.debounceTimers.clear();
    this.batchQueues.clear();
    this.activeOperations.clear();
    this.operationTimers.clear();

    this.logger.info('PERFORMANCE', 'Performance optimizer destroyed');
  }
}

// Create default instance
export const defaultPerformanceOptimizer = PerformanceOptimizer.getInstance();

/**
 * Performance decorator for methods
 */
export function trackPerformance(key?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const optimizer = PerformanceOptimizer.getInstance();

    descriptor.value = async function (...args: any[]) {
      const operationKey = key || `${target.constructor.name}.${propertyKey}`;
      return optimizer.executeOperation(operationKey, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Memoization decorator for methods
 */
export function memoize(keyGenerator?: (...args: any[]) => string, ttl?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const optimizer = PerformanceOptimizer.getInstance();

    descriptor.value = optimizer.memoize(
      (...args: any[]) => originalMethod.apply(target, args),
      keyGenerator,
      ttl
    );

    return descriptor;
  };
}

/**
 * Debounce decorator for methods
 */
export function debounce(delay?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const optimizer = PerformanceOptimizer.getInstance();

    descriptor.value = function (...args: any[]) {
      const key = `${target.constructor.name}.${propertyKey}`;
      optimizer.debounce(key, (...args: any[]) => originalMethod.apply(this, args), delay, ...args);
    };

    return descriptor;
  };
}

/**
 * Throttle decorator for methods
 */
export function throttle(delay?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const optimizer = PerformanceOptimizer.getInstance();

    descriptor.value = function (...args: any[]) {
      const key = `${target.constructor.name}.${propertyKey}`;
      optimizer.throttle(key, (...args: any[]) => originalMethod.apply(this, args), delay, ...args);
    };

    return descriptor;
  };
}
