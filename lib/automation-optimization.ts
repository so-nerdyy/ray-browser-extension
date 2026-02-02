/**
 * Automation optimization for browser automation
 * Handles performance monitoring and optimization
 */

import { PerformanceMetrics } from './automation-types';
import { chromeApi } from './chrome-api-wrappers';

export interface OptimizationOptions {
  enableCaching?: boolean;
  enableBatching?: boolean;
  enableMetrics?: boolean;
  maxCacheSize?: number;
  cacheTimeout?: number;
  batchSize?: number;
  batchDelay?: number;
}

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface BatchOperation {
  id: string;
  type: string;
  commands: any[];
  timestamp: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  results?: any[];
}

export class AutomationOptimization {
  private cache: Map<string, CacheEntry> = new Map();
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private batchQueue: BatchOperation[] = [];
  private batchTimer: number | null = null;
  private defaultOptions: OptimizationOptions = {
    enableCaching: true,
    enableBatching: true,
    enableMetrics: true,
    maxCacheSize: 100,
    cacheTimeout: 30000, // 30 seconds
    batchSize: 5,
    batchDelay: 100
  };

  /**
   * Initialize optimization system
   */
  async initialize(options: Partial<OptimizationOptions> = {}): Promise<void> {
    this.defaultOptions = { ...this.defaultOptions, ...options };

    // Load cached data from storage
    if (this.defaultOptions.enableCaching) {
      await this.loadCacheFromStorage();
    }

    // Load metrics from storage
    if (this.defaultOptions.enableMetrics) {
      await this.loadMetricsFromStorage();
    }

    console.log('Automation optimization initialized');
  }

  /**
   * Get a value from cache
   */
  getCached(key: string): any | undefined {
    if (!this.defaultOptions.enableCaching) {
      return undefined;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if entry is still valid
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update hit count
    entry.hits++;

    return entry.value;
  }

  /**
   * Set a value in cache
   */
  setCached(key: string, value: any, ttl?: number): void {
    if (!this.defaultOptions.enableCaching) {
      return;
    }

    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultOptions.cacheTimeout!,
      hits: 0
    };

    this.cache.set(key, entry);

    // Clean up cache if it's too large
    this.cleanupCache();

    // Persist to storage
    this.persistCacheToStorage();
  }

  /**
   * Clear cache entry
   */
  clearCacheEntry(key: string): boolean {
    if (!this.defaultOptions.enableCaching) {
      return false;
    }

    const deleted = this.cache.delete(key);

    if (deleted) {
      this.persistCacheToStorage();
    }

    return deleted;
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    if (!this.defaultOptions.enableCaching) {
      return;
    }

    this.cache.clear();
    this.persistCacheToStorage();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));

    // Also clean up if cache is too large
    if (this.cache.size > (this.defaultOptions.maxCacheSize || 100)) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, this.defaultOptions.maxCacheSize || 100);

      this.cache.clear();
      entries.forEach(([key, entry]) => {
        this.cache.set(key, entry);
      });
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): any {
    const entries = Array.from(this.cache.entries());
    const now = Date.now();

    let expiredCount = 0;
    let totalHits = 0;
    let averageAge = 0;

    entries.forEach(([key, entry]) => {
      if (now - entry.timestamp > entry.ttl) {
        expiredCount++;
      } else {
        totalHits += entry.hits;
        averageAge += now - entry.timestamp;
      }
    });

    return {
      totalEntries: this.cache.size,
      expiredCount,
      validEntries: this.cache.size - expiredCount,
      totalHits,
      averageAge: entries.length > 0 ? averageAge / entries.length : 0,
      hitRate: totalHits > 0 ? totalHits / (totalHits + entries.length) : 0,
      memoryUsage: this.estimateCacheMemoryUsage()
    };
  }

  /**
   * Estimate cache memory usage
   */
  private estimateCacheMemoryUsage(): number {
    let totalSize = 0;

    this.cache.forEach((entry, key) => {
      totalSize += JSON.stringify(entry).length * 2; // Rough estimate
    });

    return totalSize;
  }

  /**
   * Persist cache to storage
   */
  private async persistCacheToStorage(): Promise<void> {
    try {
      const cacheData = Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        ...entry
      }));

      await chromeApi.setStorageData('automation_cache', cacheData);
    } catch (error) {
      console.error('Failed to persist cache to storage:', error);
    }
  }

  /**
   * Load cache from storage
   */
  private async loadCacheFromStorage(): Promise<void> {
    try {
      const cacheData = await chromeApi.getStorageData('automation_cache');

      if (cacheData && Array.isArray(cacheData)) {
        this.cache.clear();

        cacheData.forEach(item => {
          this.cache.set(item.key, {
            key: item.key,
            value: item.value,
            timestamp: item.timestamp,
            ttl: item.ttl,
            hits: item.hits || 0
          });
        });
      }
    } catch (error) {
      console.error('Failed to load cache from storage:', error);
    }
  }

  /**
   * Add commands to batch queue
   */
  addToBatch(type: string, commands: any[]): string {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const batch: BatchOperation = {
      id: batchId,
      type,
      commands,
      timestamp: Date.now(),
      status: 'pending'
    };

    this.batchQueue.push(batch);

    // Start batch processing if not already running
    if (!this.batchTimer && this.defaultOptions.enableBatching) {
      this.startBatchProcessing();
    }

    return batchId;
  }

  /**
   * Start batch processing
   */
  private startBatchProcessing(): void {
    if (this.batchTimer) {
      return;
    }

    this.batchTimer = window.setTimeout(() => {
      this.processBatch();
    }, this.defaultOptions.batchDelay || 100);
  }

  /**
   * Process batch queue
   */
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) {
      this.batchTimer = null;
      return;
    }

    const batch = this.batchQueue.shift();

    if (!batch) {
      this.batchTimer = null;
      return;
    }

    batch.status = 'executing';

    try {
      // Process commands in batch
      const batchSize = this.defaultOptions.batchSize || 5;
      const commands = batch.commands.slice(0, batchSize);

      // This would execute the commands
      // For now, we'll simulate execution
      const results = await Promise.all(
        commands.map(command => this.executeCommand(command))
      );

      batch.results = results;
      batch.status = 'completed';

      // Process remaining commands if any
      if (batch.commands.length > batchSize) {
        batch.commands = batch.commands.slice(batchSize);
        this.batchQueue.unshift(batch);
      }

    } catch (error) {
      batch.status = 'failed';
      console.error('Batch execution failed:', error);
    }

    // Continue processing if more batches
    if (this.batchQueue.length > 0) {
      this.startBatchProcessing();
    } else {
      this.batchTimer = null;
    }
  }

  /**
   * Execute a command (simulated)
   */
  private async executeCommand(command: any): Promise<any> {
    // This would execute the actual command
    // For now, we'll simulate execution
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: true,
          timestamp: Date.now(),
          data: command
        });
      }, Math.random() * 100 + 50); // Random delay between 50-150ms
    });
  }

  /**
   * Get batch status
   */
  getBatchStatus(batchId: string): BatchOperation | undefined {
    return this.batchQueue.find(batch => batch.id === batchId);
  }

  /**
   * Get all batches
   */
  getAllBatches(): BatchOperation[] {
    return [...this.batchQueue];
  }

  /**
   * Clear batch queue
   */
  clearBatchQueue(): void {
    this.batchQueue = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Record performance metrics
   */
  recordMetrics(commandType: string, startTime: number, endTime: number, success: boolean, error?: Error): void {
    if (!this.defaultOptions.enableMetrics) {
      return;
    }

    const metrics: PerformanceMetrics = {
      commandType,
      startTime,
      endTime,
      duration: endTime - startTime,
      memoryUsage: this.getMemoryUsage(),
      success
    };

    const key = `metrics_${commandType}`;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const metricList = this.metrics.get(key)!;
    metricList.push(metrics);

    // Keep only recent metrics
    if (metricList.length > 100) {
      metricList.splice(0, metricList.length - 100);
      this.metrics.set(key, metricList);
    }

    // Persist to storage
    this.persistMetricsToStorage();
  }

  /**
   * Get performance metrics
   */
  getMetrics(commandType?: string): PerformanceMetrics[] {
    if (commandType) {
      return this.metrics.get(`metrics_${commandType}`) || [];
    }

    // Return all metrics if no type specified
    const allMetrics: PerformanceMetrics[] = [];
    this.metrics.forEach(metricList => {
      allMetrics.push(...metricList);
    });

    return allMetrics;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStatistics(commandType?: string): any {
    const allMetrics = this.getMetrics(commandType);

    if (allMetrics.length === 0) {
      return {
        totalCommands: 0,
        averageDuration: 0,
        successRate: 0,
        totalDuration: 0
      };
    }

    const totalCommands = allMetrics.length;
    const successfulCommands = allMetrics.filter(m => m.success).length;
    const totalDuration = allMetrics.reduce((sum, m) => sum + m.duration, 0);

    return {
      commandType,
      totalCommands,
      successfulCommands,
      failedCommands: totalCommands - successfulCommands,
      successRate: successfulCommands / totalCommands,
      averageDuration: totalDuration / totalCommands,
      totalDuration,
      minDuration: Math.min(...allMetrics.map(m => m.duration)),
      maxDuration: Math.max(...allMetrics.map(m => m.duration))
    };
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): any {
    if (performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        cacheMemoryUsage: this.estimateCacheMemoryUsage(),
        estimatedTotalUsage: this.estimateTotalMemoryUsage()
      };
    }

    return {
      cacheMemoryUsage: this.estimateCacheMemoryUsage(),
      estimatedTotalUsage: this.estimateTotalMemoryUsage()
    };
  }

  /**
   * Estimate total memory usage
   */
  private estimateTotalMemoryUsage(): number {
    let totalSize = 0;

    // Estimate cache size
    totalSize += this.estimateCacheMemoryUsage();

    // Estimate metrics size
    this.metrics.forEach(metricList => {
      totalSize += JSON.stringify(metricList).length * 2;
    });

    // Estimate batch queue size
    totalSize += JSON.stringify(this.batchQueue).length * 2;

    return totalSize;
  }

  /**
   * Persist metrics to storage
   */
  private async persistMetricsToStorage(): Promise<void> {
    try {
      const metricsData = {};

      this.metrics.forEach((metricList, key) => {
        metricsData[key] = metricList;
      });

      await chromeApi.setStorageData('automation_metrics', metricsData);
    } catch (error) {
      console.error('Failed to persist metrics to storage:', error);
    }
  }

  /**
   * Load metrics from storage
   */
  private async loadMetricsFromStorage(): Promise<void> {
    try {
      const metricsData = await chromeApi.getStorageData('automation_metrics');

      if (metricsData) {
        Object.keys(metricsData).forEach(key => {
          if (Array.isArray(metricsData[key])) {
            this.metrics.set(key, metricsData[key]);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load metrics from storage:', error);
    }
  }

  /**
   * Optimize selector
   */
  optimizeSelector(selector: string): string {
    // Simple selector optimization
    return selector.trim()
      .replace(/\s+/g, ' ')
      .replace(/> </g, '>')
      .replace(/>/g, '>');
  }

  /**
   * Optimize command sequence
   */
  optimizeCommandSequence(commands: any[]): any[] {
    // Simple optimization - remove redundant commands
    const optimized: any[] = [];
    const seen = new Set();

    for (const command of commands) {
      const key = `${command.type}_${command.selector || ''}_${command.value || ''}`;

      if (!seen.has(key)) {
        optimized.push(command);
        seen.add(key);
      }
    }

    return optimized;
  }

  /**
   * Set optimization options
   */
  setOptions(options: Partial<OptimizationOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Get optimization options
   */
  getOptions(): OptimizationOptions {
    return { ...this.defaultOptions };
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStatistics(): any {
    return {
      cache: this.getCacheStatistics(),
      batch: {
        queueLength: this.batchQueue.length,
        isProcessing: this.batchTimer !== null,
        averageBatchSize: this.batchQueue.length > 0
          ? this.batchQueue.reduce((sum, batch) => sum + batch.commands.length, 0) / this.batchQueue.length
          : 0
      },
      metrics: {
        totalMetricTypes: this.metrics.size,
        totalMetrics: Array.from(this.metrics.values()).reduce((sum, list) => sum + list.length, 0),
        memoryUsage: this.getMemoryUsage()
      },
      options: this.defaultOptions
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Clear cache
    this.clearCache();

    // Clear batch queue
    this.clearBatchQueue();

    // Clear metrics
    this.metrics.clear();

    // Clear storage
    try {
      await chromeApi.setStorageData('automation_cache', null);
      await chromeApi.setStorageData('automation_metrics', null);
    } catch (error) {
      console.error('Failed to cleanup optimization storage:', error);
    }
  }
}

// Export singleton instance for convenience
export const automationOptimization = new AutomationOptimization();
