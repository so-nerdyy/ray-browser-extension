/**
 * Main orchestrator for coordinating AI parsing, validation, and execution
 */

import { 
  AutomationCommand, 
  ExecutionContext, 
  UIStatus, 
  AgentMessage,
  RayError
} from '../shared/contracts';
import { 
  EnhancedParsedCommand,
  ParsingResult,
  CommandContext,
  ValidationResult
} from '../commands/types';
import { OpenRouterClient } from '../openrouter/client';
import { CommandParser } from '../commands/parser';
import { CommandValidator } from '../commands/validator';
import { ContextManager } from './context-manager';
import { ExecutionEngine, ExecutionEventListener } from './execution-engine';

export interface OrchestratorConfig {
  enableAutoRetry: boolean;
  maxRetryAttempts: number;
  enableProgressReporting: boolean;
  enableConfirmationForHighRisk: boolean;
  defaultTimeout: number;
}

export interface OrchestratorRequest {
  id: string;
  userId: string;
  command: string;
  context?: CommandContext;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface OrchestratorResult {
  id: string;
  status: 'pending' | 'parsing' | 'validating' | 'executing' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  parsingResult?: ParsingResult;
  validationResult?: ValidationResult;
  executionResult?: any;
  errors: RayError[];
  warnings: string[];
  metadata?: Record<string, any>;
}

export interface OrchestratorEventListener {
  onRequestStarted?(request: OrchestratorRequest): void;
  onParsingStarted?(request: OrchestratorRequest): void;
  onParsingCompleted?(request: OrchestratorRequest, result: ParsingResult): void;
  onValidationStarted?(request: OrchestratorRequest, commands: EnhancedParsedCommand[]): void;
  onValidationCompleted?(request: OrchestratorRequest, result: ValidationResult): void;
  onExecutionStarted?(request: OrchestratorRequest, commands: AutomationCommand[]): void;
  onExecutionProgress?(request: OrchestratorRequest, progress: number): void;
  onExecutionCompleted?(request: OrchestratorRequest, result: any): void;
  onRequestCompleted?(request: OrchestratorRequest, result: OrchestratorResult): void;
  onRequestFailed?(request: OrchestratorRequest, error: RayError): void;
  onStatusUpdate?(request: OrchestratorRequest, status: UIStatus): void;
}

export class Orchestrator {
  private config: OrchestratorConfig;
  private openRouterClient: OpenRouterClient;
  private commandParser: CommandParser;
  private commandValidator: CommandValidator;
  private contextManager: ContextManager;
  private executionEngine: ExecutionEngine;
  private activeRequests: Map<string, OrchestratorResult> = new Map();
  private eventListeners: OrchestratorEventListener[] = [];

  constructor(
    openRouterClient: OpenRouterClient,
    config: Partial<OrchestratorConfig> = {}
  ) {
    this.config = {
      enableAutoRetry: true,
      maxRetryAttempts: 3,
      enableProgressReporting: true,
      enableConfirmationForHighRisk: true,
      defaultTimeout: 60000, // 1 minute
      ...config,
    };

    this.openRouterClient = openRouterClient;
    this.commandParser = new CommandParser(openRouterClient);
    this.commandValidator = new CommandValidator();
    this.contextManager = new ContextManager();
    this.executionEngine = new ExecutionEngine(this.contextManager);

    this.setupExecutionEngineListeners();
  }

  /**
   * Process natural language command
   */
  async processCommand(
    command: string,
    userId: string,
    context?: CommandContext,
    priority: OrchestratorRequest['priority'] = 'normal'
  ): Promise<OrchestratorResult> {
    const request: OrchestratorRequest = {
      id: this.generateRequestId(),
      userId,
      command,
      context,
      priority,
    };

    return this.executeRequest(request);
  }

  /**
   * Process parsed commands directly
   */
  async processParsedCommands(
    commands: EnhancedParsedCommand[],
    userId: string,
    context?: CommandContext,
    priority: OrchestratorRequest['priority'] = 'normal'
  ): Promise<OrchestratorResult> {
    // Create a mock request for parsed commands
    const request: OrchestratorRequest = {
      id: this.generateRequestId(),
      userId,
      command: commands.map(cmd => cmd.originalText).join('; '),
      context,
      priority,
    };

    return this.executeRequestWithParsedCommands(request, commands);
  }

  /**
   * Get request status
   */
  getRequestStatus(requestId: string): OrchestratorResult | null {
    return this.activeRequests.get(requestId) || null;
  }

  /**
   * Cancel request
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      return false;
    }

    request.status = 'cancelled';
    request.endTime = Date.now();

    // Cancel execution if running
    if (request.executionResult) {
      await this.executionEngine.cancelExecution(request.executionResult.id);
    }

    return true;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: OrchestratorEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: OrchestratorEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Execute request
   */
  private async executeRequest(request: OrchestratorRequest): Promise<OrchestratorResult> {
    const result: OrchestratorResult = {
      id: request.id,
      status: 'pending',
      startTime: Date.now(),
      errors: [],
      warnings: [],
    };

    this.activeRequests.set(request.id, result);
    this.notifyRequestStarted(request);

    try {
      // Create execution context
      const context = this.contextManager.createContext(
        request.userId,
        request.context?.tabId,
        request.context?.currentUrl
      );

      // Update context with additional information
      if (request.context) {
        this.contextManager.updateContext(context.id, {
          variables: new Map(Object.entries(request.context)),
        });
      }

      // Step 1: Parse command
      result.status = 'parsing';
      this.notifyParsingStarted(request);

      const parsingResult = await this.commandParser.parseCommand(
        request.command,
        request.context
      );

      result.parsingResult = parsingResult;
      result.warnings.push(...parsingResult.warnings);

      this.notifyParsingCompleted(request, parsingResult);

      // Check if parsing requires clarification
      if (parsingResult.requiresClarification) {
        result.status = 'completed';
        result.endTime = Date.now();
        this.notifyRequestCompleted(request, result);
        return result;
      }

      // Step 2: Validate commands
      result.status = 'validating';
      this.notifyValidationStarted(request, parsingResult.commands);

      const validationResult = this.commandValidator.validateCommands(
        parsingResult.commands,
        request.context
      );

      result.validationResult = validationResult;
      result.warnings.push(...validationResult.warnings);

      this.notifyValidationCompleted(request, validationResult);

      // Check if validation failed
      if (!validationResult.isValid) {
        result.status = 'failed';
        result.endTime = Date.now();
        result.errors.push(...validationResult.errors.map(error => ({
          code: 'VALIDATION_ERROR',
          message: error,
          timestamp: Date.now(),
        })));
        this.notifyRequestFailed(request, result.errors[0]);
        return result;
      }

      // Step 3: Check for confirmation
      if (this.config.enableConfirmationForHighRisk && validationResult.requiresConfirmation) {
        result.status = 'completed';
        result.endTime = Date.now();
        result.warnings.push('High-risk command requires user confirmation');
        this.notifyRequestCompleted(request, result);
        return result;
      }

      // Step 4: Execute commands
      result.status = 'executing';
      this.notifyExecutionStarted(request, validationResult.sanitizedCommands!);

      const executionResult = await this.executionEngine.executeCommands(
        validationResult.sanitizedCommands!,
        context.id,
        request.priority
      );

      result.executionResult = executionResult;

      if (executionResult.status === 'completed') {
        result.status = 'completed';
        result.endTime = Date.now();
        this.notifyRequestCompleted(request, result);
      } else {
        result.status = 'failed';
        result.endTime = Date.now();
        result.errors.push(...executionResult.errors);
        this.notifyRequestFailed(request, executionResult.errors[0]);
      }

    } catch (error) {
      result.status = 'failed';
      result.endTime = Date.now();
      
      const rayError: RayError = {
        code: 'ORCHESTRATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown orchestration error',
        timestamp: Date.now(),
        details: error,
      };

      result.errors.push(rayError);
      this.notifyRequestFailed(request, rayError);
    }

    return result;
  }

  /**
   * Execute request with pre-parsed commands
   */
  private async executeRequestWithParsedCommands(
    request: OrchestratorRequest,
    commands: EnhancedParsedCommand[]
  ): Promise<OrchestratorResult> {
    const result: OrchestratorResult = {
      id: request.id,
      status: 'pending',
      startTime: Date.now(),
      errors: [],
      warnings: [],
    };

    this.activeRequests.set(request.id, result);
    this.notifyRequestStarted(request);

    try {
      // Create execution context
      const context = this.contextManager.createContext(
        request.userId,
        request.context?.tabId,
        request.context?.currentUrl
      );

      // Update context with additional information
      if (request.context) {
        this.contextManager.updateContext(context.id, {
          variables: new Map(Object.entries(request.context)),
        });
      }

      // Step 1: Validate commands
      result.status = 'validating';
      this.notifyValidationStarted(request, commands);

      const validationResult = this.commandValidator.validateCommands(
        commands,
        request.context
      );

      result.validationResult = validationResult;
      result.warnings.push(...validationResult.warnings);

      this.notifyValidationCompleted(request, validationResult);

      // Check if validation failed
      if (!validationResult.isValid) {
        result.status = 'failed';
        result.endTime = Date.now();
        result.errors.push(...validationResult.errors.map(error => ({
          code: 'VALIDATION_ERROR',
          message: error,
          timestamp: Date.now(),
        })));
        this.notifyRequestFailed(request, result.errors[0]);
        return result;
      }

      // Step 2: Check for confirmation
      if (this.config.enableConfirmationForHighRisk && validationResult.requiresConfirmation) {
        result.status = 'completed';
        result.endTime = Date.now();
        result.warnings.push('High-risk command requires user confirmation');
        this.notifyRequestCompleted(request, result);
        return result;
      }

      // Step 3: Execute commands
      result.status = 'executing';
      this.notifyExecutionStarted(request, validationResult.sanitizedCommands!);

      const executionResult = await this.executionEngine.executeCommands(
        validationResult.sanitizedCommands!,
        context.id,
        request.priority
      );

      result.executionResult = executionResult;

      if (executionResult.status === 'completed') {
        result.status = 'completed';
        result.endTime = Date.now();
        this.notifyRequestCompleted(request, result);
      } else {
        result.status = 'failed';
        result.endTime = Date.now();
        result.errors.push(...executionResult.errors);
        this.notifyRequestFailed(request, executionResult.errors[0]);
      }

    } catch (error) {
      result.status = 'failed';
      result.endTime = Date.now();
      
      const rayError: RayError = {
        code: 'ORCHESTRATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown orchestration error',
        timestamp: Date.now(),
        details: error,
      };

      result.errors.push(rayError);
      this.notifyRequestFailed(request, rayError);
    }

    return result;
  }

  /**
   * Setup execution engine listeners
   */
  private setupExecutionEngineListeners(): void {
    this.executionEngine.addEventListener({
      onExecutionProgress: (request, progress) => {
        // Find orchestrator request
        const orchestratorRequest = Array.from(this.activeRequests.values())
          .find(result => result.executionResult?.id === request.id);
        
        if (orchestratorRequest) {
          this.notifyStatusUpdate(
            { id: orchestratorRequest.id, userId: '', command: '' },
            {
              status: 'processing',
              message: `Executing commands... ${Math.round(progress)}%`,
              progress,
              timestamp: Date.now(),
            }
          );
        }
      },
    } as ExecutionEventListener);
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Event notification methods
   */
  private notifyRequestStarted(request: OrchestratorRequest): void {
    this.eventListeners.forEach(listener => {
      if (listener.onRequestStarted) {
        listener.onRequestStarted(request);
      }
    });
  }

  private notifyParsingStarted(request: OrchestratorRequest): void {
    this.eventListeners.forEach(listener => {
      if (listener.onParsingStarted) {
        listener.onParsingStarted(request);
      }
    });
  }

  private notifyParsingCompleted(request: OrchestratorRequest, result: ParsingResult): void {
    this.eventListeners.forEach(listener => {
      if (listener.onParsingCompleted) {
        listener.onParsingCompleted(request, result);
      }
    });
  }

  private notifyValidationStarted(request: OrchestratorRequest, commands: EnhancedParsedCommand[]): void {
    this.eventListeners.forEach(listener => {
      if (listener.onValidationStarted) {
        listener.onValidationStarted(request, commands);
      }
    });
  }

  private notifyValidationCompleted(request: OrchestratorRequest, result: ValidationResult): void {
    this.eventListeners.forEach(listener => {
      if (listener.onValidationCompleted) {
        listener.onValidationCompleted(request, result);
      }
    });
  }

  private notifyExecutionStarted(request: OrchestratorRequest, commands: AutomationCommand[]): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionStarted) {
        listener.onExecutionStarted(request, commands);
      }
    });
  }

  private notifyExecutionProgress(request: OrchestratorRequest, progress: number): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionProgress) {
        listener.onExecutionProgress(request, progress);
      }
    });
  }

  private notifyExecutionCompleted(request: OrchestratorRequest, result: any): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionCompleted) {
        listener.onExecutionCompleted(request, result);
      }
    });
  }

  private notifyRequestCompleted(request: OrchestratorRequest, result: OrchestratorResult): void {
    this.eventListeners.forEach(listener => {
      if (listener.onRequestCompleted) {
        listener.onRequestCompleted(request, result);
      }
    });
  }

  private notifyRequestFailed(request: OrchestratorRequest, error: RayError): void {
    this.eventListeners.forEach(listener => {
      if (listener.onRequestFailed) {
        listener.onRequestFailed(request, error);
      }
    });
  }

  private notifyStatusUpdate(request: OrchestratorRequest, status: UIStatus): void {
    this.eventListeners.forEach(listener => {
      if (listener.onStatusUpdate) {
        listener.onStatusUpdate(request, status);
      }
    });
  }

  /**
   * Get active requests
   */
  getActiveRequests(): OrchestratorResult[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    activeRequests: number;
    totalRequests: number;
    successRate: number;
    averageProcessingTime: number;
  } {
    const activeRequests = Array.from(this.activeRequests.values())
      .filter(req => req.status === 'parsing' || req.status === 'validating' || req.status === 'executing').length;
    
    const completedRequests = Array.from(this.activeRequests.values())
      .filter(req => req.status === 'completed');
    
    const failedRequests = Array.from(this.activeRequests.values())
      .filter(req => req.status === 'failed');

    const totalRequests = completedRequests.length + failedRequests.length;
    const successRate = totalRequests > 0 ? completedRequests.length / totalRequests : 0;

    let averageProcessingTime = 0;
    if (completedRequests.length > 0) {
      const totalTime = completedRequests.reduce((sum, req) => {
        return sum + (req.endTime! - req.startTime);
      }, 0);
      averageProcessingTime = totalTime / completedRequests.length;
    }

    return {
      activeRequests,
      totalRequests,
      successRate,
      averageProcessingTime,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get dependencies
   */
  getDependencies(): {
    openRouterClient: OpenRouterClient;
    commandParser: CommandParser;
    commandValidator: CommandValidator;
    contextManager: ContextManager;
    executionEngine: ExecutionEngine;
  } {
    return {
      openRouterClient: this.openRouterClient,
      commandParser: this.commandParser,
      commandValidator: this.commandValidator,
      contextManager: this.contextManager,
      executionEngine: this.executionEngine,
    };
  }
} * Main orchestrator for coordinating AI parsing, validation, and execution
 */

import { 
  AutomationCommand, 
  ExecutionContext, 
  UIStatus, 
  AgentMessage,
  RayError
} from '../shared/contracts';
import { 
  EnhancedParsedCommand,
  ParsingResult,
  CommandContext,
  ValidationResult
} from '../commands/types';
import { OpenRouterClient } from '../openrouter/client';
import { CommandParser } from '../commands/parser';
import { CommandValidator } from '../commands/validator';
import { ContextManager } from './context-manager';
import { ExecutionEngine, ExecutionEventListener } from './execution-engine';

export interface OrchestratorConfig {
  enableAutoRetry: boolean;
  maxRetryAttempts: number;
  enableProgressReporting: boolean;
  enableConfirmationForHighRisk: boolean;
  defaultTimeout: number;
}

export interface OrchestratorRequest {
  id: string;
  userId: string;
  command: string;
  context?: CommandContext;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface OrchestratorResult {
  id: string;
  status: 'pending' | 'parsing' | 'validating' | 'executing' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  parsingResult?: ParsingResult;
  validationResult?: ValidationResult;
  executionResult?: any;
  errors: RayError[];
  warnings: string[];
  metadata?: Record<string, any>;
}

export interface OrchestratorEventListener {
  onRequestStarted?(request: OrchestratorRequest): void;
  onParsingStarted?(request: OrchestratorRequest): void;
  onParsingCompleted?(request: OrchestratorRequest, result: ParsingResult): void;
  onValidationStarted?(request: OrchestratorRequest, commands: EnhancedParsedCommand[]): void;
  onValidationCompleted?(request: OrchestratorRequest, result: ValidationResult): void;
  onExecutionStarted?(request: OrchestratorRequest, commands: AutomationCommand[]): void;
  onExecutionProgress?(request: OrchestratorRequest, progress: number): void;
  onExecutionCompleted?(request: OrchestratorRequest, result: any): void;
  onRequestCompleted?(request: OrchestratorRequest, result: OrchestratorResult): void;
  onRequestFailed?(request: OrchestratorRequest, error: RayError): void;
  onStatusUpdate?(request: OrchestratorRequest, status: UIStatus): void;
}

export class Orchestrator {
  private config: OrchestratorConfig;
  private openRouterClient: OpenRouterClient;
  private commandParser: CommandParser;
  private commandValidator: CommandValidator;
  private contextManager: ContextManager;
  private executionEngine: ExecutionEngine;
  private activeRequests: Map<string, OrchestratorResult> = new Map();
  private eventListeners: OrchestratorEventListener[] = [];

  constructor(
    openRouterClient: OpenRouterClient,
    config: Partial<OrchestratorConfig> = {}
  ) {
    this.config = {
      enableAutoRetry: true,
      maxRetryAttempts: 3,
      enableProgressReporting: true,
      enableConfirmationForHighRisk: true,
      defaultTimeout: 60000, // 1 minute
      ...config,
    };

    this.openRouterClient = openRouterClient;
    this.commandParser = new CommandParser(openRouterClient);
    this.commandValidator = new CommandValidator();
    this.contextManager = new ContextManager();
    this.executionEngine = new ExecutionEngine(this.contextManager);

    this.setupExecutionEngineListeners();
  }

  /**
   * Process natural language command
   */
  async processCommand(
    command: string,
    userId: string,
    context?: CommandContext,
    priority: OrchestratorRequest['priority'] = 'normal'
  ): Promise<OrchestratorResult> {
    const request: OrchestratorRequest = {
      id: this.generateRequestId(),
      userId,
      command,
      context,
      priority,
    };

    return this.executeRequest(request);
  }

  /**
   * Process parsed commands directly
   */
  async processParsedCommands(
    commands: EnhancedParsedCommand[],
    userId: string,
    context?: CommandContext,
    priority: OrchestratorRequest['priority'] = 'normal'
  ): Promise<OrchestratorResult> {
    // Create a mock request for parsed commands
    const request: OrchestratorRequest = {
      id: this.generateRequestId(),
      userId,
      command: commands.map(cmd => cmd.originalText).join('; '),
      context,
      priority,
    };

    return this.executeRequestWithParsedCommands(request, commands);
  }

  /**
   * Get request status
   */
  getRequestStatus(requestId: string): OrchestratorResult | null {
    return this.activeRequests.get(requestId) || null;
  }

  /**
   * Cancel request
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      return false;
    }

    request.status = 'cancelled';
    request.endTime = Date.now();

    // Cancel execution if running
    if (request.executionResult) {
      await this.executionEngine.cancelExecution(request.executionResult.id);
    }

    return true;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: OrchestratorEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: OrchestratorEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Execute request
   */
  private async executeRequest(request: OrchestratorRequest): Promise<OrchestratorResult> {
    const result: OrchestratorResult = {
      id: request.id,
      status: 'pending',
      startTime: Date.now(),
      errors: [],
      warnings: [],
    };

    this.activeRequests.set(request.id, result);
    this.notifyRequestStarted(request);

    try {
      // Create execution context
      const context = this.contextManager.createContext(
        request.userId,
        request.context?.tabId,
        request.context?.currentUrl
      );

      // Update context with additional information
      if (request.context) {
        this.contextManager.updateContext(context.id, {
          variables: new Map(Object.entries(request.context)),
        });
      }

      // Step 1: Parse command
      result.status = 'parsing';
      this.notifyParsingStarted(request);

      const parsingResult = await this.commandParser.parseCommand(
        request.command,
        request.context
      );

      result.parsingResult = parsingResult;
      result.warnings.push(...parsingResult.warnings);

      this.notifyParsingCompleted(request, parsingResult);

      // Check if parsing requires clarification
      if (parsingResult.requiresClarification) {
        result.status = 'completed';
        result.endTime = Date.now();
        this.notifyRequestCompleted(request, result);
        return result;
      }

      // Step 2: Validate commands
      result.status = 'validating';
      this.notifyValidationStarted(request, parsingResult.commands);

      const validationResult = this.commandValidator.validateCommands(
        parsingResult.commands,
        request.context
      );

      result.validationResult = validationResult;
      result.warnings.push(...validationResult.warnings);

      this.notifyValidationCompleted(request, validationResult);

      // Check if validation failed
      if (!validationResult.isValid) {
        result.status = 'failed';
        result.endTime = Date.now();
        result.errors.push(...validationResult.errors.map(error => ({
          code: 'VALIDATION_ERROR',
          message: error,
          timestamp: Date.now(),
        })));
        this.notifyRequestFailed(request, result.errors[0]);
        return result;
      }

      // Step 3: Check for confirmation
      if (this.config.enableConfirmationForHighRisk && validationResult.requiresConfirmation) {
        result.status = 'completed';
        result.endTime = Date.now();
        result.warnings.push('High-risk command requires user confirmation');
        this.notifyRequestCompleted(request, result);
        return result;
      }

      // Step 4: Execute commands
      result.status = 'executing';
      this.notifyExecutionStarted(request, validationResult.sanitizedCommands!);

      const executionResult = await this.executionEngine.executeCommands(
        validationResult.sanitizedCommands!,
        context.id,
        request.priority
      );

      result.executionResult = executionResult;

      if (executionResult.status === 'completed') {
        result.status = 'completed';
        result.endTime = Date.now();
        this.notifyRequestCompleted(request, result);
      } else {
        result.status = 'failed';
        result.endTime = Date.now();
        result.errors.push(...executionResult.errors);
        this.notifyRequestFailed(request, executionResult.errors[0]);
      }

    } catch (error) {
      result.status = 'failed';
      result.endTime = Date.now();
      
      const rayError: RayError = {
        code: 'ORCHESTRATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown orchestration error',
        timestamp: Date.now(),
        details: error,
      };

      result.errors.push(rayError);
      this.notifyRequestFailed(request, rayError);
    }

    return result;
  }

  /**
   * Execute request with pre-parsed commands
   */
  private async executeRequestWithParsedCommands(
    request: OrchestratorRequest,
    commands: EnhancedParsedCommand[]
  ): Promise<OrchestratorResult> {
    const result: OrchestratorResult = {
      id: request.id,
      status: 'pending',
      startTime: Date.now(),
      errors: [],
      warnings: [],
    };

    this.activeRequests.set(request.id, result);
    this.notifyRequestStarted(request);

    try {
      // Create execution context
      const context = this.contextManager.createContext(
        request.userId,
        request.context?.tabId,
        request.context?.currentUrl
      );

      // Update context with additional information
      if (request.context) {
        this.contextManager.updateContext(context.id, {
          variables: new Map(Object.entries(request.context)),
        });
      }

      // Step 1: Validate commands
      result.status = 'validating';
      this.notifyValidationStarted(request, commands);

      const validationResult = this.commandValidator.validateCommands(
        commands,
        request.context
      );

      result.validationResult = validationResult;
      result.warnings.push(...validationResult.warnings);

      this.notifyValidationCompleted(request, validationResult);

      // Check if validation failed
      if (!validationResult.isValid) {
        result.status = 'failed';
        result.endTime = Date.now();
        result.errors.push(...validationResult.errors.map(error => ({
          code: 'VALIDATION_ERROR',
          message: error,
          timestamp: Date.now(),
        })));
        this.notifyRequestFailed(request, result.errors[0]);
        return result;
      }

      // Step 2: Check for confirmation
      if (this.config.enableConfirmationForHighRisk && validationResult.requiresConfirmation) {
        result.status = 'completed';
        result.endTime = Date.now();
        result.warnings.push('High-risk command requires user confirmation');
        this.notifyRequestCompleted(request, result);
        return result;
      }

      // Step 3: Execute commands
      result.status = 'executing';
      this.notifyExecutionStarted(request, validationResult.sanitizedCommands!);

      const executionResult = await this.executionEngine.executeCommands(
        validationResult.sanitizedCommands!,
        context.id,
        request.priority
      );

      result.executionResult = executionResult;

      if (executionResult.status === 'completed') {
        result.status = 'completed';
        result.endTime = Date.now();
        this.notifyRequestCompleted(request, result);
      } else {
        result.status = 'failed';
        result.endTime = Date.now();
        result.errors.push(...executionResult.errors);
        this.notifyRequestFailed(request, executionResult.errors[0]);
      }

    } catch (error) {
      result.status = 'failed';
      result.endTime = Date.now();
      
      const rayError: RayError = {
        code: 'ORCHESTRATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown orchestration error',
        timestamp: Date.now(),
        details: error,
      };

      result.errors.push(rayError);
      this.notifyRequestFailed(request, rayError);
    }

    return result;
  }

  /**
   * Setup execution engine listeners
   */
  private setupExecutionEngineListeners(): void {
    this.executionEngine.addEventListener({
      onExecutionProgress: (request, progress) => {
        // Find orchestrator request
        const orchestratorRequest = Array.from(this.activeRequests.values())
          .find(result => result.executionResult?.id === request.id);
        
        if (orchestratorRequest) {
          this.notifyStatusUpdate(
            { id: orchestratorRequest.id, userId: '', command: '' },
            {
              status: 'processing',
              message: `Executing commands... ${Math.round(progress)}%`,
              progress,
              timestamp: Date.now(),
            }
          );
        }
      },
    } as ExecutionEventListener);
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Event notification methods
   */
  private notifyRequestStarted(request: OrchestratorRequest): void {
    this.eventListeners.forEach(listener => {
      if (listener.onRequestStarted) {
        listener.onRequestStarted(request);
      }
    });
  }

  private notifyParsingStarted(request: OrchestratorRequest): void {
    this.eventListeners.forEach(listener => {
      if (listener.onParsingStarted) {
        listener.onParsingStarted(request);
      }
    });
  }

  private notifyParsingCompleted(request: OrchestratorRequest, result: ParsingResult): void {
    this.eventListeners.forEach(listener => {
      if (listener.onParsingCompleted) {
        listener.onParsingCompleted(request, result);
      }
    });
  }

  private notifyValidationStarted(request: OrchestratorRequest, commands: EnhancedParsedCommand[]): void {
    this.eventListeners.forEach(listener => {
      if (listener.onValidationStarted) {
        listener.onValidationStarted(request, commands);
      }
    });
  }

  private notifyValidationCompleted(request: OrchestratorRequest, result: ValidationResult): void {
    this.eventListeners.forEach(listener => {
      if (listener.onValidationCompleted) {
        listener.onValidationCompleted(request, result);
      }
    });
  }

  private notifyExecutionStarted(request: OrchestratorRequest, commands: AutomationCommand[]): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionStarted) {
        listener.onExecutionStarted(request, commands);
      }
    });
  }

  private notifyExecutionProgress(request: OrchestratorRequest, progress: number): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionProgress) {
        listener.onExecutionProgress(request, progress);
      }
    });
  }

  private notifyExecutionCompleted(request: OrchestratorRequest, result: any): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionCompleted) {
        listener.onExecutionCompleted(request, result);
      }
    });
  }

  private notifyRequestCompleted(request: OrchestratorRequest, result: OrchestratorResult): void {
    this.eventListeners.forEach(listener => {
      if (listener.onRequestCompleted) {
        listener.onRequestCompleted(request, result);
      }
    });
  }

  private notifyRequestFailed(request: OrchestratorRequest, error: RayError): void {
    this.eventListeners.forEach(listener => {
      if (listener.onRequestFailed) {
        listener.onRequestFailed(request, error);
      }
    });
  }

  private notifyStatusUpdate(request: OrchestratorRequest, status: UIStatus): void {
    this.eventListeners.forEach(listener => {
      if (listener.onStatusUpdate) {
        listener.onStatusUpdate(request, status);
      }
    });
  }

  /**
   * Get active requests
   */
  getActiveRequests(): OrchestratorResult[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    activeRequests: number;
    totalRequests: number;
    successRate: number;
    averageProcessingTime: number;
  } {
    const activeRequests = Array.from(this.activeRequests.values())
      .filter(req => req.status === 'parsing' || req.status === 'validating' || req.status === 'executing').length;
    
    const completedRequests = Array.from(this.activeRequests.values())
      .filter(req => req.status === 'completed');
    
    const failedRequests = Array.from(this.activeRequests.values())
      .filter(req => req.status === 'failed');

    const totalRequests = completedRequests.length + failedRequests.length;
    const successRate = totalRequests > 0 ? completedRequests.length / totalRequests : 0;

    let averageProcessingTime = 0;
    if (completedRequests.length > 0) {
      const totalTime = completedRequests.reduce((sum, req) => {
        return sum + (req.endTime! - req.startTime);
      }, 0);
      averageProcessingTime = totalTime / completedRequests.length;
    }

    return {
      activeRequests,
      totalRequests,
      successRate,
      averageProcessingTime,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get dependencies
   */
  getDependencies(): {
    openRouterClient: OpenRouterClient;
    commandParser: CommandParser;
    commandValidator: CommandValidator;
    contextManager: ContextManager;
    executionEngine: ExecutionEngine;
  } {
    return {
      openRouterClient: this.openRouterClient,
      commandParser: this.commandParser,
      commandValidator: this.commandValidator,
      contextManager: this.contextManager,
      executionEngine: this.executionEngine,
    };
  }
}
