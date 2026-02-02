/**
 * URL Validator for Ray Chrome Extension
 * Provides comprehensive URL validation and security checks
 */

export interface URLValidationResult {
  isValid: boolean;
  url: string;
  violations: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  sanitized?: string;
  riskScore: number;
  warnings: string[];
}

export interface URLSecurityConfig {
  allowHTTP: boolean;
  allowDataUrls: boolean;
  allowFileUrls: boolean;
  allowJavaScriptUrls: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
  maxUrlLength: number;
  enableStrictValidation: boolean;
}

export class URLValidator {
  private static readonly DEFAULT_CONFIG: URLSecurityConfig = {
    allowHTTP: false,
    allowDataUrls: false,
    allowFileUrls: false,
    allowJavaScriptUrls: false,
    maxUrlLength: 2048,
    enableStrictValidation: true
  };

  private static readonly DANGEROUS_PROTOCOLS = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'ftp:',
    'mailto:',
    'tel:',
    'sms:'
  ];

  private static readonly SUSPICIOUS_PATTERNS = [
    /\.\./g, // Path traversal
    /[\x00-\x1F\x7F]/g, // Control characters
    /[<>"'{}[\]\\]/g, // HTML/JS special characters
    /%3C|%3E|%22|%27|%7B|%7D|%5B|%5D|%5C/gi, // URL encoded special characters
  ];

  /**
   * Validate URL for security
   * @param url The URL to validate
   * @param config Optional security configuration
   * @returns URL validation result
   */
  static validateURL(url: string, config?: Partial<URLSecurityConfig>): URLValidationResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const violations: URLValidationResult['violations'] = [];
    const warnings: string[] = [];
    let riskScore = 0;
    let sanitized = url;

    try {
      // Basic URL parsing
      let parsedURL: URL;
      try {
        parsedURL = new URL(url);
      } catch (error) {
        violations.push({
          type: 'Invalid URL',
          severity: 'high',
          description: 'URL format is invalid'
        });
        riskScore += 30;
        return {
          isValid: false,
          url,
          violations,
          riskScore,
          warnings: ['URL format is invalid']
        };
      }

      // Check URL length
      if (url.length > finalConfig.maxUrlLength) {
        violations.push({
          type: 'URL Length',
          severity: 'medium',
          description: `URL exceeds maximum length of ${finalConfig.maxUrlLength} characters`
        });
        riskScore += 15;
      }

      // Check protocol
      if (!this.isProtocolAllowed(parsedURL.protocol, finalConfig)) {
        violations.push({
          type: 'Protocol',
          severity: 'high',
          description: `Protocol ${parsedURL.protocol} is not allowed`
        });
        riskScore += 25;
      }

      // Check for dangerous protocols
      if (this.DANGEROUS_PROTOCOLS.some(protocol => url.toLowerCase().startsWith(protocol))) {
        violations.push({
          type: 'Dangerous Protocol',
          severity: 'high',
          description: 'URL contains dangerous protocol'
        });
        riskScore += 30;
      }

      // Check domain restrictions
      if (finalConfig.allowedDomains && finalConfig.allowedDomains.length > 0) {
        if (!finalConfig.allowedDomains.some(domain => 
          parsedURL.hostname === domain || parsedURL.hostname.endsWith(`.${domain}`)
        )) {
          violations.push({
            type: 'Domain Not Allowed',
            severity: 'medium',
            description: `Domain ${parsedURL.hostname} is not in allowed list`
          });
          riskScore += 20;
        }
      }

      if (finalConfig.blockedDomains) {
        if (finalConfig.blockedDomains.some(domain => 
          parsedURL.hostname === domain || parsedURL.hostname.endsWith(`.${domain}`)
        )) {
          violations.push({
            type: 'Blocked Domain',
            severity: 'high',
            description: `Domain ${parsedURL.hostname} is blocked`
          });
          riskScore += 25;
        }
      }

      // Check for suspicious patterns
      for (const pattern of this.SUSPICIOUS_PATTERNS) {
        if (pattern.test(url)) {
          violations.push({
            type: 'Suspicious Pattern',
            severity: 'medium',
            description: 'URL contains suspicious characters or patterns'
          });
          riskScore += 15;
          break;
        }
      }

      // Check for encoded content
      if (this.hasExcessiveEncoding(url)) {
        violations.push({
          type: 'Excessive Encoding',
          severity: 'medium',
          description: 'URL contains excessive percent encoding'
        });
        riskScore += 10;
      }

      // Check for potential XSS
      if (this.containsXSSPatterns(url)) {
        violations.push({
          type: 'XSS Pattern',
          severity: 'high',
          description: 'URL contains potential XSS patterns'
        });
        riskScore += 25;
      }

      // Strict validation checks
      if (finalConfig.enableStrictValidation) {
        const strictViolations = this.strictValidation(url, parsedURL);
        violations.push(...strictViolations);
        riskScore += strictViolations.length * 10;
      }

      // Sanitize URL if needed
      if (violations.length > 0) {
        sanitized = this.sanitizeURL(url, violations);
      }

      return {
        isValid: violations.length === 0,
        url,
        violations,
        sanitized,
        riskScore,
        warnings
      };
    } catch (error) {
      return {
        isValid: false,
        url,
        violations: [{
          type: 'Validation Error',
          severity: 'high',
          description: 'URL validation failed due to an error'
        }],
        riskScore: 50,
        warnings: ['URL validation encountered an error']
      };
    }
  }

  /**
   * Validate multiple URLs
   * @param urls Array of URLs to validate
   * @param config Optional security configuration
   * @returns Array of validation results
   */
  static validateURLs(urls: string[], config?: Partial<URLSecurityConfig>): URLValidationResult[] {
    return urls.map(url => this.validateURL(url, config));
  }

  /**
   * Check if URL is safe to use
   * @param url The URL to check
   * @param config Optional security configuration
   * @returns True if URL is safe
   */
  static isURLSafe(url: string, config?: Partial<URLSecurityConfig>): boolean {
    const result = this.validateURL(url, config);
    return result.isValid && result.riskScore < 50;
  }

  /**
   * Get URL risk assessment
   * @param url The URL to assess
   * @returns Risk assessment
   */
  static assessURLRisk(url: string): {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    factors: string[];
  } {
    const result = this.validateURL(url);
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (result.riskScore >= 75) {
      riskLevel = 'critical';
    } else if (result.riskScore >= 50) {
      riskLevel = 'high';
    } else if (result.riskScore >= 25) {
      riskLevel = 'medium';
    }

    const factors = result.violations.map(v => v.description);
    
    return {
      riskLevel,
      riskScore: result.riskScore,
      factors
    };
  }

  /**
   * Extract domain from URL safely
   * @param url The URL to extract domain from
   * @returns Domain or null if invalid
   */
  static extractDomain(url: string): string | null {
    try {
      const parsedURL = new URL(url);
      return parsedURL.hostname;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if URL is internal to the extension
   * @param url The URL to check
   * @returns True if URL is internal
   */
  static isInternalURL(url: string): boolean {
    try {
      const parsedURL = new URL(url);
      return parsedURL.protocol === 'chrome-extension:' || 
             parsedURL.protocol === 'moz-extension:' ||
             parsedURL.hostname === 'extension' ||
             parsedURL.hostname.endsWith('.extension');
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if protocol is allowed
   * @param protocol The protocol to check
   * @param config Security configuration
   * @returns True if protocol is allowed
   */
  private static isProtocolAllowed(protocol: string, config: URLSecurityConfig): boolean {
    const cleanProtocol = protocol.toLowerCase();
    
    // Always allow HTTPS
    if (cleanProtocol === 'https:') {
      return true;
    }
    
    // Allow HTTP if configured
    if (cleanProtocol === 'http:' && config.allowHTTP) {
      return true;
    }
    
    // Allow data URLs if configured
    if (cleanProtocol === 'data:' && config.allowDataUrls) {
      return true;
    }
    
    // Allow file URLs if configured
    if (cleanProtocol === 'file:' && config.allowFileUrls) {
      return true;
    }
    
    // Allow JavaScript URLs if configured (not recommended)
    if (cleanProtocol === 'javascript:' && config.allowJavaScriptUrls) {
      return true;
    }
    
    return false;
  }

  /**
   * Check for excessive encoding
   * @param url The URL to check
   * @returns True if URL has excessive encoding
   */
  private static hasExcessiveEncoding(url: string): boolean {
    const percentEncoded = (url.match(/%[0-9A-Fa-f]{2}/g) || []).length;
    const totalLength = url.length;
    
    // If more than 30% of the URL is percent-encoded, it's suspicious
    return percentEncoded > totalLength * 0.3;
  }

  /**
   * Check for XSS patterns
   * @param url The URL to check
   * @returns True if URL contains XSS patterns
   */
  private static containsXSSPatterns(url: string): boolean {
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<form/i,
      /<input/i,
      /<link/i,
      /<meta/i
    ];
    
    return xssPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Apply strict validation to URL
   * @param url The URL to validate
   * @param parsedURL The parsed URL object
   * @returns Array of strict violations
   */
  private static strictValidation(url: string, parsedURL: URL): URLValidationResult['violations'] {
    const violations: URLValidationResult['violations'] = [];

    // Check for port numbers that are unusual
    if (parsedURL.port && parseInt(parsedURL.port) > 65535) {
      violations.push({
        type: 'Invalid Port',
        severity: 'medium',
        description: 'URL contains invalid port number'
      });
    }

    // Check for credentials in URL
    if (parsedURL.username || parsedURL.password) {
      violations.push({
        type: 'URL Credentials',
        severity: 'medium',
        description: 'URL contains credentials which is not recommended'
      });
    }

    // Check for very long query strings
    if (parsedURL.search && parsedURL.search.length > 1000) {
      violations.push({
        type: 'Long Query String',
        severity: 'low',
        description: 'URL has unusually long query string'
      });
    }

    // Check for multiple subdomains
    const subdomainCount = parsedURL.hostname.split('.').length - 2;
    if (subdomainCount > 5) {
      violations.push({
        type: 'Excessive Subdomains',
        severity: 'low',
        description: 'URL has excessive number of subdomains'
      });
    }

    return violations;
  }

  /**
   * Sanitize URL based on violations
   * @param url The URL to sanitize
   * @param violations The violations found
   * @returns Sanitized URL
   */
  private static sanitizeURL(url: string, violations: URLValidationResult['violations']): string {
    let sanitized = url;

    for (const violation of violations) {
      switch (violation.type) {
        case 'Dangerous Protocol':
          // Remove dangerous protocols
          sanitized = sanitized.replace(/^(javascript|data|vbscript):/i, 'https:');
          break;
        case 'Suspicious Pattern':
          // Remove suspicious characters
          sanitized = sanitized.replace(/[<>"'{}[\]\\]/g, '');
          break;
        case 'Excessive Encoding':
          // Decode excessive encoding
          try {
            sanitized = decodeURIComponent(sanitized);
          } catch (error) {
            // If decoding fails, keep original
          }
          break;
        case 'XSS Pattern':
          // Remove XSS patterns
          sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
          sanitized = sanitized.replace(/on\w+\s*=/gi, '');
          break;
      }
    }

    return sanitized;
  }

  /**
   * Create custom URL security configuration
   * @param overrides Configuration overrides
   * @returns Custom security configuration
   */
  static createSecurityConfig(overrides: Partial<URLSecurityConfig>): URLSecurityConfig {
    return {
      ...this.DEFAULT_CONFIG,
      ...overrides
    };
  }

  /**
   * Get default security configuration
   * @returns Default security configuration
   */
  static getDefaultConfig(): URLSecurityConfig {
    return { ...this.DEFAULT_CONFIG };
  }
} * URL Validator for Ray Chrome Extension
 * Provides comprehensive URL validation and security checks
 */

export interface URLValidationResult {
  isValid: boolean;
  url: string;
  violations: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  sanitized?: string;
  riskScore: number;
  warnings: string[];
}

export interface URLSecurityConfig {
  allowHTTP: boolean;
  allowDataUrls: boolean;
  allowFileUrls: boolean;
  allowJavaScriptUrls: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
  maxUrlLength: number;
  enableStrictValidation: boolean;
}

export class URLValidator {
  private static readonly DEFAULT_CONFIG: URLSecurityConfig = {
    allowHTTP: false,
    allowDataUrls: false,
    allowFileUrls: false,
    allowJavaScriptUrls: false,
    maxUrlLength: 2048,
    enableStrictValidation: true
  };

  private static readonly DANGEROUS_PROTOCOLS = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'ftp:',
    'mailto:',
    'tel:',
    'sms:'
  ];

  private static readonly SUSPICIOUS_PATTERNS = [
    /\.\./g, // Path traversal
    /[\x00-\x1F\x7F]/g, // Control characters
    /[<>"'{}[\]\\]/g, // HTML/JS special characters
    /%3C|%3E|%22|%27|%7B|%7D|%5B|%5D|%5C/gi, // URL encoded special characters
  ];

  /**
   * Validate URL for security
   * @param url The URL to validate
   * @param config Optional security configuration
   * @returns URL validation result
   */
  static validateURL(url: string, config?: Partial<URLSecurityConfig>): URLValidationResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const violations: URLValidationResult['violations'] = [];
    const warnings: string[] = [];
    let riskScore = 0;
    let sanitized = url;

    try {
      // Basic URL parsing
      let parsedURL: URL;
      try {
        parsedURL = new URL(url);
      } catch (error) {
        violations.push({
          type: 'Invalid URL',
          severity: 'high',
          description: 'URL format is invalid'
        });
        riskScore += 30;
        return {
          isValid: false,
          url,
          violations,
          riskScore,
          warnings: ['URL format is invalid']
        };
      }

      // Check URL length
      if (url.length > finalConfig.maxUrlLength) {
        violations.push({
          type: 'URL Length',
          severity: 'medium',
          description: `URL exceeds maximum length of ${finalConfig.maxUrlLength} characters`
        });
        riskScore += 15;
      }

      // Check protocol
      if (!this.isProtocolAllowed(parsedURL.protocol, finalConfig)) {
        violations.push({
          type: 'Protocol',
          severity: 'high',
          description: `Protocol ${parsedURL.protocol} is not allowed`
        });
        riskScore += 25;
      }

      // Check for dangerous protocols
      if (this.DANGEROUS_PROTOCOLS.some(protocol => url.toLowerCase().startsWith(protocol))) {
        violations.push({
          type: 'Dangerous Protocol',
          severity: 'high',
          description: 'URL contains dangerous protocol'
        });
        riskScore += 30;
      }

      // Check domain restrictions
      if (finalConfig.allowedDomains && finalConfig.allowedDomains.length > 0) {
        if (!finalConfig.allowedDomains.some(domain => 
          parsedURL.hostname === domain || parsedURL.hostname.endsWith(`.${domain}`)
        )) {
          violations.push({
            type: 'Domain Not Allowed',
            severity: 'medium',
            description: `Domain ${parsedURL.hostname} is not in allowed list`
          });
          riskScore += 20;
        }
      }

      if (finalConfig.blockedDomains) {
        if (finalConfig.blockedDomains.some(domain => 
          parsedURL.hostname === domain || parsedURL.hostname.endsWith(`.${domain}`)
        )) {
          violations.push({
            type: 'Blocked Domain',
            severity: 'high',
            description: `Domain ${parsedURL.hostname} is blocked`
          });
          riskScore += 25;
        }
      }

      // Check for suspicious patterns
      for (const pattern of this.SUSPICIOUS_PATTERNS) {
        if (pattern.test(url)) {
          violations.push({
            type: 'Suspicious Pattern',
            severity: 'medium',
            description: 'URL contains suspicious characters or patterns'
          });
          riskScore += 15;
          break;
        }
      }

      // Check for encoded content
      if (this.hasExcessiveEncoding(url)) {
        violations.push({
          type: 'Excessive Encoding',
          severity: 'medium',
          description: 'URL contains excessive percent encoding'
        });
        riskScore += 10;
      }

      // Check for potential XSS
      if (this.containsXSSPatterns(url)) {
        violations.push({
          type: 'XSS Pattern',
          severity: 'high',
          description: 'URL contains potential XSS patterns'
        });
        riskScore += 25;
      }

      // Strict validation checks
      if (finalConfig.enableStrictValidation) {
        const strictViolations = this.strictValidation(url, parsedURL);
        violations.push(...strictViolations);
        riskScore += strictViolations.length * 10;
      }

      // Sanitize URL if needed
      if (violations.length > 0) {
        sanitized = this.sanitizeURL(url, violations);
      }

      return {
        isValid: violations.length === 0,
        url,
        violations,
        sanitized,
        riskScore,
        warnings
      };
    } catch (error) {
      return {
        isValid: false,
        url,
        violations: [{
          type: 'Validation Error',
          severity: 'high',
          description: 'URL validation failed due to an error'
        }],
        riskScore: 50,
        warnings: ['URL validation encountered an error']
      };
    }
  }

  /**
   * Validate multiple URLs
   * @param urls Array of URLs to validate
   * @param config Optional security configuration
   * @returns Array of validation results
   */
  static validateURLs(urls: string[], config?: Partial<URLSecurityConfig>): URLValidationResult[] {
    return urls.map(url => this.validateURL(url, config));
  }

  /**
   * Check if URL is safe to use
   * @param url The URL to check
   * @param config Optional security configuration
   * @returns True if URL is safe
   */
  static isURLSafe(url: string, config?: Partial<URLSecurityConfig>): boolean {
    const result = this.validateURL(url, config);
    return result.isValid && result.riskScore < 50;
  }

  /**
   * Get URL risk assessment
   * @param url The URL to assess
   * @returns Risk assessment
   */
  static assessURLRisk(url: string): {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    factors: string[];
  } {
    const result = this.validateURL(url);
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (result.riskScore >= 75) {
      riskLevel = 'critical';
    } else if (result.riskScore >= 50) {
      riskLevel = 'high';
    } else if (result.riskScore >= 25) {
      riskLevel = 'medium';
    }

    const factors = result.violations.map(v => v.description);
    
    return {
      riskLevel,
      riskScore: result.riskScore,
      factors
    };
  }

  /**
   * Extract domain from URL safely
   * @param url The URL to extract domain from
   * @returns Domain or null if invalid
   */
  static extractDomain(url: string): string | null {
    try {
      const parsedURL = new URL(url);
      return parsedURL.hostname;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if URL is internal to the extension
   * @param url The URL to check
   * @returns True if URL is internal
   */
  static isInternalURL(url: string): boolean {
    try {
      const parsedURL = new URL(url);
      return parsedURL.protocol === 'chrome-extension:' || 
             parsedURL.protocol === 'moz-extension:' ||
             parsedURL.hostname === 'extension' ||
             parsedURL.hostname.endsWith('.extension');
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if protocol is allowed
   * @param protocol The protocol to check
   * @param config Security configuration
   * @returns True if protocol is allowed
   */
  private static isProtocolAllowed(protocol: string, config: URLSecurityConfig): boolean {
    const cleanProtocol = protocol.toLowerCase();
    
    // Always allow HTTPS
    if (cleanProtocol === 'https:') {
      return true;
    }
    
    // Allow HTTP if configured
    if (cleanProtocol === 'http:' && config.allowHTTP) {
      return true;
    }
    
    // Allow data URLs if configured
    if (cleanProtocol === 'data:' && config.allowDataUrls) {
      return true;
    }
    
    // Allow file URLs if configured
    if (cleanProtocol === 'file:' && config.allowFileUrls) {
      return true;
    }
    
    // Allow JavaScript URLs if configured (not recommended)
    if (cleanProtocol === 'javascript:' && config.allowJavaScriptUrls) {
      return true;
    }
    
    return false;
  }

  /**
   * Check for excessive encoding
   * @param url The URL to check
   * @returns True if URL has excessive encoding
   */
  private static hasExcessiveEncoding(url: string): boolean {
    const percentEncoded = (url.match(/%[0-9A-Fa-f]{2}/g) || []).length;
    const totalLength = url.length;
    
    // If more than 30% of the URL is percent-encoded, it's suspicious
    return percentEncoded > totalLength * 0.3;
  }

  /**
   * Check for XSS patterns
   * @param url The URL to check
   * @returns True if URL contains XSS patterns
   */
  private static containsXSSPatterns(url: string): boolean {
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<form/i,
      /<input/i,
      /<link/i,
      /<meta/i
    ];
    
    return xssPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Apply strict validation to URL
   * @param url The URL to validate
   * @param parsedURL The parsed URL object
   * @returns Array of strict violations
   */
  private static strictValidation(url: string, parsedURL: URL): URLValidationResult['violations'] {
    const violations: URLValidationResult['violations'] = [];

    // Check for port numbers that are unusual
    if (parsedURL.port && parseInt(parsedURL.port) > 65535) {
      violations.push({
        type: 'Invalid Port',
        severity: 'medium',
        description: 'URL contains invalid port number'
      });
    }

    // Check for credentials in URL
    if (parsedURL.username || parsedURL.password) {
      violations.push({
        type: 'URL Credentials',
        severity: 'medium',
        description: 'URL contains credentials which is not recommended'
      });
    }

    // Check for very long query strings
    if (parsedURL.search && parsedURL.search.length > 1000) {
      violations.push({
        type: 'Long Query String',
        severity: 'low',
        description: 'URL has unusually long query string'
      });
    }

    // Check for multiple subdomains
    const subdomainCount = parsedURL.hostname.split('.').length - 2;
    if (subdomainCount > 5) {
      violations.push({
        type: 'Excessive Subdomains',
        severity: 'low',
        description: 'URL has excessive number of subdomains'
      });
    }

    return violations;
  }

  /**
   * Sanitize URL based on violations
   * @param url The URL to sanitize
   * @param violations The violations found
   * @returns Sanitized URL
   */
  private static sanitizeURL(url: string, violations: URLValidationResult['violations']): string {
    let sanitized = url;

    for (const violation of violations) {
      switch (violation.type) {
        case 'Dangerous Protocol':
          // Remove dangerous protocols
          sanitized = sanitized.replace(/^(javascript|data|vbscript):/i, 'https:');
          break;
        case 'Suspicious Pattern':
          // Remove suspicious characters
          sanitized = sanitized.replace(/[<>"'{}[\]\\]/g, '');
          break;
        case 'Excessive Encoding':
          // Decode excessive encoding
          try {
            sanitized = decodeURIComponent(sanitized);
          } catch (error) {
            // If decoding fails, keep original
          }
          break;
        case 'XSS Pattern':
          // Remove XSS patterns
          sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
          sanitized = sanitized.replace(/on\w+\s*=/gi, '');
          break;
      }
    }

    return sanitized;
  }

  /**
   * Create custom URL security configuration
   * @param overrides Configuration overrides
   * @returns Custom security configuration
   */
  static createSecurityConfig(overrides: Partial<URLSecurityConfig>): URLSecurityConfig {
    return {
      ...this.DEFAULT_CONFIG,
      ...overrides
    };
  }

  /**
   * Get default security configuration
   * @returns Default security configuration
   */
  static getDefaultConfig(): URLSecurityConfig {
    return { ...this.DEFAULT_CONFIG };
  }
}
