/**
 * Task processor for handling AI command processing in background
 */

import { OpenRouterClient } from '../openrouter/client';
import { CommandParser } from '../commands/parser';
import { CommandValidator } from '../commands/validator';
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

export interface TaskProcessorConfig {
  maxConcurrentTasks: number;
  taskTimeout: number;
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  enablePersistence: boolean;
}

export interface Task {
  id: string;
  type: 'parse' | 'validate' | 'execute' | 'complete';
  data: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timestamp: number;
  timeout: number;
  retries: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: any;
  error?: RayError;
}

export interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed' | 'cancelled';
  result?: any;
  error?: RayError;
  processingTime: number;
}

export class TaskProcessor {
  private config: TaskProcessorConfig;
  private openRouterClient: OpenRouterClient;
  private commandParser: CommandParser;
  private commandValidator: CommandValidator;
  private taskQueue: Task[] = [];
  private activeTasks: Map<string, Task> = new Map();
  private taskHistory: TaskResult[] = [];
  private eventListeners: Map<string, Function[]> = new Map();
  private isProcessing: boolean = false;

  constructor(
    openRouterClient: OpenRouterClient,
    config: Partial<TaskProcessorConfig> = {}
  ) {
    this.config = {
      maxConcurrentTasks: 3,
      taskTimeout: 60000, // 1 minute
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      enablePersistence: true,
      ...config,
    };

    this.openRouterClient = openRouterClient;
    this.commandParser = new CommandParser(openRouterClient);
    this.commandValidator = new CommandValidator();

    this.startTaskProcessor();
  }

  /**
   * Add task to queue
   */
  addTask(
    type: Task['type'],
    data: any,
    priority: Task['priority'] = 'normal',
    timeout?: number
  ): string {
    const task: Task = {
      id: this.generateTaskId(),
      type,
      data,
      priority,
      timestamp: Date.now(),
      timeout: timeout || this.config.taskTimeout,
      retries: 0,
      status: 'pending',
    };

    this.taskQueue.push(task);
    this.sortTaskQueue();
    this.persistTasks();

    return task.id;
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): Task | null {
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) {
      return activeTask;
    }

    const queuedTask = this.taskQueue.find(task => task.id === taskId);
    return queuedTask || null;
  }

  /**
   * Cancel task
   */
  cancelTask(taskId: string): boolean {
    // Check active tasks
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) {
      activeTask.status = 'cancelled';
      this.activeTasks.delete(taskId);
      this.emit('taskCancelled', { taskId, task: activeTask });
      this.persistTasks();
      return true;
    }

    // Check queued tasks
    const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
    if (queueIndex > -1) {
      const cancelledTask = this.taskQueue.splice(queueIndex, 1)[0];
      cancelledTask.status = 'cancelled';
      this.emit('taskCancelled', { taskId, task: cancelledTask });
      this.persistTasks();
      return true;
    }

    return false;
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Process command (high-level API)
   */
  async processCommand(
    command: string,
    context?: CommandContext,
    priority: Task['priority'] = 'normal'
  ): Promise<TaskResult> {
    const taskId = this.addTask('complete', {
      command,
      context,
      priority,
    }, priority);

    return new Promise((resolve, reject) => {
      const checkResult = () => {
        const task = this.getTaskStatus(taskId);
        if (task && (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled')) {
          const historyEntry = this.taskHistory.find(result => result.taskId === taskId);
          if (historyEntry) {
            resolve(historyEntry);
          } else {
            reject(new Error('Task result not found in history'));
          }
        } else {
          setTimeout(checkResult, 100);
        }
      };

      checkResult();
    });
  }

  /**
   * Start task processor
   */
  private startTaskProcessor(): void {
    setInterval(() => {
      this.processTaskQueue();
    }, 100);
  }

  /**
   * Process task queue
   */
  private async processTaskQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Check concurrent task limit
      const activeCount = this.activeTasks.size;
      const availableSlots = this.config.maxConcurrentTasks - activeCount;

      if (availableSlots <= 0) {
        return;
      }

      // Process available tasks
      const tasksToProcess = this.taskQueue.splice(0, availableSlots);
      
      for (const task of tasksToProcess) {
        this.activeTasks.set(task.id, task);
        this.processTask(task);
      }

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual task
   */
  private async processTask(task: Task): Promise<void> {
    task.status = 'running';
    this.emit('taskStarted', { taskId: task.id, task });

    const startTime = Date.now();

    try {
      let result: any;

      switch (task.type) {
        case 'parse':
          result = await this.processParseTask(task);
          break;
        case 'validate':
          result = await this.processValidateTask(task);
          break;
        case 'execute':
          result = await this.processExecuteTask(task);
          break;
        case 'complete':
          result = await this.processCompleteTask(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      task.status = 'completed';
      task.result = result;
      task.error = undefined;

      const taskResult: TaskResult = {
        taskId: task.id,
        status: 'completed',
        result,
        processingTime: Date.now() - startTime,
      };

      this.taskHistory.push(taskResult);
      this.emit('taskCompleted', { taskId: task.id, task, result: taskResult });

    } catch (error) {
      task.status = 'failed';
      task.error = {
        code: 'TASK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown task error',
        timestamp: Date.now(),
        details: error,
      };

      const taskResult: TaskResult = {
        taskId: task.id,
        status: 'failed',
        error: task.error,
        processingTime: Date.now() - startTime,
      };

      this.taskHistory.push(taskResult);
      this.emit('taskFailed', { taskId: task.id, task, result: taskResult });

      // Check if we should retry
      if (this.config.enableRetry && task.retries < this.config.maxRetries) {
        task.retries++;
        task.status = 'pending';
        
        setTimeout(() => {
          this.taskQueue.push(task);
          this.sortTaskQueue();
        }, this.config.retryDelay * task.retries);
      }
    } finally {
      this.activeTasks.delete(task.id);
      this.persistTasks();
    }
  }

  /**
   * Process parse task
   */
  private async processParseTask(task: Task): Promise<any> {
    const { command, context } = task.data;
    const parsingResult = await this.commandParser.parseCommand(command, context);
    return parsingResult;
  }

  /**
   * Process validate task
   */
  private async processValidateTask(task: Task): Promise<any> {
    const { commands, context } = task.data;
    const validationResult = this.commandValidator.validateCommands(commands, context);
    return validationResult;
  }

  /**
   * Process execute task
   */
  private async processExecuteTask(task: Task): Promise<any> {
    const { commands, contextId } = task.data;
    
    // This would delegate to the execution engine
    // For now, return a mock result
    return {
      status: 'completed',
      executedCommands: commands.length,
      contextId,
    };
  }

  /**
   * Process complete task (full command processing)
   */
  private async processCompleteTask(task: Task): Promise<any> {
    const { command, context, priority } = task.data;
    
    try {
      // Step 1: Parse command
      const parsingResult = await this.commandParser.parseCommand(command, context);
      
      if (parsingResult.requiresClarification) {
        return {
          status: 'needs_clarification',
          parsingResult,
        };
      }

      // Step 2: Validate commands
      const validationResult = this.commandValidator.validateCommands(
        parsingResult.commands,
        context
      );

      if (!validationResult.isValid) {
        return {
          status: 'validation_failed',
          parsingResult,
          validationResult,
        };
      }

      // Step 3: Execute commands (mock for now)
      const executionResult = {
        status: 'completed',
        executedCommands: validationResult.sanitizedCommands!.length,
        commands: validationResult.sanitizedCommands,
      };

      return {
        status: 'completed',
        parsingResult,
        validationResult,
        executionResult,
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Sort task queue by priority
   */
  private sortTaskQueue(): void {
    const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
    
    this.taskQueue.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Generate task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Persist tasks to storage
   */
  private persistTasks(): void {
    if (!this.config.enablePersistence) {
      return;
    }

    try {
      const data = {
        taskQueue: this.taskQueue,
        activeTasks: Array.from(this.activeTasks.values()),
        taskHistory: this.taskHistory.slice(-100), // Keep last 100 tasks
      };

      chrome.storage.local.set({
        task_processor_data: data,
      });
    } catch (error) {
      console.error('Failed to persist tasks:', error);
    }
  }

  /**
   * Load persisted tasks from storage
   */
  private async loadPersistedTasks(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    try {
      const result = await chrome.storage.local.get(['task_processor_data']);
      const data = result.task_processor_data;

      if (data) {
        if (data.taskQueue) {
          this.taskQueue = data.taskQueue;
        }
        if (data.activeTasks) {
          data.activeTasks.forEach((task: Task) => {
            this.activeTasks.set(task.id, task);
          });
        }
        if (data.taskHistory) {
          this.taskHistory = data.taskHistory;
        }
      }
    } catch (error) {
      console.error('Failed to load persisted tasks:', error);
    }
  }

  /**
   * Get task statistics
   */
  getStatistics(): {
    queueLength: number;
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageProcessingTime: number;
    totalProcessed: number;
  } {
    const completedTasks = this.taskHistory.filter(result => result.status === 'completed');
    const failedTasks = this.taskHistory.filter(result => result.status === 'failed');

    let averageProcessingTime = 0;
    if (completedTasks.length > 0) {
      const totalTime = completedTasks.reduce((sum, result) => {
        return sum + result.processingTime;
      }, 0);
      averageProcessingTime = totalTime / completedTasks.length;
    }

    return {
      queueLength: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      averageProcessingTime,
      totalProcessed: this.taskHistory.length,
    };
  }

  /**
   * Clear task history
   */
  clearHistory(): void {
    this.taskHistory = [];
    this.persistTasks();
  }

  /**
   * Clear all tasks
   */
  clearAllTasks(): void {
    this.taskQueue = [];
    this.activeTasks.clear();
    this.taskHistory = [];
    this.persistTasks();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TaskProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get configuration
   */
  getConfig(): TaskProcessorConfig {
    return { ...this.config };
  }
}
