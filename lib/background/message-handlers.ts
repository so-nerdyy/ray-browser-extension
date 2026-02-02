/**
 * Message handlers for background service worker communication
 */

import {
  AgentMessage,
  UIStatus,
  AutomationCommand,
  RayError
} from '../shared/contracts';
import { Orchestrator } from '../orchestration/orchestrator';

export interface MessageHandler {
  canHandle(message: any): boolean;
  handle(message: any, sender: chrome.runtime.MessageSender): Promise<any>;
}

export class MessageRouter {
  private handlers: Map<string, MessageHandler> = new Map();
  private orchestrator: Orchestrator;

  constructor(orchestrator: Orchestrator) {
    this.orchestrator = orchestrator;
    this.registerDefaultHandlers();
  }

  /**
   * Route message to appropriate handler
   */
  async routeMessage(
    message: any,
    sender: chrome.runtime.MessageSender
  ): Promise<any> {
    const messageType = message.type;
    const handler = this.handlers.get(messageType);

    if (!handler) {
      throw new Error(`No handler registered for message type: ${messageType}`);
    }

    if (!handler.canHandle(message)) {
      throw new Error(`Handler cannot handle message: ${JSON.stringify(message)}`);
    }

    try {
      return await handler.handle(message, sender);
    } catch (error) {
      console.error(`Error handling message ${messageType}:`, error);
      throw error;
    }
  }

  /**
   * Register message handler
   */
  registerHandler(messageType: string, handler: MessageHandler): void {
    this.handlers.set(messageType, handler);
  }

  /**
   * Unregister message handler
   */
  unregisterHandler(messageType: string): boolean {
    return this.handlers.delete(messageType);
  }

  /**
   * Register default handlers
   */
  private registerDefaultHandlers(): void {
    // Command execution handler
    this.registerHandler('execute_command', new ExecuteCommandHandler(this.orchestrator));

    // Status query handler
    this.registerHandler('get_status', new GetStatusHandler(this.orchestrator));

    // Request cancellation handler
    this.registerHandler('cancel_request', new CancelRequestHandler(this.orchestrator));

    // API key management handler
    this.registerHandler('update_api_key', new UpdateApiKeyHandler(this.orchestrator));

    // Statistics handler
    this.registerHandler('get_statistics', new GetStatisticsHandler(this.orchestrator));

    // Command response handler (from content script)
    this.registerHandler('command_response', new CommandResponseHandler(this.orchestrator));

    // Context update handler
    this.registerHandler('update_context', new UpdateContextHandler(this.orchestrator));

    // Settings handler
    this.registerHandler('get_settings', new GetSettingsHandler(this.orchestrator));
    this.registerHandler('update_settings', new UpdateSettingsHandler(this.orchestrator));
  }
}

/**
 * Execute command handler
 */
class ExecuteCommandHandler implements MessageHandler {
  constructor(private orchestrator: Orchestrator) {}

  canHandle(message: any): boolean {
    return message.type === 'execute_command' && message.command;
  }

  async handle(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    const { command, context, priority } = message;

    // Get user ID
    const userId = await this.getUserId();

    // Enhance context with sender information
    const enhancedContext = {
      ...context,
      tabId: sender.tab?.id,
      currentUrl: sender.tab?.url,
      pageTitle: sender.tab?.title,
    };

    // Execute command
    const result = await this.orchestrator.processCommand(
      command,
      userId,
      enhancedContext,
      priority
    );

    return {
      success: true,
      requestId: result.id,
      status: result.status,
    };
  }

  private async getUserId(): Promise<string> {
    try {
      const result = await chrome.storage.local.get(['user_id']);
      return result.user_id || 'anonymous_user';
    } catch (error) {
      console.error('Failed to get user ID:', error);
      return 'anonymous_user';
    }
  }
}

/**
 * Get status handler
 */
class GetStatusHandler implements MessageHandler {
  constructor(private orchestrator: Orchestrator) {}

  canHandle(message: any): boolean {
    return message.type === 'get_status';
  }

  async handle(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    const { requestId } = message;

    if (requestId) {
      // Get specific request status
      const result = this.orchestrator.getRequestStatus(requestId);
      return {
        success: true,
        result,
      };
    } else {
      // Get overall status
      const activeRequests = this.orchestrator.getActiveRequests();
      return {
        success: true,
        activeRequests: activeRequests.length,
        requests: activeRequests,
      };
    }
  }
}

/**
 * Cancel request handler
 */
class CancelRequestHandler implements MessageHandler {
  constructor(private orchestrator: Orchestrator) {}

  canHandle(message: any): boolean {
    return message.type === 'cancel_request' && message.requestId;
  }

  async handle(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    const { requestId } = message;

    const cancelled = await this.orchestrator.cancelRequest(requestId);

    return {
      success: true,
      cancelled,
    };
  }
}

/**
 * Update API key handler
 */
class UpdateApiKeyHandler implements MessageHandler {
  constructor(private orchestrator: Orchestrator) {}

  canHandle(message: any): boolean {
    return message.type === 'update_api_key' && message.apiKey;
  }

  async handle(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    const { apiKey } = message;

    try {
      // Validate API key format
      if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
        throw new Error('Invalid API key format');
      }

      // Store API key
      await chrome.storage.local.set({ openrouter_api_key: apiKey });

      // Update orchestrator's OpenRouter client
      const dependencies = this.orchestrator.getDependencies();
      dependencies.openRouterClient.updateConfig({ apiKey });

      return {
        success: true,
        message: 'API key updated successfully',
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Get statistics handler
 */
class GetStatisticsHandler implements MessageHandler {
  constructor(private orchestrator: Orchestrator) {}

  canHandle(message: any): boolean {
    return message.type === 'get_statistics';
  }

  async handle(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    try {
      const orchestratorStats = this.orchestrator.getStatistics();
      const dependencies = this.orchestrator.getDependencies();
      const openRouterStats = dependencies.openRouterClient.getUsageStats();
      const contextStats = dependencies.contextManager.getStatistics();
      const executionStats = dependencies.executionEngine.getStatistics();

      return {
        success: true,
        statistics: {
          orchestrator: orchestratorStats,
          openRouter: openRouterStats,
          context: contextStats,
          execution: executionStats,
          timestamp: Date.now(),
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Command response handler (from content script)
 */
class CommandResponseHandler implements MessageHandler {
  constructor(private orchestrator: Orchestrator) {}

  canHandle(message: any): boolean {
    return message.type === 'command_response' && message.commandId;
  }

  async handle(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    const { commandId, success, result, error } = message;

    // This message is typically handled by the execution engine
    // But we can log it for debugging
    console.log(`Command response received for ${commandId}:`, {
      success,
      result,
      error,
    });

    // Store response for potential retrieval
    await chrome.storage.local.set({
      [`command_response_${commandId}`]: {
        success,
        result,
        error,
        timestamp: Date.now(),
        tabId: sender.tab?.id,
      },
    });

    return {
      success: true,
      received: true,
    };
  }
}

/**
 * Update context handler
 */
class UpdateContextHandler implements MessageHandler {
  constructor(private orchestrator: Orchestrator) {}

  canHandle(message: any): boolean {
    return message.type === 'update_context' && message.context;
  }

  async handle(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    const { context, contextId } = message;

    try {
      const dependencies = this.orchestrator.getDependencies();

      if (contextId) {
        // Update specific context
        const updated = dependencies.contextManager.updateContext(contextId, context);
        return {
          success: true,
          updated: !!updated,
        };
      } else {
        // Update global variables
        if (context.variables) {
          for (const [key, value] of Object.entries(context.variables)) {
            dependencies.contextManager.setGlobalVariable(key, value);
          }
        }

        return {
          success: true,
          updated: true,
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Get settings handler
 */
class GetSettingsHandler implements MessageHandler {
  constructor(private orchestrator: Orchestrator) {}

  canHandle(message: any): boolean {
    return message.type === 'get_settings';
  }

  async handle(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    try {
      const result = await chrome.storage.local.get([
        'openrouter_api_key',
        'enable_debug_logging',
        'enable_auto_retry',
        'max_retry_attempts',
        'enable_confirmation_for_high_risk',
      ]);

      // Don't expose the full API key
      const settings = {
        ...result,
        openrouter_api_key: result.openrouter_api_key ? '***configured***' : null,
      };

      return {
        success: true,
        settings,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Update settings handler
 */
class UpdateSettingsHandler implements MessageHandler {
  constructor(private orchestrator: Orchestrator) {}

  canHandle(message: any): boolean {
    return message.type === 'update_settings' && message.settings;
  }

  async handle(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    const { settings } = message;

    try {
      // Validate settings
      const validSettings = this.validateSettings(settings);

      if (validSettings.errors.length > 0) {
        return {
          success: false,
          error: 'Invalid settings',
          validationErrors: validSettings.errors,
        };
      }

      // Update storage
      await chrome.storage.local.set(validSettings.settings);

      // Update orchestrator configuration if needed
      if (validSettings.settings.enable_auto_retry !== undefined ||
          validSettings.settings.max_retry_attempts !== undefined ||
          validSettings.settings.enable_confirmation_for_high_risk !== undefined) {

        this.orchestrator.updateConfig({
          enableAutoRetry: validSettings.settings.enable_auto_retry,
          maxRetryAttempts: validSettings.settings.max_retry_attempts,
          enableConfirmationForHighRisk: validSettings.settings.enable_confirmation_for_high_risk,
        });
      }

      return {
        success: true,
        updated: true,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private validateSettings(settings: any): { settings: any; errors: string[] } {
    const errors: string[] = [];
    const validSettings: any = {};

    // Validate API key if provided
    if (settings.openrouter_api_key !== undefined) {
      if (!settings.openrouter_api_key || typeof settings.openrouter_api_key !== 'string') {
        errors.push('API key must be a non-empty string');
      } else {
        validSettings.openrouter_api_key = settings.openrouter_api_key;
      }
    }

    // Validate boolean settings
    const booleanSettings = [
      'enable_debug_logging',
      'enable_auto_retry',
      'enable_confirmation_for_high_risk',
    ];

    for (const setting of booleanSettings) {
      if (settings[setting] !== undefined) {
        if (typeof settings[setting] !== 'boolean') {
          errors.push(`${setting} must be a boolean`);
        } else {
          validSettings[setting] = settings[setting];
        }
      }
    }

    // Validate numeric settings
    if (settings.max_retry_attempts !== undefined) {
      if (typeof settings.max_retry_attempts !== 'number' ||
          settings.max_retry_attempts < 0 ||
          settings.max_retry_attempts > 10) {
        errors.push('max_retry_attempts must be a number between 0 and 10');
      } else {
        validSettings.max_retry_attempts = settings.max_retry_attempts;
      }
    }

    return {
      settings: validSettings,
      errors,
    };
  }
}

/**
 * Message utility functions
 */
export class MessageUtils {
  /**
   * Create agent message
   */
  static createAgentMessage(
    from: string,
    to: string,
    type: string,
    payload: any,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ): AgentMessage {
    return {
      from,
      to,
      type,
      payload,
      timestamp: Date.now(),
      id: this.generateMessageId(),
      priority,
    };
  }

  /**
   * Create status message
   */
  static createStatusMessage(
    status: UIStatus['status'],
    message: string,
    progress?: number,
    currentStep?: string,
    totalSteps?: string
  ): UIStatus {
    return {
      status,
      message,
      progress,
      currentStep,
      totalSteps,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate unique message ID
   */
  static generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send message to tab
   */
  static async sendToTab(
    tabId: number,
    message: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 5000);

      const responseHandler = (response: any) => {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(responseHandler);
        resolve(response);
      };

      chrome.runtime.onMessage.addListener(responseHandler);
      chrome.tabs.sendMessage(tabId, message);
    });
  }

  /**
   * Broadcast message to all tabs
   */
  static async broadcastToAllTabs(message: any): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({});

      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Tab might not be ready to receive messages
          });
        }
      }
    } catch (error) {
      console.error('Failed to broadcast message to tabs:', error);
    }
  }
}

export { MessageRouter };
