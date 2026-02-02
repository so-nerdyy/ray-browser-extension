/**
 * Shared Security Utilities for Ray Chrome Extension
 * Provides common security utilities and helper functions
 */

export interface SecurityContext {
  userId?: string;
  sessionId: string;
  timestamp: number;
  source: string;
  permissions: string[];
  metadata?: Record<string, any>;
}

export interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

export interface SecurityCheckConfig {
  enableStrictMode: boolean;
  enableLogging: boolean;
  enableNotifications: boolean;
  maxRetries: number;
  timeout: number;
}

export class SharedSecurityUtils {
  private static readonly DEFAULT_CONFIG: SecurityCheckConfig = {
    enableStrictMode: true,
    enableLogging: true,
    enableNotifications: true,
    maxRetries: 3,
    timeout: 5000
  };

  /**
   * Generate a secure random string
   * @param length Length of the string to generate
   * @returns Secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    try {
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Failed to generate secure random string:', error instanceof Error ? error.message : 'Unknown error');
      // Fallback to Math.random() if crypto API is not available
      return Math.random().toString(36).substring(2, 2 + length);
    }
  }

  /**
   * Generate a secure random ID
   * @param prefix Optional prefix
   * @returns Secure random ID
   */
  static generateSecureId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36);
    const random = this.generateSecureRandom(8);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  }

  /**
   * Hash a string using SHA-256
   * @param data String to hash
   * @returns Hashed string
   */
  static async hashString(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return hashHex;
    } catch (error) {
      console.error('Failed to hash string:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to hash string');
    }
  }

  /**
   * Validate a security context
   * @param context Security context to validate
   * @param config Optional validation configuration
   * @returns Validation result
   */
  static validateSecurityContext(context: SecurityContext, config?: Partial<SecurityCheckConfig>): SecurityValidationResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check required fields
    if (!context.sessionId) {
      errors.push('Session ID is required');
      score -= 20;
    }

    if (!context.timestamp) {
      errors.push('Timestamp is required');
      score -= 20;
    }

    if (!context.source) {
      errors.push('Source is required');
      score -= 15;
    }

    if (!context.permissions || !Array.isArray(context.permissions)) {
      errors.push('Permissions must be an array');
      score -= 15;
    }

    // Check timestamp validity
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Math.abs(now - context.timestamp) > maxAge) {
      warnings.push('Timestamp is too old or too far in the future');
      score -= 10;
    }

    // Check session ID format
    if (context.sessionId && !/^[a-zA-Z0-9_-]+$/.test(context.sessionId)) {
      warnings.push('Session ID contains invalid characters');
      score -= 5;
    }

    // Check source format
    if (context.source && !/^[a-zA-Z0-9_.-]+$/.test(context.source)) {
      warnings.push('Source contains invalid characters');
      score -= 5;
    }

    // Check permissions in strict mode
    if (finalConfig.enableStrictMode && context.permissions) {
      const validPermissions = [
        'activeTab', 'storage', 'scripting', 'tabs', 'webNavigation',
        'cookies', 'background', 'notifications', 'alarms', 'contextMenus'
      ];
      
      for (const permission of context.permissions) {
        if (!validPermissions.includes(permission)) {
          warnings.push(`Unknown permission: ${permission}`);
          score -= 2;
        }
      }
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score
    };
  }

  /**
   * Create a security context
   * @param source Context source
   * @param permissions Context permissions
   * @param userId Optional user ID
   * @returns Security context
   */
  static createSecurityContext(
    source: string,
    permissions: string[],
    userId?: string
  ): SecurityContext {
    return {
      userId,
      sessionId: this.generateSecureId('sess'),
      timestamp: Date.now(),
      source,
      permissions,
      metadata: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }
    };
  }

  /**
   * Sanitize a string for security
   * @param input String to sanitize
   * @param options Sanitization options
   * @returns Sanitized string
   */
  static sanitizeString(
    input: string,
    options: {
      removeHTML?: boolean;
      removeScripts?: boolean;
      maxLength?: number;
      allowedChars?: RegExp;
    } = {}
  ): string {
    try {
      let sanitized = input;

      // Remove HTML tags
      if (options.removeHTML !== false) {
        sanitized = sanitized.replace(/<[^>]*>/g, '');
      }

      // Remove script content
      if (options.removeScripts !== false) {
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        sanitized = sanitized.replace(/javascript:/gi, '');
      }

      // Limit length
      if (options.maxLength && sanitized.length > options.maxLength) {
        sanitized = sanitized.substring(0, options.maxLength);
      }

      // Filter allowed characters
      if (options.allowedChars) {
        sanitized = sanitized.replace(new RegExp(`[^${options.allowedChars.source}]`, 'g'), '');
      }

      // Remove potentially dangerous characters
      sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

      return sanitized;
    } catch (error) {
      console.error('Failed to sanitize string:', error instanceof Error ? error.message : 'Unknown error');
      return input; // Return original string if sanitization fails
    }
  }

  /**
   * Validate a URL for security
   * @param url URL to validate
   * @returns Validation result
   */
  static validateURL(url: string): SecurityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    try {
      // Check if URL is valid
      const parsedURL = new URL(url);
      
      // Check protocol
      const allowedProtocols = ['https:', 'http:', 'chrome-extension:', 'moz-extension:'];
      if (!allowedProtocols.includes(parsedURL.protocol)) {
        errors.push(`Protocol ${parsedURL.protocol} is not allowed`);
        score -= 30;
      }

      // Check for suspicious patterns
      const suspiciousPatterns = [
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /<script/i,
        /on\w+\s*=/i
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(url)) {
          errors.push('URL contains suspicious patterns');
          score -= 25;
          break;
        }
      }

      // Check for excessive length
      if (url.length > 2048) {
        warnings.push('URL is excessively long');
        score -= 10;
      }

      // Check for path traversal
      if (/\.\.[\\/]/.test(parsedURL.pathname)) {
        warnings.push('URL contains potential path traversal');
        score -= 15;
      }

    } catch (error) {
      errors.push('URL format is invalid');
      score -= 50;
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score
    };
  }

  /**
   * Validate permissions for security
   * @param permissions Permissions to validate
   * @param requestedPermissions Requested permissions
   * @returns Validation result
   */
  static validatePermissions(
    permissions: string[],
    requestedPermissions: string[]
  ): SecurityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check if all requested permissions are granted
    for (const requested of requestedPermissions) {
      if (!permissions.includes(requested)) {
        errors.push(`Permission ${requested} is not granted`);
        score -= 20;
      }
    }

    // Check for excessive permissions
    const excessivePermissions = ['<all_urls>', 'nativeMessaging', 'devtools'];
    for (const permission of permissions) {
      if (excessivePermissions.includes(permission)) {
        warnings.push(`Excessive permission: ${permission}`);
        score -= 10;
      }
    }

    // Check for permission count
    if (permissions.length > 10) {
      warnings.push('High number of permissions requested');
      score -= 5;
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score
    };
  }

  /**
   * Create a secure storage key
   * @param baseKey Base key
   * @param context Security context
   * @returns Secure storage key
   */
  static async createSecureStorageKey(baseKey: string, context: SecurityContext): Promise<string> {
    try {
      const keyData = `${baseKey}_${context.sessionId}_${context.timestamp}`;
      const hash = await this.hashString(keyData);
      return `${baseKey}_${hash.substring(0, 16)}`;
    } catch (error) {
      console.error('Failed to create secure storage key:', error instanceof Error ? error.message : 'Unknown error');
      return baseKey; // Fallback to base key
    }
  }

  /**
   * Encrypt data for secure storage
   * @param data Data to encrypt
   * @param key Encryption key
   * @returns Encrypted data
   */
  static async encryptData(data: string, key: string): Promise<string> {
    try {
      // Generate a proper encryption key from the provided key
      const encoder = new TextEncoder();
      const keyData = await crypto.subtle.digest('SHA-256', encoder.encode(key));
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      // Generate a random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt the data
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        encoder.encode(data)
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedData.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encryptedData), iv.length);

      // Convert to base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Failed to encrypt data:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data from secure storage
   * @param encryptedData Encrypted data
   * @param key Encryption key
   * @returns Decrypted data
   */
  static async decryptData(encryptedData: string, key: string): Promise<string> {
    try {
      // Generate a proper encryption key from the provided key
      const encoder = new TextEncoder();
      const keyData = await crypto.subtle.digest('SHA-256', encoder.encode(key));
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      // Decrypt the data
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        data
      );

      // Convert to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error('Failed to decrypt data:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Rate limit a function call
   * @param key Rate limit key
   * @param limit Maximum calls per window
   * @param windowMs Time window in milliseconds
   * @param fn Function to rate limit
   * @returns Rate limited function
   */
  static rateLimit<T extends (...args: any[]) => any>(
    key: string,
    limit: number,
    windowMs: number,
    fn: T
  ): T {
    const calls: Array<{ timestamp: number }> = [];
    
    return ((...args: any[]) => {
      const now = Date.now();
      
      // Remove old calls outside the window
      while (calls.length > 0 && calls[0].timestamp <= now - windowMs) {
        calls.shift();
      }
      
      // Check if limit is exceeded
      if (calls.length >= limit) {
        throw new Error(`Rate limit exceeded for ${key}`);
      }
      
      // Add current call
      calls.push({ timestamp: now });
      
      // Call the function
      return fn(...args);
    }) as T;
  }

  /**
   * Create a retry wrapper for a function
   * @param fn Function to retry
   * @param maxRetries Maximum number of retries
   * @param delay Delay between retries in milliseconds
   * @returns Retry wrapper function
   */
  static withRetry<T extends (...args: any[]) => any>(
    fn: T,
    maxRetries: number = this.DEFAULT_CONFIG.maxRetries,
    delay: number = 1000
  ): T {
    return (async (...args: any[]) => {
      let lastError: Error;
      
      for (let i = 0; i <= maxRetries; i++) {
        try {
          return await fn(...args);
        } catch (error) {
          lastError = error as Error;
          
          if (i < maxRetries) {
            console.warn(`Retry ${i + 1}/${maxRetries} for function:`, error instanceof Error ? error.message : 'Unknown error');
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
          }
        }
      }
      
      throw lastError;
    }) as T;
  }

  /**
   * Create a timeout wrapper for a function
   * @param fn Function to timeout
   * @param timeoutMs Timeout in milliseconds
   * @returns Timeout wrapper function
   */
  static withTimeout<T extends (...args: any[]) => any>(
    fn: T,
    timeoutMs: number = this.DEFAULT_CONFIG.timeout
  ): T {
    return (async (...args: any[]) => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Function timed out')), timeoutMs);
      });
      
      try {
        return await Promise.race([fn(...args), timeoutPromise]);
      } catch (error) {
        if (error instanceof Error && error.message === 'Function timed out') {
          throw error;
        }
        throw error;
      }
    }) as T;
  }

  /**
   * Check if the current environment is secure
   * @returns True if environment is secure
   */
  static isSecureEnvironment(): boolean {
    try {
      // Check if we're in a secure context
      if (typeof window !== 'undefined' && window.isSecureContext !== undefined) {
        return window.isSecureContext;
      }
      
      // Check if we're in an extension context
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return true;
      }
      
      // Check if we're in HTTPS
      if (typeof location !== 'undefined' && location.protocol === 'https:') {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check secure environment:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get the current security level
   * @returns Security level
   */
  static getSecurityLevel(): 'low' | 'medium' | 'high' {
    try {
      let score = 0;
      
      // Check for secure environment
      if (this.isSecureEnvironment()) {
        score += 30;
      }
      
      // Check for HTTPS
      if (typeof location !== 'undefined' && location.protocol === 'https:') {
        score += 20;
      }
      
      // Check for CSP
      if (typeof document !== 'undefined' && document.head) {
        const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        if (cspMeta) {
          score += 25;
        }
      }
      
      // Check for extension context
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        score += 25;
      }
      
      // Determine security level
      if (score >= 75) {
        return 'high';
      } else if (score >= 50) {
        return 'medium';
      } else {
        return 'low';
      }
    } catch (error) {
      console.error('Failed to get security level:', error instanceof Error ? error.message : 'Unknown error');
      return 'low';
    }
  }

  /**
   * Create a security audit log entry
   * @param action Action performed
   * @param result Result of action
   * @param context Security context
   * @param details Additional details
   * @returns Audit log entry
   */
  static createAuditLogEntry(
    action: string,
    result: 'success' | 'failure' | 'warning',
    context: SecurityContext,
    details?: any
  ): {
    id: string;
    timestamp: number;
    action: string;
    result: string;
    context: SecurityContext;
    details?: any;
  } {
    return {
      id: this.generateSecureId('audit'),
      timestamp: Date.now(),
      action,
      result,
      context,
      details
    };
  }

  /**
   * Compare two security contexts
   * @param context1 First context
   * @param context2 Second context
   * @returns Comparison result
   */
  static compareSecurityContexts(
    context1: SecurityContext,
    context2: SecurityContext
  ): {
    isSameUser: boolean;
    isSameSession: boolean;
    timeDifference: number;
    permissionDifference: string[];
  } {
    const isSameUser = context1.userId === context2.userId;
    const isSameSession = context1.sessionId === context2.sessionId;
    const timeDifference = Math.abs(context1.timestamp - context2.timestamp);
    
    const permissionDifference = [
      ...context1.permissions.filter(p => !context2.permissions.includes(p)),
      ...context2.permissions.filter(p => !context1.permissions.includes(p))
    ];
    
    return {
      isSameUser,
      isSameSession,
      timeDifference,
      permissionDifference
    };
  }

  /**
   * Generate a security report summary
   * @param events Security events to summarize
   * @returns Security report summary
   */
  static generateSecurityReportSummary(events: Array<{
    type: string;
    severity: string;
    timestamp: number;
  }>): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    mostRecentEvent: number;
    criticalEvents: number;
    timeSpan: number;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    let mostRecentEvent = 0;
    let criticalEvents = 0;
    let oldestEvent = Date.now();
    
    for (const event of events) {
      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      
      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      
      // Track most recent
      if (event.timestamp > mostRecentEvent) {
        mostRecentEvent = event.timestamp;
      }
      
      // Track critical events
      if (event.severity === 'critical') {
        criticalEvents++;
      }
      
      // Track oldest event
      if (event.timestamp < oldestEvent) {
        oldestEvent = event.timestamp;
      }
    }
    
    const timeSpan = mostRecentEvent - oldestEvent;
    
    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      mostRecentEvent,
      criticalEvents,
      timeSpan
    };
  }
} * Shared Security Utilities for Ray Chrome Extension
 * Provides common security utilities and helper functions
 */

export interface SecurityContext {
  userId?: string;
  sessionId: string;
  timestamp: number;
  source: string;
  permissions: string[];
  metadata?: Record<string, any>;
}

export interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

export interface SecurityCheckConfig {
  enableStrictMode: boolean;
  enableLogging: boolean;
  enableNotifications: boolean;
  maxRetries: number;
  timeout: number;
}

export class SharedSecurityUtils {
  private static readonly DEFAULT_CONFIG: SecurityCheckConfig = {
    enableStrictMode: true,
    enableLogging: true,
    enableNotifications: true,
    maxRetries: 3,
    timeout: 5000
  };

  /**
   * Generate a secure random string
   * @param length Length of the string to generate
   * @returns Secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    try {
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Failed to generate secure random string:', error instanceof Error ? error.message : 'Unknown error');
      // Fallback to Math.random() if crypto API is not available
      return Math.random().toString(36).substring(2, 2 + length);
    }
  }

  /**
   * Generate a secure random ID
   * @param prefix Optional prefix
   * @returns Secure random ID
   */
  static generateSecureId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36);
    const random = this.generateSecureRandom(8);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  }

  /**
   * Hash a string using SHA-256
   * @param data String to hash
   * @returns Hashed string
   */
  static async hashString(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return hashHex;
    } catch (error) {
      console.error('Failed to hash string:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to hash string');
    }
  }

  /**
   * Validate a security context
   * @param context Security context to validate
   * @param config Optional validation configuration
   * @returns Validation result
   */
  static validateSecurityContext(context: SecurityContext, config?: Partial<SecurityCheckConfig>): SecurityValidationResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check required fields
    if (!context.sessionId) {
      errors.push('Session ID is required');
      score -= 20;
    }

    if (!context.timestamp) {
      errors.push('Timestamp is required');
      score -= 20;
    }

    if (!context.source) {
      errors.push('Source is required');
      score -= 15;
    }

    if (!context.permissions || !Array.isArray(context.permissions)) {
      errors.push('Permissions must be an array');
      score -= 15;
    }

    // Check timestamp validity
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Math.abs(now - context.timestamp) > maxAge) {
      warnings.push('Timestamp is too old or too far in the future');
      score -= 10;
    }

    // Check session ID format
    if (context.sessionId && !/^[a-zA-Z0-9_-]+$/.test(context.sessionId)) {
      warnings.push('Session ID contains invalid characters');
      score -= 5;
    }

    // Check source format
    if (context.source && !/^[a-zA-Z0-9_.-]+$/.test(context.source)) {
      warnings.push('Source contains invalid characters');
      score -= 5;
    }

    // Check permissions in strict mode
    if (finalConfig.enableStrictMode && context.permissions) {
      const validPermissions = [
        'activeTab', 'storage', 'scripting', 'tabs', 'webNavigation',
        'cookies', 'background', 'notifications', 'alarms', 'contextMenus'
      ];
      
      for (const permission of context.permissions) {
        if (!validPermissions.includes(permission)) {
          warnings.push(`Unknown permission: ${permission}`);
          score -= 2;
        }
      }
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score
    };
  }

  /**
   * Create a security context
   * @param source Context source
   * @param permissions Context permissions
   * @param userId Optional user ID
   * @returns Security context
   */
  static createSecurityContext(
    source: string,
    permissions: string[],
    userId?: string
  ): SecurityContext {
    return {
      userId,
      sessionId: this.generateSecureId('sess'),
      timestamp: Date.now(),
      source,
      permissions,
      metadata: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }
    };
  }

  /**
   * Sanitize a string for security
   * @param input String to sanitize
   * @param options Sanitization options
   * @returns Sanitized string
   */
  static sanitizeString(
    input: string,
    options: {
      removeHTML?: boolean;
      removeScripts?: boolean;
      maxLength?: number;
      allowedChars?: RegExp;
    } = {}
  ): string {
    try {
      let sanitized = input;

      // Remove HTML tags
      if (options.removeHTML !== false) {
        sanitized = sanitized.replace(/<[^>]*>/g, '');
      }

      // Remove script content
      if (options.removeScripts !== false) {
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        sanitized = sanitized.replace(/javascript:/gi, '');
      }

      // Limit length
      if (options.maxLength && sanitized.length > options.maxLength) {
        sanitized = sanitized.substring(0, options.maxLength);
      }

      // Filter allowed characters
      if (options.allowedChars) {
        sanitized = sanitized.replace(new RegExp(`[^${options.allowedChars.source}]`, 'g'), '');
      }

      // Remove potentially dangerous characters
      sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

      return sanitized;
    } catch (error) {
      console.error('Failed to sanitize string:', error instanceof Error ? error.message : 'Unknown error');
      return input; // Return original string if sanitization fails
    }
  }

  /**
   * Validate a URL for security
   * @param url URL to validate
   * @returns Validation result
   */
  static validateURL(url: string): SecurityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    try {
      // Check if URL is valid
      const parsedURL = new URL(url);
      
      // Check protocol
      const allowedProtocols = ['https:', 'http:', 'chrome-extension:', 'moz-extension:'];
      if (!allowedProtocols.includes(parsedURL.protocol)) {
        errors.push(`Protocol ${parsedURL.protocol} is not allowed`);
        score -= 30;
      }

      // Check for suspicious patterns
      const suspiciousPatterns = [
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /<script/i,
        /on\w+\s*=/i
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(url)) {
          errors.push('URL contains suspicious patterns');
          score -= 25;
          break;
        }
      }

      // Check for excessive length
      if (url.length > 2048) {
        warnings.push('URL is excessively long');
        score -= 10;
      }

      // Check for path traversal
      if (/\.\.[\\/]/.test(parsedURL.pathname)) {
        warnings.push('URL contains potential path traversal');
        score -= 15;
      }

    } catch (error) {
      errors.push('URL format is invalid');
      score -= 50;
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score
    };
  }

  /**
   * Validate permissions for security
   * @param permissions Permissions to validate
   * @param requestedPermissions Requested permissions
   * @returns Validation result
   */
  static validatePermissions(
    permissions: string[],
    requestedPermissions: string[]
  ): SecurityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check if all requested permissions are granted
    for (const requested of requestedPermissions) {
      if (!permissions.includes(requested)) {
        errors.push(`Permission ${requested} is not granted`);
        score -= 20;
      }
    }

    // Check for excessive permissions
    const excessivePermissions = ['<all_urls>', 'nativeMessaging', 'devtools'];
    for (const permission of permissions) {
      if (excessivePermissions.includes(permission)) {
        warnings.push(`Excessive permission: ${permission}`);
        score -= 10;
      }
    }

    // Check for permission count
    if (permissions.length > 10) {
      warnings.push('High number of permissions requested');
      score -= 5;
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score
    };
  }

  /**
   * Create a secure storage key
   * @param baseKey Base key
   * @param context Security context
   * @returns Secure storage key
   */
  static async createSecureStorageKey(baseKey: string, context: SecurityContext): Promise<string> {
    try {
      const keyData = `${baseKey}_${context.sessionId}_${context.timestamp}`;
      const hash = await this.hashString(keyData);
      return `${baseKey}_${hash.substring(0, 16)}`;
    } catch (error) {
      console.error('Failed to create secure storage key:', error instanceof Error ? error.message : 'Unknown error');
      return baseKey; // Fallback to base key
    }
  }

  /**
   * Encrypt data for secure storage
   * @param data Data to encrypt
   * @param key Encryption key
   * @returns Encrypted data
   */
  static async encryptData(data: string, key: string): Promise<string> {
    try {
      // Generate a proper encryption key from the provided key
      const encoder = new TextEncoder();
      const keyData = await crypto.subtle.digest('SHA-256', encoder.encode(key));
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      // Generate a random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt the data
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        encoder.encode(data)
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedData.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encryptedData), iv.length);

      // Convert to base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Failed to encrypt data:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data from secure storage
   * @param encryptedData Encrypted data
   * @param key Encryption key
   * @returns Decrypted data
   */
  static async decryptData(encryptedData: string, key: string): Promise<string> {
    try {
      // Generate a proper encryption key from the provided key
      const encoder = new TextEncoder();
      const keyData = await crypto.subtle.digest('SHA-256', encoder.encode(key));
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      // Decrypt the data
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        data
      );

      // Convert to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error('Failed to decrypt data:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Rate limit a function call
   * @param key Rate limit key
   * @param limit Maximum calls per window
   * @param windowMs Time window in milliseconds
   * @param fn Function to rate limit
   * @returns Rate limited function
   */
  static rateLimit<T extends (...args: any[]) => any>(
    key: string,
    limit: number,
    windowMs: number,
    fn: T
  ): T {
    const calls: Array<{ timestamp: number }> = [];
    
    return ((...args: any[]) => {
      const now = Date.now();
      
      // Remove old calls outside the window
      while (calls.length > 0 && calls[0].timestamp <= now - windowMs) {
        calls.shift();
      }
      
      // Check if limit is exceeded
      if (calls.length >= limit) {
        throw new Error(`Rate limit exceeded for ${key}`);
      }
      
      // Add current call
      calls.push({ timestamp: now });
      
      // Call the function
      return fn(...args);
    }) as T;
  }

  /**
   * Create a retry wrapper for a function
   * @param fn Function to retry
   * @param maxRetries Maximum number of retries
   * @param delay Delay between retries in milliseconds
   * @returns Retry wrapper function
   */
  static withRetry<T extends (...args: any[]) => any>(
    fn: T,
    maxRetries: number = this.DEFAULT_CONFIG.maxRetries,
    delay: number = 1000
  ): T {
    return (async (...args: any[]) => {
      let lastError: Error;
      
      for (let i = 0; i <= maxRetries; i++) {
        try {
          return await fn(...args);
        } catch (error) {
          lastError = error as Error;
          
          if (i < maxRetries) {
            console.warn(`Retry ${i + 1}/${maxRetries} for function:`, error instanceof Error ? error.message : 'Unknown error');
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
          }
        }
      }
      
      throw lastError;
    }) as T;
  }

  /**
   * Create a timeout wrapper for a function
   * @param fn Function to timeout
   * @param timeoutMs Timeout in milliseconds
   * @returns Timeout wrapper function
   */
  static withTimeout<T extends (...args: any[]) => any>(
    fn: T,
    timeoutMs: number = this.DEFAULT_CONFIG.timeout
  ): T {
    return (async (...args: any[]) => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Function timed out')), timeoutMs);
      });
      
      try {
        return await Promise.race([fn(...args), timeoutPromise]);
      } catch (error) {
        if (error instanceof Error && error.message === 'Function timed out') {
          throw error;
        }
        throw error;
      }
    }) as T;
  }

  /**
   * Check if the current environment is secure
   * @returns True if environment is secure
   */
  static isSecureEnvironment(): boolean {
    try {
      // Check if we're in a secure context
      if (typeof window !== 'undefined' && window.isSecureContext !== undefined) {
        return window.isSecureContext;
      }
      
      // Check if we're in an extension context
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return true;
      }
      
      // Check if we're in HTTPS
      if (typeof location !== 'undefined' && location.protocol === 'https:') {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check secure environment:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get the current security level
   * @returns Security level
   */
  static getSecurityLevel(): 'low' | 'medium' | 'high' {
    try {
      let score = 0;
      
      // Check for secure environment
      if (this.isSecureEnvironment()) {
        score += 30;
      }
      
      // Check for HTTPS
      if (typeof location !== 'undefined' && location.protocol === 'https:') {
        score += 20;
      }
      
      // Check for CSP
      if (typeof document !== 'undefined' && document.head) {
        const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        if (cspMeta) {
          score += 25;
        }
      }
      
      // Check for extension context
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        score += 25;
      }
      
      // Determine security level
      if (score >= 75) {
        return 'high';
      } else if (score >= 50) {
        return 'medium';
      } else {
        return 'low';
      }
    } catch (error) {
      console.error('Failed to get security level:', error instanceof Error ? error.message : 'Unknown error');
      return 'low';
    }
  }

  /**
   * Create a security audit log entry
   * @param action Action performed
   * @param result Result of action
   * @param context Security context
   * @param details Additional details
   * @returns Audit log entry
   */
  static createAuditLogEntry(
    action: string,
    result: 'success' | 'failure' | 'warning',
    context: SecurityContext,
    details?: any
  ): {
    id: string;
    timestamp: number;
    action: string;
    result: string;
    context: SecurityContext;
    details?: any;
  } {
    return {
      id: this.generateSecureId('audit'),
      timestamp: Date.now(),
      action,
      result,
      context,
      details
    };
  }

  /**
   * Compare two security contexts
   * @param context1 First context
   * @param context2 Second context
   * @returns Comparison result
   */
  static compareSecurityContexts(
    context1: SecurityContext,
    context2: SecurityContext
  ): {
    isSameUser: boolean;
    isSameSession: boolean;
    timeDifference: number;
    permissionDifference: string[];
  } {
    const isSameUser = context1.userId === context2.userId;
    const isSameSession = context1.sessionId === context2.sessionId;
    const timeDifference = Math.abs(context1.timestamp - context2.timestamp);
    
    const permissionDifference = [
      ...context1.permissions.filter(p => !context2.permissions.includes(p)),
      ...context2.permissions.filter(p => !context1.permissions.includes(p))
    ];
    
    return {
      isSameUser,
      isSameSession,
      timeDifference,
      permissionDifference
    };
  }

  /**
   * Generate a security report summary
   * @param events Security events to summarize
   * @returns Security report summary
   */
  static generateSecurityReportSummary(events: Array<{
    type: string;
    severity: string;
    timestamp: number;
  }>): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    mostRecentEvent: number;
    criticalEvents: number;
    timeSpan: number;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    let mostRecentEvent = 0;
    let criticalEvents = 0;
    let oldestEvent = Date.now();
    
    for (const event of events) {
      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      
      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      
      // Track most recent
      if (event.timestamp > mostRecentEvent) {
        mostRecentEvent = event.timestamp;
      }
      
      // Track critical events
      if (event.severity === 'critical') {
        criticalEvents++;
      }
      
      // Track oldest event
      if (event.timestamp < oldestEvent) {
        oldestEvent = event.timestamp;
      }
    }
    
    const timeSpan = mostRecentEvent - oldestEvent;
    
    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      mostRecentEvent,
      criticalEvents,
      timeSpan
    };
  }
}
