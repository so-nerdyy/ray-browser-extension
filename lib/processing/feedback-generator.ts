/**
 * Feedback generator for creating user-friendly feedback messages
 */

import { 
  UIStatus, 
  AutomationCommand,
  RayError
} from '../shared/contracts';
import { 
  EnhancedParsedCommand,
  CommandSummary,
  ResponseSummary
} from './response-processor';

export interface FeedbackGeneratorConfig {
  enableEmoji: boolean;
  enableAnimations: boolean;
  enableSuggestions: boolean;
  enableProgressIndicators: boolean;
  language: 'en' | 'es' | 'fr' | 'auto';
  detailLevel: 'brief' | 'normal' | 'detailed';
}

export interface UserFeedback {
  id: string;
  type: 'status' | 'success' | 'error' | 'warning' | 'info' | 'suggestion';
  title: string;
  message: string;
  details?: any;
  actions?: FeedbackAction[];
  metadata: FeedbackMetadata;
  timestamp: number;
}

export interface FeedbackAction {
  id: string;
  type: 'primary' | 'secondary' | 'link' | 'input';
  label: string;
  action?: string;
  url?: string;
  icon?: string;
  style?: FeedbackActionStyle;
}

export interface FeedbackActionStyle {
  variant: 'contained' | 'outlined' | 'text';
  color: string;
  backgroundColor?: string;
}

export interface FeedbackMetadata {
  category: 'parsing' | 'validation' | 'execution' | 'error' | 'general';
  priority: 'low' | 'normal' | 'high' | 'critical';
  confidence: number;
  context: any;
  suggestions: string[];
  learnMore?: {
    url: string;
    text: string;
  };
}

export class FeedbackGenerator {
  private config: FeedbackGeneratorConfig;
  private templates: Map<string, FeedbackTemplate> = new Map();
  private suggestions: Map<string, SuggestionGenerator> = new Map();

  constructor(config: Partial<FeedbackGeneratorConfig> = {}) {
    this.config = {
      enableEmoji: true,
      enableAnimations: true,
      enableSuggestions: true,
      enableProgressIndicators: true,
      language: 'en',
      detailLevel: 'normal',
      ...config,
    };

    this.initializeTemplates();
    this.initializeSuggestions();
  }

  /**
   * Generate feedback from status
   */
  generateFromStatus(status: UIStatus, context?: any): UserFeedback {
    const template = this.templates.get('status');
    if (!template) {
      throw new Error('Status template not found');
    }

    return template.generate({
      status,
      context,
      config: this.config,
    });
  }

  /**
   * Generate feedback from command results
   */
  generateFromCommandResults(
    commands: AutomationCommand[],
    results: any[],
    summary: ResponseSummary,
    context?: any
  ): UserFeedback {
    const template = this.templates.get('command_results');
    if (!template) {
      throw new Error('Command results template not found');
    }

    return template.generate({
      commands,
      results,
      summary,
      context,
      config: this.config,
    });
  }

  /**
   * Generate feedback from error
   */
  generateFromError(error: RayError, context?: any): UserFeedback {
    const template = this.templates.get('error');
    if (!template) {
      throw new Error('Error template not found');
    }

    return template.generate({
      error,
      context,
      config: this.config,
    });
  }

  /**
   * Generate feedback from parsing result
   */
  generateFromParsingResult(
    result: any,
    context?: any
  ): UserFeedback {
    const template = this.templates.get('parsing');
    if (!template) {
      throw new Error('Parsing template not found');
    }

    return template.generate({
      result,
      context,
      config: this.config,
    });
  }

  /**
   * Generate feedback from validation result
   */
  generateFromValidationResult(
    result: any,
    context?: any
  ): UserFeedback {
    const template = this.templates.get('validation');
    if (!template) {
      throw new Error('Validation template not found');
    }

    return template.generate({
      result,
      context,
      config: this.config,
    });
  }

  /**
   * Generate suggestion feedback
   */
  generateSuggestion(
    type: 'clarification' | 'alternative' | 'improvement' | 'help',
    message: string,
    context?: any
  ): UserFeedback {
    const template = this.templates.get('suggestion');
    if (!template) {
      throw new Error('Suggestion template not found');
    }

    return template.generate({
      type,
      message,
      context,
      config: this.config,
    });
  }

  /**
   * Generate progress feedback
   */
  generateProgress(
    current: number,
    total: number,
    currentStep?: string,
    context?: any
  ): UserFeedback {
    const template = this.templates.get('progress');
    if (!template) {
      throw new Error('Progress template not found');
    }

    return template.generate({
      current,
      total,
      currentStep,
      context,
      config: this.config,
    });
  }

  /**
   * Initialize feedback templates
   */
  private initializeTemplates(): void {
    this.templates.set('status', new StatusFeedbackTemplate());
    this.templates.set('command_results', new CommandResultsFeedbackTemplate());
    this.templates.set('error', new ErrorFeedbackTemplate());
    this.templates.set('parsing', new ParsingFeedbackTemplate());
    this.templates.set('validation', new ValidationFeedbackTemplate());
    this.templates.set('suggestion', new SuggestionFeedbackTemplate());
    this.templates.set('progress', new ProgressFeedbackTemplate());
  }

  /**
   * Initialize suggestion generators
   */
  private initializeSuggestions(): void {
    this.suggestions.set('clarification', new ClarificationSuggestionGenerator());
    this.suggestions.set('alternative', new AlternativeSuggestionGenerator());
    this.suggestions.set('improvement', new ImprovementSuggestionGenerator());
    this.suggestions.set('help', new HelpSuggestionGenerator());
  }

  /**
   * Get localized text
   */
  private getLocalizedText(key: string, fallback: string): string {
    const translations: Record<string, Record<string, string>> = {
      en: {
        processing: 'Processing...',
        success: 'Success!',
        error: 'Error',
        warning: 'Warning',
        info: 'Information',
        command_executed: 'Command executed',
        commands_executed: 'Commands executed',
        execution_failed: 'Execution failed',
        parsing_failed: 'Parsing failed',
        validation_failed: 'Validation failed',
        needs_clarification: 'Needs clarification',
        try_again: 'Try again',
        learn_more: 'Learn more',
        retry: 'Retry',
        cancel: 'Cancel',
        view_details: 'View details',
        close: 'Close',
      },
      es: {
        processing: 'Procesando...',
        success: '¡Éxito!',
        error: 'Error',
        warning: 'Advertencia',
        info: 'Información',
        command_executed: 'Comando ejecutado',
        commands_executed: 'Comandos ejecutados',
        execution_failed: 'La ejecución falló',
        parsing_failed: 'El análisis falló',
        validation_failed: 'La validación falló',
        needs_clarification: 'Necesita aclaración',
        try_again: 'Intentar de nuevo',
        learn_more: 'Aprender más',
        retry: 'Reintentar',
        cancel: 'Cancelar',
        view_details: 'Ver detalles',
        close: 'Cerrar',
      },
      fr: {
        processing: 'Traitement en cours...',
        success: 'Succès!',
        error: 'Erreur',
        warning: 'Avertissement',
        info: 'Information',
        command_executed: 'Commande exécutée',
        commands_executed: 'Commandes exécutées',
        execution_failed: 'L\'exécution a échoué',
        parsing_failed: 'L\'analyse a échoué',
        validation_failed: 'La validation a échoué',
        needs_clarification: 'Nécessite une clarification',
        try_again: 'Réessayer',
        learn_more: 'En savoir plus',
        retry: 'Réessayer',
        cancel: 'Annuler',
        view_details: 'Voir les détails',
        close: 'Fermer',
      },
    };

    const lang = this.config.language === 'auto' ? 'en' : this.config.language;
    const langTranslations = translations[lang] || translations.en;
    return langTranslations[key] || fallback;
  }

  /**
   * Get emoji for status
   */
  private getEmoji(status: string): string {
    if (!this.config.enableEmoji) {
      return '';
    }

    const emojis: Record<string, string> = {
      processing: '⏳',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      progress: '🔄',
      help: '💡',
      suggestion: '💭',
    };

    return emojis[status] || '';
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FeedbackGeneratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Template interface
export interface FeedbackTemplate {
  generate(data: any): UserFeedback;
}

// Status feedback template
class StatusFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { status, context, config } = data;
    
    const localizedText = this.getLocalizedText(status.status, status.status);
    const emoji = this.getEmoji(status.status);
    
    return {
      id: this.generateId(),
      type: 'status',
      title: localizedText,
      message: status.message || localizedText,
      details: {
        progress: status.progress,
        currentStep: status.currentStep,
        totalSteps: status.totalSteps,
      },
      actions: this.createStatusActions(status),
      metadata: {
        category: 'general',
        priority: 'normal',
        confidence: 1,
        context,
        suggestions: [],
      },
      timestamp: Date.now(),
    };
  }

  private getLocalizedText(key: string, fallback: string): string {
    // This would use the same localization logic as FeedbackGenerator
    const translations: Record<string, string> = {
      processing: 'Processing...',
      success: 'Success!',
      error: 'Error',
      warning: 'Warning',
      info: 'Information',
    };
    return translations[key] || fallback;
  }

  private getEmoji(status: string): string {
    const emojis: Record<string, string> = {
      processing: '⏳',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };
    return emojis[status] || '';
  }

  private createStatusActions(status: UIStatus): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    if (status.status === 'error') {
      actions.push({
        id: 'retry',
        type: 'primary',
        label: 'Retry',
        action: 'retry',
        icon: '🔄',
        style: { variant: 'contained', color: '#007bff' },
      });
    }
    
    if (status.status === 'processing') {
      actions.push({
        id: 'cancel',
        type: 'secondary',
        label: 'Cancel',
        action: 'cancel',
        icon: '❌',
        style: { variant: 'outlined', color: '#dc3545' },
      });
    }
    
    return actions;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Command results feedback template
class CommandResultsFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { commands, results, summary, context, config } = data;
    
    const successCount = results.filter(r => r && r.success !== false).length;
    const totalCount = commands.length;
    const allSuccess = successCount === totalCount;
    
    return {
      id: this.generateId(),
      type: allSuccess ? 'success' : 'warning',
      title: allSuccess ? 'Commands Completed' : 'Partial Success',
      message: summary.description,
      details: {
        summary,
        commands: commands.map((cmd, index) => ({
          command: cmd,
          result: results[index],
          success: results[index]?.success !== false,
        })),
      },
      actions: this.createCommandActions(commands, results, allSuccess),
      metadata: {
        category: 'execution',
        priority: allSuccess ? 'normal' : 'high',
        confidence: summary.confidence,
        context,
        suggestions: this.generateSuggestions(commands, results),
      },
      timestamp: Date.now(),
    };
  }

  private createCommandActions(commands: any[], results: any[], allSuccess: boolean): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    if (!allSuccess) {
      actions.push({
        id: 'retry_failed',
        type: 'primary',
        label: 'Retry Failed Commands',
        action: 'retry',
        icon: '🔄',
        style: { variant: 'contained', color: '#007bff' },
      });
    }
    
    actions.push({
      id: 'view_details',
      type: 'secondary',
      label: 'View Details',
      action: 'show_details',
      icon: '📋',
      style: { variant: 'outlined', color: '#6c757d' },
    });
    
    return actions;
  }

  private generateSuggestions(commands: any[], results: any[]): string[] {
    const suggestions: string[] = [];
    
    const failedCommands = commands.filter((cmd, index) => 
      results[index] && results[index].success === false
    );
    
    if (failedCommands.length > 0) {
      suggestions.push('Check command syntax and try again');
      suggestions.push('Ensure page elements are available');
    }
    
    if (failedCommands.some(cmd => cmd.type === 'navigate')) {
      suggestions.push('Verify URLs are accessible');
    }
    
    if (failedCommands.some(cmd => cmd.type === 'fill')) {
      suggestions.push('Check form field selectors');
    }
    
    return suggestions;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Error feedback template
class ErrorFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { error, context, config } = data;
    
    return {
      id: this.generateId(),
      type: 'error',
      title: 'Error',
      message: error.message,
      details: {
        code: error.code,
        timestamp: error.timestamp,
        stack: error.stack,
      },
      actions: this.createErrorActions(error),
      metadata: {
        category: 'error',
        priority: 'high',
        confidence: 0,
        context,
        suggestions: this.generateErrorSuggestions(error),
        learnMore: {
          url: this.getHelpUrl(error.code),
          text: 'Get help with this error',
        },
      },
      timestamp: Date.now(),
    };
  }

  private createErrorActions(error: any): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    actions.push({
      id: 'retry',
      type: 'primary',
      label: 'Try Again',
      action: 'retry',
      icon: '🔄',
      style: { variant: 'contained', color: '#007bff' },
    });
    
    actions.push({
      id: 'report',
      type: 'secondary',
      label: 'Report Issue',
      action: 'report',
      url: 'https://github.com/ray-extension/issues',
      icon: '🐛',
      style: { variant: 'outlined', color: '#6c757d' },
    });
    
    return actions;
  }

  private generateErrorSuggestions(error: any): string[] {
    const suggestions: string[] = [];
    
    switch (error.code) {
      case 'NETWORK_ERROR':
        suggestions.push('Check your internet connection');
        suggestions.push('Try again in a few moments');
        break;
      case 'API_ERROR':
        suggestions.push('Verify API key is valid');
        suggestions.push('Check API service status');
        break;
      case 'VALIDATION_ERROR':
        suggestions.push('Review command syntax');
        suggestions.push('Check required parameters');
        break;
      case 'TIMEOUT':
        suggestions.push('Try again with a longer timeout');
        suggestions.push('Check if page is responsive');
        break;
      default:
        suggestions.push('Try rephrasing your command');
        suggestions.push('Check extension permissions');
    }
    
    return suggestions;
  }

  private getHelpUrl(errorCode: string): string {
    const baseUrl = 'https://ray-extension.com/help/errors/';
    return `${baseUrl}${errorCode}`;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Parsing feedback template
class ParsingFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { result, context, config } = data;
    
    const needsClarification = result.requiresClarification || result.confidence < 0.5;
    
    return {
      id: this.generateId(),
      type: needsClarification ? 'warning' : 'info',
      title: needsClarification ? 'Needs Clarification' : 'Parsing Complete',
      message: needsClarification ? 
        result.clarificationQuestion || 'Please provide more details' : 
        'Command parsed successfully',
      details: {
        confidence: result.confidence,
        commands: result.commands,
        warnings: result.warnings,
      },
      actions: this.createParsingActions(result, needsClarification),
      metadata: {
        category: 'parsing',
        priority: needsClarification ? 'high' : 'normal',
        confidence: result.confidence,
        context,
        suggestions: this.generateParsingSuggestions(result),
      },
      timestamp: Date.now(),
    };
  }

  private createParsingActions(result: any, needsClarification: boolean): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    if (needsClarification) {
      actions.push({
        id: 'clarify',
        type: 'primary',
        label: 'Provide More Details',
        action: 'clarify',
        icon: '💬',
        style: { variant: 'contained', color: '#007bff' },
      });
    }
    
    if (result.commands && result.commands.length > 0) {
      actions.push({
        id: 'execute_anyway',
        type: 'secondary',
        label: 'Execute Anyway',
        action: 'execute',
        icon: '⚡',
        style: { variant: 'outlined', color: '#6c757d' },
      });
    }
    
    return actions;
  }

  private generateParsingSuggestions(result: any): string[] {
    const suggestions: string[] = [];
    
    if (result.confidence < 0.5) {
      suggestions.push('Be more specific in your command');
      suggestions.push('Include relevant details like URLs or selectors');
    }
    
    if (result.warnings && result.warnings.length > 0) {
      suggestions.push('Address the warnings shown above');
    }
    
    return suggestions;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Validation feedback template
class ValidationFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { result, context, config } = data;
    
    return {
      id: this.generateId(),
      type: result.isValid ? 'success' : 'error',
      title: result.isValid ? 'Validation Passed' : 'Validation Failed',
      message: result.isValid ? 
        'Commands are valid and ready to execute' : 
        'Commands failed validation',
      details: {
        errors: result.errors,
        warnings: result.warnings,
        sanitizedCommands: result.sanitizedCommands,
      },
      actions: this.createValidationActions(result),
      metadata: {
        category: 'validation',
        priority: result.isValid ? 'normal' : 'high',
        confidence: result.isValid ? 1 : 0,
        context,
        suggestions: this.generateValidationSuggestions(result),
      },
      timestamp: Date.now(),
    };
  }

  private createValidationActions(result: any): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    if (!result.isValid) {
      actions.push({
        id: 'fix_issues',
        type: 'primary',
        label: 'Fix Issues',
        action: 'fix',
        icon: '🔧',
        style: { variant: 'contained', color: '#007bff' },
      });
    }
    
    if (result.sanitizedCommands && result.sanitizedCommands.length > 0) {
      actions.push({
        id: 'execute_sanitized',
        type: 'secondary',
        label: 'Execute Sanitized Commands',
        action: 'execute_sanitized',
        icon: '⚡',
        style: { variant: 'outlined', color: '#28a745' },
      });
    }
    
    return actions;
  }

  private generateValidationSuggestions(result: any): string[] {
    const suggestions: string[] = [];
    
    if (!result.isValid) {
      suggestions.push(...result.errors);
      suggestions.push('Review command syntax and parameters');
      suggestions.push('Check security requirements');
    }
    
    if (result.warnings && result.warnings.length > 0) {
      suggestions.push(...result.warnings);
    }
    
    return suggestions;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Suggestion feedback template
class SuggestionFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { type, message, context, config } = data;
    
    return {
      id: this.generateId(),
      type: 'suggestion',
      title: 'Suggestion',
      message,
      details: {
        suggestionType: type,
        context,
      },
      actions: this.createSuggestionActions(type, message),
      metadata: {
        category: 'general',
        priority: 'normal',
        confidence: 0.7,
        context,
        suggestions: [message],
      },
      timestamp: Date.now(),
    };
  }

  private createSuggestionActions(type: string, message: string): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    actions.push({
      id: 'accept',
      type: 'primary',
      label: 'Accept',
      action: 'accept',
      icon: '✅',
      style: { variant: 'contained', color: '#28a745' },
    });
    
    actions.push({
      id: 'dismiss',
      type: 'secondary',
      label: 'Dismiss',
      action: 'dismiss',
      icon: '❌',
      style: { variant: 'outlined', color: '#6c757d' },
    });
    
    return actions;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Progress feedback template
class ProgressFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { current, total, currentStep, context, config } = data;
    
    const percentage = Math.round((current / total) * 100);
    const progressText = `${current} of ${total} (${percentage}%)`;
    
    return {
      id: this.generateId(),
      type: 'info',
      title: 'Processing',
      message: currentStep || progressText,
      details: {
        current,
        total,
        percentage,
        currentStep,
      },
      actions: this.createProgressActions(current, total),
      metadata: {
        category: 'general',
        priority: 'normal',
        confidence: 1,
        context,
        suggestions: [],
      },
      timestamp: Date.now(),
    };
  }

  private createProgressActions(current: number, total: number): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    actions.push({
      id: 'cancel',
      type: 'secondary',
      label: 'Cancel',
      action: 'cancel',
      icon: '❌',
      style: { variant: 'outlined', color: '#dc3545' },
    });
    
    return actions;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Suggestion generator interfaces
export interface SuggestionGenerator {
  generate(context: any, type: string): string[];
}

class ClarificationSuggestionGenerator implements SuggestionGenerator {
  generate(context: any, type: string): string[] {
    return [
      'Try specifying what you want to do more clearly',
      'Include relevant details like URLs or element names',
      'Use specific action words like "click", "fill", or "navigate"',
      'Provide context about the current page if relevant',
    ];
  }
}

class AlternativeSuggestionGenerator implements SuggestionGenerator {
  generate(context: any, type: string): string[] {
    return [
      'Try a different approach to accomplish your goal',
      'Consider breaking down complex commands into smaller steps',
      'Use alternative selectors if the current ones don\'t work',
      'Try navigating to the page first if commands aren\'t working',
    ];
  }
}

class ImprovementSuggestionGenerator implements SuggestionGenerator {
  generate(context: any, type: string): string[] {
    return [
      'Be more specific with your commands for better accuracy',
      'Include page context for more precise execution',
      'Use descriptive names for elements you want to interact with',
      'Consider the timing of commands - some may need to wait for page loads',
    ];
  }
}

class HelpSuggestionGenerator implements SuggestionGenerator {
  generate(context: any, type: string): string[] {
    return [
      'Check the documentation for command examples',
      'Use the help command to see available options',
      'Visit the extension settings to configure preferences',
      'Try the tutorial for step-by-step guidance',
    ];
  }
} * Feedback generator for creating user-friendly feedback messages
 */

import { 
  UIStatus, 
  AutomationCommand,
  RayError
} from '../shared/contracts';
import { 
  EnhancedParsedCommand,
  CommandSummary,
  ResponseSummary
} from './response-processor';

export interface FeedbackGeneratorConfig {
  enableEmoji: boolean;
  enableAnimations: boolean;
  enableSuggestions: boolean;
  enableProgressIndicators: boolean;
  language: 'en' | 'es' | 'fr' | 'auto';
  detailLevel: 'brief' | 'normal' | 'detailed';
}

export interface UserFeedback {
  id: string;
  type: 'status' | 'success' | 'error' | 'warning' | 'info' | 'suggestion';
  title: string;
  message: string;
  details?: any;
  actions?: FeedbackAction[];
  metadata: FeedbackMetadata;
  timestamp: number;
}

export interface FeedbackAction {
  id: string;
  type: 'primary' | 'secondary' | 'link' | 'input';
  label: string;
  action?: string;
  url?: string;
  icon?: string;
  style?: FeedbackActionStyle;
}

export interface FeedbackActionStyle {
  variant: 'contained' | 'outlined' | 'text';
  color: string;
  backgroundColor?: string;
}

export interface FeedbackMetadata {
  category: 'parsing' | 'validation' | 'execution' | 'error' | 'general';
  priority: 'low' | 'normal' | 'high' | 'critical';
  confidence: number;
  context: any;
  suggestions: string[];
  learnMore?: {
    url: string;
    text: string;
  };
}

export class FeedbackGenerator {
  private config: FeedbackGeneratorConfig;
  private templates: Map<string, FeedbackTemplate> = new Map();
  private suggestions: Map<string, SuggestionGenerator> = new Map();

  constructor(config: Partial<FeedbackGeneratorConfig> = {}) {
    this.config = {
      enableEmoji: true,
      enableAnimations: true,
      enableSuggestions: true,
      enableProgressIndicators: true,
      language: 'en',
      detailLevel: 'normal',
      ...config,
    };

    this.initializeTemplates();
    this.initializeSuggestions();
  }

  /**
   * Generate feedback from status
   */
  generateFromStatus(status: UIStatus, context?: any): UserFeedback {
    const template = this.templates.get('status');
    if (!template) {
      throw new Error('Status template not found');
    }

    return template.generate({
      status,
      context,
      config: this.config,
    });
  }

  /**
   * Generate feedback from command results
   */
  generateFromCommandResults(
    commands: AutomationCommand[],
    results: any[],
    summary: ResponseSummary,
    context?: any
  ): UserFeedback {
    const template = this.templates.get('command_results');
    if (!template) {
      throw new Error('Command results template not found');
    }

    return template.generate({
      commands,
      results,
      summary,
      context,
      config: this.config,
    });
  }

  /**
   * Generate feedback from error
   */
  generateFromError(error: RayError, context?: any): UserFeedback {
    const template = this.templates.get('error');
    if (!template) {
      throw new Error('Error template not found');
    }

    return template.generate({
      error,
      context,
      config: this.config,
    });
  }

  /**
   * Generate feedback from parsing result
   */
  generateFromParsingResult(
    result: any,
    context?: any
  ): UserFeedback {
    const template = this.templates.get('parsing');
    if (!template) {
      throw new Error('Parsing template not found');
    }

    return template.generate({
      result,
      context,
      config: this.config,
    });
  }

  /**
   * Generate feedback from validation result
   */
  generateFromValidationResult(
    result: any,
    context?: any
  ): UserFeedback {
    const template = this.templates.get('validation');
    if (!template) {
      throw new Error('Validation template not found');
    }

    return template.generate({
      result,
      context,
      config: this.config,
    });
  }

  /**
   * Generate suggestion feedback
   */
  generateSuggestion(
    type: 'clarification' | 'alternative' | 'improvement' | 'help',
    message: string,
    context?: any
  ): UserFeedback {
    const template = this.templates.get('suggestion');
    if (!template) {
      throw new Error('Suggestion template not found');
    }

    return template.generate({
      type,
      message,
      context,
      config: this.config,
    });
  }

  /**
   * Generate progress feedback
   */
  generateProgress(
    current: number,
    total: number,
    currentStep?: string,
    context?: any
  ): UserFeedback {
    const template = this.templates.get('progress');
    if (!template) {
      throw new Error('Progress template not found');
    }

    return template.generate({
      current,
      total,
      currentStep,
      context,
      config: this.config,
    });
  }

  /**
   * Initialize feedback templates
   */
  private initializeTemplates(): void {
    this.templates.set('status', new StatusFeedbackTemplate());
    this.templates.set('command_results', new CommandResultsFeedbackTemplate());
    this.templates.set('error', new ErrorFeedbackTemplate());
    this.templates.set('parsing', new ParsingFeedbackTemplate());
    this.templates.set('validation', new ValidationFeedbackTemplate());
    this.templates.set('suggestion', new SuggestionFeedbackTemplate());
    this.templates.set('progress', new ProgressFeedbackTemplate());
  }

  /**
   * Initialize suggestion generators
   */
  private initializeSuggestions(): void {
    this.suggestions.set('clarification', new ClarificationSuggestionGenerator());
    this.suggestions.set('alternative', new AlternativeSuggestionGenerator());
    this.suggestions.set('improvement', new ImprovementSuggestionGenerator());
    this.suggestions.set('help', new HelpSuggestionGenerator());
  }

  /**
   * Get localized text
   */
  private getLocalizedText(key: string, fallback: string): string {
    const translations: Record<string, Record<string, string>> = {
      en: {
        processing: 'Processing...',
        success: 'Success!',
        error: 'Error',
        warning: 'Warning',
        info: 'Information',
        command_executed: 'Command executed',
        commands_executed: 'Commands executed',
        execution_failed: 'Execution failed',
        parsing_failed: 'Parsing failed',
        validation_failed: 'Validation failed',
        needs_clarification: 'Needs clarification',
        try_again: 'Try again',
        learn_more: 'Learn more',
        retry: 'Retry',
        cancel: 'Cancel',
        view_details: 'View details',
        close: 'Close',
      },
      es: {
        processing: 'Procesando...',
        success: '¡Éxito!',
        error: 'Error',
        warning: 'Advertencia',
        info: 'Información',
        command_executed: 'Comando ejecutado',
        commands_executed: 'Comandos ejecutados',
        execution_failed: 'La ejecución falló',
        parsing_failed: 'El análisis falló',
        validation_failed: 'La validación falló',
        needs_clarification: 'Necesita aclaración',
        try_again: 'Intentar de nuevo',
        learn_more: 'Aprender más',
        retry: 'Reintentar',
        cancel: 'Cancelar',
        view_details: 'Ver detalles',
        close: 'Cerrar',
      },
      fr: {
        processing: 'Traitement en cours...',
        success: 'Succès!',
        error: 'Erreur',
        warning: 'Avertissement',
        info: 'Information',
        command_executed: 'Commande exécutée',
        commands_executed: 'Commandes exécutées',
        execution_failed: 'L\'exécution a échoué',
        parsing_failed: 'L\'analyse a échoué',
        validation_failed: 'La validation a échoué',
        needs_clarification: 'Nécessite une clarification',
        try_again: 'Réessayer',
        learn_more: 'En savoir plus',
        retry: 'Réessayer',
        cancel: 'Annuler',
        view_details: 'Voir les détails',
        close: 'Fermer',
      },
    };

    const lang = this.config.language === 'auto' ? 'en' : this.config.language;
    const langTranslations = translations[lang] || translations.en;
    return langTranslations[key] || fallback;
  }

  /**
   * Get emoji for status
   */
  private getEmoji(status: string): string {
    if (!this.config.enableEmoji) {
      return '';
    }

    const emojis: Record<string, string> = {
      processing: '⏳',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      progress: '🔄',
      help: '💡',
      suggestion: '💭',
    };

    return emojis[status] || '';
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FeedbackGeneratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Template interface
export interface FeedbackTemplate {
  generate(data: any): UserFeedback;
}

// Status feedback template
class StatusFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { status, context, config } = data;
    
    const localizedText = this.getLocalizedText(status.status, status.status);
    const emoji = this.getEmoji(status.status);
    
    return {
      id: this.generateId(),
      type: 'status',
      title: localizedText,
      message: status.message || localizedText,
      details: {
        progress: status.progress,
        currentStep: status.currentStep,
        totalSteps: status.totalSteps,
      },
      actions: this.createStatusActions(status),
      metadata: {
        category: 'general',
        priority: 'normal',
        confidence: 1,
        context,
        suggestions: [],
      },
      timestamp: Date.now(),
    };
  }

  private getLocalizedText(key: string, fallback: string): string {
    // This would use the same localization logic as FeedbackGenerator
    const translations: Record<string, string> = {
      processing: 'Processing...',
      success: 'Success!',
      error: 'Error',
      warning: 'Warning',
      info: 'Information',
    };
    return translations[key] || fallback;
  }

  private getEmoji(status: string): string {
    const emojis: Record<string, string> = {
      processing: '⏳',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };
    return emojis[status] || '';
  }

  private createStatusActions(status: UIStatus): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    if (status.status === 'error') {
      actions.push({
        id: 'retry',
        type: 'primary',
        label: 'Retry',
        action: 'retry',
        icon: '🔄',
        style: { variant: 'contained', color: '#007bff' },
      });
    }
    
    if (status.status === 'processing') {
      actions.push({
        id: 'cancel',
        type: 'secondary',
        label: 'Cancel',
        action: 'cancel',
        icon: '❌',
        style: { variant: 'outlined', color: '#dc3545' },
      });
    }
    
    return actions;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Command results feedback template
class CommandResultsFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { commands, results, summary, context, config } = data;
    
    const successCount = results.filter(r => r && r.success !== false).length;
    const totalCount = commands.length;
    const allSuccess = successCount === totalCount;
    
    return {
      id: this.generateId(),
      type: allSuccess ? 'success' : 'warning',
      title: allSuccess ? 'Commands Completed' : 'Partial Success',
      message: summary.description,
      details: {
        summary,
        commands: commands.map((cmd, index) => ({
          command: cmd,
          result: results[index],
          success: results[index]?.success !== false,
        })),
      },
      actions: this.createCommandActions(commands, results, allSuccess),
      metadata: {
        category: 'execution',
        priority: allSuccess ? 'normal' : 'high',
        confidence: summary.confidence,
        context,
        suggestions: this.generateSuggestions(commands, results),
      },
      timestamp: Date.now(),
    };
  }

  private createCommandActions(commands: any[], results: any[], allSuccess: boolean): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    if (!allSuccess) {
      actions.push({
        id: 'retry_failed',
        type: 'primary',
        label: 'Retry Failed Commands',
        action: 'retry',
        icon: '🔄',
        style: { variant: 'contained', color: '#007bff' },
      });
    }
    
    actions.push({
      id: 'view_details',
      type: 'secondary',
      label: 'View Details',
      action: 'show_details',
      icon: '📋',
      style: { variant: 'outlined', color: '#6c757d' },
    });
    
    return actions;
  }

  private generateSuggestions(commands: any[], results: any[]): string[] {
    const suggestions: string[] = [];
    
    const failedCommands = commands.filter((cmd, index) => 
      results[index] && results[index].success === false
    );
    
    if (failedCommands.length > 0) {
      suggestions.push('Check command syntax and try again');
      suggestions.push('Ensure page elements are available');
    }
    
    if (failedCommands.some(cmd => cmd.type === 'navigate')) {
      suggestions.push('Verify URLs are accessible');
    }
    
    if (failedCommands.some(cmd => cmd.type === 'fill')) {
      suggestions.push('Check form field selectors');
    }
    
    return suggestions;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Error feedback template
class ErrorFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { error, context, config } = data;
    
    return {
      id: this.generateId(),
      type: 'error',
      title: 'Error',
      message: error.message,
      details: {
        code: error.code,
        timestamp: error.timestamp,
        stack: error.stack,
      },
      actions: this.createErrorActions(error),
      metadata: {
        category: 'error',
        priority: 'high',
        confidence: 0,
        context,
        suggestions: this.generateErrorSuggestions(error),
        learnMore: {
          url: this.getHelpUrl(error.code),
          text: 'Get help with this error',
        },
      },
      timestamp: Date.now(),
    };
  }

  private createErrorActions(error: any): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    actions.push({
      id: 'retry',
      type: 'primary',
      label: 'Try Again',
      action: 'retry',
      icon: '🔄',
      style: { variant: 'contained', color: '#007bff' },
    });
    
    actions.push({
      id: 'report',
      type: 'secondary',
      label: 'Report Issue',
      action: 'report',
      url: 'https://github.com/ray-extension/issues',
      icon: '🐛',
      style: { variant: 'outlined', color: '#6c757d' },
    });
    
    return actions;
  }

  private generateErrorSuggestions(error: any): string[] {
    const suggestions: string[] = [];
    
    switch (error.code) {
      case 'NETWORK_ERROR':
        suggestions.push('Check your internet connection');
        suggestions.push('Try again in a few moments');
        break;
      case 'API_ERROR':
        suggestions.push('Verify API key is valid');
        suggestions.push('Check API service status');
        break;
      case 'VALIDATION_ERROR':
        suggestions.push('Review command syntax');
        suggestions.push('Check required parameters');
        break;
      case 'TIMEOUT':
        suggestions.push('Try again with a longer timeout');
        suggestions.push('Check if page is responsive');
        break;
      default:
        suggestions.push('Try rephrasing your command');
        suggestions.push('Check extension permissions');
    }
    
    return suggestions;
  }

  private getHelpUrl(errorCode: string): string {
    const baseUrl = 'https://ray-extension.com/help/errors/';
    return `${baseUrl}${errorCode}`;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Parsing feedback template
class ParsingFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { result, context, config } = data;
    
    const needsClarification = result.requiresClarification || result.confidence < 0.5;
    
    return {
      id: this.generateId(),
      type: needsClarification ? 'warning' : 'info',
      title: needsClarification ? 'Needs Clarification' : 'Parsing Complete',
      message: needsClarification ? 
        result.clarificationQuestion || 'Please provide more details' : 
        'Command parsed successfully',
      details: {
        confidence: result.confidence,
        commands: result.commands,
        warnings: result.warnings,
      },
      actions: this.createParsingActions(result, needsClarification),
      metadata: {
        category: 'parsing',
        priority: needsClarification ? 'high' : 'normal',
        confidence: result.confidence,
        context,
        suggestions: this.generateParsingSuggestions(result),
      },
      timestamp: Date.now(),
    };
  }

  private createParsingActions(result: any, needsClarification: boolean): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    if (needsClarification) {
      actions.push({
        id: 'clarify',
        type: 'primary',
        label: 'Provide More Details',
        action: 'clarify',
        icon: '💬',
        style: { variant: 'contained', color: '#007bff' },
      });
    }
    
    if (result.commands && result.commands.length > 0) {
      actions.push({
        id: 'execute_anyway',
        type: 'secondary',
        label: 'Execute Anyway',
        action: 'execute',
        icon: '⚡',
        style: { variant: 'outlined', color: '#6c757d' },
      });
    }
    
    return actions;
  }

  private generateParsingSuggestions(result: any): string[] {
    const suggestions: string[] = [];
    
    if (result.confidence < 0.5) {
      suggestions.push('Be more specific in your command');
      suggestions.push('Include relevant details like URLs or selectors');
    }
    
    if (result.warnings && result.warnings.length > 0) {
      suggestions.push('Address the warnings shown above');
    }
    
    return suggestions;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Validation feedback template
class ValidationFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { result, context, config } = data;
    
    return {
      id: this.generateId(),
      type: result.isValid ? 'success' : 'error',
      title: result.isValid ? 'Validation Passed' : 'Validation Failed',
      message: result.isValid ? 
        'Commands are valid and ready to execute' : 
        'Commands failed validation',
      details: {
        errors: result.errors,
        warnings: result.warnings,
        sanitizedCommands: result.sanitizedCommands,
      },
      actions: this.createValidationActions(result),
      metadata: {
        category: 'validation',
        priority: result.isValid ? 'normal' : 'high',
        confidence: result.isValid ? 1 : 0,
        context,
        suggestions: this.generateValidationSuggestions(result),
      },
      timestamp: Date.now(),
    };
  }

  private createValidationActions(result: any): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    if (!result.isValid) {
      actions.push({
        id: 'fix_issues',
        type: 'primary',
        label: 'Fix Issues',
        action: 'fix',
        icon: '🔧',
        style: { variant: 'contained', color: '#007bff' },
      });
    }
    
    if (result.sanitizedCommands && result.sanitizedCommands.length > 0) {
      actions.push({
        id: 'execute_sanitized',
        type: 'secondary',
        label: 'Execute Sanitized Commands',
        action: 'execute_sanitized',
        icon: '⚡',
        style: { variant: 'outlined', color: '#28a745' },
      });
    }
    
    return actions;
  }

  private generateValidationSuggestions(result: any): string[] {
    const suggestions: string[] = [];
    
    if (!result.isValid) {
      suggestions.push(...result.errors);
      suggestions.push('Review command syntax and parameters');
      suggestions.push('Check security requirements');
    }
    
    if (result.warnings && result.warnings.length > 0) {
      suggestions.push(...result.warnings);
    }
    
    return suggestions;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Suggestion feedback template
class SuggestionFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { type, message, context, config } = data;
    
    return {
      id: this.generateId(),
      type: 'suggestion',
      title: 'Suggestion',
      message,
      details: {
        suggestionType: type,
        context,
      },
      actions: this.createSuggestionActions(type, message),
      metadata: {
        category: 'general',
        priority: 'normal',
        confidence: 0.7,
        context,
        suggestions: [message],
      },
      timestamp: Date.now(),
    };
  }

  private createSuggestionActions(type: string, message: string): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    actions.push({
      id: 'accept',
      type: 'primary',
      label: 'Accept',
      action: 'accept',
      icon: '✅',
      style: { variant: 'contained', color: '#28a745' },
    });
    
    actions.push({
      id: 'dismiss',
      type: 'secondary',
      label: 'Dismiss',
      action: 'dismiss',
      icon: '❌',
      style: { variant: 'outlined', color: '#6c757d' },
    });
    
    return actions;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Progress feedback template
class ProgressFeedbackTemplate implements FeedbackTemplate {
  generate(data: any): UserFeedback {
    const { current, total, currentStep, context, config } = data;
    
    const percentage = Math.round((current / total) * 100);
    const progressText = `${current} of ${total} (${percentage}%)`;
    
    return {
      id: this.generateId(),
      type: 'info',
      title: 'Processing',
      message: currentStep || progressText,
      details: {
        current,
        total,
        percentage,
        currentStep,
      },
      actions: this.createProgressActions(current, total),
      metadata: {
        category: 'general',
        priority: 'normal',
        confidence: 1,
        context,
        suggestions: [],
      },
      timestamp: Date.now(),
    };
  }

  private createProgressActions(current: number, total: number): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    
    actions.push({
      id: 'cancel',
      type: 'secondary',
      label: 'Cancel',
      action: 'cancel',
      icon: '❌',
      style: { variant: 'outlined', color: '#dc3545' },
    });
    
    return actions;
  }

  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Suggestion generator interfaces
export interface SuggestionGenerator {
  generate(context: any, type: string): string[];
}

class ClarificationSuggestionGenerator implements SuggestionGenerator {
  generate(context: any, type: string): string[] {
    return [
      'Try specifying what you want to do more clearly',
      'Include relevant details like URLs or element names',
      'Use specific action words like "click", "fill", or "navigate"',
      'Provide context about the current page if relevant',
    ];
  }
}

class AlternativeSuggestionGenerator implements SuggestionGenerator {
  generate(context: any, type: string): string[] {
    return [
      'Try a different approach to accomplish your goal',
      'Consider breaking down complex commands into smaller steps',
      'Use alternative selectors if the current ones don\'t work',
      'Try navigating to the page first if commands aren\'t working',
    ];
  }
}

class ImprovementSuggestionGenerator implements SuggestionGenerator {
  generate(context: any, type: string): string[] {
    return [
      'Be more specific with your commands for better accuracy',
      'Include page context for more precise execution',
      'Use descriptive names for elements you want to interact with',
      'Consider the timing of commands - some may need to wait for page loads',
    ];
  }
}

class HelpSuggestionGenerator implements SuggestionGenerator {
  generate(context: any, type: string): string[] {
    return [
      'Check the documentation for command examples',
      'Use the help command to see available options',
      'Visit the extension settings to configure preferences',
      'Try the tutorial for step-by-step guidance',
    ];
  }
}
