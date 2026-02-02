/**
 * Storage Security for Ray Chrome Extension
 * Provides secure storage patterns and utilities for chrome.storage
 */

export interface StorageSecurityConfig {
  enableEncryption: boolean;
  enableAccessLogging: boolean;
  enableIntegrityChecks: boolean;
  maxRetries: number;
  retryDelay: number;
}

export interface StorageItem<T = any> {
  data: T;
  metadata: {
    createdAt: number;
    lastModified: number;
    accessCount: number;
    lastAccessed: number;
    checksum?: string;
    encrypted?: boolean;
  };
}

export interface StorageAccessLog {
  key: string;
  action: 'read' | 'write' | 'delete';
  timestamp: number;
  success: boolean;
  error?: string;
}

export class StorageSecurity {
  private static readonly DEFAULT_CONFIG: StorageSecurityConfig = {
    enableEncryption: false,
    enableAccessLogging: true,
    enableIntegrityChecks: true,
    maxRetries: 3,
    retryDelay: 100
  };

  private static readonly LOG_KEY = 'storageAccessLog';
  private static readonly MAX_LOG_ENTRIES = 1000;

  /**
   * Store data securely with metadata and optional encryption
   * @param key The storage key
   * @param data The data to store
   * @param config Optional security configuration
   * @returns Promise that resolves when data is stored
   */
  static async secureStore<T>(
    key: string, 
    data: T, 
    config: Partial<StorageSecurityConfig> = {}
  ): Promise<void> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    let attempt = 0;

    while (attempt < finalConfig.maxRetries) {
      try {
        const storageItem: StorageItem<T> = {
          data,
          metadata: {
            createdAt: Date.now(),
            lastModified: Date.now(),
            accessCount: 0,
            lastAccessed: 0,
            encrypted: finalConfig.enableEncryption
          }
        };

        // Add integrity checksum if enabled
        if (finalConfig.enableIntegrityChecks) {
          storageItem.metadata.checksum = await this.calculateChecksum(JSON.stringify(data));
        }

        // Encrypt data if enabled
        let finalData = storageItem;
        if (finalConfig.enableEncryption) {
          const encryptedData = await this.encryptData(JSON.stringify(data));
          finalData = {
            ...storageItem,
            data: encryptedData as any
          };
        }

        await chrome.storage.local.set({ [key]: finalData });

        // Log the access if enabled
        if (finalConfig.enableAccessLogging) {
          await this.logAccess(key, 'write', true);
        }

        return;
      } catch (error) {
        attempt++;
        if (attempt >= finalConfig.maxRetries) {
          if (finalConfig.enableAccessLogging) {
            await this.logAccess(key, 'write', false, error instanceof Error ? error.message : 'Unknown error');
          }
          throw new Error(`Failed to store data after ${attempt} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, finalConfig.retryDelay * attempt));
      }
    }
  }

  /**
   * Retrieve data securely with validation
   * @param key The storage key
   * @param config Optional security configuration
   * @returns Promise that resolves with the retrieved data or null
   */
  static async secureRetrieve<T>(
    key: string, 
    config: Partial<StorageSecurityConfig> = {}
  ): Promise<T | null> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    let attempt = 0;

    while (attempt < finalConfig.maxRetries) {
      try {
        const result = await chrome.storage.local.get([key]);
        const storageItem: StorageItem<T> = result[key];

        if (!storageItem) {
          if (finalConfig.enableAccessLogging) {
            await this.logAccess(key, 'read', false, 'Item not found');
          }
          return null;
        }

        // Update access metadata
        storageItem.metadata.accessCount++;
        storageItem.metadata.lastAccessed = Date.now();

        // Decrypt data if needed
        let data = storageItem.data;
        if (storageItem.metadata.encrypted) {
          if (typeof data === 'string') {
            data = JSON.parse(await this.decryptData(data)) as T;
          } else {
            throw new Error('Encrypted data is not in expected format');
          }
        }

        // Verify integrity if enabled
        if (finalConfig.enableIntegrityChecks && storageItem.metadata.checksum) {
          const currentChecksum = await this.calculateChecksum(JSON.stringify(data));
          if (currentChecksum !== storageItem.metadata.checksum) {
            throw new Error('Data integrity check failed');
          }
        }

        // Update the access metadata in storage
        await chrome.storage.local.set({ [key]: storageItem });

        // Log the access if enabled
        if (finalConfig.enableAccessLogging) {
          await this.logAccess(key, 'read', true);
        }

        return data;
      } catch (error) {
        attempt++;
        if (attempt >= finalConfig.maxRetries) {
          if (finalConfig.enableAccessLogging) {
            await this.logAccess(key, 'read', false, error instanceof Error ? error.message : 'Unknown error');
          }
          console.error(`Failed to retrieve data after ${attempt} attempts:`, error);
          return null;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, finalConfig.retryDelay * attempt));
      }
    }

    return null;
  }

  /**
   * Remove data securely from storage
   * @param key The storage key
   * @param config Optional security configuration
   * @returns Promise that resolves when data is removed
   */
  static async secureRemove(
    key: string, 
    config: Partial<StorageSecurityConfig> = {}
  ): Promise<void> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    let attempt = 0;

    while (attempt < finalConfig.maxRetries) {
      try {
        await chrome.storage.local.remove([key]);

        // Log the access if enabled
        if (finalConfig.enableAccessLogging) {
          await this.logAccess(key, 'delete', true);
        }

        return;
      } catch (error) {
        attempt++;
        if (attempt >= finalConfig.maxRetries) {
          if (finalConfig.enableAccessLogging) {
            await this.logAccess(key, 'delete', false, error instanceof Error ? error.message : 'Unknown error');
          }
          throw new Error(`Failed to remove data after ${attempt} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, finalConfig.retryDelay * attempt));
      }
    }
  }

  /**
   * Get metadata for a storage item without accessing the data
   * @param key The storage key
   * @returns Promise that resolves with the metadata or null
   */
  static async getStorageMetadata(key: string): Promise<StorageItem['metadata'] | null> {
    try {
      const result = await chrome.storage.local.get([key]);
      const storageItem: StorageItem = result[key];

      if (!storageItem) {
        return null;
      }

      return storageItem.metadata;
    } catch (error) {
      console.error('Failed to get storage metadata:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Calculate checksum for data integrity verification
   * @param data The data to calculate checksum for
   * @returns Promise that resolves with the checksum
   */
  private static async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataArray = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataArray);
    const hashArray = new Uint8Array(hashBuffer);
    
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Encrypt data using the key encryption module
   * @param data The data to encrypt
   * @returns Promise that resolves with encrypted data
   */
  private static async encryptData(data: string): Promise<string> {
    // Import KeyEncryption dynamically to avoid circular dependencies
    const { KeyEncryption } = await import('./key-encryption');
    const result = await KeyEncryption.encryptApiKey(data);
    
    if (!result) {
      throw new Error('Failed to encrypt data');
    }

    return JSON.stringify(result);
  }

  /**
   * Decrypt data using the key encryption module
   * @param encryptedData The encrypted data
   * @returns Promise that resolves with decrypted data
   */
  private static async decryptData(encryptedData: string): Promise<string> {
    // Import KeyEncryption dynamically to avoid circular dependencies
    const { KeyEncryption } = await import('./key-encryption');
    const encryptionResult = JSON.parse(encryptedData);
    const result = await KeyEncryption.decryptApiKey(encryptionResult);
    
    if (!result) {
      throw new Error('Failed to decrypt data');
    }

    return result;
  }

  /**
   * Log storage access for security monitoring
   * @param key The storage key
   * @param action The action performed
   * @param success Whether the action was successful
   * @param error Optional error message
   */
  private static async logAccess(
    key: string, 
    action: 'read' | 'write' | 'delete', 
    success: boolean, 
    error?: string
  ): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.LOG_KEY]);
      const logs: StorageAccessLog[] = result[this.LOG_KEY] || [];

      const newLog: StorageAccessLog = {
        key: this.sanitizeKeyForLogging(key),
        action,
        timestamp: Date.now(),
        success,
        error
      };

      logs.push(newLog);

      // Keep only the most recent entries
      if (logs.length > this.MAX_LOG_ENTRIES) {
        logs.splice(0, logs.length - this.MAX_LOG_ENTRIES);
      }

      await chrome.storage.local.set({ [this.LOG_KEY]: logs });
    } catch (error) {
      // Don't throw errors for logging failures
      console.error('Failed to log storage access:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Sanitize storage key for logging (remove sensitive parts)
   * @param key The storage key to sanitize
   * @returns Sanitized key
   */
  private static sanitizeKeyForLogging(key: string): string {
    // Replace common sensitive key patterns with generic names
    const sensitivePatterns = [
      { pattern: /api[_-]?key/i, replacement: 'apiKey' },
      { pattern: /token/i, replacement: 'token' },
      { pattern: /password/i, replacement: 'password' },
      { pattern: /secret/i, replacement: 'secret' }
    ];

    let sanitizedKey = key;
    for (const { pattern, replacement } of sensitivePatterns) {
      if (pattern.test(key)) {
        sanitizedKey = replacement;
        break;
      }
    }

    return sanitizedKey;
  }

  /**
   * Get storage access logs for security monitoring
   * @param limit Maximum number of logs to retrieve
   * @returns Promise that resolves with access logs
   */
  static async getAccessLogs(limit: number = 100): Promise<StorageAccessLog[]> {
    try {
      const result = await chrome.storage.local.get([this.LOG_KEY]);
      const logs: StorageAccessLog[] = result[this.LOG_KEY] || [];

      // Return the most recent logs
      return logs.slice(-limit);
    } catch (error) {
      console.error('Failed to get access logs:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Clear storage access logs
   * @returns Promise that resolves when logs are cleared
   */
  static async clearAccessLogs(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.LOG_KEY]);
    } catch (error) {
      console.error('Failed to clear access logs:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear access logs');
    }
  }

  /**
   * Check if storage is available and accessible
   * @returns Promise that resolves with true if storage is available
   */
  static async isStorageAvailable(): Promise<boolean> {
    try {
      const testKey = 'storage_availability_test';
      const testData = { test: true, timestamp: Date.now() };
      
      await chrome.storage.local.set({ [testKey]: testData });
      const result = await chrome.storage.local.get([testKey]);
      await chrome.storage.local.remove([testKey]);
      
      return result[testKey] && result[testKey].test === true;
    } catch (error) {
      console.error('Storage availability check failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }
} * Storage Security for Ray Chrome Extension
 * Provides secure storage patterns and utilities for chrome.storage
 */

export interface StorageSecurityConfig {
  enableEncryption: boolean;
  enableAccessLogging: boolean;
  enableIntegrityChecks: boolean;
  maxRetries: number;
  retryDelay: number;
}

export interface StorageItem<T = any> {
  data: T;
  metadata: {
    createdAt: number;
    lastModified: number;
    accessCount: number;
    lastAccessed: number;
    checksum?: string;
    encrypted?: boolean;
  };
}

export interface StorageAccessLog {
  key: string;
  action: 'read' | 'write' | 'delete';
  timestamp: number;
  success: boolean;
  error?: string;
}

export class StorageSecurity {
  private static readonly DEFAULT_CONFIG: StorageSecurityConfig = {
    enableEncryption: false,
    enableAccessLogging: true,
    enableIntegrityChecks: true,
    maxRetries: 3,
    retryDelay: 100
  };

  private static readonly LOG_KEY = 'storageAccessLog';
  private static readonly MAX_LOG_ENTRIES = 1000;

  /**
   * Store data securely with metadata and optional encryption
   * @param key The storage key
   * @param data The data to store
   * @param config Optional security configuration
   * @returns Promise that resolves when data is stored
   */
  static async secureStore<T>(
    key: string, 
    data: T, 
    config: Partial<StorageSecurityConfig> = {}
  ): Promise<void> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    let attempt = 0;

    while (attempt < finalConfig.maxRetries) {
      try {
        const storageItem: StorageItem<T> = {
          data,
          metadata: {
            createdAt: Date.now(),
            lastModified: Date.now(),
            accessCount: 0,
            lastAccessed: 0,
            encrypted: finalConfig.enableEncryption
          }
        };

        // Add integrity checksum if enabled
        if (finalConfig.enableIntegrityChecks) {
          storageItem.metadata.checksum = await this.calculateChecksum(JSON.stringify(data));
        }

        // Encrypt data if enabled
        let finalData = storageItem;
        if (finalConfig.enableEncryption) {
          const encryptedData = await this.encryptData(JSON.stringify(data));
          finalData = {
            ...storageItem,
            data: encryptedData as any
          };
        }

        await chrome.storage.local.set({ [key]: finalData });

        // Log the access if enabled
        if (finalConfig.enableAccessLogging) {
          await this.logAccess(key, 'write', true);
        }

        return;
      } catch (error) {
        attempt++;
        if (attempt >= finalConfig.maxRetries) {
          if (finalConfig.enableAccessLogging) {
            await this.logAccess(key, 'write', false, error instanceof Error ? error.message : 'Unknown error');
          }
          throw new Error(`Failed to store data after ${attempt} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, finalConfig.retryDelay * attempt));
      }
    }
  }

  /**
   * Retrieve data securely with validation
   * @param key The storage key
   * @param config Optional security configuration
   * @returns Promise that resolves with the retrieved data or null
   */
  static async secureRetrieve<T>(
    key: string, 
    config: Partial<StorageSecurityConfig> = {}
  ): Promise<T | null> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    let attempt = 0;

    while (attempt < finalConfig.maxRetries) {
      try {
        const result = await chrome.storage.local.get([key]);
        const storageItem: StorageItem<T> = result[key];

        if (!storageItem) {
          if (finalConfig.enableAccessLogging) {
            await this.logAccess(key, 'read', false, 'Item not found');
          }
          return null;
        }

        // Update access metadata
        storageItem.metadata.accessCount++;
        storageItem.metadata.lastAccessed = Date.now();

        // Decrypt data if needed
        let data = storageItem.data;
        if (storageItem.metadata.encrypted) {
          if (typeof data === 'string') {
            data = JSON.parse(await this.decryptData(data)) as T;
          } else {
            throw new Error('Encrypted data is not in expected format');
          }
        }

        // Verify integrity if enabled
        if (finalConfig.enableIntegrityChecks && storageItem.metadata.checksum) {
          const currentChecksum = await this.calculateChecksum(JSON.stringify(data));
          if (currentChecksum !== storageItem.metadata.checksum) {
            throw new Error('Data integrity check failed');
          }
        }

        // Update the access metadata in storage
        await chrome.storage.local.set({ [key]: storageItem });

        // Log the access if enabled
        if (finalConfig.enableAccessLogging) {
          await this.logAccess(key, 'read', true);
        }

        return data;
      } catch (error) {
        attempt++;
        if (attempt >= finalConfig.maxRetries) {
          if (finalConfig.enableAccessLogging) {
            await this.logAccess(key, 'read', false, error instanceof Error ? error.message : 'Unknown error');
          }
          console.error(`Failed to retrieve data after ${attempt} attempts:`, error);
          return null;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, finalConfig.retryDelay * attempt));
      }
    }

    return null;
  }

  /**
   * Remove data securely from storage
   * @param key The storage key
   * @param config Optional security configuration
   * @returns Promise that resolves when data is removed
   */
  static async secureRemove(
    key: string, 
    config: Partial<StorageSecurityConfig> = {}
  ): Promise<void> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    let attempt = 0;

    while (attempt < finalConfig.maxRetries) {
      try {
        await chrome.storage.local.remove([key]);

        // Log the access if enabled
        if (finalConfig.enableAccessLogging) {
          await this.logAccess(key, 'delete', true);
        }

        return;
      } catch (error) {
        attempt++;
        if (attempt >= finalConfig.maxRetries) {
          if (finalConfig.enableAccessLogging) {
            await this.logAccess(key, 'delete', false, error instanceof Error ? error.message : 'Unknown error');
          }
          throw new Error(`Failed to remove data after ${attempt} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, finalConfig.retryDelay * attempt));
      }
    }
  }

  /**
   * Get metadata for a storage item without accessing the data
   * @param key The storage key
   * @returns Promise that resolves with the metadata or null
   */
  static async getStorageMetadata(key: string): Promise<StorageItem['metadata'] | null> {
    try {
      const result = await chrome.storage.local.get([key]);
      const storageItem: StorageItem = result[key];

      if (!storageItem) {
        return null;
      }

      return storageItem.metadata;
    } catch (error) {
      console.error('Failed to get storage metadata:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Calculate checksum for data integrity verification
   * @param data The data to calculate checksum for
   * @returns Promise that resolves with the checksum
   */
  private static async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataArray = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataArray);
    const hashArray = new Uint8Array(hashBuffer);
    
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Encrypt data using the key encryption module
   * @param data The data to encrypt
   * @returns Promise that resolves with encrypted data
   */
  private static async encryptData(data: string): Promise<string> {
    // Import KeyEncryption dynamically to avoid circular dependencies
    const { KeyEncryption } = await import('./key-encryption');
    const result = await KeyEncryption.encryptApiKey(data);
    
    if (!result) {
      throw new Error('Failed to encrypt data');
    }

    return JSON.stringify(result);
  }

  /**
   * Decrypt data using the key encryption module
   * @param encryptedData The encrypted data
   * @returns Promise that resolves with decrypted data
   */
  private static async decryptData(encryptedData: string): Promise<string> {
    // Import KeyEncryption dynamically to avoid circular dependencies
    const { KeyEncryption } = await import('./key-encryption');
    const encryptionResult = JSON.parse(encryptedData);
    const result = await KeyEncryption.decryptApiKey(encryptionResult);
    
    if (!result) {
      throw new Error('Failed to decrypt data');
    }

    return result;
  }

  /**
   * Log storage access for security monitoring
   * @param key The storage key
   * @param action The action performed
   * @param success Whether the action was successful
   * @param error Optional error message
   */
  private static async logAccess(
    key: string, 
    action: 'read' | 'write' | 'delete', 
    success: boolean, 
    error?: string
  ): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.LOG_KEY]);
      const logs: StorageAccessLog[] = result[this.LOG_KEY] || [];

      const newLog: StorageAccessLog = {
        key: this.sanitizeKeyForLogging(key),
        action,
        timestamp: Date.now(),
        success,
        error
      };

      logs.push(newLog);

      // Keep only the most recent entries
      if (logs.length > this.MAX_LOG_ENTRIES) {
        logs.splice(0, logs.length - this.MAX_LOG_ENTRIES);
      }

      await chrome.storage.local.set({ [this.LOG_KEY]: logs });
    } catch (error) {
      // Don't throw errors for logging failures
      console.error('Failed to log storage access:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Sanitize storage key for logging (remove sensitive parts)
   * @param key The storage key to sanitize
   * @returns Sanitized key
   */
  private static sanitizeKeyForLogging(key: string): string {
    // Replace common sensitive key patterns with generic names
    const sensitivePatterns = [
      { pattern: /api[_-]?key/i, replacement: 'apiKey' },
      { pattern: /token/i, replacement: 'token' },
      { pattern: /password/i, replacement: 'password' },
      { pattern: /secret/i, replacement: 'secret' }
    ];

    let sanitizedKey = key;
    for (const { pattern, replacement } of sensitivePatterns) {
      if (pattern.test(key)) {
        sanitizedKey = replacement;
        break;
      }
    }

    return sanitizedKey;
  }

  /**
   * Get storage access logs for security monitoring
   * @param limit Maximum number of logs to retrieve
   * @returns Promise that resolves with access logs
   */
  static async getAccessLogs(limit: number = 100): Promise<StorageAccessLog[]> {
    try {
      const result = await chrome.storage.local.get([this.LOG_KEY]);
      const logs: StorageAccessLog[] = result[this.LOG_KEY] || [];

      // Return the most recent logs
      return logs.slice(-limit);
    } catch (error) {
      console.error('Failed to get access logs:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Clear storage access logs
   * @returns Promise that resolves when logs are cleared
   */
  static async clearAccessLogs(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.LOG_KEY]);
    } catch (error) {
      console.error('Failed to clear access logs:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear access logs');
    }
  }

  /**
   * Check if storage is available and accessible
   * @returns Promise that resolves with true if storage is available
   */
  static async isStorageAvailable(): Promise<boolean> {
    try {
      const testKey = 'storage_availability_test';
      const testData = { test: true, timestamp: Date.now() };
      
      await chrome.storage.local.set({ [testKey]: testData });
      const result = await chrome.storage.local.get([testKey]);
      await chrome.storage.local.remove([testKey]);
      
      return result[testKey] && result[testKey].test === true;
    } catch (error) {
      console.error('Storage availability check failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }
}
