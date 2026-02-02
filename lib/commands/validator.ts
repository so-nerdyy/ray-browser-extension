/**
 * Command validation and security implementation
 */

import { 
  EnhancedParsedCommand,
  CommandParameters,
  CommandContext,
  SecurityValidation,
  CommandParsingError
} from './types';
import { AutomationCommand, RayError } from '../shared/contracts';

export class CommandValidator {
  private securityRules: SecurityRule[] = [];
  private validationRules: ValidationRule[] = [];
  private blockedDomains: Set<string> = new Set();
  private allowedSchemes: Set<string> = new Set(['https', 'http', 'file', 'data']);
  private maxCommandComplexity: number = 10;

  constructor() {
    this.initializeSecurityRules();
    this.initializeValidationRules();
    this.initializeBlockedDomains();
  }

  /**
   * Validate a parsed command
   */
  validateCommand(
    command: EnhancedParsedCommand,
    context: CommandContext = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const securityIssues: string[] = [];

    // Basic validation
    const basicValidation = this.validateBasicStructure(command);
    errors.push(...basicValidation.errors);
    warnings.push(...basicValidation.warnings);

    // Parameter validation
    const paramValidation = this.validateParameters(command.parameters, command.intent);
    errors.push(...paramValidation.errors);
    warnings.push(...paramValidation.warnings);

    // Security validation
    const securityValidation = this.validateSecurity(command, context);
    errors.push(...securityValidation.errors);
    warnings.push(...securityValidation.warnings);
    securityIssues.push(...securityValidation.securityIssues);

    // Context validation
    const contextValidation = this.validateContext(command, context);
    errors.push(...contextValidation.errors);
    warnings.push(...contextValidation.warnings);

    // Complexity validation
    const complexityValidation = this.validateComplexity(command);
    errors.push(...complexityValidation.errors);
    warnings.push(...complexityValidation.warnings);

    const isValid = errors.length === 0 && securityIssues.length === 0;
    const sanitizedCommand = this.sanitizeCommand(command);

    return {
      isValid,
      errors,
      warnings,
      securityIssues,
      sanitizedCommand,
      riskLevel: this.calculateRiskLevel(command, securityIssues),
      requiresConfirmation: this.requiresConfirmation(command, securityIssues),
    };
  }

  /**
   * Validate multiple commands
   */
  validateCommands(
    commands: EnhancedParsedCommand[],
    context: CommandContext = {}
  ): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const allSecurityIssues: string[] = [];
    const sanitizedCommands: EnhancedParsedCommand[] = [];

    // Validate individual commands
    for (const command of commands) {
      const result = this.validateCommand(command, context);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      allSecurityIssues.push(...result.securityIssues);
      
      if (result.sanitizedCommand) {
        sanitizedCommands.push(result.sanitizedCommand);
      }
    }

    // Validate command sequence
    const sequenceValidation = this.validateCommandSequence(commands);
    allErrors.push(...sequenceValidation.errors);
    allWarnings.push(...sequenceValidation.warnings);

    return {
      isValid: allErrors.length === 0 && allSecurityIssues.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      securityIssues: allSecurityIssues,
      sanitizedCommands,
      riskLevel: this.calculateSequenceRiskLevel(commands, allSecurityIssues),
      requiresConfirmation: allSecurityIssues.length > 0 || commands.some(cmd => this.requiresConfirmation(cmd, [])),
    };
  }

  /**
   * Validate automation command
   */
  validateAutomationCommand(
    command: AutomationCommand,
    context: CommandContext = {}
  ): SecurityValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const permissions: string[] = [];

    // Basic structure validation
    if (!command.id) {
      errors.push('Command ID is required');
    }

    if (!command.type) {
      errors.push('Command type is required');
    }

    // Type-specific validation
    switch (command.type) {
      case 'navigate':
        if (!command.url) {
          errors.push('URL is required for navigation commands');
        } else {
          const urlValidation = this.validateURL(command.url);
          errors.push(...urlValidation.errors);
          warnings.push(...urlValidation.warnings);
          permissions.push('navigation');
        }
        break;

      case 'click':
        if (!command.selector && !command.value) {
          warnings.push('Click command should have either selector or value');
        }
        permissions.push('dom_access');
        break;

      case 'fill':
        if (!command.selector) {
          errors.push('Selector is required for fill commands');
        }
        if (!command.value) {
          errors.push('Value is required for fill commands');
        }
        permissions.push('dom_access', 'form_interaction');
        break;

      case 'extract':
        permissions.push('dom_access', 'data_extraction');
        break;

      case 'submit':
        permissions.push('dom_access', 'form_interaction');
        break;
    }

    // Security validation
    const securityIssues = this.checkSecurityIssues(command);
    errors.push(...securityIssues);

    return {
      isValid: errors.length === 0,
      errors,
      permissions: [...new Set(permissions)],
      warnings,
    };
  }

  /**
   * Validate basic command structure
   */
  private validateBasicStructure(command: EnhancedParsedCommand): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!command.intent) {
      errors.push('Command intent is required');
    }

    if (!command.originalText) {
      errors.push('Original text is required');
    }

    if (typeof command.confidence !== 'number' || command.confidence < 0 || command.confidence > 1) {
      errors.push('Confidence must be a number between 0 and 1');
    }

    if (command.confidence < 0.3) {
      warnings.push('Low confidence command may not execute correctly');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate command parameters
   */
  private validateParameters(
    parameters: CommandParameters,
    intent: string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // URL validation
    if (parameters.url) {
      const urlValidation = this.validateURL(parameters.url);
      errors.push(...urlValidation.errors);
      warnings.push(...urlValidation.warnings);
    }

    // Selector validation
    if (parameters.selector) {
      const selectorValidation = this.validateSelector(parameters.selector);
      errors.push(...selectorValidation.errors);
      warnings.push(...selectorValidation.warnings);
    }

    // Duration validation
    if (parameters.duration !== undefined) {
      if (typeof parameters.duration !== 'number' || parameters.duration < 0) {
        errors.push('Duration must be a positive number');
      }
      if (parameters.duration > 60000) {
        warnings.push('Duration exceeds 1 minute, consider breaking into smaller steps');
      }
    }

    // Timeout validation
    if (parameters.timeout !== undefined) {
      if (typeof parameters.timeout !== 'number' || parameters.timeout < 0) {
        errors.push('Timeout must be a positive number');
      }
    }

    // Value validation for sensitive data
    if (parameters.value) {
      const sensitiveValidation = this.validateSensitiveData(parameters.value);
      warnings.push(...sensitiveValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate URL
   */
  private validateURL(url: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const parsedUrl = new URL(url);
      
      // Check scheme
      if (!this.allowedSchemes.has(parsedUrl.protocol.replace(':', ''))) {
        errors.push(`URL scheme ${parsedUrl.protocol} is not allowed`);
      }

      // Check for blocked domains
      const domain = parsedUrl.hostname;
      if (this.blockedDomains.has(domain)) {
        errors.push(`Domain ${domain} is blocked`);
      }

      // Check for suspicious patterns
      if (url.includes('javascript:') || url.includes('data:')) {
        errors.push('JavaScript and data URLs are not allowed');
      }

      // Security warnings
      if (parsedUrl.protocol === 'http:') {
        warnings.push('HTTP URLs are less secure than HTTPS');
      }

      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        warnings.push('Localhost URLs may not be accessible');
      }

    } catch (error) {
      errors.push('Invalid URL format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate CSS selector
   */
  private validateSelector(selector: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!selector || selector.trim() === '') {
      errors.push('Selector cannot be empty');
      return { isValid: false, errors, warnings };
    }

    // Check for potentially dangerous selectors
    if (selector.includes('javascript:') || selector.includes('data:')) {
      errors.push('Selector contains potentially dangerous content');
    }

    // Check for overly complex selectors
    if (selector.length > 500) {
      warnings.push('Selector is very long and may be inefficient');
    }

    // Check for XSS patterns
    const xssPatterns = ['<script', 'onerror', 'onload', 'javascript:'];
    for (const pattern of xssPatterns) {
      if (selector.toLowerCase().includes(pattern)) {
        errors.push(`Selector contains potentially dangerous pattern: ${pattern}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate sensitive data
   */
  private validateSensitiveData(value: string): ValidationResult {
    const warnings: string[] = [];

    // Check for patterns that might indicate sensitive data
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /credit.*card/i,
      /ssn/i,
      /social.*security/i,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(value)) {
        warnings.push('Value may contain sensitive information');
        break;
      }
    }

    return {
      isValid: true,
      errors: [],
      warnings,
    };
  }

  /**
   * Validate security aspects
   */
  private validateSecurity(
    command: EnhancedParsedCommand,
    context: CommandContext
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const securityIssues: string[] = [];

    // Apply security rules
    for (const rule of this.securityRules) {
      const result = rule.check(command, context);
      if (!result.passed) {
        if (result.severity === 'error') {
          errors.push(result.message);
          securityIssues.push(result.message);
        } else {
          warnings.push(result.message);
        }
      }
    }

    // Check intent-specific security
    const intentSecurity = this.checkIntentSecurity(command);
    errors.push(...intentSecurity.errors);
    warnings.push(...intentSecurity.warnings);
    securityIssues.push(...intentSecurity.securityIssues);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      securityIssues,
    };
  }

  /**
   * Validate context
   */
  private validateContext(
    command: EnhancedParsedCommand,
    context: CommandContext
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if command makes sense in current context
    if (context.currentUrl && command.intent === 'navigate') {
      try {
        const currentUrl = new URL(context.currentUrl);
        const targetUrl = command.parameters.url;
        
        if (targetUrl) {
          const target = new URL(targetUrl);
          if (currentUrl.href === target.href) {
            warnings.push('Navigating to the same URL');
          }
        }
      } catch {
        // URL parsing failed, already caught in URL validation
      }
    }

    // Check if required elements are available
    if (context.availableElements && command.parameters.selector) {
      const hasElement = context.availableElements.some(
        element => element.selector === command.parameters.selector
      );
      
      if (!hasElement) {
        warnings.push('Specified selector not found in available elements');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate command complexity
   */
  private validateComplexity(command: EnhancedParsedCommand): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

}
