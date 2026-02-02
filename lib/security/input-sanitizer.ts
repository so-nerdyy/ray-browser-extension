/**
 * Input Sanitization for Ray Chrome Extension
 * Handles input validation and sanitization for security
 */

export interface SanitizationRule {
  name: string;
  description: string;
  sanitize: (input: string) => string;
  validate: (input: string) => boolean;
}

export interface SanitizationResult {
  original: string;
  sanitized: string;
  isValid: boolean;
  warnings: string[];
  appliedRules: string[];
}

export interface InputValidationConfig {
  maxLength: number;
  allowHTML: boolean;
  allowScripts: boolean;
  allowedTags?: string[];
  allowedAttributes?: string[];
  customRules?: SanitizationRule[];
}

export class InputSanitizer {
  private static readonly DEFAULT_CONFIG: InputValidationConfig = {
    maxLength: 10000,
    allowHTML: false,
    allowScripts: false,
    allowedTags: [],
    allowedAttributes: []
  };

  private static readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /expression\s*\(/gi,
    /@import/gi,
    /binding\s*:/gi
  ];

  private static readonly SANITIZATION_RULES: SanitizationRule[] = [
    {
      name: 'Remove Scripts',
      description: 'Remove all script tags and JavaScript code',
      sanitize: (input: string) => {
        return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                   .replace(/javascript:/gi, '')
                   .replace(/on\w+\s*=/gi, '');
      },
      validate: (input: string) => {
        return !/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(input) &&
               !/javascript:/gi.test(input) &&
               !/on\w+\s*=/gi.test(input);
      }
    },
    {
      name: 'Remove Dangerous Protocols',
      description: 'Remove dangerous URL protocols',
      sanitize: (input: string) => {
        return input.replace(/(javascript|vbscript|data):/gi, '');
      },
      validate: (input: string) => {
        return !/(javascript|vbscript|data):/gi.test(input);
      }
    },
    {
      name: 'Remove HTML Comments',
      description: 'Remove HTML comments',
      sanitize: (input: string) => {
        return input.replace(/<!--[\s\S]*?-->/g, '');
      },
      validate: (input: string) => {
        return !/<!--[\s\S]*?-->/g.test(input);
      }
    },
    {
      name: 'Normalize Whitespace',
      description: 'Normalize whitespace characters',
      sanitize: (input: string) => {
        return input.replace(/\s+/g, ' ').trim();
      },
      validate: (input: string) => {
        return true; // Always valid after normalization
      }
    }
  ];

  /**
   * Sanitize input string according to configuration
   * @param input The input string to sanitize
   * @param config Optional sanitization configuration
   * @returns Sanitization result
   */
  static sanitize(input: string, config?: Partial<InputValidationConfig>): SanitizationResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const warnings: string[] = [];
    const appliedRules: string[] = [];

    let sanitized = input;
    let isValid = true;

    // Check maximum length
    if (sanitized.length > finalConfig.maxLength) {
      warnings.push(`Input exceeds maximum length of ${finalConfig.maxLength} characters`);
      sanitized = sanitized.substring(0, finalConfig.maxLength);
      isValid = false;
    }

    // Apply sanitization rules
    const rules = [...this.SANITIZATION_RULES, ...(finalConfig.customRules || [])];
    
    for (const rule of rules) {
      const before = sanitized;
      sanitized = rule.sanitize(sanitized);
      
      if (before !== sanitized) {
        appliedRules.push(rule.name);
        
        if (!rule.validate(before)) {
          isValid = false;
        }
      }
    }

    // Additional HTML processing if HTML is allowed
    if (finalConfig.allowHTML) {
      const htmlResult = this.sanitizeHTML(sanitized, finalConfig);
      sanitized = htmlResult.sanitized;
      
      if (htmlResult.warnings.length > 0) {
        warnings.push(...htmlResult.warnings);
      }
      
      if (!htmlResult.isValid) {
        isValid = false;
      }
    } else {
      // Remove all HTML if not allowed
      const htmlRemoved = sanitized.replace(/<[^>]*>/g, '');
      if (htmlRemoved !== sanitized) {
        appliedRules.push('Remove HTML');
        sanitized = htmlRemoved;
        isValid = false;
        warnings.push('HTML content removed as it is not allowed');
      }
    }

    // Final validation for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(sanitized)) {
        warnings.push('Dangerous pattern detected and removed');
        sanitized = sanitized.replace(pattern, '');
        isValid = false;
      }
    }

    return {
      original: input,
      sanitized,
      isValid,
      warnings,
      appliedRules
    };
  }

  /**
   * Sanitize HTML content with allowed tags and attributes
   * @param html The HTML content to sanitize
   * @param config Sanitization configuration
   * @returns Sanitization result
   */
  private static sanitizeHTML(html: string, config: InputValidationConfig): SanitizationResult {
    const warnings: string[] = [];
    let isValid = true;
    let sanitized = html;

    // Basic HTML tag removal if scripts are not allowed
    if (!config.allowScripts) {
      const scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
      if (scriptPattern.test(sanitized)) {
        warnings.push('Script tags removed');
        sanitized = sanitized.replace(scriptPattern, '');
        isValid = false;
      }
    }

    // Remove dangerous attributes
    const dangerousAttributes = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'];
    for (const attr of dangerousAttributes) {
      const pattern = new RegExp(`\\b${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      if (pattern.test(sanitized)) {
        warnings.push(`Dangerous attribute ${attr} removed`);
        sanitized = sanitized.replace(pattern, '');
        isValid = false;
      }
    }

    // Filter to allowed tags if specified
    if (config.allowedTags && config.allowedTags.length > 0) {
      const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
      const matches = sanitized.match(tagPattern) || [];
      
      for (const match of matches) {
        const tagName = match.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/)?.[1];
        if (tagName && !config.allowedTags.includes(tagName.toLowerCase())) {
          warnings.push(`Disallowed tag ${tagName} removed`);
          sanitized = sanitized.replace(match, '');
          isValid = false;
        }
      }
    }

    return {
      original: html,
      sanitized,
      isValid,
      warnings,
      appliedRules: ['HTML Sanitization']
    };
  }

  /**
   * Validate input without sanitizing
   * @param input The input to validate
   * @param config Optional validation configuration
   * @returns Validation result
   */
  static validate(input: string, config?: Partial<InputValidationConfig>): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const warnings: string[] = [];
    const errors: string[] = [];
    let isValid = true;

    // Check maximum length
    if (input.length > finalConfig.maxLength) {
      errors.push(`Input exceeds maximum length of ${finalConfig.maxLength} characters`);
      isValid = false;
    }

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        errors.push('Input contains dangerous patterns');
        isValid = false;
        break;
      }
    }

    // Check HTML content
    if (!finalConfig.allowHTML && /<[^>]*>/.test(input)) {
      warnings.push('Input contains HTML content which is not allowed');
    }

    // Check for script content
    if (!finalConfig.allowScripts && /<script/i.test(input)) {
      errors.push('Input contains script content which is not allowed');
      isValid = false;
    }

    return {
      isValid,
      warnings,
      errors
    };
  }

  /**
   * Sanitize URL for safe usage
   * @param url The URL to sanitize
   * @param allowedProtocols Optional list of allowed protocols
   * @returns Sanitized URL or null if unsafe
   */
  static sanitizeURL(url: string, allowedProtocols: string[] = ['https:', 'http:']): string | null {
    try {
      // Remove dangerous protocols
      const sanitized = url.replace(/(javascript|vbscript|data):/gi, '');
      
      // Parse URL
      const parsed = new URL(sanitized, 'http://example.com');
      
      // Check protocol
      if (!allowedProtocols.includes(parsed.protocol)) {
        return null;
      }

      // Check for dangerous characters
      if (/[<>"\s]/.test(sanitized)) {
        return null;
      }

      return sanitized;
    } catch (error) {
      return null;
    }
  }

  /**
   * Sanitize CSS for safe usage
   * @param css The CSS to sanitize
   * @returns Sanitized CSS
   */
  static sanitizeCSS(css: string): string {
    let sanitized = css;

    // Remove dangerous CSS
    const dangerousPatterns = [
      /expression\s*\(/gi,
      /javascript:/gi,
      /@import/gi,
      /binding\s*:/gi,
      /behavior\s*:/gi
    ];

    for (const pattern of dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Remove comments
    sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');

    return sanitized.trim();
  }

  /**
   * Sanitize JSON data
   * @param jsonString The JSON string to sanitize
   * @returns Sanitized JSON or null if invalid
   */
  static sanitizeJSON(jsonString: string): any | null {
    try {
      // Remove script tags and dangerous content
      const sanitized = jsonString
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '');

      // Parse and validate JSON
      const parsed = JSON.parse(sanitized);
      
      // Recursively sanitize object properties
      return this.sanitizeJSONObject(parsed);
    } catch (error) {
      return null;
    }
  }

  /**
   * Recursively sanitize JSON object
   * @param obj The object to sanitize
   * @returns Sanitized object
   */
  private static sanitizeJSONObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitize(obj).sanitized;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeJSONObject(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip potentially dangerous keys
        if (!/^(constructor|prototype|__proto__)$/.test(key)) {
          sanitized[key] = this.sanitizeJSONObject(value);
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Create custom sanitization rule
   * @param name Rule name
   * @param description Rule description
   * @param pattern Pattern to match
   * @param replacement Replacement string
   * @returns Custom sanitization rule
   */
  static createCustomRule(
    name: string,
    description: string,
    pattern: RegExp,
    replacement: string = ''
  ): SanitizationRule {
    return {
      name,
      description,
      sanitize: (input: string) => input.replace(pattern, replacement),
      validate: (input: string) => !pattern.test(input)
    };
  }

  /**
   * Get default sanitization rules
   * @returns Array of default rules
   */
  static getDefaultRules(): SanitizationRule[] {
    return [...this.SANITIZATION_RULES];
  }

  /**
   * Add custom sanitization rule
   * @param rule The custom rule to add
   */
  static addCustomRule(rule: SanitizationRule): void {
    this.SANITIZATION_RULES.push(rule);
  }

  /**
   * Remove sanitization rule by name
   * @param name Name of the rule to remove
   */
  static removeRule(name: string): void {
    const index = this.SANITIZATION_RULES.findIndex(rule => rule.name === name);
    if (index !== -1) {
      this.SANITIZATION_RULES.splice(index, 1);
    }
  }
} * Input Sanitization for Ray Chrome Extension
 * Handles input validation and sanitization for security
 */

export interface SanitizationRule {
  name: string;
  description: string;
  sanitize: (input: string) => string;
  validate: (input: string) => boolean;
}

export interface SanitizationResult {
  original: string;
  sanitized: string;
  isValid: boolean;
  warnings: string[];
  appliedRules: string[];
}

export interface InputValidationConfig {
  maxLength: number;
  allowHTML: boolean;
  allowScripts: boolean;
  allowedTags?: string[];
  allowedAttributes?: string[];
  customRules?: SanitizationRule[];
}

export class InputSanitizer {
  private static readonly DEFAULT_CONFIG: InputValidationConfig = {
    maxLength: 10000,
    allowHTML: false,
    allowScripts: false,
    allowedTags: [],
    allowedAttributes: []
  };

  private static readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /expression\s*\(/gi,
    /@import/gi,
    /binding\s*:/gi
  ];

  private static readonly SANITIZATION_RULES: SanitizationRule[] = [
    {
      name: 'Remove Scripts',
      description: 'Remove all script tags and JavaScript code',
      sanitize: (input: string) => {
        return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                   .replace(/javascript:/gi, '')
                   .replace(/on\w+\s*=/gi, '');
      },
      validate: (input: string) => {
        return !/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(input) &&
               !/javascript:/gi.test(input) &&
               !/on\w+\s*=/gi.test(input);
      }
    },
    {
      name: 'Remove Dangerous Protocols',
      description: 'Remove dangerous URL protocols',
      sanitize: (input: string) => {
        return input.replace(/(javascript|vbscript|data):/gi, '');
      },
      validate: (input: string) => {
        return !/(javascript|vbscript|data):/gi.test(input);
      }
    },
    {
      name: 'Remove HTML Comments',
      description: 'Remove HTML comments',
      sanitize: (input: string) => {
        return input.replace(/<!--[\s\S]*?-->/g, '');
      },
      validate: (input: string) => {
        return !/<!--[\s\S]*?-->/g.test(input);
      }
    },
    {
      name: 'Normalize Whitespace',
      description: 'Normalize whitespace characters',
      sanitize: (input: string) => {
        return input.replace(/\s+/g, ' ').trim();
      },
      validate: (input: string) => {
        return true; // Always valid after normalization
      }
    }
  ];

  /**
   * Sanitize input string according to configuration
   * @param input The input string to sanitize
   * @param config Optional sanitization configuration
   * @returns Sanitization result
   */
  static sanitize(input: string, config?: Partial<InputValidationConfig>): SanitizationResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const warnings: string[] = [];
    const appliedRules: string[] = [];

    let sanitized = input;
    let isValid = true;

    // Check maximum length
    if (sanitized.length > finalConfig.maxLength) {
      warnings.push(`Input exceeds maximum length of ${finalConfig.maxLength} characters`);
      sanitized = sanitized.substring(0, finalConfig.maxLength);
      isValid = false;
    }

    // Apply sanitization rules
    const rules = [...this.SANITIZATION_RULES, ...(finalConfig.customRules || [])];
    
    for (const rule of rules) {
      const before = sanitized;
      sanitized = rule.sanitize(sanitized);
      
      if (before !== sanitized) {
        appliedRules.push(rule.name);
        
        if (!rule.validate(before)) {
          isValid = false;
        }
      }
    }

    // Additional HTML processing if HTML is allowed
    if (finalConfig.allowHTML) {
      const htmlResult = this.sanitizeHTML(sanitized, finalConfig);
      sanitized = htmlResult.sanitized;
      
      if (htmlResult.warnings.length > 0) {
        warnings.push(...htmlResult.warnings);
      }
      
      if (!htmlResult.isValid) {
        isValid = false;
      }
    } else {
      // Remove all HTML if not allowed
      const htmlRemoved = sanitized.replace(/<[^>]*>/g, '');
      if (htmlRemoved !== sanitized) {
        appliedRules.push('Remove HTML');
        sanitized = htmlRemoved;
        isValid = false;
        warnings.push('HTML content removed as it is not allowed');
      }
    }

    // Final validation for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(sanitized)) {
        warnings.push('Dangerous pattern detected and removed');
        sanitized = sanitized.replace(pattern, '');
        isValid = false;
      }
    }

    return {
      original: input,
      sanitized,
      isValid,
      warnings,
      appliedRules
    };
  }

  /**
   * Sanitize HTML content with allowed tags and attributes
   * @param html The HTML content to sanitize
   * @param config Sanitization configuration
   * @returns Sanitization result
   */
  private static sanitizeHTML(html: string, config: InputValidationConfig): SanitizationResult {
    const warnings: string[] = [];
    let isValid = true;
    let sanitized = html;

    // Basic HTML tag removal if scripts are not allowed
    if (!config.allowScripts) {
      const scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
      if (scriptPattern.test(sanitized)) {
        warnings.push('Script tags removed');
        sanitized = sanitized.replace(scriptPattern, '');
        isValid = false;
      }
    }

    // Remove dangerous attributes
    const dangerousAttributes = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'];
    for (const attr of dangerousAttributes) {
      const pattern = new RegExp(`\\b${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      if (pattern.test(sanitized)) {
        warnings.push(`Dangerous attribute ${attr} removed`);
        sanitized = sanitized.replace(pattern, '');
        isValid = false;
      }
    }

    // Filter to allowed tags if specified
    if (config.allowedTags && config.allowedTags.length > 0) {
      const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
      const matches = sanitized.match(tagPattern) || [];
      
      for (const match of matches) {
        const tagName = match.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/)?.[1];
        if (tagName && !config.allowedTags.includes(tagName.toLowerCase())) {
          warnings.push(`Disallowed tag ${tagName} removed`);
          sanitized = sanitized.replace(match, '');
          isValid = false;
        }
      }
    }

    return {
      original: html,
      sanitized,
      isValid,
      warnings,
      appliedRules: ['HTML Sanitization']
    };
  }

  /**
   * Validate input without sanitizing
   * @param input The input to validate
   * @param config Optional validation configuration
   * @returns Validation result
   */
  static validate(input: string, config?: Partial<InputValidationConfig>): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const warnings: string[] = [];
    const errors: string[] = [];
    let isValid = true;

    // Check maximum length
    if (input.length > finalConfig.maxLength) {
      errors.push(`Input exceeds maximum length of ${finalConfig.maxLength} characters`);
      isValid = false;
    }

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        errors.push('Input contains dangerous patterns');
        isValid = false;
        break;
      }
    }

    // Check HTML content
    if (!finalConfig.allowHTML && /<[^>]*>/.test(input)) {
      warnings.push('Input contains HTML content which is not allowed');
    }

    // Check for script content
    if (!finalConfig.allowScripts && /<script/i.test(input)) {
      errors.push('Input contains script content which is not allowed');
      isValid = false;
    }

    return {
      isValid,
      warnings,
      errors
    };
  }

  /**
   * Sanitize URL for safe usage
   * @param url The URL to sanitize
   * @param allowedProtocols Optional list of allowed protocols
   * @returns Sanitized URL or null if unsafe
   */
  static sanitizeURL(url: string, allowedProtocols: string[] = ['https:', 'http:']): string | null {
    try {
      // Remove dangerous protocols
      const sanitized = url.replace(/(javascript|vbscript|data):/gi, '');
      
      // Parse URL
      const parsed = new URL(sanitized, 'http://example.com');
      
      // Check protocol
      if (!allowedProtocols.includes(parsed.protocol)) {
        return null;
      }

      // Check for dangerous characters
      if (/[<>"\s]/.test(sanitized)) {
        return null;
      }

      return sanitized;
    } catch (error) {
      return null;
    }
  }

  /**
   * Sanitize CSS for safe usage
   * @param css The CSS to sanitize
   * @returns Sanitized CSS
   */
  static sanitizeCSS(css: string): string {
    let sanitized = css;

    // Remove dangerous CSS
    const dangerousPatterns = [
      /expression\s*\(/gi,
      /javascript:/gi,
      /@import/gi,
      /binding\s*:/gi,
      /behavior\s*:/gi
    ];

    for (const pattern of dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Remove comments
    sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');

    return sanitized.trim();
  }

  /**
   * Sanitize JSON data
   * @param jsonString The JSON string to sanitize
   * @returns Sanitized JSON or null if invalid
   */
  static sanitizeJSON(jsonString: string): any | null {
    try {
      // Remove script tags and dangerous content
      const sanitized = jsonString
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '');

      // Parse and validate JSON
      const parsed = JSON.parse(sanitized);
      
      // Recursively sanitize object properties
      return this.sanitizeJSONObject(parsed);
    } catch (error) {
      return null;
    }
  }

  /**
   * Recursively sanitize JSON object
   * @param obj The object to sanitize
   * @returns Sanitized object
   */
  private static sanitizeJSONObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitize(obj).sanitized;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeJSONObject(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip potentially dangerous keys
        if (!/^(constructor|prototype|__proto__)$/.test(key)) {
          sanitized[key] = this.sanitizeJSONObject(value);
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Create custom sanitization rule
   * @param name Rule name
   * @param description Rule description
   * @param pattern Pattern to match
   * @param replacement Replacement string
   * @returns Custom sanitization rule
   */
  static createCustomRule(
    name: string,
    description: string,
    pattern: RegExp,
    replacement: string = ''
  ): SanitizationRule {
    return {
      name,
      description,
      sanitize: (input: string) => input.replace(pattern, replacement),
      validate: (input: string) => !pattern.test(input)
    };
  }

  /**
   * Get default sanitization rules
   * @returns Array of default rules
   */
  static getDefaultRules(): SanitizationRule[] {
    return [...this.SANITIZATION_RULES];
  }

  /**
   * Add custom sanitization rule
   * @param rule The custom rule to add
   */
  static addCustomRule(rule: SanitizationRule): void {
    this.SANITIZATION_RULES.push(rule);
  }

  /**
   * Remove sanitization rule by name
   * @param name Name of the rule to remove
   */
  static removeRule(name: string): void {
    const index = this.SANITIZATION_RULES.findIndex(rule => rule.name === name);
    if (index !== -1) {
      this.SANITIZATION_RULES.splice(index, 1);
    }
  }
}
