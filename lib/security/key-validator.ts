/**
 * API Key Validation for Ray Chrome Extension
 * Handles validation of API key formats and security requirements
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class KeyValidator {
  /**
   * Validate OpenRouter API key format
   * @param apiKey The API key to validate
   * @returns ValidationResult with validation status and messages
   */
  static validateOpenRouterKey(apiKey: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic type and existence checks
    if (!apiKey) {
      errors.push('API key is required');
      return { isValid: false, errors, warnings };
    }

    if (typeof apiKey !== 'string') {
      errors.push('API key must be a string');
      return { isValid: false, errors, warnings };
    }

    // Length validation
    if (apiKey.length < 20) {
      errors.push('API key appears to be too short');
    }

    if (apiKey.length > 200) {
      warnings.push('API key is unusually long');
    }

    // Format validation for OpenRouter keys
    // OpenRouter typically uses UUID-like keys or token-like strings
    const validPatterns = [
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, // UUID format
      /^sk-or-[a-zA-Z0-9_-]{20,}$/, // OpenRouter token format (sk-or-...)
      /^[a-zA-Z0-9_-]{20,}$/ // Generic token format
    ];

    const isValidFormat = validPatterns.some(pattern => pattern.test(apiKey));
    
    if (!isValidFormat) {
      warnings.push('API key format may not match expected OpenRouter format');
    }

    // Security checks
    if (apiKey.includes(' ') || apiKey.includes('\t') || apiKey.includes('\n')) {
      errors.push('API key contains whitespace characters');
    }

    if (apiKey.toLowerCase() === 'api_key' || apiKey.toLowerCase() === 'test') {
      errors.push('API key appears to be a placeholder value');
    }

    // Check for common test/dev keys
    const testPatterns = [
      /test/i,
      /demo/i,
      /example/i,
      /sample/i,
      /fake/i,
      /mock/i
    ];

    if (testPatterns.some(pattern => pattern.test(apiKey))) {
      warnings.push('API key appears to be a test or demo key');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate API key strength and security properties
   * @param apiKey The API key to validate
   * @returns ValidationResult with security validation
   */
  static validateKeySecurity(apiKey: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!apiKey || typeof apiKey !== 'string') {
      errors.push('API key is required and must be a string');
      return { isValid: false, errors, warnings };
    }

    // Check for weak patterns
    const weakPatterns = [
      /^(.)\1+$/, // All same character
      /^123+/, // Sequential numbers
      /^abc+/i, // Sequential letters
      /^(.)\1{2,}(.*)\2{2,}$/, // Repeated patterns
    ];

    if (weakPatterns.some(pattern => pattern.test(apiKey))) {
      warnings.push('API key appears to use a weak pattern');
    }

    // Entropy check (basic)
    const uniqueChars = new Set(apiKey).size;
    const entropyRatio = uniqueChars / apiKey.length;
    
    if (entropyRatio < 0.3) {
      warnings.push('API key has low character diversity');
    }

    // Check for dictionary words (basic check)
    const commonWords = ['password', 'secret', 'key', 'token', 'api'];
    const lowerKey = apiKey.toLowerCase();
    
    for (const word of commonWords) {
      if (lowerKey.includes(word)) {
        warnings.push(`API key contains common word: ${word}`);
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Comprehensive validation combining format and security checks
   * @param apiKey The API key to validate
   * @returns ValidationResult with comprehensive validation
   */
  static validateApiKey(apiKey: string): ValidationResult {
    const formatResult = this.validateOpenRouterKey(apiKey);
    const securityResult = this.validateKeySecurity(apiKey);

    return {
      isValid: formatResult.isValid && securityResult.isValid,
      errors: [...formatResult.errors, ...securityResult.errors],
      warnings: [...formatResult.warnings, ...securityResult.warnings]
    };
  }

  /**
   * Sanitize API key input for display purposes
   * @param apiKey The API key to sanitize
   * @param showChars Number of characters to show at beginning and end
   * @returns Sanitized API key for display
   */
  static sanitizeForDisplay(apiKey: string, showChars: number = 4): string {
    if (!apiKey || typeof apiKey !== 'string') {
      return '';
    }

    if (apiKey.length <= showChars * 2) {
      return '*'.repeat(apiKey.length);
    }

    const start = apiKey.substring(0, showChars);
    const end = apiKey.substring(apiKey.length - showChars);
    const middle = '*'.repeat(apiKey.length - (showChars * 2));
    
    return `${start}${middle}${end}`;
  }

  /**
   * Check if API key is expired based on metadata
   * @param createdAt Creation timestamp
   * @param maxAge Maximum age in milliseconds (default: 1 year)
   * @returns True if key is expired, false otherwise
   */
  static isKeyExpired(createdAt: number, maxAge: number = 365 * 24 * 60 * 60 * 1000): boolean {
    if (!createdAt || typeof createdAt !== 'number') {
      return true;
    }

    const now = Date.now();
    const age = now - createdAt;
    
    return age > maxAge;
  }

  /**
   * Check if API key needs rotation based on last used
   * @param lastUsed Last used timestamp
   * @param rotationPeriod Rotation period in milliseconds (default: 90 days)
   * @returns True if key needs rotation, false otherwise
   */
  static needsRotation(lastUsed: number, rotationPeriod: number = 90 * 24 * 60 * 60 * 1000): boolean {
    if (!lastUsed || typeof lastUsed !== 'number') {
      return true;
    }

    const now = Date.now();
    const timeSinceLastUse = now - lastUsed;
    
    return timeSinceLastUse > rotationPeriod;
  }
} * API Key Validation for Ray Chrome Extension
 * Handles validation of API key formats and security requirements
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class KeyValidator {
  /**
   * Validate OpenRouter API key format
   * @param apiKey The API key to validate
   * @returns ValidationResult with validation status and messages
   */
  static validateOpenRouterKey(apiKey: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic type and existence checks
    if (!apiKey) {
      errors.push('API key is required');
      return { isValid: false, errors, warnings };
    }

    if (typeof apiKey !== 'string') {
      errors.push('API key must be a string');
      return { isValid: false, errors, warnings };
    }

    // Length validation
    if (apiKey.length < 20) {
      errors.push('API key appears to be too short');
    }

    if (apiKey.length > 200) {
      warnings.push('API key is unusually long');
    }

    // Format validation for OpenRouter keys
    // OpenRouter typically uses UUID-like keys or token-like strings
    const validPatterns = [
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, // UUID format
      /^sk-or-[a-zA-Z0-9_-]{20,}$/, // OpenRouter token format (sk-or-...)
      /^[a-zA-Z0-9_-]{20,}$/ // Generic token format
    ];

    const isValidFormat = validPatterns.some(pattern => pattern.test(apiKey));
    
    if (!isValidFormat) {
      warnings.push('API key format may not match expected OpenRouter format');
    }

    // Security checks
    if (apiKey.includes(' ') || apiKey.includes('\t') || apiKey.includes('\n')) {
      errors.push('API key contains whitespace characters');
    }

    if (apiKey.toLowerCase() === 'api_key' || apiKey.toLowerCase() === 'test') {
      errors.push('API key appears to be a placeholder value');
    }

    // Check for common test/dev keys
    const testPatterns = [
      /test/i,
      /demo/i,
      /example/i,
      /sample/i,
      /fake/i,
      /mock/i
    ];

    if (testPatterns.some(pattern => pattern.test(apiKey))) {
      warnings.push('API key appears to be a test or demo key');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate API key strength and security properties
   * @param apiKey The API key to validate
   * @returns ValidationResult with security validation
   */
  static validateKeySecurity(apiKey: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!apiKey || typeof apiKey !== 'string') {
      errors.push('API key is required and must be a string');
      return { isValid: false, errors, warnings };
    }

    // Check for weak patterns
    const weakPatterns = [
      /^(.)\1+$/, // All same character
      /^123+/, // Sequential numbers
      /^abc+/i, // Sequential letters
      /^(.)\1{2,}(.*)\2{2,}$/, // Repeated patterns
    ];

    if (weakPatterns.some(pattern => pattern.test(apiKey))) {
      warnings.push('API key appears to use a weak pattern');
    }

    // Entropy check (basic)
    const uniqueChars = new Set(apiKey).size;
    const entropyRatio = uniqueChars / apiKey.length;
    
    if (entropyRatio < 0.3) {
      warnings.push('API key has low character diversity');
    }

    // Check for dictionary words (basic check)
    const commonWords = ['password', 'secret', 'key', 'token', 'api'];
    const lowerKey = apiKey.toLowerCase();
    
    for (const word of commonWords) {
      if (lowerKey.includes(word)) {
        warnings.push(`API key contains common word: ${word}`);
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Comprehensive validation combining format and security checks
   * @param apiKey The API key to validate
   * @returns ValidationResult with comprehensive validation
   */
  static validateApiKey(apiKey: string): ValidationResult {
    const formatResult = this.validateOpenRouterKey(apiKey);
    const securityResult = this.validateKeySecurity(apiKey);

    return {
      isValid: formatResult.isValid && securityResult.isValid,
      errors: [...formatResult.errors, ...securityResult.errors],
      warnings: [...formatResult.warnings, ...securityResult.warnings]
    };
  }

  /**
   * Sanitize API key input for display purposes
   * @param apiKey The API key to sanitize
   * @param showChars Number of characters to show at beginning and end
   * @returns Sanitized API key for display
   */
  static sanitizeForDisplay(apiKey: string, showChars: number = 4): string {
    if (!apiKey || typeof apiKey !== 'string') {
      return '';
    }

    if (apiKey.length <= showChars * 2) {
      return '*'.repeat(apiKey.length);
    }

    const start = apiKey.substring(0, showChars);
    const end = apiKey.substring(apiKey.length - showChars);
    const middle = '*'.repeat(apiKey.length - (showChars * 2));
    
    return `${start}${middle}${end}`;
  }

  /**
   * Check if API key is expired based on metadata
   * @param createdAt Creation timestamp
   * @param maxAge Maximum age in milliseconds (default: 1 year)
   * @returns True if key is expired, false otherwise
   */
  static isKeyExpired(createdAt: number, maxAge: number = 365 * 24 * 60 * 60 * 1000): boolean {
    if (!createdAt || typeof createdAt !== 'number') {
      return true;
    }

    const now = Date.now();
    const age = now - createdAt;
    
    return age > maxAge;
  }

  /**
   * Check if API key needs rotation based on last used
   * @param lastUsed Last used timestamp
   * @param rotationPeriod Rotation period in milliseconds (default: 90 days)
   * @returns True if key needs rotation, false otherwise
   */
  static needsRotation(lastUsed: number, rotationPeriod: number = 90 * 24 * 60 * 60 * 1000): boolean {
    if (!lastUsed || typeof lastUsed !== 'number') {
      return true;
    }

    const now = Date.now();
    const timeSinceLastUse = now - lastUsed;
    
    return timeSinceLastUse > rotationPeriod;
  }
}
