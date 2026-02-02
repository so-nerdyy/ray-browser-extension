/**
 * Context manager for execution state and workflow management
 */

import { 
  ExecutionContext, 
  AutomationCommand, 
  UIStatus, 
  AgentMessage,
  CacheEntry
} from '../shared/contracts';
import { EnhancedParsedCommand } from '../commands/types';

export interface ContextManagerConfig {
  maxHistorySize: number;
  contextTimeout: number;
  persistenceEnabled: boolean;
  storageKey: string;
}

export class ContextManager {
  private config: ContextManagerConfig;
  private contexts: Map<string, ExecutionContext> = new Map();
  private globalVariables: Map<string, any> = new Map();
  private commandHistory: AutomationCommand[] = [];
  private statusHistory: UIStatus[] = [];
  private messageCache: Map<string, AgentMessage> = new Map();

  constructor(config: Partial<ContextManagerConfig> = {}) {
    this.config = {
      maxHistorySize: 100,
      contextTimeout: 30 * 60 * 1000, // 30 minutes
      persistenceEnabled: true,
      storageKey: 'ray_execution_contexts',
      ...config,
    };

    this.loadPersistedContexts();
    this.startCleanupTimer();
  }

  /**
   * Create a new execution context
   */
  createContext(
    userId: string,
    tabId?: number,
    url?: string
  ): ExecutionContext {
    const context: ExecutionContext = {
      id: this.generateContextId(),
      userId,
      tabId,
      url,
      timestamp: Date.now(),
      variables: new Map(),
      history: [],
      status: 'pending',
    };

    this.contexts.set(context.id, context);
    this.persistContexts();

    return context;
  }

  /**
   * Get execution context by ID
   */
  getContext(contextId: string): ExecutionContext | null {
    const context = this.contexts.get(contextId);
    
    if (!context) {
      return null;
    }

    // Check if context has expired
    if (Date.now() - context.timestamp > this.config.contextTimeout) {
      this.contexts.delete(contextId);
      this.persistContexts();
      return null;
    }

    return context;
  }

  /**
   * Update execution context
   */
  updateContext(
    contextId: string,
    updates: Partial<ExecutionContext>
  ): ExecutionContext | null {
    const context = this.getContext(contextId);
    
    if (!context) {
      return null;
    }

    const updatedContext = { ...context, ...updates };
    this.contexts.set(contextId, updatedContext);
    this.persistContexts();

    return updatedContext;
  }

  /**
   * Delete execution context
   */
  deleteContext(contextId: string): boolean {
    const deleted = this.contexts.delete(contextId);
    if (deleted) {
      this.persistContexts();
    }
    return deleted;
  }

  /**
   * Add command to context history
   */
  addCommandToHistory(
    contextId: string,
    command: AutomationCommand
  ): void {
    const context = this.getContext(contextId);
    if (!context) {
      return;
    }

    context.history.push(command);
    
    // Limit history size
    if (context.history.length > this.config.maxHistorySize) {
      context.history = context.history.slice(-this.config.maxHistorySize);
    }

    // Add to global history
    this.commandHistory.push(command);
    if (this.commandHistory.length > this.config.maxHistorySize) {
      this.commandHistory = this.commandHistory.slice(-this.config.maxHistorySize);
    }

    this.persistContexts();
  }

  /**
   * Set variable in context
   */
  setContextVariable(
    contextId: string,
    key: string,
    value: any
  ): void {
    const context = this.getContext(contextId);
    if (!context) {
      return;
    }

    context.variables.set(key, value);
    this.persistContexts();
  }

  /**
   * Get variable from context
   */
  getContextVariable(
    contextId: string,
    key: string
  ): any {
    const context = this.getContext(contextId);
    if (!context) {
      return null;
    }

    return context.variables.get(key);
  }

  /**
   * Set global variable
   */
  setGlobalVariable(key: string, value: any): void {
    this.globalVariables.set(key, value);
    this.persistContexts();
  }

  /**
   * Get global variable
   */
  getGlobalVariable(key: string): any {
    return this.globalVariables.get(key);
  }

  /**
   * Get all variables for a context (context + global)
   */
  getAllVariables(contextId: string): Map<string, any> {
    const context = this.getContext(contextId);
    if (!context) {
      return new Map(this.globalVariables);
    }

    const allVariables = new Map(this.globalVariables);
    for (const [key, value] of context.variables) {
      allVariables.set(key, value);
    }

    return allVariables;
  }

  /**
   * Add status update to history
   */
  addStatusUpdate(status: UIStatus): void {
    this.statusHistory.push(status);
    
    // Limit history size
    if (this.statusHistory.length > this.config.maxHistorySize) {
      this.statusHistory = this.statusHistory.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * Get recent status updates
   */
  getRecentStatusUpdates(limit: number = 10): UIStatus[] {
    return this.statusHistory.slice(-limit);
  }

  /**
   * Cache message for deduplication
   */
  cacheMessage(message: AgentMessage, ttl: number = 60000): void {
    this.messageCache.set(message.id, message);
    
    // Remove from cache after TTL
    setTimeout(() => {
      this.messageCache.delete(message.id);
    }, ttl);
  }

  /**
   * Check if message is cached
   */
  isMessageCached(messageId: string): boolean {
    return this.messageCache.has(messageId);
  }

  /**
   * Get command history
   */
  getCommandHistory(limit?: number): AutomationCommand[] {
    if (limit) {
      return this.commandHistory.slice(-limit);
    }
    return [...this.commandHistory];
  }

  /**
   * Get contexts by user
   */
  getContextsByUser(userId: string): ExecutionContext[] {
    return Array.from(this.contexts.values())
      .filter(context => context.userId === userId);
  }

  /**
   * Get contexts by tab
   */
  getContextsByTab(tabId: number): ExecutionContext[] {
    return Array.from(this.contexts.values())
      .filter(context => context.tabId === tabId);
  }

  /**
   * Get active contexts (not completed or failed)
   */
  getActiveContexts(): ExecutionContext[] {
    return Array.from(this.contexts.values())
      .filter(context => 
        context.status === 'pending' || context.status === 'running'
      );
  }

  /**
   * Cleanup expired contexts
   */
  cleanupExpiredContexts(): void {
    const now = Date.now();
    const expiredContexts: string[] = [];

    for (const [id, context] of this.contexts) {
      if (now - context.timestamp > this.config.contextTimeout) {
        expiredContexts.push(id);
      }
    }

    for (const id of expiredContexts) {
      this.contexts.delete(id);
    }

    if (expiredContexts.length > 0) {
      this.persistContexts();
    }
  }

  /**
   * Export context data for persistence
   */
  exportContextData(): any {
    const contextsData: any[] = [];
    
    for (const [id, context] of this.contexts) {
      contextsData.push({
        id: context.id,
        userId: context.userId,
        tabId: context.tabId,
        url: context.url,
        timestamp: context.timestamp,
        variables: Array.from(context.variables.entries()),
        history: context.history,
        status: context.status,
      });
    }

    return {
      contexts: contextsData,
      globalVariables: Array.from(this.globalVariables.entries()),
      commandHistory: this.commandHistory,
      statusHistory: this.statusHistory,
    };
  }

  /**
   * Import context data from persistence
   */
  importContextData(data: any): void {
    if (!data) return;

    // Import contexts
    if (data.contexts) {
      for (const contextData of data.contexts) {
        const context: ExecutionContext = {
          id: contextData.id,
          userId: contextData.userId,
          tabId: contextData.tabId,
          url: contextData.url,
          timestamp: contextData.timestamp,
          variables: new Map(contextData.variables || []),
          history: contextData.history || [],
          status: contextData.status,
        };
        this.contexts.set(context.id, context);
      }
    }

    // Import global variables
    if (data.globalVariables) {
      this.globalVariables = new Map(data.globalVariables);
    }

    // Import history
    if (data.commandHistory) {
      this.commandHistory = data.commandHistory;
    }

    if (data.statusHistory) {
      this.statusHistory = data.statusHistory;
    }
  }

  /**
   * Generate unique context ID
   */
  private generateContextId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredContexts();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Persist contexts to storage
   */
  private persistContexts(): void {
    if (!this.config.persistenceEnabled) {
      return;
    }

    try {
      const data = this.exportContextData();
      chrome.storage.local.set({
        [this.config.storageKey]: data
      });
    } catch (error) {
      console.warn('Failed to persist contexts:', error);
    }
  }

  /**
   * Load persisted contexts from storage
   */
  private loadPersistedContexts(): void {
    if (!this.config.persistenceEnabled) {
      return;
    }

    try {
      chrome.storage.local.get([this.config.storageKey], (result) => {
        if (result[this.config.storageKey]) {
          this.importContextData(result[this.config.storageKey]);
        }
      });
    } catch (error) {
      console.warn('Failed to load persisted contexts:', error);
    }
  }

  /**
   * Clear all contexts
   */
  clearAllContexts(): void {
    this.contexts.clear();
    this.globalVariables.clear();
    this.commandHistory = [];
    this.statusHistory = [];
    this.messageCache.clear();
    this.persistContexts();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalContexts: number;
    activeContexts: number;
    totalCommands: number;
    totalStatusUpdates: number;
    cachedMessages: number;
  } {
    return {
      totalContexts: this.contexts.size,
      activeContexts: this.getActiveContexts().length,
      totalCommands: this.commandHistory.length,
      totalStatusUpdates: this.statusHistory.length,
      cachedMessages: this.messageCache.size,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ContextManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
} * Context manager for execution state and workflow management
 */

import { 
  ExecutionContext, 
  AutomationCommand, 
  UIStatus, 
  AgentMessage,
  CacheEntry
} from '../shared/contracts';
import { EnhancedParsedCommand } from '../commands/types';

export interface ContextManagerConfig {
  maxHistorySize: number;
  contextTimeout: number;
  persistenceEnabled: boolean;
  storageKey: string;
}

export class ContextManager {
  private config: ContextManagerConfig;
  private contexts: Map<string, ExecutionContext> = new Map();
  private globalVariables: Map<string, any> = new Map();
  private commandHistory: AutomationCommand[] = [];
  private statusHistory: UIStatus[] = [];
  private messageCache: Map<string, AgentMessage> = new Map();

  constructor(config: Partial<ContextManagerConfig> = {}) {
    this.config = {
      maxHistorySize: 100,
      contextTimeout: 30 * 60 * 1000, // 30 minutes
      persistenceEnabled: true,
      storageKey: 'ray_execution_contexts',
      ...config,
    };

    this.loadPersistedContexts();
    this.startCleanupTimer();
  }

  /**
   * Create a new execution context
   */
  createContext(
    userId: string,
    tabId?: number,
    url?: string
  ): ExecutionContext {
    const context: ExecutionContext = {
      id: this.generateContextId(),
      userId,
      tabId,
      url,
      timestamp: Date.now(),
      variables: new Map(),
      history: [],
      status: 'pending',
    };

    this.contexts.set(context.id, context);
    this.persistContexts();

    return context;
  }

  /**
   * Get execution context by ID
   */
  getContext(contextId: string): ExecutionContext | null {
    const context = this.contexts.get(contextId);
    
    if (!context) {
      return null;
    }

    // Check if context has expired
    if (Date.now() - context.timestamp > this.config.contextTimeout) {
      this.contexts.delete(contextId);
      this.persistContexts();
      return null;
    }

    return context;
  }

  /**
   * Update execution context
   */
  updateContext(
    contextId: string,
    updates: Partial<ExecutionContext>
  ): ExecutionContext | null {
    const context = this.getContext(contextId);
    
    if (!context) {
      return null;
    }

    const updatedContext = { ...context, ...updates };
    this.contexts.set(contextId, updatedContext);
    this.persistContexts();

    return updatedContext;
  }

  /**
   * Delete execution context
   */
  deleteContext(contextId: string): boolean {
    const deleted = this.contexts.delete(contextId);
    if (deleted) {
      this.persistContexts();
    }
    return deleted;
  }

  /**
   * Add command to context history
   */
  addCommandToHistory(
    contextId: string,
    command: AutomationCommand
  ): void {
    const context = this.getContext(contextId);
    if (!context) {
      return;
    }

    context.history.push(command);
    
    // Limit history size
    if (context.history.length > this.config.maxHistorySize) {
      context.history = context.history.slice(-this.config.maxHistorySize);
    }

    // Add to global history
    this.commandHistory.push(command);
    if (this.commandHistory.length > this.config.maxHistorySize) {
      this.commandHistory = this.commandHistory.slice(-this.config.maxHistorySize);
    }

    this.persistContexts();
  }

  /**
   * Set variable in context
   */
  setContextVariable(
    contextId: string,
    key: string,
    value: any
  ): void {
    const context = this.getContext(contextId);
    if (!context) {
      return;
    }

    context.variables.set(key, value);
    this.persistContexts();
  }

  /**
   * Get variable from context
   */
  getContextVariable(
    contextId: string,
    key: string
  ): any {
    const context = this.getContext(contextId);
    if (!context) {
      return null;
    }

    return context.variables.get(key);
  }

  /**
   * Set global variable
   */
  setGlobalVariable(key: string, value: any): void {
    this.globalVariables.set(key, value);
    this.persistContexts();
  }

  /**
   * Get global variable
   */
  getGlobalVariable(key: string): any {
    return this.globalVariables.get(key);
  }

  /**
   * Get all variables for a context (context + global)
   */
  getAllVariables(contextId: string): Map<string, any> {
    const context = this.getContext(contextId);
    if (!context) {
      return new Map(this.globalVariables);
    }

    const allVariables = new Map(this.globalVariables);
    for (const [key, value] of context.variables) {
      allVariables.set(key, value);
    }

    return allVariables;
  }

  /**
   * Add status update to history
   */
  addStatusUpdate(status: UIStatus): void {
    this.statusHistory.push(status);
    
    // Limit history size
    if (this.statusHistory.length > this.config.maxHistorySize) {
      this.statusHistory = this.statusHistory.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * Get recent status updates
   */
  getRecentStatusUpdates(limit: number = 10): UIStatus[] {
    return this.statusHistory.slice(-limit);
  }

  /**
   * Cache message for deduplication
   */
  cacheMessage(message: AgentMessage, ttl: number = 60000): void {
    this.messageCache.set(message.id, message);
    
    // Remove from cache after TTL
    setTimeout(() => {
      this.messageCache.delete(message.id);
    }, ttl);
  }

  /**
   * Check if message is cached
   */
  isMessageCached(messageId: string): boolean {
    return this.messageCache.has(messageId);
  }

  /**
   * Get command history
   */
  getCommandHistory(limit?: number): AutomationCommand[] {
    if (limit) {
      return this.commandHistory.slice(-limit);
    }
    return [...this.commandHistory];
  }

  /**
   * Get contexts by user
   */
  getContextsByUser(userId: string): ExecutionContext[] {
    return Array.from(this.contexts.values())
      .filter(context => context.userId === userId);
  }

  /**
   * Get contexts by tab
   */
  getContextsByTab(tabId: number): ExecutionContext[] {
    return Array.from(this.contexts.values())
      .filter(context => context.tabId === tabId);
  }

  /**
   * Get active contexts (not completed or failed)
   */
  getActiveContexts(): ExecutionContext[] {
    return Array.from(this.contexts.values())
      .filter(context => 
        context.status === 'pending' || context.status === 'running'
      );
  }

  /**
   * Cleanup expired contexts
   */
  cleanupExpiredContexts(): void {
    const now = Date.now();
    const expiredContexts: string[] = [];

    for (const [id, context] of this.contexts) {
      if (now - context.timestamp > this.config.contextTimeout) {
        expiredContexts.push(id);
      }
    }

    for (const id of expiredContexts) {
      this.contexts.delete(id);
    }

    if (expiredContexts.length > 0) {
      this.persistContexts();
    }
  }

  /**
   * Export context data for persistence
   */
  exportContextData(): any {
    const contextsData: any[] = [];
    
    for (const [id, context] of this.contexts) {
      contextsData.push({
        id: context.id,
        userId: context.userId,
        tabId: context.tabId,
        url: context.url,
        timestamp: context.timestamp,
        variables: Array.from(context.variables.entries()),
        history: context.history,
        status: context.status,
      });
    }

    return {
      contexts: contextsData,
      globalVariables: Array.from(this.globalVariables.entries()),
      commandHistory: this.commandHistory,
      statusHistory: this.statusHistory,
    };
  }

  /**
   * Import context data from persistence
   */
  importContextData(data: any): void {
    if (!data) return;

    // Import contexts
    if (data.contexts) {
      for (const contextData of data.contexts) {
        const context: ExecutionContext = {
          id: contextData.id,
          userId: contextData.userId,
          tabId: contextData.tabId,
          url: contextData.url,
          timestamp: contextData.timestamp,
          variables: new Map(contextData.variables || []),
          history: contextData.history || [],
          status: contextData.status,
        };
        this.contexts.set(context.id, context);
      }
    }

    // Import global variables
    if (data.globalVariables) {
      this.globalVariables = new Map(data.globalVariables);
    }

    // Import history
    if (data.commandHistory) {
      this.commandHistory = data.commandHistory;
    }

    if (data.statusHistory) {
      this.statusHistory = data.statusHistory;
    }
  }

  /**
   * Generate unique context ID
   */
  private generateContextId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredContexts();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Persist contexts to storage
   */
  private persistContexts(): void {
    if (!this.config.persistenceEnabled) {
      return;
    }

    try {
      const data = this.exportContextData();
      chrome.storage.local.set({
        [this.config.storageKey]: data
      });
    } catch (error) {
      console.warn('Failed to persist contexts:', error);
    }
  }

  /**
   * Load persisted contexts from storage
   */
  private loadPersistedContexts(): void {
    if (!this.config.persistenceEnabled) {
      return;
    }

    try {
      chrome.storage.local.get([this.config.storageKey], (result) => {
        if (result[this.config.storageKey]) {
          this.importContextData(result[this.config.storageKey]);
        }
      });
    } catch (error) {
      console.warn('Failed to load persisted contexts:', error);
    }
  }

  /**
   * Clear all contexts
   */
  clearAllContexts(): void {
    this.contexts.clear();
    this.globalVariables.clear();
    this.commandHistory = [];
    this.statusHistory = [];
    this.messageCache.clear();
    this.persistContexts();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalContexts: number;
    activeContexts: number;
    totalCommands: number;
    totalStatusUpdates: number;
    cachedMessages: number;
  } {
    return {
      totalContexts: this.contexts.size,
      activeContexts: this.getActiveContexts().length,
      totalCommands: this.commandHistory.length,
      totalStatusUpdates: this.statusHistory.length,
      cachedMessages: this.messageCache.size,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ContextManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
