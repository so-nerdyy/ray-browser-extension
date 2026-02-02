/**
 * Input Validation for Ray Chrome Extension
 * Handles comprehensive input validation and security checks
 */

export interface ValidationRule {
  name: string;
  description: string;
  validate: (input: any) => ValidationResult;
  required: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: any;
}

export interface InputValidationConfig {
  enableStrictValidation: boolean;
  enableSanitization: boolean;
  maxLength: number;
  allowedTypes: string[];
  customRules?: ValidationRule[];
}

export interface ValidationError {
  field?: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export class InputValidator {
  private static readonly DEFAULT_CONFIG: InputValidationConfig = {
    enableStrictValidation: true,
    enableSanitization: true,
    maxLength: 10000,
    allowedTypes: ['string', 'number', 'boolean', 'object']
  };

  private static readonly VALIDATION_RULES: ValidationRule[] = [
    {
      name: 'Type Validation',
      description: 'Validates input data type',
      validate: this.validateType.bind(this),
      required: true
    },
    {
      name: 'Length Validation',
      description: 'Validates input length',
      validate: this.validateLength.bind(this),
      required: true
    },
    {
      name: 'Pattern Validation',
      description: 'Validates input against security patterns',
      validate: this.validatePatterns.bind(this),
      required: true
    },
    {
      name: 'Encoding Validation',
      description: 'Validates character encoding',
      validate: this.validateEncoding.bind(this),
      required: true
    },
    {
      name: 'Injection Validation',
      description: 'Validates against injection attacks',
      validate: this.validateInjections.bind(this),
      required: true
    }
  ];

  private static readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
    /expression\s*\(/gi,
    /@import/gi,
    /binding\s*:/gi,
    /<!--[\s\S]*?-->/g,
    /<!\[CDATA\[[\s\S]*?\]\]>/g
  ];

  private static readonly INJECTION_PATTERNS = [
    { name: 'SQL Injection', pattern: /('|(\\')|(;)|(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi },
    { name: 'Command Injection', pattern: /[;&|`$(){}[\]]/g },
    { name: 'LDAP Injection', pattern: /[()=*|&|]/g },
    { name: 'XPath Injection', pattern: /['"](\bor\b|\band\b|\bdiv\b)[^'"]*['"]/gi },
    { name: 'NoSQL Injection', pattern: /(\$ne|\$gt|\$lt|\$where|\$regex)/g }
  ];

  /**
   * Validate input against all configured rules
   * @param input The input to validate
   * @param config Optional validation configuration
   * @returns Comprehensive validation result
   */
  static validate(input: any, config?: Partial<InputValidationConfig>): ValidationResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitized = input;

    // Check if input is null or undefined
    if (input === null || input === undefined) {
      return {
        isValid: false,
        errors: ['Input cannot be null or undefined'],
        warnings: []
      };
    }

    // Validate type
    if (!finalConfig.allowedTypes.includes(typeof input)) {
      errors.push(`Invalid input type: ${typeof input}. Allowed types: ${finalConfig.allowedTypes.join(', ')}`);
      return {
        isValid: false,
        errors,
        warnings
      };
    }

    // Apply validation rules
    const rules = [...this.VALIDATION_RULES, ...(finalConfig.customRules || [])];
    
    for (const rule of rules) {
      const result = rule.validate(input);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
      
      if (result.sanitized !== undefined) {
        sanitized = result.sanitized;
      }
    }

    // Additional sanitization if enabled
    if (finalConfig.enableSanitization && sanitized === input) {
      sanitized = this.sanitizeInput(input);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized
    };
  }

  /**
   * Validate string input specifically
   * @param input The string input to validate
   * @param config Optional validation configuration
   * @returns String-specific validation result
   */
  static validateString(input: string, config?: Partial<InputValidationConfig>): ValidationResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    if (typeof input !== 'string') {
      return {
        isValid: false,
        errors: ['Input must be a string'],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Length validation
    if (input.length > finalConfig.maxLength) {
      errors.push(`String exceeds maximum length of ${finalConfig.maxLength} characters`);
    }

    // Empty string validation
    if (input.length === 0) {
      warnings.push('Input string is empty');
    }

    // Dangerous pattern validation
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        errors.push('Input contains potentially dangerous content');
        break;
      }
    }

    // Character encoding validation
    if (!this.isValidEncoding(input)) {
      errors.push('Input contains invalid character encoding');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: finalConfig.enableSanitization ? this.sanitizeString(input) : input
    };
  }

  /**
   * Validate numeric input
   * @param input The numeric input to validate
   * @param min Minimum allowed value
   * @param max Maximum allowed value
   * @returns Numeric validation result
   */
  static validateNumber(input: number, min?: number, max?: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof input !== 'number' || isNaN(input)) {
      return {
        isValid: false,
        errors: ['Input must be a valid number'],
        warnings: []
      };
    }

    // Range validation
    if (min !== undefined && input < min) {
      errors.push(`Number ${input} is below minimum value of ${min}`);
    }

    if (max !== undefined && input > max) {
      errors.push(`Number ${input} is above maximum value of ${max}`);
    }

    // Infinity and NaN checks
    if (!isFinite(input)) {
      errors.push('Number must be finite');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate email address
   * @param email The email to validate
   * @returns Email validation result
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof email !== 'string') {
      return {
        isValid: false,
        errors: ['Email must be a string'],
        warnings: []
      };
    }

    // Basic email format validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      errors.push('Invalid email format');
    }

    // Length validation
    if (email.length > 254) {
      errors.push('Email address is too long (max 254 characters)');
    }

    // Dangerous content check
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(email)) {
        errors.push('Email contains potentially dangerous content');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: this.sanitizeString(email)
    };
  }

  /**
   * Validate URL
   * @param url The URL to validate
   * @param allowedProtocols Optional list of allowed protocols
   * @returns URL validation result
   */
  static validateURL(url: string, allowedProtocols: string[] = ['https:', 'http:']): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof url !== 'string') {
      return {
        isValid: false,
        errors: ['URL must be a string'],
        warnings: []
      };
    }

    try {
      const parsed = new URL(url);
      
      // Protocol validation
      if (!allowedProtocols.includes(parsed.protocol)) {
        errors.push(`URL protocol ${parsed.protocol} is not allowed`);
      }

      // Dangerous protocol check
      const dangerousProtocols = ['javascript:', 'vbscript:', 'data:'];
      if (dangerousProtocols.some(protocol => url.toLowerCase().startsWith(protocol))) {
        errors.push('URL contains dangerous protocol');
      }

      // Host validation
      if (!parsed.hostname) {
        errors.push('URL must have a valid hostname');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        sanitized: url
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Invalid URL format'],
        warnings: []
      };
    }
  }

  /**
   * Validate object input
   * @param obj The object to validate
   * @param schema Optional schema to validate against
   * @returns Object validation result
   */
  static validateObject(obj: any, schema?: Record<string, ValidationRule>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof obj !== 'object' || obj === null) {
      return {
        isValid: false,
        errors: ['Input must be an object'],
        warnings: []
      };
    }

    // Validate against schema if provided
    if (schema) {
      for (const [key, rule] of Object.entries(schema)) {
        if (!(key in obj)) {
          if (rule.required) {
            errors.push(`Required property '${key}' is missing`);
          }
        } else {
          const result = rule.validate(obj[key]);
          errors.push(...result.errors.map(e => `${key}: ${e}`));
          warnings.push(...result.warnings.map(w => `${key}: ${w}`));
        }
      }
    }

    // Check for prototype pollution
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    for (const key of Object.keys(obj)) {
      if (dangerousKeys.includes(key)) {
        errors.push(`Object contains dangerous property: ${key}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: obj
    };
  }

  /**
   * Validate input type
   * @param input The input to validate
   * @returns Type validation result
   */
  private static validateType(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const inputType = typeof input;
    
    // Check for dangerous types
    if (inputType === 'function') {
      errors.push('Function type is not allowed as input');
    }

    if (inputType === 'symbol') {
      errors.push('Symbol type is not allowed as input');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate input length
   * @param input The input to validate
   * @returns Length validation result
   */
  private static validateLength(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof input === 'string') {
      if (input.length > this.DEFAULT_CONFIG.maxLength) {
        errors.push(`Input exceeds maximum length of ${this.DEFAULT_CONFIG.maxLength} characters`);
      }
    }

    if (Array.isArray(input)) {
      if (input.length > 1000) {
        warnings.push('Array input is very large, consider pagination');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate against dangerous patterns
   * @param input The input to validate
   * @returns Pattern validation result
   */
  private static validatePatterns(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof input === 'string') {
      for (const pattern of this.DANGEROUS_PATTERNS) {
        if (pattern.test(input)) {
          errors.push('Input contains potentially dangerous patterns');
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate character encoding
   * @param input The input to validate
   * @returns Encoding validation result
   */
  private static validateEncoding(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof input === 'string') {
      // Check for invalid UTF-8 sequences
      try {
        const encoded = new TextEncoder().encode(input);
        const decoded = new TextDecoder().decode(encoded);
        if (decoded !== input) {
          errors.push('Input contains invalid character encoding');
        }
      } catch (error) {
        errors.push('Input encoding validation failed');
      }

      // Check for control characters
      if (/[\x00-\x1F\x7F]/.test(input)) {
        warnings.push('Input contains control characters');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate against injection attacks
   * @param input The input to validate
   * @returns Injection validation result
   */
  private static validateInjections(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof input === 'string') {
      for (const injection of this.INJECTION_PATTERNS) {
        if (injection.pattern.test(input)) {
          errors.push(`Input may contain ${injection.name} attempt`);
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if string has valid encoding
   * @param str The string to check
   * @returns True if encoding is valid
   */
  private static isValidEncoding(str: string): boolean {
    try {
      // Try to encode and decode to check for invalid sequences
      const encoded = new TextEncoder().encode(str);
      new TextDecoder().decode(encoded);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sanitize input string
   * @param input The string to sanitize
   * @returns Sanitized string
   */
  private static sanitizeString(input: string): string {
    let sanitized = input;

    // Remove dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Sanitize input based on type
   * @param input The input to sanitize
   * @returns Sanitized input
   */
  private static sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return this.sanitizeString(input);
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        // Skip dangerous keys
        if (!['__proto__', 'constructor', 'prototype'].includes(key)) {
          sanitized[key] = this.sanitizeInput(value);
        }
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Create custom validation rule
   * @param name Rule name
   * @param description Rule description
   * @param validator Validation function
   * @param required Whether rule is required
   * @returns Custom validation rule
   */
  static createCustomRule(
    name: string,
    description: string,
    validator: (input: any) => ValidationResult,
    required: boolean = false
  ): ValidationRule {
    return {
      name,
      description,
      validate: validator,
      required
    };
  }

  /**
   * Add custom validation rule
   * @param rule The custom rule to add
   */
  static addCustomRule(rule: ValidationRule): void {
    this.VALIDATION_RULES.push(rule);
  }

  /**
   * Remove validation rule by name
   * @param name Name of the rule to remove
   */
  static removeRule(name: string): void {
    const index = this.VALIDATION_RULES.findIndex(rule => rule.name === name);
    if (index !== -1) {
      this.VALIDATION_RULES.splice(index, 1);
    }
  }

  /**
   * Get all validation rules
   * @returns Array of validation rules
   */
  static getValidationRules(): ValidationRule[] {
    return [...this.VALIDATION_RULES];
  }

  /**
   * Validate batch of inputs
   * @param inputs Object with inputs to validate
   * @param config Optional validation configuration
   * @returns Batch validation result
   */
  static validateBatch(
    inputs: Record<string, any>,
    config?: Partial<InputValidationConfig>
  ): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};

    for (const [key, value] of Object.entries(inputs)) {
      results[key] = this.validate(value, config);
    }

    return results;
  }

  /**
   * Generate validation report
   * @param results Validation results to analyze
   * @returns Validation report
   */
  static generateReport(results: Record<string, ValidationResult>): {
    summary: {
      totalInputs: number;
      validInputs: number;
      invalidInputs: number;
      totalErrors: number;
      totalWarnings: number;
    };
    details: Array<{
      field: string;
      isValid: boolean;
      errors: string[];
      warnings: string[];
    }>;
    recommendations: string[];
    generatedAt: number;
  } {
    const entries = Object.entries(results);
    const validInputs = entries.filter(([_, result]) => result.isValid).length;
    const totalErrors = entries.reduce((sum, [_, result]) => sum + result.errors.length, 0);
    const totalWarnings = entries.reduce((sum, [_, result]) => sum + result.warnings.length, 0);

    const recommendations: string[] = [];
    
    if (totalErrors > 0) {
      recommendations.push('Fix validation errors before processing inputs');
    }

    if (totalWarnings > 0) {
      recommendations.push('Review validation warnings for potential improvements');
    }

    return {
      summary: {
        totalInputs: entries.length,
        validInputs,
        invalidInputs: entries.length - validInputs,
        totalErrors,
        totalWarnings
      },
      details: entries.map(([field, result]) => ({
        field,
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings
      })),
      recommendations,
      generatedAt: Date.now()
    };
  }
} * Input Validation for Ray Chrome Extension
 * Handles comprehensive input validation and security checks
 */

export interface ValidationRule {
  name: string;
  description: string;
  validate: (input: any) => ValidationResult;
  required: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: any;
}

export interface InputValidationConfig {
  enableStrictValidation: boolean;
  enableSanitization: boolean;
  maxLength: number;
  allowedTypes: string[];
  customRules?: ValidationRule[];
}

export interface ValidationError {
  field?: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export class InputValidator {
  private static readonly DEFAULT_CONFIG: InputValidationConfig = {
    enableStrictValidation: true,
    enableSanitization: true,
    maxLength: 10000,
    allowedTypes: ['string', 'number', 'boolean', 'object']
  };

  private static readonly VALIDATION_RULES: ValidationRule[] = [
    {
      name: 'Type Validation',
      description: 'Validates input data type',
      validate: this.validateType.bind(this),
      required: true
    },
    {
      name: 'Length Validation',
      description: 'Validates input length',
      validate: this.validateLength.bind(this),
      required: true
    },
    {
      name: 'Pattern Validation',
      description: 'Validates input against security patterns',
      validate: this.validatePatterns.bind(this),
      required: true
    },
    {
      name: 'Encoding Validation',
      description: 'Validates character encoding',
      validate: this.validateEncoding.bind(this),
      required: true
    },
    {
      name: 'Injection Validation',
      description: 'Validates against injection attacks',
      validate: this.validateInjections.bind(this),
      required: true
    }
  ];

  private static readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
    /expression\s*\(/gi,
    /@import/gi,
    /binding\s*:/gi,
    /<!--[\s\S]*?-->/g,
    /<!\[CDATA\[[\s\S]*?\]\]>/g
  ];

  private static readonly INJECTION_PATTERNS = [
    { name: 'SQL Injection', pattern: /('|(\\')|(;)|(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi },
    { name: 'Command Injection', pattern: /[;&|`$(){}[\]]/g },
    { name: 'LDAP Injection', pattern: /[()=*|&|]/g },
    { name: 'XPath Injection', pattern: /['"](\bor\b|\band\b|\bdiv\b)[^'"]*['"]/gi },
    { name: 'NoSQL Injection', pattern: /(\$ne|\$gt|\$lt|\$where|\$regex)/g }
  ];

  /**
   * Validate input against all configured rules
   * @param input The input to validate
   * @param config Optional validation configuration
   * @returns Comprehensive validation result
   */
  static validate(input: any, config?: Partial<InputValidationConfig>): ValidationResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitized = input;

    // Check if input is null or undefined
    if (input === null || input === undefined) {
      return {
        isValid: false,
        errors: ['Input cannot be null or undefined'],
        warnings: []
      };
    }

    // Validate type
    if (!finalConfig.allowedTypes.includes(typeof input)) {
      errors.push(`Invalid input type: ${typeof input}. Allowed types: ${finalConfig.allowedTypes.join(', ')}`);
      return {
        isValid: false,
        errors,
        warnings
      };
    }

    // Apply validation rules
    const rules = [...this.VALIDATION_RULES, ...(finalConfig.customRules || [])];
    
    for (const rule of rules) {
      const result = rule.validate(input);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
      
      if (result.sanitized !== undefined) {
        sanitized = result.sanitized;
      }
    }

    // Additional sanitization if enabled
    if (finalConfig.enableSanitization && sanitized === input) {
      sanitized = this.sanitizeInput(input);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized
    };
  }

  /**
   * Validate string input specifically
   * @param input The string input to validate
   * @param config Optional validation configuration
   * @returns String-specific validation result
   */
  static validateString(input: string, config?: Partial<InputValidationConfig>): ValidationResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    if (typeof input !== 'string') {
      return {
        isValid: false,
        errors: ['Input must be a string'],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Length validation
    if (input.length > finalConfig.maxLength) {
      errors.push(`String exceeds maximum length of ${finalConfig.maxLength} characters`);
    }

    // Empty string validation
    if (input.length === 0) {
      warnings.push('Input string is empty');
    }

    // Dangerous pattern validation
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        errors.push('Input contains potentially dangerous content');
        break;
      }
    }

    // Character encoding validation
    if (!this.isValidEncoding(input)) {
      errors.push('Input contains invalid character encoding');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: finalConfig.enableSanitization ? this.sanitizeString(input) : input
    };
  }

  /**
   * Validate numeric input
   * @param input The numeric input to validate
   * @param min Minimum allowed value
   * @param max Maximum allowed value
   * @returns Numeric validation result
   */
  static validateNumber(input: number, min?: number, max?: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof input !== 'number' || isNaN(input)) {
      return {
        isValid: false,
        errors: ['Input must be a valid number'],
        warnings: []
      };
    }

    // Range validation
    if (min !== undefined && input < min) {
      errors.push(`Number ${input} is below minimum value of ${min}`);
    }

    if (max !== undefined && input > max) {
      errors.push(`Number ${input} is above maximum value of ${max}`);
    }

    // Infinity and NaN checks
    if (!isFinite(input)) {
      errors.push('Number must be finite');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate email address
   * @param email The email to validate
   * @returns Email validation result
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof email !== 'string') {
      return {
        isValid: false,
        errors: ['Email must be a string'],
        warnings: []
      };
    }

    // Basic email format validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      errors.push('Invalid email format');
    }

    // Length validation
    if (email.length > 254) {
      errors.push('Email address is too long (max 254 characters)');
    }

    // Dangerous content check
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(email)) {
        errors.push('Email contains potentially dangerous content');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: this.sanitizeString(email)
    };
  }

  /**
   * Validate URL
   * @param url The URL to validate
   * @param allowedProtocols Optional list of allowed protocols
   * @returns URL validation result
   */
  static validateURL(url: string, allowedProtocols: string[] = ['https:', 'http:']): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof url !== 'string') {
      return {
        isValid: false,
        errors: ['URL must be a string'],
        warnings: []
      };
    }

    try {
      const parsed = new URL(url);
      
      // Protocol validation
      if (!allowedProtocols.includes(parsed.protocol)) {
        errors.push(`URL protocol ${parsed.protocol} is not allowed`);
      }

      // Dangerous protocol check
      const dangerousProtocols = ['javascript:', 'vbscript:', 'data:'];
      if (dangerousProtocols.some(protocol => url.toLowerCase().startsWith(protocol))) {
        errors.push('URL contains dangerous protocol');
      }

      // Host validation
      if (!parsed.hostname) {
        errors.push('URL must have a valid hostname');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        sanitized: url
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Invalid URL format'],
        warnings: []
      };
    }
  }

  /**
   * Validate object input
   * @param obj The object to validate
   * @param schema Optional schema to validate against
   * @returns Object validation result
   */
  static validateObject(obj: any, schema?: Record<string, ValidationRule>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof obj !== 'object' || obj === null) {
      return {
        isValid: false,
        errors: ['Input must be an object'],
        warnings: []
      };
    }

    // Validate against schema if provided
    if (schema) {
      for (const [key, rule] of Object.entries(schema)) {
        if (!(key in obj)) {
          if (rule.required) {
            errors.push(`Required property '${key}' is missing`);
          }
        } else {
          const result = rule.validate(obj[key]);
          errors.push(...result.errors.map(e => `${key}: ${e}`));
          warnings.push(...result.warnings.map(w => `${key}: ${w}`));
        }
      }
    }

    // Check for prototype pollution
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    for (const key of Object.keys(obj)) {
      if (dangerousKeys.includes(key)) {
        errors.push(`Object contains dangerous property: ${key}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: obj
    };
  }

  /**
   * Validate input type
   * @param input The input to validate
   * @returns Type validation result
   */
  private static validateType(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const inputType = typeof input;
    
    // Check for dangerous types
    if (inputType === 'function') {
      errors.push('Function type is not allowed as input');
    }

    if (inputType === 'symbol') {
      errors.push('Symbol type is not allowed as input');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate input length
   * @param input The input to validate
   * @returns Length validation result
   */
  private static validateLength(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof input === 'string') {
      if (input.length > this.DEFAULT_CONFIG.maxLength) {
        errors.push(`Input exceeds maximum length of ${this.DEFAULT_CONFIG.maxLength} characters`);
      }
    }

    if (Array.isArray(input)) {
      if (input.length > 1000) {
        warnings.push('Array input is very large, consider pagination');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate against dangerous patterns
   * @param input The input to validate
   * @returns Pattern validation result
   */
  private static validatePatterns(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof input === 'string') {
      for (const pattern of this.DANGEROUS_PATTERNS) {
        if (pattern.test(input)) {
          errors.push('Input contains potentially dangerous patterns');
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate character encoding
   * @param input The input to validate
   * @returns Encoding validation result
   */
  private static validateEncoding(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof input === 'string') {
      // Check for invalid UTF-8 sequences
      try {
        const encoded = new TextEncoder().encode(input);
        const decoded = new TextDecoder().decode(encoded);
        if (decoded !== input) {
          errors.push('Input contains invalid character encoding');
        }
      } catch (error) {
        errors.push('Input encoding validation failed');
      }

      // Check for control characters
      if (/[\x00-\x1F\x7F]/.test(input)) {
        warnings.push('Input contains control characters');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate against injection attacks
   * @param input The input to validate
   * @returns Injection validation result
   */
  private static validateInjections(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof input === 'string') {
      for (const injection of this.INJECTION_PATTERNS) {
        if (injection.pattern.test(input)) {
          errors.push(`Input may contain ${injection.name} attempt`);
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if string has valid encoding
   * @param str The string to check
   * @returns True if encoding is valid
   */
  private static isValidEncoding(str: string): boolean {
    try {
      // Try to encode and decode to check for invalid sequences
      const encoded = new TextEncoder().encode(str);
      new TextDecoder().decode(encoded);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sanitize input string
   * @param input The string to sanitize
   * @returns Sanitized string
   */
  private static sanitizeString(input: string): string {
    let sanitized = input;

    // Remove dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Sanitize input based on type
   * @param input The input to sanitize
   * @returns Sanitized input
   */
  private static sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return this.sanitizeString(input);
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        // Skip dangerous keys
        if (!['__proto__', 'constructor', 'prototype'].includes(key)) {
          sanitized[key] = this.sanitizeInput(value);
        }
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Create custom validation rule
   * @param name Rule name
   * @param description Rule description
   * @param validator Validation function
   * @param required Whether rule is required
   * @returns Custom validation rule
   */
  static createCustomRule(
    name: string,
    description: string,
    validator: (input: any) => ValidationResult,
    required: boolean = false
  ): ValidationRule {
    return {
      name,
      description,
      validate: validator,
      required
    };
  }

  /**
   * Add custom validation rule
   * @param rule The custom rule to add
   */
  static addCustomRule(rule: ValidationRule): void {
    this.VALIDATION_RULES.push(rule);
  }

  /**
   * Remove validation rule by name
   * @param name Name of the rule to remove
   */
  static removeRule(name: string): void {
    const index = this.VALIDATION_RULES.findIndex(rule => rule.name === name);
    if (index !== -1) {
      this.VALIDATION_RULES.splice(index, 1);
    }
  }

  /**
   * Get all validation rules
   * @returns Array of validation rules
   */
  static getValidationRules(): ValidationRule[] {
    return [...this.VALIDATION_RULES];
  }

  /**
   * Validate batch of inputs
   * @param inputs Object with inputs to validate
   * @param config Optional validation configuration
   * @returns Batch validation result
   */
  static validateBatch(
    inputs: Record<string, any>,
    config?: Partial<InputValidationConfig>
  ): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};

    for (const [key, value] of Object.entries(inputs)) {
      results[key] = this.validate(value, config);
    }

    return results;
  }

  /**
   * Generate validation report
   * @param results Validation results to analyze
   * @returns Validation report
   */
  static generateReport(results: Record<string, ValidationResult>): {
    summary: {
      totalInputs: number;
      validInputs: number;
      invalidInputs: number;
      totalErrors: number;
      totalWarnings: number;
    };
    details: Array<{
      field: string;
      isValid: boolean;
      errors: string[];
      warnings: string[];
    }>;
    recommendations: string[];
    generatedAt: number;
  } {
    const entries = Object.entries(results);
    const validInputs = entries.filter(([_, result]) => result.isValid).length;
    const totalErrors = entries.reduce((sum, [_, result]) => sum + result.errors.length, 0);
    const totalWarnings = entries.reduce((sum, [_, result]) => sum + result.warnings.length, 0);

    const recommendations: string[] = [];
    
    if (totalErrors > 0) {
      recommendations.push('Fix validation errors before processing inputs');
    }

    if (totalWarnings > 0) {
      recommendations.push('Review validation warnings for potential improvements');
    }

    return {
      summary: {
        totalInputs: entries.length,
        validInputs,
        invalidInputs: entries.length - validInputs,
        totalErrors,
        totalWarnings
      },
      details: entries.map(([field, result]) => ({
        field,
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings
      })),
      recommendations,
      generatedAt: Date.now()
    };
  }
}
