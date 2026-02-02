/**
 * Chrome Storage API Wrapper
 * Provides type-safe utilities for storage operations
 */

import type { StorageOptions, StorageData } from '../types/chrome-api';

/**
 * Get data from storage
 */
export async function getStorage<T = any>(
  keys: string | string[] | Record<string, any> | null,
  options: StorageOptions = {}
): Promise<T> {
  try {
    const storage = options.area === 'sync' ? chrome.storage.sync : chrome.storage.local;
    return await storage.get(keys);
  } catch (error) {
    console.error('Failed to get storage data:', error);
    throw error;
  }
}

/**
 * Set data in storage
 */
export async function setStorage(
  items: StorageData,
  options: StorageOptions = {}
): Promise<void> {
  try {
    const storage = options.area === 'sync' ? chrome.storage.sync : chrome.storage.local;
    await storage.set(items);
  } catch (error) {
    console.error('Failed to set storage data:', error);
    throw error;
  }
}

/**
 * Remove data from storage
 */
export async function removeStorage(
  keys: string | string[],
  options: StorageOptions = {}
): Promise<void> {
  try {
    const storage = options.area === 'sync' ? chrome.storage.sync : chrome.storage.local;
    await storage.remove(keys);
  } catch (error) {
    console.error('Failed to remove storage data:', error);
    throw error;
  }
}

/**
 * Clear all data from storage
 */
export async function clearStorage(options: StorageOptions = {}): Promise<void> {
  try {
    const storage = options.area === 'sync' ? chrome.storage.sync : chrome.storage.local;
    await storage.clear();
  } catch (error) {
    console.error('Failed to clear storage:', error);
    throw error;
  }
}

/**
 * Get storage usage bytes
 */
export async function getStorageUsage(options: StorageOptions = {}): Promise<number> {
  try {
    if (options.area === 'sync') {
      const bytesInUse = await chrome.storage.sync.getBytesInUse();
      return bytesInUse;
    } else {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      return bytesInUse;
    }
  } catch (error) {
    console.error('Failed to get storage usage:', error);
    throw error;
  }
}

/**
 * Get a single value from storage
 */
export async function getStorageValue<T = any>(
  key: string,
  defaultValue: T | null = null,
  options: StorageOptions = {}
): Promise<T | null> {
  try {
    const data = await getStorage<Record<string, T>>(key, options);
    return data[key] !== undefined ? data[key] : defaultValue;
  } catch (error) {
    console.error('Failed to get storage value:', error);
    return defaultValue;
  }
}

/**
 * Set a single value in storage
 */
export async function setStorageValue<T = any>(
  key: string,
  value: T,
  options: StorageOptions = {}
): Promise<void> {
  try {
    await setStorage({ [key]: value }, options);
  } catch (error) {
    console.error('Failed to set storage value:', error);
    throw error;
  }
}

/**
 * Remove a single value from storage
 */
export async function removeStorageValue(
  key: string,
  options: StorageOptions = {}
): Promise<void> {
  try {
    await removeStorage(key, options);
  } catch (error) {
    console.error('Failed to remove storage value:', error);
    throw error;
  }
}

/**
 * Check if a key exists in storage
 */
export async function hasStorageKey(
  key: string,
  options: StorageOptions = {}
): Promise<boolean> {
  try {
    const data = await getStorage(key, options);
    return key in data;
  } catch (error) {
    console.error('Failed to check storage key:', error);
    return false;
  }
}

/**
 * Get all keys from storage
 */
export async function getStorageKeys(options: StorageOptions = {}): Promise<string[]> {
  try {
    const data = await getStorage<Record<string, any>>(null, options);
    return Object.keys(data);
  } catch (error) {
    console.error('Failed to get storage keys:', error);
    return [];
  }
}

/**
 * Listen for storage changes
 */
export function onStorageChanged(
  callback: (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void
): void {
  chrome.storage.onChanged.addListener(callback);
}

/**
 * Remove storage change listener
 */
export function removeStorageChangedListener(): void {
  chrome.storage.onChanged.removeListener(() => {});
}

/**
 * Secure storage for sensitive data (with basic encryption)
 */
export class SecureStorage {
  private static async encrypt(data: string): Promise<string> {
    // Simple XOR encryption for demonstration
    // In production, use proper encryption libraries
    const key = await this.getEncryptionKey();
    let encrypted = '';
    for (let i = 0; i < data.length; i++) {
      encrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(encrypted);
  }

  private static async decrypt(encryptedData: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const decoded = atob(encryptedData);
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
      decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return decrypted;
  }

  private static async getEncryptionKey(): Promise<string> {
    const storedKey = await getStorageValue<string>('ray-encryption-key', 'ray-default-key-2024');
    if (storedKey === 'ray-default-key-2024') {
      await setStorageValue('ray-encryption-key', storedKey);
    }
    return storedKey;
  }

  static async setSecureValue(key: string, value: string, options: StorageOptions = {}): Promise<void> {
    const encryptedValue = await this.encrypt(value);
    await setStorageValue(`secure-${key}`, encryptedValue, options);
  }

  static async getSecureValue(key: string, defaultValue: string | null = null, options: StorageOptions = {}): Promise<string | null> {
    const encryptedValue = await getStorageValue<string>(`secure-${key}`, null, options);
    if (!encryptedValue) return defaultValue;
    
    try {
      return await this.decrypt(encryptedValue);
    } catch (error) {
      console.error('Failed to decrypt secure value:', error);
      return defaultValue;
    }
  }

  static async removeSecureValue(key: string, options: StorageOptions = {}): Promise<void> {
    await removeStorageValue(`secure-${key}`, options);
  }
} * Chrome Storage API Wrapper
 * Provides type-safe utilities for storage operations
 */

import type { StorageOptions, StorageData } from '../types/chrome-api';

/**
 * Get data from storage
 */
export async function getStorage<T = any>(
  keys: string | string[] | Record<string, any> | null,
  options: StorageOptions = {}
): Promise<T> {
  try {
    const storage = options.area === 'sync' ? chrome.storage.sync : chrome.storage.local;
    return await storage.get(keys);
  } catch (error) {
    console.error('Failed to get storage data:', error);
    throw error;
  }
}

/**
 * Set data in storage
 */
export async function setStorage(
  items: StorageData,
  options: StorageOptions = {}
): Promise<void> {
  try {
    const storage = options.area === 'sync' ? chrome.storage.sync : chrome.storage.local;
    await storage.set(items);
  } catch (error) {
    console.error('Failed to set storage data:', error);
    throw error;
  }
}

/**
 * Remove data from storage
 */
export async function removeStorage(
  keys: string | string[],
  options: StorageOptions = {}
): Promise<void> {
  try {
    const storage = options.area === 'sync' ? chrome.storage.sync : chrome.storage.local;
    await storage.remove(keys);
  } catch (error) {
    console.error('Failed to remove storage data:', error);
    throw error;
  }
}

/**
 * Clear all data from storage
 */
export async function clearStorage(options: StorageOptions = {}): Promise<void> {
  try {
    const storage = options.area === 'sync' ? chrome.storage.sync : chrome.storage.local;
    await storage.clear();
  } catch (error) {
    console.error('Failed to clear storage:', error);
    throw error;
  }
}

/**
 * Get storage usage bytes
 */
export async function getStorageUsage(options: StorageOptions = {}): Promise<number> {
  try {
    if (options.area === 'sync') {
      const bytesInUse = await chrome.storage.sync.getBytesInUse();
      return bytesInUse;
    } else {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      return bytesInUse;
    }
  } catch (error) {
    console.error('Failed to get storage usage:', error);
    throw error;
  }
}

/**
 * Get a single value from storage
 */
export async function getStorageValue<T = any>(
  key: string,
  defaultValue: T | null = null,
  options: StorageOptions = {}
): Promise<T | null> {
  try {
    const data = await getStorage<Record<string, T>>(key, options);
    return data[key] !== undefined ? data[key] : defaultValue;
  } catch (error) {
    console.error('Failed to get storage value:', error);
    return defaultValue;
  }
}

/**
 * Set a single value in storage
 */
export async function setStorageValue<T = any>(
  key: string,
  value: T,
  options: StorageOptions = {}
): Promise<void> {
  try {
    await setStorage({ [key]: value }, options);
  } catch (error) {
    console.error('Failed to set storage value:', error);
    throw error;
  }
}

/**
 * Remove a single value from storage
 */
export async function removeStorageValue(
  key: string,
  options: StorageOptions = {}
): Promise<void> {
  try {
    await removeStorage(key, options);
  } catch (error) {
    console.error('Failed to remove storage value:', error);
    throw error;
  }
}

/**
 * Check if a key exists in storage
 */
export async function hasStorageKey(
  key: string,
  options: StorageOptions = {}
): Promise<boolean> {
  try {
    const data = await getStorage(key, options);
    return key in data;
  } catch (error) {
    console.error('Failed to check storage key:', error);
    return false;
  }
}

/**
 * Get all keys from storage
 */
export async function getStorageKeys(options: StorageOptions = {}): Promise<string[]> {
  try {
    const data = await getStorage<Record<string, any>>(null, options);
    return Object.keys(data);
  } catch (error) {
    console.error('Failed to get storage keys:', error);
    return [];
  }
}

/**
 * Listen for storage changes
 */
export function onStorageChanged(
  callback: (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void
): void {
  chrome.storage.onChanged.addListener(callback);
}

/**
 * Remove storage change listener
 */
export function removeStorageChangedListener(): void {
  chrome.storage.onChanged.removeListener(() => {});
}

/**
 * Secure storage for sensitive data (with basic encryption)
 */
export class SecureStorage {
  private static async encrypt(data: string): Promise<string> {
    // Simple XOR encryption for demonstration
    // In production, use proper encryption libraries
    const key = await this.getEncryptionKey();
    let encrypted = '';
    for (let i = 0; i < data.length; i++) {
      encrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(encrypted);
  }

  private static async decrypt(encryptedData: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const decoded = atob(encryptedData);
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
      decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return decrypted;
  }

  private static async getEncryptionKey(): Promise<string> {
    const storedKey = await getStorageValue<string>('ray-encryption-key', 'ray-default-key-2024');
    if (storedKey === 'ray-default-key-2024') {
      await setStorageValue('ray-encryption-key', storedKey);
    }
    return storedKey;
  }

  static async setSecureValue(key: string, value: string, options: StorageOptions = {}): Promise<void> {
    const encryptedValue = await this.encrypt(value);
    await setStorageValue(`secure-${key}`, encryptedValue, options);
  }

  static async getSecureValue(key: string, defaultValue: string | null = null, options: StorageOptions = {}): Promise<string | null> {
    const encryptedValue = await getStorageValue<string>(`secure-${key}`, null, options);
    if (!encryptedValue) return defaultValue;
    
    try {
      return await this.decrypt(encryptedValue);
    } catch (error) {
      console.error('Failed to decrypt secure value:', error);
      return defaultValue;
    }
  }

  static async removeSecureValue(key: string, options: StorageOptions = {}): Promise<void> {
    await removeStorageValue(`secure-${key}`, options);
  }
}
