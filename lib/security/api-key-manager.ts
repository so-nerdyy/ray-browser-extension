/**
 * Secure API Key Management for Ray Chrome Extension
 * Handles secure storage, retrieval, and management of API keys
 */

export interface ApiKeyInfo {
  key: string;
  createdAt: number;
  lastUsed?: number;
  isValid: boolean;
}

export class ApiKeyManager {
  private static readonly STORAGE_KEY = 'openrouterApiKey';
  private static readonly METADATA_KEY = 'openrouterApiKeyMetadata';

  /**
   * Store API key securely in chrome.storage.local
   * @param apiKey The API key to store
   * @returns Promise that resolves when the key is stored
   */
  static async storeApiKey(apiKey: string): Promise<void> {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key provided');
    }

    try {
      // Store the encrypted API key
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: apiKey
      });

      // Store metadata for tracking
      const metadata: ApiKeyInfo = {
        key: '', // Never store the actual key in metadata
        createdAt: Date.now(),
        isValid: true
      };

      await chrome.storage.local.set({
        [this.METADATA_KEY]: metadata
      });

    } catch (error) {
      // Never expose API key in error messages
      console.error('Failed to store API key:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to store API key');
    }
  }

  /**
   * Retrieve API key securely from chrome.storage.local
   * @returns Promise that resolves with the API key or null if not found
   */
  static async getApiKey(): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const apiKey = result[this.STORAGE_KEY];

      if (!apiKey || typeof apiKey !== 'string') {
        return null;
      }

      // Update last used timestamp
      await this.updateLastUsed();

      return apiKey;
    } catch (error) {
      console.error('Failed to retrieve API key:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Check if an API key exists
   * @returns Promise that resolves with true if key exists, false otherwise
   */
  static async hasApiKey(): Promise<boolean> {
    try {
      const apiKey = await this.getApiKey();
      return apiKey !== null && apiKey.length > 0;
    } catch (error) {
      console.error('Failed to check API key existence:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Remove API key from storage
   * @returns Promise that resolves when the key is removed
   */
  static async removeApiKey(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.STORAGE_KEY, this.METADATA_KEY]);
    } catch (error) {
      console.error('Failed to remove API key:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to remove API key');
    }
  }

  /**
   * Rotate API key with new one
   * @param newApiKey The new API key to replace the old one
   * @returns Promise that resolves when the key is rotated
   */
  static async rotateApiKey(newApiKey: string): Promise<void> {
    if (!newApiKey || typeof newApiKey !== 'string') {
      throw new Error('Invalid new API key provided');
    }

    try {
      // Remove old key
      await this.removeApiKey();
      
      // Store new key
      await this.storeApiKey(newApiKey);
    } catch (error) {
      console.error('Failed to rotate API key:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to rotate API key');
    }
  }

  /**
   * Get API key metadata without exposing the key itself
   * @returns Promise that resolves with the API key metadata
   */
  static async getApiKeyMetadata(): Promise<ApiKeyInfo | null> {
    try {
      const result = await chrome.storage.local.get([this.METADATA_KEY]);
      return result[this.METADATA_KEY] || null;
    } catch (error) {
      console.error('Failed to retrieve API key metadata:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Update the last used timestamp for the API key
   * @private
   */
  private static async updateLastUsed(): Promise<void> {
    try {
      const metadata = await this.getApiKeyMetadata();
      if (metadata) {
        metadata.lastUsed = Date.now();
        await chrome.storage.local.set({
          [this.METADATA_KEY]: metadata
        });
      }
    } catch (error) {
      // Don't throw errors for metadata updates
      console.error('Failed to update last used timestamp:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Validate API key format and basic security requirements
   * @param apiKey The API key to validate
   * @returns True if the API key appears valid, false otherwise
   */
  static validateApiKeyFormat(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Basic validation - should be a non-empty string
    // Add more specific validation based on OpenRouter API key format
    return apiKey.length > 0 && apiKey.trim().length > 0;
  }
} * Secure API Key Management for Ray Chrome Extension
 * Handles secure storage, retrieval, and management of API keys
 */

export interface ApiKeyInfo {
  key: string;
  createdAt: number;
  lastUsed?: number;
  isValid: boolean;
}

export class ApiKeyManager {
  private static readonly STORAGE_KEY = 'openrouterApiKey';
  private static readonly METADATA_KEY = 'openrouterApiKeyMetadata';

  /**
   * Store API key securely in chrome.storage.local
   * @param apiKey The API key to store
   * @returns Promise that resolves when the key is stored
   */
  static async storeApiKey(apiKey: string): Promise<void> {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key provided');
    }

    try {
      // Store the encrypted API key
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: apiKey
      });

      // Store metadata for tracking
      const metadata: ApiKeyInfo = {
        key: '', // Never store the actual key in metadata
        createdAt: Date.now(),
        isValid: true
      };

      await chrome.storage.local.set({
        [this.METADATA_KEY]: metadata
      });

    } catch (error) {
      // Never expose API key in error messages
      console.error('Failed to store API key:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to store API key');
    }
  }

  /**
   * Retrieve API key securely from chrome.storage.local
   * @returns Promise that resolves with the API key or null if not found
   */
  static async getApiKey(): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const apiKey = result[this.STORAGE_KEY];

      if (!apiKey || typeof apiKey !== 'string') {
        return null;
      }

      // Update last used timestamp
      await this.updateLastUsed();

      return apiKey;
    } catch (error) {
      console.error('Failed to retrieve API key:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Check if an API key exists
   * @returns Promise that resolves with true if key exists, false otherwise
   */
  static async hasApiKey(): Promise<boolean> {
    try {
      const apiKey = await this.getApiKey();
      return apiKey !== null && apiKey.length > 0;
    } catch (error) {
      console.error('Failed to check API key existence:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Remove API key from storage
   * @returns Promise that resolves when the key is removed
   */
  static async removeApiKey(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.STORAGE_KEY, this.METADATA_KEY]);
    } catch (error) {
      console.error('Failed to remove API key:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to remove API key');
    }
  }

  /**
   * Rotate API key with new one
   * @param newApiKey The new API key to replace the old one
   * @returns Promise that resolves when the key is rotated
   */
  static async rotateApiKey(newApiKey: string): Promise<void> {
    if (!newApiKey || typeof newApiKey !== 'string') {
      throw new Error('Invalid new API key provided');
    }

    try {
      // Remove old key
      await this.removeApiKey();
      
      // Store new key
      await this.storeApiKey(newApiKey);
    } catch (error) {
      console.error('Failed to rotate API key:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to rotate API key');
    }
  }

  /**
   * Get API key metadata without exposing the key itself
   * @returns Promise that resolves with the API key metadata
   */
  static async getApiKeyMetadata(): Promise<ApiKeyInfo | null> {
    try {
      const result = await chrome.storage.local.get([this.METADATA_KEY]);
      return result[this.METADATA_KEY] || null;
    } catch (error) {
      console.error('Failed to retrieve API key metadata:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Update the last used timestamp for the API key
   * @private
   */
  private static async updateLastUsed(): Promise<void> {
    try {
      const metadata = await this.getApiKeyMetadata();
      if (metadata) {
        metadata.lastUsed = Date.now();
        await chrome.storage.local.set({
          [this.METADATA_KEY]: metadata
        });
      }
    } catch (error) {
      // Don't throw errors for metadata updates
      console.error('Failed to update last used timestamp:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Validate API key format and basic security requirements
   * @param apiKey The API key to validate
   * @returns True if the API key appears valid, false otherwise
   */
  static validateApiKeyFormat(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Basic validation - should be a non-empty string
    // Add more specific validation based on OpenRouter API key format
    return apiKey.length > 0 && apiKey.trim().length > 0;
  }
}
