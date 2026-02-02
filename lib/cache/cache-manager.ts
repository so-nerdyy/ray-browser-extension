/**
 * Centralized caching system for the Ray extension
 */

import { Logger, defaultLogger } from '../utils/logger';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessed: number;
  metadata?: any;
  size: number;
}

export interface CacheConfig {
  maxSize: number;
  maxAge: number; // in milliseconds
  cleanupInterval: number; // in milliseconds
  enableCompression: boolean;
  enableEncryption: boolean;
  enablePersistence: boolean;
  storageKey: string;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'size';
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  currentSize: number;
  currentEntries: number;
  hitRate: number;
  averageAccessTime: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private config: CacheConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private logger: Logger;
  private statistics: CacheStatistics;
  private cleanupTimer?: NodeJS.Timeout;
  private totalAccessTime: number = 0;
  private accessCount: number = 0;

  private constructor(config: Partial<CacheConfig> = {}, logger?: Logger) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxAge: 30 * 60 * 1000, // 30 minutes
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      enableCompression: false,
      enableEncryption: false,
      enablePersistence: true,
      storageKey: 'ray_cache',
      evictionPolicy: 'lru',
      ...config,
    };

    this.logger = logger || defaultLogger;
    this.statistics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      currentSize: 0,
      currentEntries: 0,
      hitRate: 0,
      averageAccessTime: 0,
    };

    this.initializeCache();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<CacheConfig>, logger?: Logger): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config, logger);
    }
    return CacheManager.instance;
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.statistics.misses++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache miss: ${key}`);
        return null;
      }

      // Check if entry has expired
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.statistics.misses++;
        this.statistics.deletes++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache expired: ${key}`);
        return null;
      }

      // Update access information
      entry.accessCount++;
      entry.lastAccessed = Date.now();

      this.statistics.hits++;
      this.updateStatistics();
      
      const accessTime = performance.now() - startTime;
      this.updateAccessTime(accessTime);
      
      this.logger.debug('CACHE', `Cache hit: ${key}`, { accessTime });
      return entry.value;
    } catch (error) {
      this.logger.error('CACHE', `Error getting cache entry: ${key}`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string, 
    value: T, 
    ttl?: number,
    metadata?: any
  ): Promise<void> {
    try {
      const now = Date.now();
      const size = this.calculateSize(value);
      
      // Check if we need to make space
      await this.ensureSpace(size);

      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: now,
        expiresAt: ttl ? now + ttl : now + this.config.maxAge,
        accessCount: 0,
        lastAccessed: now,
        metadata,
        size,
      };

      this.cache.set(key, entry);
      this.statistics.sets++;
      this.updateStatistics();
      
      this.logger.debug('CACHE', `Cache set: ${key}`, { size, ttl });
      
      // Persist if enabled
      if (this.config.enablePersistence) {
        await this.persistCache();
      }
    } catch (error) {
      this.logger.error('CACHE', `Error setting cache entry: ${key}`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.statistics.deletes++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache delete: ${key}`);
        
        if (this.config.enablePersistence) {
          await this.persistCache();
        }
      }
      return deleted;
    } catch (error) {
      this.logger.error('CACHE', `Error deleting cache entry: ${key}`, error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    try {
      const entry = this.cache.get(key);
      if (!entry) {
        return false;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('CACHE', `Error checking cache entry: ${key}`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.statistics.deletes += this.statistics.currentEntries;
      this.updateStatistics();
      
      this.logger.info('CACHE', 'Cache cleared');
      
      if (this.config.enablePersistence) {
        await this.persistCache();
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error clearing cache', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Get cache keys
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size in bytes
   */
  getSize(): number {
    return this.statistics.currentSize;
  }

  /**
   * Get cache entry count
   */
  getCount(): number {
    return this.cache.size;
  }

  /**
   * Force cleanup of expired entries
   */
  async cleanup(): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();

    try {
      for (const [key, entry] of this.cache.entries()) {
        if (this.isExpired(entry)) {
          this.cache.delete(key);
          cleanedCount++;
        }
      }

      this.statistics.deletes += cleanedCount;
      this.updateStatistics();
      
      if (cleanedCount > 0) {
        this.logger.debug('CACHE', `Cleaned up ${cleanedCount} expired entries`);
        
        if (this.config.enablePersistence) {
          await this.persistCache();
        }
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error during cleanup', error);
    }

    return cleanedCount;
  }

  /**
   * Initialize cache
   */
  private async initializeCache(): Promise<void> {
    try {
      // Load from storage if persistence is enabled
      if (this.config.enablePersistence) {
        await this.loadPersistedCache();
      }

      // Start cleanup timer
      this.startCleanupTimer();
      
      this.logger.info('CACHE', 'Cache initialized', {
        maxSize: this.config.maxSize,
        maxAge: this.config.maxAge,
        entries: this.cache.size,
      });
    } catch (error) {
      this.logger.error('CACHE', 'Error initializing cache', error);
    }
  }

  /**
   * Check if entry has expired
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.expiresAt) {
      return false;
    }
    return Date.now() > entry.expiresAt;
  }

  /**
   * Calculate size of value
   */
  private calculateSize(value: any): number {
    try {
      const serialized = JSON.stringify(value);
      return new Blob([serialized]).size;
    } catch (error) {
      this.logger.warn('CACHE', 'Error calculating size', error);
      return 1024; // Default to 1KB
    }
  }

  /**
   * Ensure there's enough space for new entry
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    const currentSize = this.statistics.currentSize;
    
    if (currentSize + requiredSize <= this.config.maxSize) {
      return;
    }

    this.logger.debug('CACHE', `Need to free space: ${requiredSize} bytes, current: ${currentSize}`);
    
    // Evict entries based on policy
    const entriesToEvict = this.getEntriesToEvict(requiredSize);
    
    for (const key of entriesToEvict) {
      this.cache.delete(key);
      this.statistics.evictions++;
    }
    
    this.statistics.deletes += entriesToEvict.length;
    this.updateStatistics();
    
    this.logger.debug('CACHE', `Evicted ${entriesToEvict.length} entries`);
  }

  /**
   * Get entries to evict based on policy
   */
  private getEntriesToEvict(requiredSize: number): string[] {
    const entries = Array.from(this.cache.entries());
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        return this.evictLRU(entries, requiredSize);
      case 'lfu':
        return this.evictLFU(entries, requiredSize);
      case 'ttl':
        return this.evictTTL(entries, requiredSize);
      case 'size':
        return this.evictBySize(entries, requiredSize);
      default:
        return this.evictLRU(entries, requiredSize);
    }
  }

  /**
   * Evict using Least Recently Used policy
   */
  private evictLRU(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict using Least Frequently Used policy
   */
  private evictLFU(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict using Time To Live policy
   */
  private evictTTL(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => (a[1].expiresAt || 0) - (b[1].expiresAt || 0));
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict by size (largest first)
   */
  private evictBySize(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => b[1].size - a[1].size);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict from sorted entries
   */
  private evictFromSorted(sorted: [string, CacheEntry][], requiredSize: number): string[] {
    const keysToEvict: string[] = [];
    let freedSpace = 0;
    
    for (const [key, entry] of sorted) {
      keysToEvict.push(key);
      freedSpace += entry.size;
      
      if (freedSpace >= requiredSize) {
        break;
      }
    }
    
    return keysToEvict;
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    this.statistics.currentEntries = this.cache.size;
    this.statistics.currentSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
    
    const totalRequests = this.statistics.hits + this.statistics.misses;
    this.statistics.hitRate = totalRequests > 0 ? this.statistics.hits / totalRequests : 0;
  }

  /**
   * Update access time statistics
   */
  private updateAccessTime(accessTime: number): void {
    this.totalAccessTime += accessTime;
    this.accessCount++;
    this.statistics.averageAccessTime = this.totalAccessTime / this.accessCount;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Persist cache to storage
   */
  private async persistCache(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const serialized = JSON.stringify(Array.from(this.cache.entries()));
        await chrome.storage.local.set({
          [this.config.storageKey]: serialized,
        });
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error persisting cache', error);
    }
  }

  /**
   * Load persisted cache from storage
   */
  private async loadPersistedCache(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(this.config.storageKey);
        if (result[this.config.storageKey]) {
          const entries = JSON.parse(result[this.config.storageKey]);
          this.cache = new Map(entries);
          this.updateStatistics();
          this.logger.info('CACHE', `Loaded ${this.cache.size} entries from storage`);
        }
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error loading persisted cache', error);
    }
  }

  /**
   * Destroy cache manager
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cache.clear();
    this.logger.info('CACHE', 'Cache manager destroyed');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cleanup timer if interval changed
    if (newConfig.cleanupInterval) {
      this.startCleanupTimer();
    }
  }
}

// Create default instance
export const defaultCacheManager = CacheManager.getInstance();
 * Centralized caching system for the Ray extension
 */

import { Logger, defaultLogger } from '../utils/logger';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessed: number;
  metadata?: any;
  size: number;
}

export interface CacheConfig {
  maxSize: number;
  maxAge: number; // in milliseconds
  cleanupInterval: number; // in milliseconds
  enableCompression: boolean;
  enableEncryption: boolean;
  enablePersistence: boolean;
  storageKey: string;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'size';
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  currentSize: number;
  currentEntries: number;
  hitRate: number;
  averageAccessTime: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private config: CacheConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private logger: Logger;
  private statistics: CacheStatistics;
  private cleanupTimer?: NodeJS.Timeout;
  private totalAccessTime: number = 0;
  private accessCount: number = 0;

  private constructor(config: Partial<CacheConfig> = {}, logger?: Logger) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxAge: 30 * 60 * 1000, // 30 minutes
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      enableCompression: false,
      enableEncryption: false,
      enablePersistence: true,
      storageKey: 'ray_cache',
      evictionPolicy: 'lru',
      ...config,
    };

    this.logger = logger || defaultLogger;
    this.statistics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      currentSize: 0,
      currentEntries: 0,
      hitRate: 0,
      averageAccessTime: 0,
    };

    this.initializeCache();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<CacheConfig>, logger?: Logger): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config, logger);
    }
    return CacheManager.instance;
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.statistics.misses++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache miss: ${key}`);
        return null;
      }

      // Check if entry has expired
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.statistics.misses++;
        this.statistics.deletes++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache expired: ${key}`);
        return null;
      }

      // Update access information
      entry.accessCount++;
      entry.lastAccessed = Date.now();

      this.statistics.hits++;
      this.updateStatistics();
      
      const accessTime = performance.now() - startTime;
      this.updateAccessTime(accessTime);
      
      this.logger.debug('CACHE', `Cache hit: ${key}`, { accessTime });
      return entry.value;
    } catch (error) {
      this.logger.error('CACHE', `Error getting cache entry: ${key}`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string, 
    value: T, 
    ttl?: number,
    metadata?: any
  ): Promise<void> {
    try {
      const now = Date.now();
      const size = this.calculateSize(value);
      
      // Check if we need to make space
      await this.ensureSpace(size);

      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: now,
        expiresAt: ttl ? now + ttl : now + this.config.maxAge,
        accessCount: 0,
        lastAccessed: now,
        metadata,
        size,
      };

      this.cache.set(key, entry);
      this.statistics.sets++;
      this.updateStatistics();
      
      this.logger.debug('CACHE', `Cache set: ${key}`, { size, ttl });
      
      // Persist if enabled
      if (this.config.enablePersistence) {
        await this.persistCache();
      }
    } catch (error) {
      this.logger.error('CACHE', `Error setting cache entry: ${key}`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.statistics.deletes++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache delete: ${key}`);
        
        if (this.config.enablePersistence) {
          await this.persistCache();
        }
      }
      return deleted;
    } catch (error) {
      this.logger.error('CACHE', `Error deleting cache entry: ${key}`, error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    try {
      const entry = this.cache.get(key);
      if (!entry) {
        return false;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('CACHE', `Error checking cache entry: ${key}`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.statistics.deletes += this.statistics.currentEntries;
      this.updateStatistics();
      
      this.logger.info('CACHE', 'Cache cleared');
      
      if (this.config.enablePersistence) {
        await this.persistCache();
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error clearing cache', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Get cache keys
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size in bytes
   */
  getSize(): number {
    return this.statistics.currentSize;
  }

  /**
   * Get cache entry count
   */
  getCount(): number {
    return this.cache.size;
  }

  /**
   * Force cleanup of expired entries
   */
  async cleanup(): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();

    try {
      for (const [key, entry] of this.cache.entries()) {
        if (this.isExpired(entry)) {
          this.cache.delete(key);
          cleanedCount++;
        }
      }

      this.statistics.deletes += cleanedCount;
      this.updateStatistics();
      
      if (cleanedCount > 0) {
        this.logger.debug('CACHE', `Cleaned up ${cleanedCount} expired entries`);
        
        if (this.config.enablePersistence) {
          await this.persistCache();
        }
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error during cleanup', error);
    }

    return cleanedCount;
  }

  /**
   * Initialize cache
   */
  private async initializeCache(): Promise<void> {
    try {
      // Load from storage if persistence is enabled
      if (this.config.enablePersistence) {
        await this.loadPersistedCache();
      }

      // Start cleanup timer
      this.startCleanupTimer();
      
      this.logger.info('CACHE', 'Cache initialized', {
        maxSize: this.config.maxSize,
        maxAge: this.config.maxAge,
        entries: this.cache.size,
      });
    } catch (error) {
      this.logger.error('CACHE', 'Error initializing cache', error);
    }
  }

  /**
   * Check if entry has expired
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.expiresAt) {
      return false;
    }
    return Date.now() > entry.expiresAt;
  }

  /**
   * Calculate size of value
   */
  private calculateSize(value: any): number {
    try {
      const serialized = JSON.stringify(value);
      return new Blob([serialized]).size;
    } catch (error) {
      this.logger.warn('CACHE', 'Error calculating size', error);
      return 1024; // Default to 1KB
    }
  }

  /**
   * Ensure there's enough space for new entry
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    const currentSize = this.statistics.currentSize;
    
    if (currentSize + requiredSize <= this.config.maxSize) {
      return;
    }

    this.logger.debug('CACHE', `Need to free space: ${requiredSize} bytes, current: ${currentSize}`);
    
    // Evict entries based on policy
    const entriesToEvict = this.getEntriesToEvict(requiredSize);
    
    for (const key of entriesToEvict) {
      this.cache.delete(key);
      this.statistics.evictions++;
    }
    
    this.statistics.deletes += entriesToEvict.length;
    this.updateStatistics();
    
    this.logger.debug('CACHE', `Evicted ${entriesToEvict.length} entries`);
  }

  /**
   * Get entries to evict based on policy
   */
  private getEntriesToEvict(requiredSize: number): string[] {
    const entries = Array.from(this.cache.entries());
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        return this.evictLRU(entries, requiredSize);
      case 'lfu':
        return this.evictLFU(entries, requiredSize);
      case 'ttl':
        return this.evictTTL(entries, requiredSize);
      case 'size':
        return this.evictBySize(entries, requiredSize);
      default:
        return this.evictLRU(entries, requiredSize);
    }
  }

  /**
   * Evict using Least Recently Used policy
   */
  private evictLRU(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict using Least Frequently Used policy
   */
  private evictLFU(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict using Time To Live policy
   */
  private evictTTL(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => (a[1].expiresAt || 0) - (b[1].expiresAt || 0));
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict by size (largest first)
   */
  private evictBySize(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => b[1].size - a[1].size);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict from sorted entries
   */
  private evictFromSorted(sorted: [string, CacheEntry][], requiredSize: number): string[] {
    const keysToEvict: string[] = [];
    let freedSpace = 0;
    
    for (const [key, entry] of sorted) {
      keysToEvict.push(key);
      freedSpace += entry.size;
      
      if (freedSpace >= requiredSize) {
        break;
      }
    }
    
    return keysToEvict;
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    this.statistics.currentEntries = this.cache.size;
    this.statistics.currentSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
    
    const totalRequests = this.statistics.hits + this.statistics.misses;
    this.statistics.hitRate = totalRequests > 0 ? this.statistics.hits / totalRequests : 0;
  }

  /**
   * Update access time statistics
   */
  private updateAccessTime(accessTime: number): void {
    this.totalAccessTime += accessTime;
    this.accessCount++;
    this.statistics.averageAccessTime = this.totalAccessTime / this.accessCount;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Persist cache to storage
   */
  private async persistCache(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const serialized = JSON.stringify(Array.from(this.cache.entries()));
        await chrome.storage.local.set({
          [this.config.storageKey]: serialized,
        });
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error persisting cache', error);
    }
  }

  /**
   * Load persisted cache from storage
   */
  private async loadPersistedCache(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(this.config.storageKey);
        if (result[this.config.storageKey]) {
          const entries = JSON.parse(result[this.config.storageKey]);
          this.cache = new Map(entries);
          this.updateStatistics();
          this.logger.info('CACHE', `Loaded ${this.cache.size} entries from storage`);
        }
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error loading persisted cache', error);
    }
  }

  /**
   * Destroy cache manager
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cache.clear();
    this.logger.info('CACHE', 'Cache manager destroyed');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cleanup timer if interval changed
    if (newConfig.cleanupInterval) {
      this.startCleanupTimer();
    }
  }
}

// Create default instance
export const defaultCacheManager = CacheManager.getInstance();
export const defaultCacheManager = CacheManager.getInstance();

import { Logger, defaultLogger } from '../utils/logger';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessed: number;
  metadata?: any;
  size: number;
}

export interface CacheConfig {
  maxSize: number;
  maxAge: number; // in milliseconds
  cleanupInterval: number; // in milliseconds
  enableCompression: boolean;
  enableEncryption: boolean;
  enablePersistence: boolean;
  storageKey: string;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'size';
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  currentSize: number;
  currentEntries: number;
  hitRate: number;
  averageAccessTime: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private config: CacheConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private logger: Logger;
  private statistics: CacheStatistics;
  private cleanupTimer?: NodeJS.Timeout;
  private totalAccessTime: number = 0;
  private accessCount: number = 0;

  private constructor(config: Partial<CacheConfig> = {}, logger?: Logger) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxAge: 30 * 60 * 1000, // 30 minutes
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      enableCompression: false,
      enableEncryption: false,
      enablePersistence: true,
      storageKey: 'ray_cache',
      evictionPolicy: 'lru',
      ...config,
    };

    this.logger = logger || defaultLogger;
    this.statistics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      currentSize: 0,
      currentEntries: 0,
      hitRate: 0,
      averageAccessTime: 0,
    };

    this.initializeCache();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<CacheConfig>, logger?: Logger): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config, logger);
    }
    return CacheManager.instance;
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.statistics.misses++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache miss: ${key}`);
        return null;
      }

      // Check if entry has expired
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.statistics.misses++;
        this.statistics.deletes++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache expired: ${key}`);
        return null;
      }

      // Update access information
      entry.accessCount++;
      entry.lastAccessed = Date.now();

      this.statistics.hits++;
      this.updateStatistics();
      
      const accessTime = performance.now() - startTime;
      this.updateAccessTime(accessTime);
      
      this.logger.debug('CACHE', `Cache hit: ${key}`, { accessTime });
      return entry.value;
    } catch (error) {
      this.logger.error('CACHE', `Error getting cache entry: ${key}`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string, 
    value: T, 
    ttl?: number,
    metadata?: any
  ): Promise<void> {
    try {
      const now = Date.now();
      const size = this.calculateSize(value);
      
      // Check if we need to make space
      await this.ensureSpace(size);

      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: now,
        expiresAt: ttl ? now + ttl : now + this.config.maxAge,
        accessCount: 0,
        lastAccessed: now,
        metadata,
        size,
      };

      this.cache.set(key, entry);
      this.statistics.sets++;
      this.updateStatistics();
      
      this.logger.debug('CACHE', `Cache set: ${key}`, { size, ttl });
      
      // Persist if enabled
      if (this.config.enablePersistence) {
        await this.persistCache();
      }
    } catch (error) {
      this.logger.error('CACHE', `Error setting cache entry: ${key}`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.statistics.deletes++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache delete: ${key}`);
        
        if (this.config.enablePersistence) {
          await this.persistCache();
        }
      }
      return deleted;
    } catch (error) {
      this.logger.error('CACHE', `Error deleting cache entry: ${key}`, error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    try {
      const entry = this.cache.get(key);
      if (!entry) {
        return false;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('CACHE', `Error checking cache entry: ${key}`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.statistics.deletes += this.statistics.currentEntries;
      this.updateStatistics();
      
      this.logger.info('CACHE', 'Cache cleared');
      
      if (this.config.enablePersistence) {
        await this.persistCache();
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error clearing cache', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Get cache keys
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size in bytes
   */
  getSize(): number {
    return this.statistics.currentSize;
  }

  /**
   * Get cache entry count
   */
  getCount(): number {
    return this.cache.size;
  }

  /**
   * Force cleanup of expired entries
   */
  async cleanup(): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();

    try {
      for (const [key, entry] of this.cache.entries()) {
        if (this.isExpired(entry)) {
          this.cache.delete(key);
          cleanedCount++;
        }
      }

      this.statistics.deletes += cleanedCount;
      this.updateStatistics();
      
      if (cleanedCount > 0) {
        this.logger.debug('CACHE', `Cleaned up ${cleanedCount} expired entries`);
        
        if (this.config.enablePersistence) {
          await this.persistCache();
        }
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error during cleanup', error);
    }

    return cleanedCount;
  }

  /**
   * Initialize cache
   */
  private async initializeCache(): Promise<void> {
    try {
      // Load from storage if persistence is enabled
      if (this.config.enablePersistence) {
        await this.loadPersistedCache();
      }

      // Start cleanup timer
      this.startCleanupTimer();
      
      this.logger.info('CACHE', 'Cache initialized', {
        maxSize: this.config.maxSize,
        maxAge: this.config.maxAge,
        entries: this.cache.size,
      });
    } catch (error) {
      this.logger.error('CACHE', 'Error initializing cache', error);
    }
  }

  /**
   * Check if entry has expired
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.expiresAt) {
      return false;
    }
    return Date.now() > entry.expiresAt;
  }

  /**
   * Calculate size of value
   */
  private calculateSize(value: any): number {
    try {
      const serialized = JSON.stringify(value);
      return new Blob([serialized]).size;
    } catch (error) {
      this.logger.warn('CACHE', 'Error calculating size', error);
      return 1024; // Default to 1KB
    }
  }

  /**
   * Ensure there's enough space for new entry
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    const currentSize = this.statistics.currentSize;
    
    if (currentSize + requiredSize <= this.config.maxSize) {
      return;
    }

    this.logger.debug('CACHE', `Need to free space: ${requiredSize} bytes, current: ${currentSize}`);
    
    // Evict entries based on policy
    const entriesToEvict = this.getEntriesToEvict(requiredSize);
    
    for (const key of entriesToEvict) {
      this.cache.delete(key);
      this.statistics.evictions++;
    }
    
    this.statistics.deletes += entriesToEvict.length;
    this.updateStatistics();
    
    this.logger.debug('CACHE', `Evicted ${entriesToEvict.length} entries`);
  }

  /**
   * Get entries to evict based on policy
   */
  private getEntriesToEvict(requiredSize: number): string[] {
    const entries = Array.from(this.cache.entries());
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        return this.evictLRU(entries, requiredSize);
      case 'lfu':
        return this.evictLFU(entries, requiredSize);
      case 'ttl':
        return this.evictTTL(entries, requiredSize);
      case 'size':
        return this.evictBySize(entries, requiredSize);
      default:
        return this.evictLRU(entries, requiredSize);
    }
  }

  /**
   * Evict using Least Recently Used policy
   */
  private evictLRU(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict using Least Frequently Used policy
   */
  private evictLFU(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict using Time To Live policy
   */
  private evictTTL(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => (a[1].expiresAt || 0) - (b[1].expiresAt || 0));
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict by size (largest first)
   */
  private evictBySize(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => b[1].size - a[1].size);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict from sorted entries
   */
  private evictFromSorted(sorted: [string, CacheEntry][], requiredSize: number): string[] {
    const keysToEvict: string[] = let freedSpace = 0;
    
    for (const [key, entry] of sorted) {
      keysToEvict.push(key);
      freedSpace += entry.size;
      
      if (freedSpace >= requiredSize) {
        break;
      }
    }
    
    return keysToEvict;
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    this.statistics.currentEntries = this.cache.size;
    this.statistics.currentSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
    
    const totalRequests = this.statistics.hits + this.statistics.misses;
    this.statistics.hitRate = totalRequests > 0 ? this.statistics.hits / totalRequests : 0;
  }

  /**
   * Update access time statistics
   */
  private updateAccessTime(accessTime: number): void {
    this.totalAccessTime += accessTime;
    this.accessCount++;
    this.statistics.averageAccessTime = this.totalAccessTime / this.accessCount;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Persist cache to storage
   */
  private async persistCache(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const serialized = JSON.stringify(Array.from(this.cache.entries()));
        await chrome.storage.local.set({
          [this.config.storageKey]: serialized,
        });
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error persisting cache', error);
    }
  }

  /**
   * Load persisted cache from storage
   */
  private async loadPersistedCache(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(this.config.storageKey);
        if (result[this.config.storageKey]) {
          const entries = JSON.parse(result[this.config.storageKey]);
          this.cache = new Map(entries);
          this.updateStatistics();
          this.logger.info('CACHE', `Loaded ${this.cache.size} entries from storage`);
        }
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error loading persisted cache', error);
    }
  }

  /**
   * Destroy cache manager
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cache.clear();
    this.logger.info('CACHE', 'Cache manager destroyed');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cleanup timer if interval changed
    if (newConfig.cleanupInterval) {
      this.startCleanupTimer();
    }
  }
}

// Create default instance
export const defaultCacheManager = CacheManager.getInstance();
 * Centralized caching system for the Ray extension
 */

import { Logger, defaultLogger } from '../utils/logger';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessed: number;
  metadata?: any;
  size: number;
}

export interface CacheConfig {
  maxSize: number;
  maxAge: number; // in milliseconds
  cleanupInterval: number; // in milliseconds
  enableCompression: boolean;
  enableEncryption: boolean;
  enablePersistence: boolean;
  storageKey: string;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'size';
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  currentSize: number;
  currentEntries: number;
  hitRate: number;
  averageAccessTime: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private config: CacheConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private logger: Logger;
  private statistics: CacheStatistics;
  private cleanupTimer?: NodeJS.Timeout;
  private totalAccessTime: number = 0;
  private accessCount: number = 0;

  private constructor(config: Partial<CacheConfig> = {}, logger?: Logger) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxAge: 30 * 60 * 1000, // 30 minutes
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      enableCompression: false,
      enableEncryption: false,
      enablePersistence: true,
      storageKey: 'ray_cache',
      evictionPolicy: 'lru',
      ...config,
    };

    this.logger = logger || defaultLogger;
    this.statistics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      currentSize: 0,
      currentEntries: 0,
      hitRate: 0,
      averageAccessTime: 0,
    };

    this.initializeCache();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<CacheConfig>, logger?: Logger): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config, logger);
    }
    return CacheManager.instance;
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.statistics.misses++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache miss: ${key}`);
        return null;
      }

      // Check if entry has expired
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.statistics.misses++;
        this.statistics.deletes++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache expired: ${key}`);
        return null;
      }

      // Update access information
      entry.accessCount++;
      entry.lastAccessed = Date.now();

      this.statistics.hits++;
      this.updateStatistics();
      
      const accessTime = performance.now() - startTime;
      this.updateAccessTime(accessTime);
      
      this.logger.debug('CACHE', `Cache hit: ${key}`, { accessTime });
      return entry.value;
    } catch (error) {
      this.logger.error('CACHE', `Error getting cache entry: ${key}`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string, 
    value: T, 
    ttl?: number,
    metadata?: any
  ): Promise<void> {
    try {
      const now = Date.now();
      const size = this.calculateSize(value);
      
      // Check if we need to make space
      await this.ensureSpace(size);

      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: now,
        expiresAt: ttl ? now + ttl : now + this.config.maxAge,
        accessCount: 0,
        lastAccessed: now,
        metadata,
        size,
      };

      this.cache.set(key, entry);
      this.statistics.sets++;
      this.updateStatistics();
      
      this.logger.debug('CACHE', `Cache set: ${key}`, { size, ttl });
      
      // Persist if enabled
      if (this.config.enablePersistence) {
        await this.persistCache();
      }
    } catch (error) {
      this.logger.error('CACHE', `Error setting cache entry: ${key}`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.statistics.deletes++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache delete: ${key}`);
        
        if (this.config.enablePersistence) {
          await this.persistCache();
        }
      }
      return deleted;
    } catch (error) {
      this.logger.error('CACHE', `Error deleting cache entry: ${key}`, error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    try {
      const entry = this.cache.get(key);
      if (!entry) {
        return false;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('CACHE', `Error checking cache entry: ${key}`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.statistics.deletes += this.statistics.currentEntries;
      this.updateStatistics();
      
      this.logger.info('CACHE', 'Cache cleared');
      
      if (this.config.enablePersistence) {
        await this.persistCache();
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error clearing cache', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Get cache keys
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size in bytes
   */
  getSize(): number {
    return this.statistics.currentSize;
  }

  /**
   * Get cache entry count
   */
  getCount(): number {
    return this.cache.size;
  }

  /**
   * Force cleanup of expired entries
   */
  async cleanup(): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();

    try {
      for (const [key, entry] of this.cache.entries()) {
        if (this.isExpired(entry)) {
          this.cache.delete(key);
          cleanedCount++;
        }
      }

      this.statistics.deletes += cleanedCount;
      this.updateStatistics();
      
      if (cleanedCount > 0) {
        this.logger.debug('CACHE', `Cleaned up ${cleanedCount} expired entries`);
        
        if (this.config.enablePersistence) {
          await this.persistCache();
        }
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error during cleanup', error);
    }

    return cleanedCount;
  }

  /**
   * Initialize cache
   */
  private async initializeCache(): Promise<void> {
    try {
      // Load from storage if persistence is enabled
      if (this.config.enablePersistence) {
        await this.loadPersistedCache();
      }

      // Start cleanup timer
      this.startCleanupTimer();
      
      this.logger.info('CACHE', 'Cache initialized', {
        maxSize: this.config.maxSize,
        maxAge: this.config.maxAge,
        entries: this.cache.size,
      });
    } catch (error) {
      this.logger.error('CACHE', 'Error initializing cache', error);
    }
  }

  /**
   * Check if entry has expired
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.expiresAt) {
      return false;
    }
    return Date.now() > entry.expiresAt;
  }

  /**
   * Calculate size of value
   */
  private calculateSize(value: any): number {
    try {
      const serialized = JSON.stringify(value);
      return new Blob([serialized]).size;
    } catch (error) {
      this.logger.warn('CACHE', 'Error calculating size', error);
      return 1024; // Default to 1KB
    }
  }

  /**
   * Ensure there's enough space for new entry
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    const currentSize = this.statistics.currentSize;
    
    if (currentSize + requiredSize <= this.config.maxSize) {
      return;
    }

    this.logger.debug('CACHE', `Need to free space: ${requiredSize} bytes, current: ${currentSize}`);
    
    // Evict entries based on policy
    const entriesToEvict = this.getEntriesToEvict(requiredSize);
    
    for (const key of entriesToEvict) {
      this.cache.delete(key);
      this.statistics.evictions++;
    }
    
    this.statistics.deletes += entriesToEvict.length;
    this.updateStatistics();
    
    this.logger.debug('CACHE', `Evicted ${entriesToEvict.length} entries`);
  }

  /**
   * Get entries to evict based on policy
   */
  private getEntriesToEvict(requiredSize: number): string[] {
    const entries = Array.from(this.cache.entries());
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        return this.evictLRU(entries, requiredSize);
      case 'lfu':
        return this.evictLFU(entries, requiredSize);
      case 'ttl':
        return this.evictTTL(entries, requiredSize);
      case 'size':
        return this.evictBySize(entries, requiredSize);
      default:
        return this.evictLRU(entries, requiredSize);
    }
  }

  /**
   * Evict using Least Recently Used policy
   */
  private evictLRU(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict using Least Frequently Used policy
   */
  private evictLFU(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict using Time To Live policy
   */
  private evictTTL(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => (a[1].expiresAt || 0) - (b[1].expiresAt || 0));
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict by size (largest first)
   */
  private evictBySize(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => b[1].size - a[1].size);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict from sorted entries
   */
  private evictFromSorted(sorted: [string, CacheEntry][], requiredSize: number): string[] {
    const keysToEvict: string[] = [];
    let freedSpace = 0;
    
    for (const [key, entry] of sorted) {
      keysToEvict.push(key);
      freedSpace += entry.size;
      
      if (freedSpace >= requiredSize) {
        break;
      }
    }
    
    return keysToEvict;
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    this.statistics.currentEntries = this.cache.size;
    this.statistics.currentSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
    
    const totalRequests = this.statistics.hits + this.statistics.misses;
    this.statistics.hitRate = totalRequests > 0 ? this.statistics.hits / totalRequests : 0;
  }

  /**
   * Update access time statistics
   */
  private updateAccessTime(accessTime: number): void {
    this.totalAccessTime += accessTime;
    this.accessCount++;
    this.statistics.averageAccessTime = this.totalAccessTime / this.accessCount;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Persist cache to storage
   */
  private async persistCache(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const serialized = JSON.stringify(Array.from(this.cache.entries()));
        await chrome.storage.local.set({
          [this.config.storageKey]: serialized,
        });
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error persisting cache', error);
    }
  }

  /**
   * Load persisted cache from storage
   */
  private async loadPersistedCache(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(this.config.storageKey);
        if (result[this.config.storageKey]) {
          const entries = JSON.parse(result[this.config.storageKey]);
          this.cache = new Map(entries);
          this.updateStatistics();
          this.logger.info('CACHE', `Loaded ${this.cache.size} entries from storage`);
        }
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error loading persisted cache', error);
    }
  }

  /**
   * Destroy cache manager
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cache.clear();
    this.logger.info('CACHE', 'Cache manager destroyed');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cleanup timer if interval changed
    if (newConfig.cleanupInterval) {
      this.startCleanupTimer();
    }
  }
}

// Create default instance
export const defaultCacheManager = CacheManager.getInstance(); * Centralized caching system for the Ray extension
 */

import { Logger, defaultLogger } from '../utils/logger';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessed: number;
  metadata?: any;
  size: number;
}

export interface CacheConfig {
  maxSize: number;
  maxAge: number; // in milliseconds
  cleanupInterval: number; // in milliseconds
  enableCompression: boolean;
  enableEncryption: boolean;
  enablePersistence: boolean;
  storageKey: string;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'size';
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  currentSize: number;
  currentEntries: number;
  hitRate: number;
  averageAccessTime: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private config: CacheConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private logger: Logger;
  private statistics: CacheStatistics;
  private cleanupTimer?: NodeJS.Timeout;
  private totalAccessTime: number = 0;
  private accessCount: number = 0;

  private constructor(config: Partial<CacheConfig> = {}, logger?: Logger) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxAge: 30 * 60 * 1000, // 30 minutes
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      enableCompression: false,
      enableEncryption: false,
      enablePersistence: true,
      storageKey: 'ray_cache',
      evictionPolicy: 'lru',
      ...config,
    };

    this.logger = logger || defaultLogger;
    this.statistics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      currentSize: 0,
      currentEntries: 0,
      hitRate: 0,
      averageAccessTime: 0,
    };

    this.initializeCache();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<CacheConfig>, logger?: Logger): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config, logger);
    }
    return CacheManager.instance;
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.statistics.misses++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache miss: ${key}`);
        return null;
      }

      // Check if entry has expired
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.statistics.misses++;
        this.statistics.deletes++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache expired: ${key}`);
        return null;
      }

      // Update access information
      entry.accessCount++;
      entry.lastAccessed = Date.now();

      this.statistics.hits++;
      this.updateStatistics();
      
      const accessTime = performance.now() - startTime;
      this.updateAccessTime(accessTime);
      
      this.logger.debug('CACHE', `Cache hit: ${key}`, { accessTime });
      return entry.value;
    } catch (error) {
      this.logger.error('CACHE', `Error getting cache entry: ${key}`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string, 
    value: T, 
    ttl?: number,
    metadata?: any
  ): Promise<void> {
    try {
      const now = Date.now();
      const size = this.calculateSize(value);
      
      // Check if we need to make space
      await this.ensureSpace(size);

      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: now,
        expiresAt: ttl ? now + ttl : now + this.config.maxAge,
        accessCount: 0,
        lastAccessed: now,
        metadata,
        size,
      };

      this.cache.set(key, entry);
      this.statistics.sets++;
      this.updateStatistics();
      
      this.logger.debug('CACHE', `Cache set: ${key}`, { size, ttl });
      
      // Persist if enabled
      if (this.config.enablePersistence) {
        await this.persistCache();
      }
    } catch (error) {
      this.logger.error('CACHE', `Error setting cache entry: ${key}`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.statistics.deletes++;
        this.updateStatistics();
        this.logger.debug('CACHE', `Cache delete: ${key}`);
        
        if (this.config.enablePersistence) {
          await this.persistCache();
        }
      }
      return deleted;
    } catch (error) {
      this.logger.error('CACHE', `Error deleting cache entry: ${key}`, error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    try {
      const entry = this.cache.get(key);
      if (!entry) {
        return false;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('CACHE', `Error checking cache entry: ${key}`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.statistics.deletes += this.statistics.currentEntries;
      this.updateStatistics();
      
      this.logger.info('CACHE', 'Cache cleared');
      
      if (this.config.enablePersistence) {
        await this.persistCache();
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error clearing cache', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Get cache keys
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size in bytes
   */
  getSize(): number {
    return this.statistics.currentSize;
  }

  /**
   * Get cache entry count
   */
  getCount(): number {
    return this.cache.size;
  }

  /**
   * Force cleanup of expired entries
   */
  async cleanup(): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();

    try {
      for (const [key, entry] of this.cache.entries()) {
        if (this.isExpired(entry)) {
          this.cache.delete(key);
          cleanedCount++;
        }
      }

      this.statistics.deletes += cleanedCount;
      this.updateStatistics();
      
      if (cleanedCount > 0) {
        this.logger.debug('CACHE', `Cleaned up ${cleanedCount} expired entries`);
        
        if (this.config.enablePersistence) {
          await this.persistCache();
        }
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error during cleanup', error);
    }

    return cleanedCount;
  }

  /**
   * Initialize cache
   */
  private async initializeCache(): Promise<void> {
    try {
      // Load from storage if persistence is enabled
      if (this.config.enablePersistence) {
        await this.loadPersistedCache();
      }

      // Start cleanup timer
      this.startCleanupTimer();
      
      this.logger.info('CACHE', 'Cache initialized', {
        maxSize: this.config.maxSize,
        maxAge: this.config.maxAge,
        entries: this.cache.size,
      });
    } catch (error) {
      this.logger.error('CACHE', 'Error initializing cache', error);
    }
  }

  /**
   * Check if entry has expired
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.expiresAt) {
      return false;
    }
    return Date.now() > entry.expiresAt;
  }

  /**
   * Calculate size of value
   */
  private calculateSize(value: any): number {
    try {
      const serialized = JSON.stringify(value);
      return new Blob([serialized]).size;
    } catch (error) {
      this.logger.warn('CACHE', 'Error calculating size', error);
      return 1024; // Default to 1KB
    }
  }

  /**
   * Ensure there's enough space for new entry
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    const currentSize = this.statistics.currentSize;
    
    if (currentSize + requiredSize <= this.config.maxSize) {
      return;
    }

    this.logger.debug('CACHE', `Need to free space: ${requiredSize} bytes, current: ${currentSize}`);
    
    // Evict entries based on policy
    const entriesToEvict = this.getEntriesToEvict(requiredSize);
    
    for (const key of entriesToEvict) {
      this.cache.delete(key);
      this.statistics.evictions++;
    }
    
    this.statistics.deletes += entriesToEvict.length;
    this.updateStatistics();
    
    this.logger.debug('CACHE', `Evicted ${entriesToEvict.length} entries`);
  }

  /**
   * Get entries to evict based on policy
   */
  private getEntriesToEvict(requiredSize: number): string[] {
    const entries = Array.from(this.cache.entries());
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        return this.evictLRU(entries, requiredSize);
      case 'lfu':
        return this.evictLFU(entries, requiredSize);
      case 'ttl':
        return this.evictTTL(entries, requiredSize);
      case 'size':
        return this.evictBySize(entries, requiredSize);
      default:
        return this.evictLRU(entries, requiredSize);
    }
  }

  /**
   * Evict using Least Recently Used policy
   */
  private evictLRU(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict using Least Frequently Used policy
   */
  private evictLFU(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict using Time To Live policy
   */
  private evictTTL(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => (a[1].expiresAt || 0) - (b[1].expiresAt || 0));
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict by size (largest first)
   */
  private evictBySize(entries: [string, CacheEntry][], requiredSize: number): string[] {
    const sorted = entries.sort((a, b) => b[1].size - a[1].size);
    return this.evictFromSorted(sorted, requiredSize);
  }

  /**
   * Evict from sorted entries
   */
  private evictFromSorted(sorted: [string, CacheEntry][], requiredSize: number): string[] {
    const keysToEvict: string[] = let freedSpace = 0;
    
    for (const [key, entry] of sorted) {
      keysToEvict.push(key);
      freedSpace += entry.size;
      
      if (freedSpace >= requiredSize) {
        break;
      }
    }
    
    return keysToEvict;
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    this.statistics.currentEntries = this.cache.size;
    this.statistics.currentSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
    
    const totalRequests = this.statistics.hits + this.statistics.misses;
    this.statistics.hitRate = totalRequests > 0 ? this.statistics.hits / totalRequests : 0;
  }

  /**
   * Update access time statistics
   */
  private updateAccessTime(accessTime: number): void {
    this.totalAccessTime += accessTime;
    this.accessCount++;
    this.statistics.averageAccessTime = this.totalAccessTime / this.accessCount;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Persist cache to storage
   */
  private async persistCache(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const serialized = JSON.stringify(Array.from(this.cache.entries()));
        await chrome.storage.local.set({
          [this.config.storageKey]: serialized,
        });
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error persisting cache', error);
    }
  }

  /**
   * Load persisted cache from storage
   */
  private async loadPersistedCache(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(this.config.storageKey);
        if (result[this.config.storageKey]) {
          const entries = JSON.parse(result[this.config.storageKey]);
          this.cache = new Map(entries);
          this.updateStatistics();
          this.logger.info('CACHE', `Loaded ${this.cache.size} entries from storage`);
        }
      }
    } catch (error) {
      this.logger.error('CACHE', 'Error loading persisted cache', error);
    }
  }

  /**
   * Destroy cache manager
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cache.clear();
    this.logger.info('CACHE', 'Cache manager destroyed');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cleanup timer if interval changed
    if (newConfig.cleanupInterval) {
      this.startCleanupTimer();
    }
  }
}

// Create default instance
export const defaultCacheManager = CacheManager.getInstance();

