/**
 * Error Display Component
 * Handles user-friendly error messages, categorization, and troubleshooting guidance
 */

export type ErrorType = 'api' | 'network' | 'permission' | 'validation' | 'automation' | 'unknown';

export interface ErrorInfo {
  type: ErrorType;
  message: string;
  details?: string;
  code?: string;
  timestamp?: number;
  retryable?: boolean;
  helpUrl?: string;
}

export interface ErrorDisplayOptions {
  autoHide?: boolean;
  autoHideDelay?: number;
  showRetry?: boolean;
  showHelp?: boolean;
  maxErrors?: number;
}

export interface ErrorDisplayEvents {
  errorShow: (error: ErrorInfo) => void;
  errorHide: () => void;
  retry: (error: ErrorInfo) => void;
  help: (error: ErrorInfo) => void;
}

export class ErrorDisplay {
  private errorSection: HTMLElement;
  private errorMessage: HTMLElement;
  private retryBtn: HTMLElement;
  private helpBtn: HTMLElement;
  private options: Required<ErrorDisplayOptions>;
  private events: Partial<ErrorDisplayEvents>;
  private currentError: ErrorInfo | null = null;
  private autoHideTimer: number | null = null;
  private errorHistory: ErrorInfo[] = [];

  constructor(
    errorSectionId: string,
    errorMessageId: string,
    retryBtnId: string,
    helpBtnId: string,
    options: ErrorDisplayOptions = {},
    events: Partial<ErrorDisplayEvents> = {}
  ) {
    // Get DOM elements
    this.errorSection = document.getElementById(errorSectionId) as HTMLElement;
    this.errorMessage = document.getElementById(errorMessageId) as HTMLElement;
    this.retryBtn = document.getElementById(retryBtnId) as HTMLElement;
    this.helpBtn = document.getElementById(helpBtnId) as HTMLElement;

    if (!this.errorSection || !this.errorMessage || !this.retryBtn || !this.helpBtn) {
      throw new Error('Required DOM elements not found');
    }

    // Set default options
    this.options = {
      autoHide: options.autoHide === true, // Default to false
      autoHideDelay: options.autoHideDelay || 5000, // Default 5 seconds
      showRetry: options.showRetry !== false, // Default to true
      showHelp: options.showHelp !== false, // Default to true
      maxErrors: options.maxErrors || 10 // Default 10 errors
    };

    this.events = events;

    // Initialize the component
    this.init();
  }

  private init(): void {
    // Set up event listeners
    this.setupEventListeners();

    // Hide error section initially
    this.hide();
  }

  private setupEventListeners(): void {
    // Retry button
    this.retryBtn.addEventListener('click', () => {
      if (this.currentError) {
        this.events.retry?.(this.currentError);
      }
    });

    // Help button
    this.helpBtn.addEventListener('click', () => {
      if (this.currentError) {
        this.events.help?.(this.currentError);
      }
    });
  }

  public showError(error: ErrorInfo | Error | string): void {
    let errorInfo: ErrorInfo;

    if (typeof error === 'string') {
      errorInfo = {
        type: 'unknown',
        message: error,
        retryable: true
      };
    } else if (error instanceof Error) {
      errorInfo = this.parseError(error);
    } else {
      errorInfo = error;
    }

    // Add timestamp if not provided
    if (!errorInfo.timestamp) {
      errorInfo.timestamp = Date.now();
    }

    // Set default retryable if not provided
    if (errorInfo.retryable === undefined) {
      errorInfo.retryable = this.isRetryableError(errorInfo.type);
    }

    // Add to history
    this.addToHistory(errorInfo);

    // Update current error
    this.currentError = errorInfo;

    // Update UI
    this.updateErrorDisplay(errorInfo);

    // Show error section
    this.show();

    // Trigger event
    this.events.errorShow?.(errorInfo);

    // Auto-hide if enabled
    if (this.options.autoHide && errorInfo.type !== 'permission') {
      this.scheduleAutoHide();
    }
  }

  private parseError(error: Error): ErrorInfo {
    // Try to categorize the error based on message or name
    const message = error.message.toLowerCase();
    let type: ErrorType = 'unknown';
    let retryable = true;

    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      type = 'network';
    } else if (message.includes('permission') || message.includes('access denied') || message.includes('unauthorized')) {
      type = 'permission';
      retryable = false;
    } else if (message.includes('api') || message.includes('key') || message.includes('authentication')) {
      type = 'api';
    } else if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      type = 'validation';
      retryable = false;
    } else if (message.includes('automation') || message.includes('element') || message.includes('selector')) {
      type = 'automation';
    }

    return {
      type,
      message: error.message,
      details: error.stack,
      code: (error as any).code,
      retryable
    };
  }

  private isRetryableError(type: ErrorType): boolean {
    // Define which error types are retryable
    switch (type) {
      case 'network':
      case 'api':
      case 'automation':
        return true;
      case 'permission':
      case 'validation':
        return false;
      default:
        return true;
    }
  }

  private updateErrorDisplay(errorInfo: ErrorInfo): void {
    // Update error message
    this.errorMessage.textContent = this.formatErrorMessage(errorInfo);

    // Update retry button
    if (this.options.showRetry && errorInfo.retryable) {
      this.retryBtn.style.display = 'inline-flex';
    } else {
      this.retryBtn.style.display = 'none';
    }

    // Update help button
    if (this.options.showHelp) {
      this.helpBtn.style.display = 'inline-flex';
    } else {
      this.helpBtn.style.display = 'none';
    }
  }

  private formatErrorMessage(errorInfo: ErrorInfo): string {
    let message = errorInfo.message;

    // Add context based on error type
    switch (errorInfo.type) {
      case 'api':
        message = `API Error: ${message}`;
        break;
      case 'network':
        message = `Network Error: ${message}`;
        break;
      case 'permission':
        message = `Permission Error: ${message}`;
        break;
      case 'validation':
        message = `Validation Error: ${message}`;
        break;
      case 'automation':
        message = `Automation Error: ${message}`;
        break;
    }

    // Add code if available
    if (errorInfo.code) {
      message += ` (Code: ${errorInfo.code})`;
    }

    return message;
  }

  private addToHistory(errorInfo: ErrorInfo): void {
    this.errorHistory.unshift(errorInfo);
    
    // Keep only the specified number of errors
    if (this.errorHistory.length > this.options.maxErrors) {
      this.errorHistory = this.errorHistory.slice(0, this.options.maxErrors);
    }
  }

  private scheduleAutoHide(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }
    
    this.autoHideTimer = window.setTimeout(() => {
      this.hide();
    }, this.options.autoHideDelay);
  }

  public hide(): void {
    this.errorSection.hidden = true;
    this.currentError = null;
    
    // Clear auto-hide timer
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }

    this.events.errorHide?.();
  }

  public show(): void {
    this.errorSection.hidden = false;
  }

  public clear(): void {
    this.hide();
    this.errorHistory = [];
  }

  public isVisible(): boolean {
    return !this.errorSection.hidden;
  }

  public getCurrentError(): ErrorInfo | null {
    return this.currentError;
  }

  public getErrorHistory(): ErrorInfo[] {
    return [...this.errorHistory];
  }

  public hasErrors(): boolean {
    return this.errorHistory.length > 0;
  }

  public getLastError(): ErrorInfo | null {
    return this.errorHistory.length > 0 ? this.errorHistory[0] : null;
  }

  public getErrorCount(): number {
    return this.errorHistory.length;
  }

  public getErrorsByType(type: ErrorType): ErrorInfo[] {
    return this.errorHistory.filter(error => error.type === type);
  }

  public retryCurrentError(): void {
    if (this.currentError && this.currentError.retryable) {
      this.events.retry?.(this.currentError);
    }
  }

  public getHelpForCurrentError(): void {
    if (this.currentError) {
      this.events.help?.(this.currentError);
    }
  }

  public getHelpUrl(errorType: ErrorType): string {
    // Return help URLs based on error type
    switch (errorType) {
      case 'api':
        return 'https://docs.ray.ai/api-troubleshooting';
      case 'network':
        return 'https://docs.ray.ai/network-issues';
      case 'permission':
        return 'https://docs.ray.ai/permissions';
      case 'validation':
        return 'https://docs.ray.ai/validation-errors';
      case 'automation':
        return 'https://docs.ray.ai/automation-errors';
      default:
        return 'https://docs.ray.ai/troubleshooting';
    }
  }

  public getRetryableSuggestion(errorType: ErrorType): string {
    // Return retry suggestions based on error type
    switch (errorType) {
      case 'api':
        return 'Check your API key and try again';
      case 'network':
        return 'Check your internet connection and try again';
      case 'automation':
        return 'Make sure the page is fully loaded and try again';
      default:
        return 'Try the operation again';
    }
  }

  public createDetailedErrorReport(): string {
    if (!this.currentError) return '';

    const report = [
      `Error Type: ${this.currentError.type}`,
      `Message: ${this.currentError.message}`,
      `Timestamp: ${new Date(this.currentError.timestamp).toISOString()}`
    ];

    if (this.currentError.code) {
      report.push(`Error Code: ${this.currentError.code}`);
    }

    if (this.currentError.details) {
      report.push(`Details: ${this.currentError.details}`);
    }

    if (this.currentError.retryable !== undefined) {
      report.push(`Retryable: ${this.currentError.retryable}`);
    }

    return report.join('\n');
  }

  public destroy(): void {
    // Clear auto-hide timer
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }

    // Remove event listeners
    this.retryBtn.removeEventListener('click', () => {
      if (this.currentError) {
        this.events.retry?.(this.currentError);
      }
    });

    this.helpBtn.removeEventListener('click', () => {
      if (this.currentError) {
        this.events.help?.(this.currentError);
      }
    });

    // Clear state
    this.currentError = null;
    this.errorHistory = [];
  }
} * Error Display Component
 * Handles user-friendly error messages, categorization, and troubleshooting guidance
 */

export type ErrorType = 'api' | 'network' | 'permission' | 'validation' | 'automation' | 'unknown';

export interface ErrorInfo {
  type: ErrorType;
  message: string;
  details?: string;
  code?: string;
  timestamp?: number;
  retryable?: boolean;
  helpUrl?: string;
}

export interface ErrorDisplayOptions {
  autoHide?: boolean;
  autoHideDelay?: number;
  showRetry?: boolean;
  showHelp?: boolean;
  maxErrors?: number;
}

export interface ErrorDisplayEvents {
  errorShow: (error: ErrorInfo) => void;
  errorHide: () => void;
  retry: (error: ErrorInfo) => void;
  help: (error: ErrorInfo) => void;
}

export class ErrorDisplay {
  private errorSection: HTMLElement;
  private errorMessage: HTMLElement;
  private retryBtn: HTMLElement;
  private helpBtn: HTMLElement;
  private options: Required<ErrorDisplayOptions>;
  private events: Partial<ErrorDisplayEvents>;
  private currentError: ErrorInfo | null = null;
  private autoHideTimer: number | null = null;
  private errorHistory: ErrorInfo[] = [];

  constructor(
    errorSectionId: string,
    errorMessageId: string,
    retryBtnId: string,
    helpBtnId: string,
    options: ErrorDisplayOptions = {},
    events: Partial<ErrorDisplayEvents> = {}
  ) {
    // Get DOM elements
    this.errorSection = document.getElementById(errorSectionId) as HTMLElement;
    this.errorMessage = document.getElementById(errorMessageId) as HTMLElement;
    this.retryBtn = document.getElementById(retryBtnId) as HTMLElement;
    this.helpBtn = document.getElementById(helpBtnId) as HTMLElement;

    if (!this.errorSection || !this.errorMessage || !this.retryBtn || !this.helpBtn) {
      throw new Error('Required DOM elements not found');
    }

    // Set default options
    this.options = {
      autoHide: options.autoHide === true, // Default to false
      autoHideDelay: options.autoHideDelay || 5000, // Default 5 seconds
      showRetry: options.showRetry !== false, // Default to true
      showHelp: options.showHelp !== false, // Default to true
      maxErrors: options.maxErrors || 10 // Default 10 errors
    };

    this.events = events;

    // Initialize the component
    this.init();
  }

  private init(): void {
    // Set up event listeners
    this.setupEventListeners();

    // Hide error section initially
    this.hide();
  }

  private setupEventListeners(): void {
    // Retry button
    this.retryBtn.addEventListener('click', () => {
      if (this.currentError) {
        this.events.retry?.(this.currentError);
      }
    });

    // Help button
    this.helpBtn.addEventListener('click', () => {
      if (this.currentError) {
        this.events.help?.(this.currentError);
      }
    });
  }

  public showError(error: ErrorInfo | Error | string): void {
    let errorInfo: ErrorInfo;

    if (typeof error === 'string') {
      errorInfo = {
        type: 'unknown',
        message: error,
        retryable: true
      };
    } else if (error instanceof Error) {
      errorInfo = this.parseError(error);
    } else {
      errorInfo = error;
    }

    // Add timestamp if not provided
    if (!errorInfo.timestamp) {
      errorInfo.timestamp = Date.now();
    }

    // Set default retryable if not provided
    if (errorInfo.retryable === undefined) {
      errorInfo.retryable = this.isRetryableError(errorInfo.type);
    }

    // Add to history
    this.addToHistory(errorInfo);

    // Update current error
    this.currentError = errorInfo;

    // Update UI
    this.updateErrorDisplay(errorInfo);

    // Show error section
    this.show();

    // Trigger event
    this.events.errorShow?.(errorInfo);

    // Auto-hide if enabled
    if (this.options.autoHide && errorInfo.type !== 'permission') {
      this.scheduleAutoHide();
    }
  }

  private parseError(error: Error): ErrorInfo {
    // Try to categorize the error based on message or name
    const message = error.message.toLowerCase();
    let type: ErrorType = 'unknown';
    let retryable = true;

    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      type = 'network';
    } else if (message.includes('permission') || message.includes('access denied') || message.includes('unauthorized')) {
      type = 'permission';
      retryable = false;
    } else if (message.includes('api') || message.includes('key') || message.includes('authentication')) {
      type = 'api';
    } else if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      type = 'validation';
      retryable = false;
    } else if (message.includes('automation') || message.includes('element') || message.includes('selector')) {
      type = 'automation';
    }

    return {
      type,
      message: error.message,
      details: error.stack,
      code: (error as any).code,
      retryable
    };
  }

  private isRetryableError(type: ErrorType): boolean {
    // Define which error types are retryable
    switch (type) {
      case 'network':
      case 'api':
      case 'automation':
        return true;
      case 'permission':
      case 'validation':
        return false;
      default:
        return true;
    }
  }

  private updateErrorDisplay(errorInfo: ErrorInfo): void {
    // Update error message
    this.errorMessage.textContent = this.formatErrorMessage(errorInfo);

    // Update retry button
    if (this.options.showRetry && errorInfo.retryable) {
      this.retryBtn.style.display = 'inline-flex';
    } else {
      this.retryBtn.style.display = 'none';
    }

    // Update help button
    if (this.options.showHelp) {
      this.helpBtn.style.display = 'inline-flex';
    } else {
      this.helpBtn.style.display = 'none';
    }
  }

  private formatErrorMessage(errorInfo: ErrorInfo): string {
    let message = errorInfo.message;

    // Add context based on error type
    switch (errorInfo.type) {
      case 'api':
        message = `API Error: ${message}`;
        break;
      case 'network':
        message = `Network Error: ${message}`;
        break;
      case 'permission':
        message = `Permission Error: ${message}`;
        break;
      case 'validation':
        message = `Validation Error: ${message}`;
        break;
      case 'automation':
        message = `Automation Error: ${message}`;
        break;
    }

    // Add code if available
    if (errorInfo.code) {
      message += ` (Code: ${errorInfo.code})`;
    }

    return message;
  }

  private addToHistory(errorInfo: ErrorInfo): void {
    this.errorHistory.unshift(errorInfo);
    
    // Keep only the specified number of errors
    if (this.errorHistory.length > this.options.maxErrors) {
      this.errorHistory = this.errorHistory.slice(0, this.options.maxErrors);
    }
  }

  private scheduleAutoHide(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }
    
    this.autoHideTimer = window.setTimeout(() => {
      this.hide();
    }, this.options.autoHideDelay);
  }

  public hide(): void {
    this.errorSection.hidden = true;
    this.currentError = null;
    
    // Clear auto-hide timer
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }

    this.events.errorHide?.();
  }

  public show(): void {
    this.errorSection.hidden = false;
  }

  public clear(): void {
    this.hide();
    this.errorHistory = [];
  }

  public isVisible(): boolean {
    return !this.errorSection.hidden;
  }

  public getCurrentError(): ErrorInfo | null {
    return this.currentError;
  }

  public getErrorHistory(): ErrorInfo[] {
    return [...this.errorHistory];
  }

  public hasErrors(): boolean {
    return this.errorHistory.length > 0;
  }

  public getLastError(): ErrorInfo | null {
    return this.errorHistory.length > 0 ? this.errorHistory[0] : null;
  }

  public getErrorCount(): number {
    return this.errorHistory.length;
  }

  public getErrorsByType(type: ErrorType): ErrorInfo[] {
    return this.errorHistory.filter(error => error.type === type);
  }

  public retryCurrentError(): void {
    if (this.currentError && this.currentError.retryable) {
      this.events.retry?.(this.currentError);
    }
  }

  public getHelpForCurrentError(): void {
    if (this.currentError) {
      this.events.help?.(this.currentError);
    }
  }

  public getHelpUrl(errorType: ErrorType): string {
    // Return help URLs based on error type
    switch (errorType) {
      case 'api':
        return 'https://docs.ray.ai/api-troubleshooting';
      case 'network':
        return 'https://docs.ray.ai/network-issues';
      case 'permission':
        return 'https://docs.ray.ai/permissions';
      case 'validation':
        return 'https://docs.ray.ai/validation-errors';
      case 'automation':
        return 'https://docs.ray.ai/automation-errors';
      default:
        return 'https://docs.ray.ai/troubleshooting';
    }
  }

  public getRetryableSuggestion(errorType: ErrorType): string {
    // Return retry suggestions based on error type
    switch (errorType) {
      case 'api':
        return 'Check your API key and try again';
      case 'network':
        return 'Check your internet connection and try again';
      case 'automation':
        return 'Make sure the page is fully loaded and try again';
      default:
        return 'Try the operation again';
    }
  }

  public createDetailedErrorReport(): string {
    if (!this.currentError) return '';

    const report = [
      `Error Type: ${this.currentError.type}`,
      `Message: ${this.currentError.message}`,
      `Timestamp: ${new Date(this.currentError.timestamp).toISOString()}`
    ];

    if (this.currentError.code) {
      report.push(`Error Code: ${this.currentError.code}`);
    }

    if (this.currentError.details) {
      report.push(`Details: ${this.currentError.details}`);
    }

    if (this.currentError.retryable !== undefined) {
      report.push(`Retryable: ${this.currentError.retryable}`);
    }

    return report.join('\n');
  }

  public destroy(): void {
    // Clear auto-hide timer
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }

    // Remove event listeners
    this.retryBtn.removeEventListener('click', () => {
      if (this.currentError) {
        this.events.retry?.(this.currentError);
      }
    });

    this.helpBtn.removeEventListener('click', () => {
      if (this.currentError) {
        this.events.help?.(this.currentError);
      }
    });

    // Clear state
    this.currentError = null;
    this.errorHistory = [];
  }
}
