/**
 * Execution engine for command coordination and execution
 */

import { 
  AutomationCommand, 
  ExecutionContext, 
  UIStatus, 
  AgentMessage,
  RayError
} from '../shared/contracts';
import { EnhancedParsedCommand } from '../commands/types';
import { ContextManager } from './context-manager';

export interface ExecutionEngineConfig {
  maxConcurrentExecutions: number;
  defaultTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableParallelExecution: boolean;
  progressReportingEnabled: boolean;
}

export interface ExecutionRequest {
  id: string;
  contextId: string;
  commands: AutomationCommand[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout?: number;
  retries?: number;
  metadata?: Record<string, any>;
}

export interface ExecutionResult {
  id: string;
  contextId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  results: CommandResult[];
  errors: RayError[];
  metadata?: Record<string, any>;
}

export interface CommandResult {
  command: AutomationCommand;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime: number;
  endTime?: number;
  result?: any;
  error?: RayError;
  retryCount: number;
}

export interface ExecutionEventListener {
  onExecutionStarted?(request: ExecutionRequest): void;
  onExecutionProgress?(request: ExecutionRequest, progress: number): void;
  onExecutionCompleted?(request: ExecutionRequest, result: ExecutionResult): void;
  onExecutionFailed?(request: ExecutionRequest, error: RayError): void;
  onCommandStarted?(command: AutomationCommand, context: ExecutionContext): void;
  onCommandCompleted?(command: AutomationCommand, result: any, context: ExecutionContext): void;
  onCommandFailed?(command: AutomationCommand, error: RayError, context: ExecutionContext): void;
}

export class ExecutionEngine {
  private config: ExecutionEngineConfig;
  private contextManager: ContextManager;
  private activeExecutions: Map<string, ExecutionResult> = new Map();
  private executionQueue: ExecutionRequest[] = [];
  private eventListeners: ExecutionEventListener[] = [];
  private isProcessing: boolean = false;

  constructor(
    contextManager: ContextManager,
    config: Partial<ExecutionEngineConfig> = {}
  ) {
    this.contextManager = contextManager;
    this.config = {
      maxConcurrentExecutions: 3,
      defaultTimeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      enableParallelExecution: true,
      progressReportingEnabled: true,
      ...config,
    };

    this.startQueueProcessor();
  }

  /**
   * Execute parsed commands
   */
  async executeCommands(
    commands: EnhancedParsedCommand[],
    contextId: string,
    priority: ExecutionRequest['priority'] = 'normal'
  ): Promise<ExecutionResult> {
    // Convert parsed commands to automation commands
    const automationCommands = commands.map(cmd => this.convertToAutomationCommand(cmd));
    
    const request: ExecutionRequest = {
      id: this.generateExecutionId(),
      contextId,
      commands: automationCommands,
      priority,
    };

    return this.executeRequest(request);
  }

  /**
   * Execute automation commands
   */
  async executeAutomationCommands(
    commands: AutomationCommand[],
    contextId: string,
    priority: ExecutionRequest['priority'] = 'normal'
  ): Promise<ExecutionResult> {
    const request: ExecutionRequest = {
      id: this.generateExecutionId(),
      contextId,
      commands,
      priority,
    };

    return this.executeRequest(request);
  }

  /**
   * Execute single command
   */
  async executeCommand(
    command: AutomationCommand,
    contextId: string,
    priority: ExecutionRequest['priority'] = 'normal'
  ): Promise<ExecutionResult> {
    const request: ExecutionRequest = {
      id: this.generateExecutionId(),
      contextId,
      commands: [command],
      priority,
    };

    return this.executeRequest(request);
  }

  /**
   * Get execution status
   */
  getExecutionStatus(executionId: string): ExecutionResult | null {
    return this.activeExecutions.get(executionId) || null;
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    execution.status = 'cancelled';
    execution.endTime = Date.now();

    // Cancel running commands
    for (const result of execution.results) {
      if (result.status === 'running') {
        result.status = 'cancelled';
        result.endTime = Date.now();
      }
    }

    this.activeExecutions.delete(executionId);
    return true;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: ExecutionEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: ExecutionEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): ExecutionResult[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get execution queue
   */
  getExecutionQueue(): ExecutionRequest[] {
    return [...this.executionQueue];
  }

  /**
   * Execute request
   */
  private async executeRequest(request: ExecutionRequest): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      // Add to queue
      this.executionQueue.push(request);
      
      // Sort queue by priority
      this.executionQueue.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      // Set up result handler
      const checkResult = () => {
        const result = this.activeExecutions.get(request.id);
        if (result && (result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled')) {
          resolve(result);
        } else {
          setTimeout(checkResult, 100);
        }
      };

      checkResult();
    });
  }

  /**
   * Process execution queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.executionQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Check concurrent execution limit
      const runningExecutions = Array.from(this.activeExecutions.values())
        .filter(exec => exec.status === 'running');
      
      if (runningExecutions.length >= this.config.maxConcurrentExecutions) {
        return;
      }

      // Get next request from queue
      const request = this.executionQueue.shift();
      if (!request) {
        return;
      }

      // Execute the request
      this.executeRequestInternal(request);

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute request internally
   */
  private async executeRequestInternal(request: ExecutionRequest): Promise<void> {
    const context = this.contextManager.getContext(request.contextId);
    if (!context) {
      const error: RayError = {
        code: 'CONTEXT_NOT_FOUND',
        message: `Execution context ${request.contextId} not found`,
        timestamp: Date.now(),
      };
      
      const result: ExecutionResult = {
        id: request.id,
        contextId: request.contextId,
        status: 'failed',
        startTime: Date.now(),
        endTime: Date.now(),
        results: [],
        errors: [error],
      };

      this.activeExecutions.set(request.id, result);
      this.notifyExecutionFailed(request, error);
      return;
    }

    // Create execution result
    const result: ExecutionResult = {
      id: request.id,
      contextId: request.contextId,
      status: 'running',
      startTime: Date.now(),
      results: request.commands.map(cmd => ({
        command: cmd,
        status: 'pending',
        startTime: 0,
        retryCount: 0,
      })),
      errors: [],
    };

    this.activeExecutions.set(request.id, result);
    this.contextManager.updateContext(request.contextId, { status: 'running' });
    this.notifyExecutionStarted(request);

    try {
      // Execute commands
      if (this.config.enableParallelExecution && this.canExecuteParallel(request.commands)) {
        await this.executeCommandsParallel(request, result, context);
      } else {
        await this.executeCommandsSequential(request, result, context);
      }

      // Update final status
      const hasFailures = result.results.some(r => r.status === 'failed');
      result.status = hasFailures ? 'failed' : 'completed';
      result.endTime = Date.now();

      this.contextManager.updateContext(request.contextId, { 
        status: hasFailures ? 'failed' : 'completed' 
      });

      this.notifyExecutionCompleted(request, result);

    } catch (error) {
      const rayError: RayError = {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown execution error',
        timestamp: Date.now(),
        details: error,
      };

      result.status = 'failed';
      result.endTime = Date.now();
      result.errors.push(rayError);

      this.contextManager.updateContext(request.contextId, { status: 'failed' });
      this.notifyExecutionFailed(request, rayError);
    }
  }

  /**
   * Execute commands sequentially
   */
  private async executeCommandsSequential(
    request: ExecutionRequest,
    result: ExecutionResult,
    context: ExecutionContext
  ): Promise<void> {
    for (let i = 0; i < request.commands.length; i++) {
      const command = request.commands[i];
      const commandResult = result.results[i];

      try {
        await this.executeSingleCommand(command, commandResult, context, i + 1, request.commands.length);
      } catch (error) {
        // Continue with next command even if one fails
        const rayError: RayError = {
          code: 'COMMAND_ERROR',
          message: error instanceof Error ? error.message : 'Command execution error',
          timestamp: Date.now(),
          details: error,
        };

        commandResult.status = 'failed';
        commandResult.error = rayError;
        result.errors.push(rayError);
      }

      // Report progress
      if (this.config.progressReportingEnabled) {
        const progress = ((i + 1) / request.commands.length) * 100;
        this.notifyExecutionProgress(request, progress);
      }
    }
  }

  /**
   * Execute commands in parallel
   */
  private async executeCommandsParallel(
    request: ExecutionRequest,
    result: ExecutionResult,
    context: ExecutionContext
  ): Promise<void> {
    const promises = request.commands.map(async (command, index) => {
      const commandResult = result.results[index];
      
      try {
        await this.executeSingleCommand(command, commandResult, context, index + 1, request.commands.length);
      } catch (error) {
        const rayError: RayError = {
          code: 'COMMAND_ERROR',
          message: error instanceof Error ? error.message : 'Command execution error',
          timestamp: Date.now(),
          details: error,
        };

        commandResult.status = 'failed';
        commandResult.error = rayError;
        result.errors.push(rayError);
      }
    });

    await Promise.all(promises);

    // Report final progress
    if (this.config.progressReportingEnabled) {
      this.notifyExecutionProgress(request, 100);
    }
  }

  /**
   * Execute single command
   */
  private async executeSingleCommand(
    command: AutomationCommand,
    commandResult: CommandResult,
    context: ExecutionContext,
    currentStep: number,
    totalSteps: number
  ): Promise<any> {
    commandResult.status = 'running';
    commandResult.startTime = Date.now();

    this.notifyCommandStarted(command, context);

    try {
      // Send command to content script for execution
      const result = await this.sendCommandToContentScript(command, context.tabId);
      
      commandResult.status = 'completed';
      commandResult.endTime = Date.now();
      commandResult.result = result;

      // Add to context history
      this.contextManager.addCommandToHistory(context.id, command);

      this.notifyCommandCompleted(command, result, context);
      return result;

    } catch (error) {
      // Check if we should retry
      if (commandResult.retryCount < (request.retries || this.config.retryAttempts)) {
        commandResult.retryCount++;
        commandResult.status = 'pending';
        
        // Wait before retry
        await this.sleep(this.config.retryDelay * commandResult.retryCount);
        
        return this.executeSingleCommand(command, commandResult, context, currentStep, totalSteps);
      }

      throw error;
    }
  }

  /**
   * Send command to content script
   */
  private async sendCommandToContentScript(
    command: AutomationCommand,
    tabId?: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = command.timeout || this.config.defaultTimeout;
      
      const messageHandler = (message: any) => {
        if (message.type === 'command_response' && message.commandId === command.id) {
          chrome.runtime.onMessage.removeListener(messageHandler);
          
          if (message.success) {
            resolve(message.result);
          } else {
            reject(new Error(message.error || 'Command execution failed'));
          }
        }
      };

      chrome.runtime.onMessage.addListener(messageHandler);

      // Send command to content script
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'execute_command',
          command,
        });
      } else {
        // Send to active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id!, {
              type: 'execute_command',
              command,
            });
          } else {
            reject(new Error('No active tab found'));
          }
        });
      }

      // Set timeout
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageHandler);
        reject(new Error('Command execution timeout'));
      }, timeout);
    });
  }

  /**
   * Check if commands can be executed in parallel
   */
  private canExecuteParallel(commands: AutomationCommand[]): boolean {
    // Commands that modify the page state shouldn't run in parallel
    const stateModifyingCommands = ['navigate', 'fill', 'submit', 'click'];
    
    for (const command of commands) {
      if (stateModifyingCommands.includes(command.type)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert parsed command to automation command
   */
  private convertToAutomationCommand(parsedCommand: EnhancedParsedCommand): AutomationCommand {
    return {
      id: this.generateCommandId(),
      type: parsedCommand.intent as any,
      selector: parsedCommand.parameters.selector,
      value: parsedCommand.parameters.value,
      url: parsedCommand.parameters.url,
      timeout: parsedCommand.parameters.timeout,
      options: parsedCommand.parameters.options,
    };
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate command ID
   */
  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 100);
  }

  /**
   * Event notification methods
   */
  private notifyExecutionStarted(request: ExecutionRequest): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionStarted) {
        listener.onExecutionStarted(request);
      }
    });
  }

  private notifyExecutionProgress(request: ExecutionRequest, progress: number): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionProgress) {
        listener.onExecutionProgress(request, progress);
      }
    });
  }

  private notifyExecutionCompleted(request: ExecutionRequest, result: ExecutionResult): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionCompleted) {
        listener.onExecutionCompleted(request, result);
      }
    });
  }

  private notifyExecutionFailed(request: ExecutionRequest, error: RayError): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionFailed) {
        listener.onExecutionFailed(request, error);
      }
    });
  }

  private notifyCommandStarted(command: AutomationCommand, context: ExecutionContext): void {
    this.eventListeners.forEach(listener => {
      if (listener.onCommandStarted) {
        listener.onCommandStarted(command, context);
      }
    });
  }

  private notifyCommandCompleted(command: AutomationCommand, result: any, context: ExecutionContext): void {
    this.eventListeners.forEach(listener => {
      if (listener.onCommandCompleted) {
        listener.onCommandCompleted(command, result, context);
      }
    });
  }

  private notifyCommandFailed(command: AutomationCommand, error: RayError, context: ExecutionContext): void {
    this.eventListeners.forEach(listener => {
      if (listener.onCommandFailed) {
        listener.onCommandFailed(command, error, context);
      }
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ExecutionEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    activeExecutions: number;
    queuedExecutions: number;
    totalExecutions: number;
    averageExecutionTime: number;
    successRate: number;
  } {
    const activeExecutions = Array.from(this.activeExecutions.values())
      .filter(exec => exec.status === 'running').length;
    
    const completedExecutions = Array.from(this.activeExecutions.values())
      .filter(exec => exec.status === 'completed');
    
    const failedExecutions = Array.from(this.activeExecutions.values())
      .filter(exec => exec.status === 'failed');

    const totalExecutions = completedExecutions.length + failedExecutions.length;
    const successRate = totalExecutions > 0 ? completedExecutions.length / totalExecutions : 0;

    let averageExecutionTime = 0;
    if (completedExecutions.length > 0) {
      const totalTime = completedExecutions.reduce((sum, exec) => {
        return sum + (exec.endTime! - exec.startTime);
      }, 0);
      averageExecutionTime = totalTime / completedExecutions.length;
    }

    return {
      activeExecutions,
      queuedExecutions: this.executionQueue.length,
      totalExecutions,
      averageExecutionTime,
      successRate,
    };
  }
} * Execution engine for command coordination and execution
 */

import { 
  AutomationCommand, 
  ExecutionContext, 
  UIStatus, 
  AgentMessage,
  RayError
} from '../shared/contracts';
import { EnhancedParsedCommand } from '../commands/types';
import { ContextManager } from './context-manager';

export interface ExecutionEngineConfig {
  maxConcurrentExecutions: number;
  defaultTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableParallelExecution: boolean;
  progressReportingEnabled: boolean;
}

export interface ExecutionRequest {
  id: string;
  contextId: string;
  commands: AutomationCommand[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout?: number;
  retries?: number;
  metadata?: Record<string, any>;
}

export interface ExecutionResult {
  id: string;
  contextId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  results: CommandResult[];
  errors: RayError[];
  metadata?: Record<string, any>;
}

export interface CommandResult {
  command: AutomationCommand;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime: number;
  endTime?: number;
  result?: any;
  error?: RayError;
  retryCount: number;
}

export interface ExecutionEventListener {
  onExecutionStarted?(request: ExecutionRequest): void;
  onExecutionProgress?(request: ExecutionRequest, progress: number): void;
  onExecutionCompleted?(request: ExecutionRequest, result: ExecutionResult): void;
  onExecutionFailed?(request: ExecutionRequest, error: RayError): void;
  onCommandStarted?(command: AutomationCommand, context: ExecutionContext): void;
  onCommandCompleted?(command: AutomationCommand, result: any, context: ExecutionContext): void;
  onCommandFailed?(command: AutomationCommand, error: RayError, context: ExecutionContext): void;
}

export class ExecutionEngine {
  private config: ExecutionEngineConfig;
  private contextManager: ContextManager;
  private activeExecutions: Map<string, ExecutionResult> = new Map();
  private executionQueue: ExecutionRequest[] = [];
  private eventListeners: ExecutionEventListener[] = [];
  private isProcessing: boolean = false;

  constructor(
    contextManager: ContextManager,
    config: Partial<ExecutionEngineConfig> = {}
  ) {
    this.contextManager = contextManager;
    this.config = {
      maxConcurrentExecutions: 3,
      defaultTimeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      enableParallelExecution: true,
      progressReportingEnabled: true,
      ...config,
    };

    this.startQueueProcessor();
  }

  /**
   * Execute parsed commands
   */
  async executeCommands(
    commands: EnhancedParsedCommand[],
    contextId: string,
    priority: ExecutionRequest['priority'] = 'normal'
  ): Promise<ExecutionResult> {
    // Convert parsed commands to automation commands
    const automationCommands = commands.map(cmd => this.convertToAutomationCommand(cmd));
    
    const request: ExecutionRequest = {
      id: this.generateExecutionId(),
      contextId,
      commands: automationCommands,
      priority,
    };

    return this.executeRequest(request);
  }

  /**
   * Execute automation commands
   */
  async executeAutomationCommands(
    commands: AutomationCommand[],
    contextId: string,
    priority: ExecutionRequest['priority'] = 'normal'
  ): Promise<ExecutionResult> {
    const request: ExecutionRequest = {
      id: this.generateExecutionId(),
      contextId,
      commands,
      priority,
    };

    return this.executeRequest(request);
  }

  /**
   * Execute single command
   */
  async executeCommand(
    command: AutomationCommand,
    contextId: string,
    priority: ExecutionRequest['priority'] = 'normal'
  ): Promise<ExecutionResult> {
    const request: ExecutionRequest = {
      id: this.generateExecutionId(),
      contextId,
      commands: [command],
      priority,
    };

    return this.executeRequest(request);
  }

  /**
   * Get execution status
   */
  getExecutionStatus(executionId: string): ExecutionResult | null {
    return this.activeExecutions.get(executionId) || null;
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    execution.status = 'cancelled';
    execution.endTime = Date.now();

    // Cancel running commands
    for (const result of execution.results) {
      if (result.status === 'running') {
        result.status = 'cancelled';
        result.endTime = Date.now();
      }
    }

    this.activeExecutions.delete(executionId);
    return true;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: ExecutionEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: ExecutionEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): ExecutionResult[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get execution queue
   */
  getExecutionQueue(): ExecutionRequest[] {
    return [...this.executionQueue];
  }

  /**
   * Execute request
   */
  private async executeRequest(request: ExecutionRequest): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      // Add to queue
      this.executionQueue.push(request);
      
      // Sort queue by priority
      this.executionQueue.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      // Set up result handler
      const checkResult = () => {
        const result = this.activeExecutions.get(request.id);
        if (result && (result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled')) {
          resolve(result);
        } else {
          setTimeout(checkResult, 100);
        }
      };

      checkResult();
    });
  }

  /**
   * Process execution queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.executionQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Check concurrent execution limit
      const runningExecutions = Array.from(this.activeExecutions.values())
        .filter(exec => exec.status === 'running');
      
      if (runningExecutions.length >= this.config.maxConcurrentExecutions) {
        return;
      }

      // Get next request from queue
      const request = this.executionQueue.shift();
      if (!request) {
        return;
      }

      // Execute the request
      this.executeRequestInternal(request);

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute request internally
   */
  private async executeRequestInternal(request: ExecutionRequest): Promise<void> {
    const context = this.contextManager.getContext(request.contextId);
    if (!context) {
      const error: RayError = {
        code: 'CONTEXT_NOT_FOUND',
        message: `Execution context ${request.contextId} not found`,
        timestamp: Date.now(),
      };
      
      const result: ExecutionResult = {
        id: request.id,
        contextId: request.contextId,
        status: 'failed',
        startTime: Date.now(),
        endTime: Date.now(),
        results: [],
        errors: [error],
      };

      this.activeExecutions.set(request.id, result);
      this.notifyExecutionFailed(request, error);
      return;
    }

    // Create execution result
    const result: ExecutionResult = {
      id: request.id,
      contextId: request.contextId,
      status: 'running',
      startTime: Date.now(),
      results: request.commands.map(cmd => ({
        command: cmd,
        status: 'pending',
        startTime: 0,
        retryCount: 0,
      })),
      errors: [],
    };

    this.activeExecutions.set(request.id, result);
    this.contextManager.updateContext(request.contextId, { status: 'running' });
    this.notifyExecutionStarted(request);

    try {
      // Execute commands
      if (this.config.enableParallelExecution && this.canExecuteParallel(request.commands)) {
        await this.executeCommandsParallel(request, result, context);
      } else {
        await this.executeCommandsSequential(request, result, context);
      }

      // Update final status
      const hasFailures = result.results.some(r => r.status === 'failed');
      result.status = hasFailures ? 'failed' : 'completed';
      result.endTime = Date.now();

      this.contextManager.updateContext(request.contextId, { 
        status: hasFailures ? 'failed' : 'completed' 
      });

      this.notifyExecutionCompleted(request, result);

    } catch (error) {
      const rayError: RayError = {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown execution error',
        timestamp: Date.now(),
        details: error,
      };

      result.status = 'failed';
      result.endTime = Date.now();
      result.errors.push(rayError);

      this.contextManager.updateContext(request.contextId, { status: 'failed' });
      this.notifyExecutionFailed(request, rayError);
    }
  }

  /**
   * Execute commands sequentially
   */
  private async executeCommandsSequential(
    request: ExecutionRequest,
    result: ExecutionResult,
    context: ExecutionContext
  ): Promise<void> {
    for (let i = 0; i < request.commands.length; i++) {
      const command = request.commands[i];
      const commandResult = result.results[i];

      try {
        await this.executeSingleCommand(command, commandResult, context, i + 1, request.commands.length);
      } catch (error) {
        // Continue with next command even if one fails
        const rayError: RayError = {
          code: 'COMMAND_ERROR',
          message: error instanceof Error ? error.message : 'Command execution error',
          timestamp: Date.now(),
          details: error,
        };

        commandResult.status = 'failed';
        commandResult.error = rayError;
        result.errors.push(rayError);
      }

      // Report progress
      if (this.config.progressReportingEnabled) {
        const progress = ((i + 1) / request.commands.length) * 100;
        this.notifyExecutionProgress(request, progress);
      }
    }
  }

  /**
   * Execute commands in parallel
   */
  private async executeCommandsParallel(
    request: ExecutionRequest,
    result: ExecutionResult,
    context: ExecutionContext
  ): Promise<void> {
    const promises = request.commands.map(async (command, index) => {
      const commandResult = result.results[index];
      
      try {
        await this.executeSingleCommand(command, commandResult, context, index + 1, request.commands.length);
      } catch (error) {
        const rayError: RayError = {
          code: 'COMMAND_ERROR',
          message: error instanceof Error ? error.message : 'Command execution error',
          timestamp: Date.now(),
          details: error,
        };

        commandResult.status = 'failed';
        commandResult.error = rayError;
        result.errors.push(rayError);
      }
    });

    await Promise.all(promises);

    // Report final progress
    if (this.config.progressReportingEnabled) {
      this.notifyExecutionProgress(request, 100);
    }
  }

  /**
   * Execute single command
   */
  private async executeSingleCommand(
    command: AutomationCommand,
    commandResult: CommandResult,
    context: ExecutionContext,
    currentStep: number,
    totalSteps: number
  ): Promise<any> {
    commandResult.status = 'running';
    commandResult.startTime = Date.now();

    this.notifyCommandStarted(command, context);

    try {
      // Send command to content script for execution
      const result = await this.sendCommandToContentScript(command, context.tabId);
      
      commandResult.status = 'completed';
      commandResult.endTime = Date.now();
      commandResult.result = result;

      // Add to context history
      this.contextManager.addCommandToHistory(context.id, command);

      this.notifyCommandCompleted(command, result, context);
      return result;

    } catch (error) {
      // Check if we should retry
      if (commandResult.retryCount < (request.retries || this.config.retryAttempts)) {
        commandResult.retryCount++;
        commandResult.status = 'pending';
        
        // Wait before retry
        await this.sleep(this.config.retryDelay * commandResult.retryCount);
        
        return this.executeSingleCommand(command, commandResult, context, currentStep, totalSteps);
      }

      throw error;
    }
  }

  /**
   * Send command to content script
   */
  private async sendCommandToContentScript(
    command: AutomationCommand,
    tabId?: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = command.timeout || this.config.defaultTimeout;
      
      const messageHandler = (message: any) => {
        if (message.type === 'command_response' && message.commandId === command.id) {
          chrome.runtime.onMessage.removeListener(messageHandler);
          
          if (message.success) {
            resolve(message.result);
          } else {
            reject(new Error(message.error || 'Command execution failed'));
          }
        }
      };

      chrome.runtime.onMessage.addListener(messageHandler);

      // Send command to content script
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'execute_command',
          command,
        });
      } else {
        // Send to active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id!, {
              type: 'execute_command',
              command,
            });
          } else {
            reject(new Error('No active tab found'));
          }
        });
      }

      // Set timeout
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageHandler);
        reject(new Error('Command execution timeout'));
      }, timeout);
    });
  }

  /**
   * Check if commands can be executed in parallel
   */
  private canExecuteParallel(commands: AutomationCommand[]): boolean {
    // Commands that modify the page state shouldn't run in parallel
    const stateModifyingCommands = ['navigate', 'fill', 'submit', 'click'];
    
    for (const command of commands) {
      if (stateModifyingCommands.includes(command.type)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert parsed command to automation command
   */
  private convertToAutomationCommand(parsedCommand: EnhancedParsedCommand): AutomationCommand {
    return {
      id: this.generateCommandId(),
      type: parsedCommand.intent as any,
      selector: parsedCommand.parameters.selector,
      value: parsedCommand.parameters.value,
      url: parsedCommand.parameters.url,
      timeout: parsedCommand.parameters.timeout,
      options: parsedCommand.parameters.options,
    };
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate command ID
   */
  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 100);
  }

  /**
   * Event notification methods
   */
  private notifyExecutionStarted(request: ExecutionRequest): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionStarted) {
        listener.onExecutionStarted(request);
      }
    });
  }

  private notifyExecutionProgress(request: ExecutionRequest, progress: number): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionProgress) {
        listener.onExecutionProgress(request, progress);
      }
    });
  }

  private notifyExecutionCompleted(request: ExecutionRequest, result: ExecutionResult): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionCompleted) {
        listener.onExecutionCompleted(request, result);
      }
    });
  }

  private notifyExecutionFailed(request: ExecutionRequest, error: RayError): void {
    this.eventListeners.forEach(listener => {
      if (listener.onExecutionFailed) {
        listener.onExecutionFailed(request, error);
      }
    });
  }

  private notifyCommandStarted(command: AutomationCommand, context: ExecutionContext): void {
    this.eventListeners.forEach(listener => {
      if (listener.onCommandStarted) {
        listener.onCommandStarted(command, context);
      }
    });
  }

  private notifyCommandCompleted(command: AutomationCommand, result: any, context: ExecutionContext): void {
    this.eventListeners.forEach(listener => {
      if (listener.onCommandCompleted) {
        listener.onCommandCompleted(command, result, context);
      }
    });
  }

  private notifyCommandFailed(command: AutomationCommand, error: RayError, context: ExecutionContext): void {
    this.eventListeners.forEach(listener => {
      if (listener.onCommandFailed) {
        listener.onCommandFailed(command, error, context);
      }
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ExecutionEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    activeExecutions: number;
    queuedExecutions: number;
    totalExecutions: number;
    averageExecutionTime: number;
    successRate: number;
  } {
    const activeExecutions = Array.from(this.activeExecutions.values())
      .filter(exec => exec.status === 'running').length;
    
    const completedExecutions = Array.from(this.activeExecutions.values())
      .filter(exec => exec.status === 'completed');
    
    const failedExecutions = Array.from(this.activeExecutions.values())
      .filter(exec => exec.status === 'failed');

    const totalExecutions = completedExecutions.length + failedExecutions.length;
    const successRate = totalExecutions > 0 ? completedExecutions.length / totalExecutions : 0;

    let averageExecutionTime = 0;
    if (completedExecutions.length > 0) {
      const totalTime = completedExecutions.reduce((sum, exec) => {
        return sum + (exec.endTime! - exec.startTime);
      }, 0);
      averageExecutionTime = totalTime / completedExecutions.length;
    }

    return {
      activeExecutions,
      queuedExecutions: this.executionQueue.length,
      totalExecutions,
      averageExecutionTime,
      successRate,
    };
  }
}
