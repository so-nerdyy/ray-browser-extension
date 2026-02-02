/**
 * API Key Encryption for Ray Chrome Extension
 * Provides optional encryption for API keys using Web Crypto API
 */

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  salt: string;
}

export interface DecryptionResult {
  success: boolean;
  data?: string;
  error?: string;
}

export class KeyEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12; // 96 bits for GCM
  private static readonly SALT_LENGTH = 16; // 128 bits
  private static readonly ITERATIONS = 100000;

  /**
   * Generate a cryptographic key from a password
   * @param password The password to derive the key from
   * @param salt The salt for key derivation
   * @returns Promise that resolves with the crypto key
   */
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate a random salt
   * @returns Random salt as Uint8Array
   */
  private static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
  }

  /**
   * Generate a random initialization vector
   * @returns Random IV as Uint8Array
   */
  private static generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
  }

  /**
   * Convert Uint8Array to base64 string
   * @param array The Uint8Array to convert
   * @returns Base64 encoded string
   */
  private static arrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Convert base64 string to Uint8Array
   * @param base64 The base64 string to convert
   * @returns Uint8Array
   */
  private static base64ToArray(base64: string): Uint8Array {
    const binaryString = atob(base64);
    return new Uint8Array(binaryString.length).map((_, i) => binaryString.charCodeAt(i));
  }

  /**
   * Encrypt data using AES-GCM
   * @param data The data to encrypt
   * @param password The password for encryption
   * @returns Promise that resolves with encryption result
   */
  static async encrypt(data: string, password: string): Promise<EncryptionResult> {
    try {
      const salt = this.generateSalt();
      const iv = this.generateIV();
      const key = await this.deriveKey(password, salt);

      const encoder = new TextEncoder();
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        encoder.encode(data)
      );

      return {
        encryptedData: this.arrayToBase64(new Uint8Array(encryptedData)),
        iv: this.arrayToBase64(iv),
        salt: this.arrayToBase64(salt)
      };
    } catch (error) {
      console.error('Encryption failed:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-GCM
   * @param encryptionResult The encryption result to decrypt
   * @param password The password for decryption
   * @returns Promise that resolves with decryption result
   */
  static async decrypt(encryptionResult: EncryptionResult, password: string): Promise<DecryptionResult> {
    try {
      const salt = this.base64ToArray(encryptionResult.salt);
      const iv = this.base64ToArray(encryptionResult.iv);
      const encryptedData = this.base64ToArray(encryptionResult.encryptedData);

      const key = await this.deriveKey(password, salt);

      const decryptedData = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decryptedData);

      return {
        success: true,
        data: decryptedText
      };
    } catch (error) {
      console.error('Decryption failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: 'Failed to decrypt data'
      };
    }
  }

  /**
   * Check if encryption is available in the current environment
   * @returns True if encryption is available, false otherwise
   */
  static isEncryptionAvailable(): boolean {
    return (
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle !== 'undefined' &&
      typeof TextEncoder !== 'undefined' &&
      typeof TextDecoder !== 'undefined' &&
      typeof btoa !== 'undefined' &&
      typeof atob !== 'undefined'
    );
  }

  /**
   * Generate a secure random password for encryption
   * @param length Length of the password (default: 32)
   * @returns Random password string
   */
  static generateSecurePassword(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }
    
    return password;
  }

  /**
   * Encrypt API key with device-specific key
   * @param apiKey The API key to encrypt
   * @returns Promise that resolves with encryption result or null if encryption fails
   */
  static async encryptApiKey(apiKey: string): Promise<EncryptionResult | null> {
    if (!this.isEncryptionAvailable()) {
      console.warn('Encryption not available in this environment');
      return null;
    }

    try {
      // Generate a device-specific password based on available browser info
      // This is a simple approach - in production, you might want to use more sophisticated key derivation
      const deviceInfo = navigator.userAgent + navigator.language + new Date().getTimezoneOffset();
      const password = await this.hashString(deviceInfo);
      
      return this.encrypt(apiKey, password);
    } catch (error) {
      console.error('Failed to encrypt API key:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Decrypt API key with device-specific key
   * @param encryptionResult The encryption result to decrypt
   * @returns Promise that resolves with decrypted API key or null if decryption fails
   */
  static async decryptApiKey(encryptionResult: EncryptionResult): Promise<string | null> {
    if (!this.isEncryptionAvailable()) {
      console.warn('Encryption not available in this environment');
      return null;
    }

    try {
      // Generate the same device-specific password used for encryption
      const deviceInfo = navigator.userAgent + navigator.language + new Date().getTimezoneOffset();
      const password = await this.hashString(deviceInfo);
      
      const result = await this.decrypt(encryptionResult, password);
      return result.success ? result.data || null : null;
    } catch (error) {
      console.error('Failed to decrypt API key:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Hash a string using SHA-256
   * @param input The string to hash
   * @returns Promise that resolves with the hash as a hex string
   */
  private static async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Verify encryption integrity by encrypting and decrypting test data
   * @returns Promise that resolves with true if encryption is working correctly
   */
  static async verifyEncryption(): Promise<boolean> {
    if (!this.isEncryptionAvailable()) {
      return false;
    }

    try {
      const testData = 'test-encryption-integrity';
      const password = 'test-password';
      
      const encrypted = await this.encrypt(testData, password);
      const decrypted = await this.decrypt(encrypted, password);
      
      return decrypted.success && decrypted.data === testData;
    } catch (error) {
      console.error('Encryption verification failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }
} * API Key Encryption for Ray Chrome Extension
 * Provides optional encryption for API keys using Web Crypto API
 */

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  salt: string;
}

export interface DecryptionResult {
  success: boolean;
  data?: string;
  error?: string;
}

export class KeyEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12; // 96 bits for GCM
  private static readonly SALT_LENGTH = 16; // 128 bits
  private static readonly ITERATIONS = 100000;

  /**
   * Generate a cryptographic key from a password
   * @param password The password to derive the key from
   * @param salt The salt for key derivation
   * @returns Promise that resolves with the crypto key
   */
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate a random salt
   * @returns Random salt as Uint8Array
   */
  private static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
  }

  /**
   * Generate a random initialization vector
   * @returns Random IV as Uint8Array
   */
  private static generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
  }

  /**
   * Convert Uint8Array to base64 string
   * @param array The Uint8Array to convert
   * @returns Base64 encoded string
   */
  private static arrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Convert base64 string to Uint8Array
   * @param base64 The base64 string to convert
   * @returns Uint8Array
   */
  private static base64ToArray(base64: string): Uint8Array {
    const binaryString = atob(base64);
    return new Uint8Array(binaryString.length).map((_, i) => binaryString.charCodeAt(i));
  }

  /**
   * Encrypt data using AES-GCM
   * @param data The data to encrypt
   * @param password The password for encryption
   * @returns Promise that resolves with encryption result
   */
  static async encrypt(data: string, password: string): Promise<EncryptionResult> {
    try {
      const salt = this.generateSalt();
      const iv = this.generateIV();
      const key = await this.deriveKey(password, salt);

      const encoder = new TextEncoder();
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        encoder.encode(data)
      );

      return {
        encryptedData: this.arrayToBase64(new Uint8Array(encryptedData)),
        iv: this.arrayToBase64(iv),
        salt: this.arrayToBase64(salt)
      };
    } catch (error) {
      console.error('Encryption failed:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-GCM
   * @param encryptionResult The encryption result to decrypt
   * @param password The password for decryption
   * @returns Promise that resolves with decryption result
   */
  static async decrypt(encryptionResult: EncryptionResult, password: string): Promise<DecryptionResult> {
    try {
      const salt = this.base64ToArray(encryptionResult.salt);
      const iv = this.base64ToArray(encryptionResult.iv);
      const encryptedData = this.base64ToArray(encryptionResult.encryptedData);

      const key = await this.deriveKey(password, salt);

      const decryptedData = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decryptedData);

      return {
        success: true,
        data: decryptedText
      };
    } catch (error) {
      console.error('Decryption failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: 'Failed to decrypt data'
      };
    }
  }

  /**
   * Check if encryption is available in the current environment
   * @returns True if encryption is available, false otherwise
   */
  static isEncryptionAvailable(): boolean {
    return (
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle !== 'undefined' &&
      typeof TextEncoder !== 'undefined' &&
      typeof TextDecoder !== 'undefined' &&
      typeof btoa !== 'undefined' &&
      typeof atob !== 'undefined'
    );
  }

  /**
   * Generate a secure random password for encryption
   * @param length Length of the password (default: 32)
   * @returns Random password string
   */
  static generateSecurePassword(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }
    
    return password;
  }

  /**
   * Encrypt API key with device-specific key
   * @param apiKey The API key to encrypt
   * @returns Promise that resolves with encryption result or null if encryption fails
   */
  static async encryptApiKey(apiKey: string): Promise<EncryptionResult | null> {
    if (!this.isEncryptionAvailable()) {
      console.warn('Encryption not available in this environment');
      return null;
    }

    try {
      // Generate a device-specific password based on available browser info
      // This is a simple approach - in production, you might want to use more sophisticated key derivation
      const deviceInfo = navigator.userAgent + navigator.language + new Date().getTimezoneOffset();
      const password = await this.hashString(deviceInfo);
      
      return this.encrypt(apiKey, password);
    } catch (error) {
      console.error('Failed to encrypt API key:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Decrypt API key with device-specific key
   * @param encryptionResult The encryption result to decrypt
   * @returns Promise that resolves with decrypted API key or null if decryption fails
   */
  static async decryptApiKey(encryptionResult: EncryptionResult): Promise<string | null> {
    if (!this.isEncryptionAvailable()) {
      console.warn('Encryption not available in this environment');
      return null;
    }

    try {
      // Generate the same device-specific password used for encryption
      const deviceInfo = navigator.userAgent + navigator.language + new Date().getTimezoneOffset();
      const password = await this.hashString(deviceInfo);
      
      const result = await this.decrypt(encryptionResult, password);
      return result.success ? result.data || null : null;
    } catch (error) {
      console.error('Failed to decrypt API key:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Hash a string using SHA-256
   * @param input The string to hash
   * @returns Promise that resolves with the hash as a hex string
   */
  private static async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Verify encryption integrity by encrypting and decrypting test data
   * @returns Promise that resolves with true if encryption is working correctly
   */
  static async verifyEncryption(): Promise<boolean> {
    if (!this.isEncryptionAvailable()) {
      return false;
    }

    try {
      const testData = 'test-encryption-integrity';
      const password = 'test-password';
      
      const encrypted = await this.encrypt(testData, password);
      const decrypted = await this.decrypt(encrypted, password);
      
      return decrypted.success && decrypted.data === testData;
    } catch (error) {
      console.error('Encryption verification failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }
}
