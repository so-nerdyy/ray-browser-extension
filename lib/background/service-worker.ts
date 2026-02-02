/**
 * Main service worker for Ray Chrome Extension
 */

import { OpenRouterClient } from '../openrouter/client';
import { Orchestrator } from '../orchestration/orchestrator';
import { 
  AgentMessage, 
  UIStatus, 
  AutomationCommand,
  RayError
} from '../shared/contracts';

export interface ServiceWorkerConfig {
  enableDebugLogging: boolean;
  maxConcurrentRequests: number;
  requestTimeout: number;
  enablePersistence: boolean;
}

export class RayServiceWorker {
  private config: ServiceWorkerConfig;
  private openRouterClient: OpenRouterClient;
  private orchestrator: Orchestrator;
  private isInitialized: boolean = false;

  constructor(config: Partial<ServiceWorkerConfig> = {}) {
    this.config = {
      enableDebugLogging: false,
      maxConcurrentRequests: 5,
      requestTimeout: 60000, // 1 minute
      enablePersistence: true,
      ...config,
    };

    this.initializeComponents();
    this.setupEventListeners();
  }

  /**
   * Initialize the service worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize API key from storage
      await this.initializeApiKey();
      
      // Setup message handlers
      this.setupMessageHandlers();
      
      // Setup context menu
      this.setupContextMenu();
      
      // Setup tab listeners
      this.setupTabListeners();
      
      // Setup storage listeners
      this.setupStorageListeners();
      
      this.isInitialized = true;
      this.log('Service worker initialized successfully');
      
    } catch (error) {
      this.logError('Failed to initialize service worker', error);
      throw error;
    }
  }

  /**
   * Initialize components
   */
  private initializeComponents(): void {
    // Initialize OpenRouter client with placeholder API key
    // Will be updated with actual key from storage
    this.openRouterClient = new OpenRouterClient({
      apiKey: 'placeholder-key',
    });

    // Initialize orchestrator
    this.orchestrator = new Orchestrator(this.openRouterClient, {
      enableAutoRetry: true,
      maxRetryAttempts: 3,
      enableProgressReporting: true,
      enableConfirmationForHighRisk: true,
      defaultTimeout: this.config.requestTimeout,
    });

    // Setup orchestrator event listeners
    this.setupOrchestratorListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Service worker lifecycle events
    chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
    chrome.runtime.onStartup.addListener(this.onStartup.bind(this));
    chrome.runtime.onSuspend.addListener(this.onSuspend.bind(this));
    
    // Message events
    chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
    
    // Tab events
    chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this));
    chrome.tabs.onActivated.addListener(this.onTabActivated.bind(this));
    chrome.tabs.onRemoved.addListener(this.onTabRemoved.bind(this));
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    // Message handling is done in onMessage method
    // This is just a placeholder for organization
  }

  /**
   * Setup context menu
   */
  private setupContextMenu(): void {
    chrome.contextMenus.create({
      id: 'ray-execute-command',
      title: 'Execute with Ray',
      contexts: ['selection', 'page'],
    });

    chrome.contextMenus.onClicked.addListener(this.onContextMenuClicked.bind(this));
  }

  /**
   * Setup tab listeners
   */
  private setupTabListeners(): void {
    // Tab listeners are set in setupEventListeners
    // This is just a placeholder for organization
  }

  /**
   * Setup storage listeners
   */
  private setupStorageListeners(): void {
    chrome.storage.onChanged.addListener(this.onStorageChanged.bind(this));
  }

  /**
   * Setup orchestrator event listeners
   */
  private setupOrchestratorListeners(): void {
    this.orchestrator.addEventListener({
      onRequestStarted: (request) => {
        this.broadcastStatus({
          status: 'processing',
          message: 'Starting command processing...',
          timestamp: Date.now(),
        });
      },
      
      onParsingStarted: (request) => {
        this.broadcastStatus({
          status: 'processing',
          message: 'Parsing command...',
          timestamp: Date.now(),
        });
      },
      
      onValidationStarted: (request, commands) => {
        this.broadcastStatus({
          status: 'processing',
          message: 'Validating commands...',
          timestamp: Date.now(),
        });
      },
      
      onExecutionStarted: (request, commands) => {
        this.broadcastStatus({
          status: 'processing',
          message: 'Executing commands...',
          timestamp: Date.now(),
          currentStep: '1',
          totalSteps: commands.length.toString(),
        });
      },
      
      onExecutionProgress: (request, progress) => {
        this.broadcastStatus({
          status: 'processing',
          message: `Executing commands... ${Math.round(progress)}%`,
          progress,
          timestamp: Date.now(),
        });
      },
      
      onRequestCompleted: (request, result) => {
        this.broadcastStatus({
          status: 'success',
          message: 'Command completed successfully',
          timestamp: Date.now(),
        });
        
        // Store result for popup
        chrome.storage.local.set({
          ['lastResult_' + request.id]: result,
        });
      },
      
      onRequestFailed: (request, error) => {
        this.broadcastStatus({
          status: 'error',
          message: error.message,
          timestamp: Date.now(),
        });
        
        // Store error for popup
        chrome.storage.local.set({
          ['lastError_' + request.id]: error,
        });
      },
      
      onStatusUpdate: (request, status) => {
        this.broadcastStatus(status);
      },
    });
  }

  /**
   * Initialize API key from storage
   */
  private async initializeApiKey(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['openrouter_api_key']);
      if (result.openrouter_api_key) {
        this.openRouterClient.updateConfig({
          apiKey: result.openrouter_api_key,
        });
        this.log('API key loaded from storage');
      } else {
        this.log('No API key found in storage');
      }
    } catch (error) {
      this.logError('Failed to load API key from storage', error);
    }
  }

  /**
   * Handle installed event
   */
  private onInstalled(details: chrome.runtime.InstalledDetails): void {
    this.log('Extension installed', details);
    
    if (details.reason === 'install') {
      // First time installation
      chrome.tabs.create({
        url: chrome.runtime.getURL('popup/onboarding.html'),
      });
    } else if (details.reason === 'update') {
      // Extension updated
      this.log('Extension updated to version', chrome.runtime.getManifest().version);
    }
  }

  /**
   * Handle startup event
   */
  private onStartup(): void {
    this.log('Service worker starting up');
    this.initialize();
  }

  /**
   * Handle suspend event
   */
  private onSuspend(): void {
    this.log('Service worker suspending');
    // Cleanup if needed
  }

  /**
   * Handle message event
   */
  private async onMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    this.log('Received message', message, sender);

    try {
      switch (message.type) {
        case 'execute_command':
          await this.handleExecuteCommand(message, sender, sendResponse);
          break;
          
        case 'get_status':
          await this.handleGetStatus(message, sender, sendResponse);
          break;
          
        case 'cancel_request':
          await this.handleCancelRequest(message, sender, sendResponse);
          break;
          
        case 'update_api_key':
          await this.handleUpdateApiKey(message, sender, sendResponse);
          break;
          
        case 'get_statistics':
          await this.handleGetStatistics(message, sender, sendResponse);
          break;
          
        case 'command_response':
          // Response from content script
          await this.handleCommandResponse(message, sender, sendResponse);
          break;
          
        default:
          this.logError('Unknown message type', message.type);
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      this.logError('Error handling message', error);
      sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Handle tab updated event
   */
  private onTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ): void {
    if (changeInfo.status === 'complete' && tab.url) {
      this.log('Tab updated', tabId, tab.url);
      
      // Update context with new URL
      // This could be used to update the orchestrator context
    }
  }

  /**
   * Handle tab activated event
   */
  private onTabActivated(
    activeInfo: chrome.tabs.TabActiveInfo
  ): void {
    this.log('Tab activated', activeInfo.tabId);
  }

  /**
   * Handle tab removed event
   */
  private onTabRemoved(tabId: number, removeInfo: chrome.tabs.TabRemoveInfo): void {
    this.log('Tab removed', tabId);
    
    // Clean up any context related to this tab
    // This could be used to clean up orchestrator contexts
  }

  /**
   * Handle context menu clicked event
   */
  private async onContextMenuClicked(
    info: chrome.contextMenus.OnClickData,
    tab?: chrome.tabs.Tab
  ): Promise<void> {
    if (info.menuItemId === 'ray-execute-command' && tab) {
      let command = '';
      
      if (info.selectionText) {
        command = info.selectionText;
      } else {
        // Could get page content or use a default command
        command = 'Analyze this page';
      }
      
      await this.executeCommand(command, tab.id);
    }
  }

  /**
   * Handle storage changed event
   */
  private onStorageChanged(
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ): void {
    if (areaName === 'local') {
      if (changes.openrouter_api_key) {
        this.openRouterClient.updateConfig({
          apiKey: changes.openrouter_api_key.newValue,
        });
        this.log('API key updated');
      }
    }
  }

  /**
   * Handle execute command message
   */
  private async handleExecuteCommand(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    const { command, context, priority } = message;
    
    try {
      // Get user ID (could be from storage or generate one)
      const userId = await this.getUserId();
      
      // Add tab info to context
      const enhancedContext = {
        ...context,
        tabId: sender.tab?.id,
        currentUrl: sender.tab?.url,
      };
      
      // Execute command through orchestrator
      const result = await this.orchestrator.processCommand(
        command,
        userId,
        enhancedContext,
        priority
      );
      
      sendResponse({ success: true, requestId: result.id });
      
    } catch (error) {
      this.logError('Failed to execute command', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Handle get status message
   */
  private async handleGetStatus(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    const { requestId } = message;
    
    if (requestId) {
      const result = this.orchestrator.getRequestStatus(requestId);
      sendResponse({ success: true, result });
    } else {
      // Get overall status
      const activeRequests = this.orchestrator.getActiveRequests();
      sendResponse({ 
        success: true, 
        activeRequests: activeRequests.length,
        requests: activeRequests 
      });
    }
  }

  /**
   * Handle cancel request message
   */
  private async handleCancelRequest(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    const { requestId } = message;
    
    if (requestId) {
      const cancelled = await this.orchestrator.cancelRequest(requestId);
      sendResponse({ success: true, cancelled });
    } else {
      sendResponse({ success: false, error: 'Request ID required' });
    }
  }

  /**
   * Handle update API key message
   */
  private async handleUpdateApiKey(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    const { apiKey } = message;
    
    if (apiKey) {
      try {
        // Store API key
        await chrome.storage.local.set({ openrouter_api_key: apiKey });
        
        // Update client
        this.openRouterClient.updateConfig({ apiKey });
        
        sendResponse({ success: true });
        this.log('API key updated successfully');
        
      } catch (error) {
        this.logError('Failed to update API key', error);
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    } else {
      sendResponse({ success: false, error: 'API key required' });
    }
  }

  /**
   * Handle get statistics message
   */
  private async handleGetStatistics(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      const orchestratorStats = this.orchestrator.getStatistics();
      const dependencies = this.orchestrator.getDependencies();
      const openRouterStats = this.openRouterClient.getUsageStats();
      const contextStats = dependencies.contextManager.getStatistics();
      const executionStats = dependencies.executionEngine.getStatistics();
      
      sendResponse({
        success: true,
        statistics: {
          orchestrator: orchestratorStats,
          openRouter: openRouterStats,
          context: contextStats,
          execution: executionStats,
        },
      });
      
    } catch (error) {
      this.logError('Failed to get statistics', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Handle command response from content script
   */
  private async handleCommandResponse(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    // This is handled by the execution engine
    // Just log for debugging
    this.log('Command response received', message);
  }

  /**
   * Execute command directly
   */
  private async executeCommand(command: string, tabId?: number): Promise<void> {
    try {
      const userId = await this.getUserId();
      
      const result = await this.orchestrator.processCommand(
        command,
        userId,
        { tabId },
        'normal'
      );
      
      this.log('Command executed', result.id);
      
    } catch (error) {
      this.logError('Failed to execute command', error);
    }
  }

  /**
   * Get user ID
   */
  private async getUserId(): Promise<string> {
    try {
      const result = await chrome.storage.local.get(['user_id']);
      if (result.user_id) {
        return result.user_id;
      } else {
        // Generate new user ID
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await chrome.storage.local.set({ user_id: userId });
        return userId;
      }
    } catch (error) {
      this.logError('Failed to get user ID', error);
      return 'unknown_user';
    }
  }

  /**
   * Broadcast status to all listeners
   */
  private broadcastStatus(status: UIStatus): void {
    // Send to popup if open
    chrome.runtime.sendMessage({
      type: 'status_update',
      status,
    }).catch(() => {
      // Popup might not be open, that's okay
    });
    
    // Store in storage for popup to retrieve
    chrome.storage.local.set({
      current_status: status,
    });
  }

  /**
   * Log message
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.enableDebugLogging) {
      console.log(`[Ray ServiceWorker] ${message}`, ...args);
    }
  }

  /**
   * Log error
   */
  private logError(message: string, error?: any): void {
    console.error(`[Ray ServiceWorker] ${message}`, error);
  }
}

// Create global service worker instance
let serviceWorker: RayServiceWorker;

// Initialize on service worker start
chrome.runtime.onStartup.addListener(() => {
  serviceWorker = new RayServiceWorker({
    enableDebugLogging: process.env.NODE_ENV === 'development',
  });
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  if (!serviceWorker) {
    serviceWorker = new RayServiceWorker({
      enableDebugLogging: process.env.NODE_ENV === 'development',
    });
  }
});

// Export for testing
export { RayServiceWorker }; * Main service worker for Ray Chrome Extension
 */

import { OpenRouterClient } from '../openrouter/client';
import { Orchestrator } from '../orchestration/orchestrator';
import { 
  AgentMessage, 
  UIStatus, 
  AutomationCommand,
  RayError
} from '../shared/contracts';

export interface ServiceWorkerConfig {
  enableDebugLogging: boolean;
  maxConcurrentRequests: number;
  requestTimeout: number;
  enablePersistence: boolean;
}

export class RayServiceWorker {
  private config: ServiceWorkerConfig;
  private openRouterClient: OpenRouterClient;
  private orchestrator: Orchestrator;
  private isInitialized: boolean = false;

  constructor(config: Partial<ServiceWorkerConfig> = {}) {
    this.config = {
      enableDebugLogging: false,
      maxConcurrentRequests: 5,
      requestTimeout: 60000, // 1 minute
      enablePersistence: true,
      ...config,
    };

    this.initializeComponents();
    this.setupEventListeners();
  }

  /**
   * Initialize the service worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize API key from storage
      await this.initializeApiKey();
      
      // Setup message handlers
      this.setupMessageHandlers();
      
      // Setup context menu
      this.setupContextMenu();
      
      // Setup tab listeners
      this.setupTabListeners();
      
      // Setup storage listeners
      this.setupStorageListeners();
      
      this.isInitialized = true;
      this.log('Service worker initialized successfully');
      
    } catch (error) {
      this.logError('Failed to initialize service worker', error);
      throw error;
    }
  }

  /**
   * Initialize components
   */
  private initializeComponents(): void {
    // Initialize OpenRouter client with placeholder API key
    // Will be updated with actual key from storage
    this.openRouterClient = new OpenRouterClient({
      apiKey: 'placeholder-key',
    });

    // Initialize orchestrator
    this.orchestrator = new Orchestrator(this.openRouterClient, {
      enableAutoRetry: true,
      maxRetryAttempts: 3,
      enableProgressReporting: true,
      enableConfirmationForHighRisk: true,
      defaultTimeout: this.config.requestTimeout,
    });

    // Setup orchestrator event listeners
    this.setupOrchestratorListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Service worker lifecycle events
    chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
    chrome.runtime.onStartup.addListener(this.onStartup.bind(this));
    chrome.runtime.onSuspend.addListener(this.onSuspend.bind(this));
    
    // Message events
    chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
    
    // Tab events
    chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this));
    chrome.tabs.onActivated.addListener(this.onTabActivated.bind(this));
    chrome.tabs.onRemoved.addListener(this.onTabRemoved.bind(this));
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    // Message handling is done in onMessage method
    // This is just a placeholder for organization
  }

  /**
   * Setup context menu
   */
  private setupContextMenu(): void {
    chrome.contextMenus.create({
      id: 'ray-execute-command',
      title: 'Execute with Ray',
      contexts: ['selection', 'page'],
    });

    chrome.contextMenus.onClicked.addListener(this.onContextMenuClicked.bind(this));
  }

  /**
   * Setup tab listeners
   */
  private setupTabListeners(): void {
    // Tab listeners are set in setupEventListeners
    // This is just a placeholder for organization
  }

  /**
   * Setup storage listeners
   */
  private setupStorageListeners(): void {
    chrome.storage.onChanged.addListener(this.onStorageChanged.bind(this));
  }

  /**
   * Setup orchestrator event listeners
   */
  private setupOrchestratorListeners(): void {
    this.orchestrator.addEventListener({
      onRequestStarted: (request) => {
        this.broadcastStatus({
          status: 'processing',
          message: 'Starting command processing...',
          timestamp: Date.now(),
        });
      },
      
      onParsingStarted: (request) => {
        this.broadcastStatus({
          status: 'processing',
          message: 'Parsing command...',
          timestamp: Date.now(),
        });
      },
      
      onValidationStarted: (request, commands) => {
        this.broadcastStatus({
          status: 'processing',
          message: 'Validating commands...',
          timestamp: Date.now(),
        });
      },
      
      onExecutionStarted: (request, commands) => {
        this.broadcastStatus({
          status: 'processing',
          message: 'Executing commands...',
          timestamp: Date.now(),
          currentStep: '1',
          totalSteps: commands.length.toString(),
        });
      },
      
      onExecutionProgress: (request, progress) => {
        this.broadcastStatus({
          status: 'processing',
          message: `Executing commands... ${Math.round(progress)}%`,
          progress,
          timestamp: Date.now(),
        });
      },
      
      onRequestCompleted: (request, result) => {
        this.broadcastStatus({
          status: 'success',
          message: 'Command completed successfully',
          timestamp: Date.now(),
        });
        
        // Store result for popup
        chrome.storage.local.set({
          ['lastResult_' + request.id]: result,
        });
      },
      
      onRequestFailed: (request, error) => {
        this.broadcastStatus({
          status: 'error',
          message: error.message,
          timestamp: Date.now(),
        });
        
        // Store error for popup
        chrome.storage.local.set({
          ['lastError_' + request.id]: error,
        });
      },
      
      onStatusUpdate: (request, status) => {
        this.broadcastStatus(status);
      },
    });
  }

  /**
   * Initialize API key from storage
   */
  private async initializeApiKey(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['openrouter_api_key']);
      if (result.openrouter_api_key) {
        this.openRouterClient.updateConfig({
          apiKey: result.openrouter_api_key,
        });
        this.log('API key loaded from storage');
      } else {
        this.log('No API key found in storage');
      }
    } catch (error) {
      this.logError('Failed to load API key from storage', error);
    }
  }

  /**
   * Handle installed event
   */
  private onInstalled(details: chrome.runtime.InstalledDetails): void {
    this.log('Extension installed', details);
    
    if (details.reason === 'install') {
      // First time installation
      chrome.tabs.create({
        url: chrome.runtime.getURL('popup/onboarding.html'),
      });
    } else if (details.reason === 'update') {
      // Extension updated
      this.log('Extension updated to version', chrome.runtime.getManifest().version);
    }
  }

  /**
   * Handle startup event
   */
  private onStartup(): void {
    this.log('Service worker starting up');
    this.initialize();
  }

  /**
   * Handle suspend event
   */
  private onSuspend(): void {
    this.log('Service worker suspending');
    // Cleanup if needed
  }

  /**
   * Handle message event
   */
  private async onMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    this.log('Received message', message, sender);

    try {
      switch (message.type) {
        case 'execute_command':
          await this.handleExecuteCommand(message, sender, sendResponse);
          break;
          
        case 'get_status':
          await this.handleGetStatus(message, sender, sendResponse);
          break;
          
        case 'cancel_request':
          await this.handleCancelRequest(message, sender, sendResponse);
          break;
          
        case 'update_api_key':
          await this.handleUpdateApiKey(message, sender, sendResponse);
          break;
          
        case 'get_statistics':
          await this.handleGetStatistics(message, sender, sendResponse);
          break;
          
        case 'command_response':
          // Response from content script
          await this.handleCommandResponse(message, sender, sendResponse);
          break;
          
        default:
          this.logError('Unknown message type', message.type);
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      this.logError('Error handling message', error);
      sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Handle tab updated event
   */
  private onTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ): void {
    if (changeInfo.status === 'complete' && tab.url) {
      this.log('Tab updated', tabId, tab.url);
      
      // Update context with new URL
      // This could be used to update the orchestrator context
    }
  }

  /**
   * Handle tab activated event
   */
  private onTabActivated(
    activeInfo: chrome.tabs.TabActiveInfo
  ): void {
    this.log('Tab activated', activeInfo.tabId);
  }

  /**
   * Handle tab removed event
   */
  private onTabRemoved(tabId: number, removeInfo: chrome.tabs.TabRemoveInfo): void {
    this.log('Tab removed', tabId);
    
    // Clean up any context related to this tab
    // This could be used to clean up orchestrator contexts
  }

  /**
   * Handle context menu clicked event
   */
  private async onContextMenuClicked(
    info: chrome.contextMenus.OnClickData,
    tab?: chrome.tabs.Tab
  ): Promise<void> {
    if (info.menuItemId === 'ray-execute-command' && tab) {
      let command = '';
      
      if (info.selectionText) {
        command = info.selectionText;
      } else {
        // Could get page content or use a default command
        command = 'Analyze this page';
      }
      
      await this.executeCommand(command, tab.id);
    }
  }

  /**
   * Handle storage changed event
   */
  private onStorageChanged(
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ): void {
    if (areaName === 'local') {
      if (changes.openrouter_api_key) {
        this.openRouterClient.updateConfig({
          apiKey: changes.openrouter_api_key.newValue,
        });
        this.log('API key updated');
      }
    }
  }

  /**
   * Handle execute command message
   */
  private async handleExecuteCommand(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    const { command, context, priority } = message;
    
    try {
      // Get user ID (could be from storage or generate one)
      const userId = await this.getUserId();
      
      // Add tab info to context
      const enhancedContext = {
        ...context,
        tabId: sender.tab?.id,
        currentUrl: sender.tab?.url,
      };
      
      // Execute command through orchestrator
      const result = await this.orchestrator.processCommand(
        command,
        userId,
        enhancedContext,
        priority
      );
      
      sendResponse({ success: true, requestId: result.id });
      
    } catch (error) {
      this.logError('Failed to execute command', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Handle get status message
   */
  private async handleGetStatus(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    const { requestId } = message;
    
    if (requestId) {
      const result = this.orchestrator.getRequestStatus(requestId);
      sendResponse({ success: true, result });
    } else {
      // Get overall status
      const activeRequests = this.orchestrator.getActiveRequests();
      sendResponse({ 
        success: true, 
        activeRequests: activeRequests.length,
        requests: activeRequests 
      });
    }
  }

  /**
   * Handle cancel request message
   */
  private async handleCancelRequest(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    const { requestId } = message;
    
    if (requestId) {
      const cancelled = await this.orchestrator.cancelRequest(requestId);
      sendResponse({ success: true, cancelled });
    } else {
      sendResponse({ success: false, error: 'Request ID required' });
    }
  }

  /**
   * Handle update API key message
   */
  private async handleUpdateApiKey(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    const { apiKey } = message;
    
    if (apiKey) {
      try {
        // Store API key
        await chrome.storage.local.set({ openrouter_api_key: apiKey });
        
        // Update client
        this.openRouterClient.updateConfig({ apiKey });
        
        sendResponse({ success: true });
        this.log('API key updated successfully');
        
      } catch (error) {
        this.logError('Failed to update API key', error);
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    } else {
      sendResponse({ success: false, error: 'API key required' });
    }
  }

  /**
   * Handle get statistics message
   */
  private async handleGetStatistics(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      const orchestratorStats = this.orchestrator.getStatistics();
      const dependencies = this.orchestrator.getDependencies();
      const openRouterStats = this.openRouterClient.getUsageStats();
      const contextStats = dependencies.contextManager.getStatistics();
      const executionStats = dependencies.executionEngine.getStatistics();
      
      sendResponse({
        success: true,
        statistics: {
          orchestrator: orchestratorStats,
          openRouter: openRouterStats,
          context: contextStats,
          execution: executionStats,
        },
      });
      
    } catch (error) {
      this.logError('Failed to get statistics', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Handle command response from content script
   */
  private async handleCommandResponse(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    // This is handled by the execution engine
    // Just log for debugging
    this.log('Command response received', message);
  }

  /**
   * Execute command directly
   */
  private async executeCommand(command: string, tabId?: number): Promise<void> {
    try {
      const userId = await this.getUserId();
      
      const result = await this.orchestrator.processCommand(
        command,
        userId,
        { tabId },
        'normal'
      );
      
      this.log('Command executed', result.id);
      
    } catch (error) {
      this.logError('Failed to execute command', error);
    }
  }

  /**
   * Get user ID
   */
  private async getUserId(): Promise<string> {
    try {
      const result = await chrome.storage.local.get(['user_id']);
      if (result.user_id) {
        return result.user_id;
      } else {
        // Generate new user ID
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await chrome.storage.local.set({ user_id: userId });
        return userId;
      }
    } catch (error) {
      this.logError('Failed to get user ID', error);
      return 'unknown_user';
    }
  }

  /**
   * Broadcast status to all listeners
   */
  private broadcastStatus(status: UIStatus): void {
    // Send to popup if open
    chrome.runtime.sendMessage({
      type: 'status_update',
      status,
    }).catch(() => {
      // Popup might not be open, that's okay
    });
    
    // Store in storage for popup to retrieve
    chrome.storage.local.set({
      current_status: status,
    });
  }

  /**
   * Log message
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.enableDebugLogging) {
      console.log(`[Ray ServiceWorker] ${message}`, ...args);
    }
  }

  /**
   * Log error
   */
  private logError(message: string, error?: any): void {
    console.error(`[Ray ServiceWorker] ${message}`, error);
  }
}

// Create global service worker instance
let serviceWorker: RayServiceWorker;

// Initialize on service worker start
chrome.runtime.onStartup.addListener(() => {
  serviceWorker = new RayServiceWorker({
    enableDebugLogging: process.env.NODE_ENV === 'development',
  });
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  if (!serviceWorker) {
    serviceWorker = new RayServiceWorker({
      enableDebugLogging: process.env.NODE_ENV === 'development',
    });
  }
});

// Export for testing
export { RayServiceWorker };
