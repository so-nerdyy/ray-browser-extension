/**
 * Message handler for communication between content script and background script
 * Manages message passing and response handling
 */

export interface MessageHandlerCallback {
  (data: any): Promise<any>;
}

export class MessageHandler {
  private handlers: Map<string, MessageHandlerCallback> = new Map();
  private isInitialized = false;
  private messageId = 0;
  private pendingResponses: Map<number, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: number;
  }> = new Map();

  /**
   * Initialize the message handler
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Set up message listener
      chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
      
      // Set up connection listener for persistent connections
      chrome.runtime.onConnect.addListener(this.handleConnection.bind(this));
      
      this.isInitialized = true;
      console.log('Message handler initialized successfully');
    } catch (error) {
      console.error('Failed to initialize message handler:', error);
      throw error;
    }
  }

  /**
   * Handle incoming messages from background script
   */
  private async handleMessage(
    request: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<boolean> {
    try {
      // Handle different message types
      switch (request.type) {
        case 'automation':
          await this.handleAutomationMessage(request, sendResponse);
          break;
          
        case 'response':
          this.handleResponseMessage(request);
          break;
          
        case 'ping':
          sendResponse({ type: 'pong', timestamp: Date.now() });
          break;
          
        default:
          console.warn('Unknown message type:', request.type);
          sendResponse({ 
            success: false, 
            error: `Unknown message type: ${request.type}` 
          });
      }
      
      return true; // Keep message channel open for async response
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
      return true;
    }
  }

  /**
   * Handle automation messages
   */
  private async handleAutomationMessage(
    request: any,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      const { action, data, messageId } = request;
      
      if (!this.handlers.has(action)) {
        sendResponse({
          success: false,
          error: `No handler registered for action: ${action}`,
          messageId
        });
        return;
      }
      
      const handler = this.handlers.get(action)!;
      const result = await handler(data);
      
      sendResponse({
        success: true,
        data: result,
        messageId
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
        messageId: request.messageId
      });
    }
  }

  /**
   * Handle response messages for async requests
   */
  private handleResponseMessage(request: any): void {
    const { messageId, success, data, error } = request;
    const pending = this.pendingResponses.get(messageId);
    
    if (!pending) {
      console.warn(`Received response for unknown message ID: ${messageId}`);
      return;
    }
    
    // Clear timeout
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }
    
    // Remove from pending
    this.pendingResponses.delete(messageId);
    
    // Resolve or reject the promise
    if (success) {
      pending.resolve(data);
    } else {
      pending.reject(new Error(error));
    }
  }

  /**
   * Handle persistent connections
   */
  private handleConnection(port: chrome.runtime.Port): void {
    console.log('Connected to background script:', port.name);
    
    port.onMessage.addListener((message) => {
      this.handleMessage(message, { 
        id: -1, 
        url: window.location.href 
      }, (response) => {
        port.postMessage(response);
      });
    });
    
    port.onDisconnect.addListener(() => {
      console.log('Disconnected from background script:', port.name);
    });
  }

  /**
   * Add a handler for a specific action
   */
  addHandler(action: string, callback: MessageHandlerCallback): void {
    this.handlers.set(action, callback);
  }

  /**
   * Remove a handler for a specific action
   */
  removeHandler(action: string): boolean {
    return this.handlers.delete(action);
  }

  /**
   * Send a message to the background script
   */
  async sendMessage(action: string, data?: any, timeout: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      const messageId = ++this.messageId;
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingResponses.delete(messageId);
        reject(new Error(`Message timeout: ${action}`));
      }, timeout);
      
      // Store pending response
      this.pendingResponses.set(messageId, {
        resolve,
        reject,
        timeout: timeoutId
      });
      
      // Send message
      chrome.runtime.sendMessage({
        type: 'automation',
        action,
        data,
        messageId
      }, (response) => {
        // Handle immediate response (synchronous)
        if (response && chrome.runtime.lastError) {
          clearTimeout(timeoutId);
          this.pendingResponses.delete(messageId);
          reject(new Error(chrome.runtime.lastError.message));
        }
      });
    });
  }

  /**
   * Send a synchronous message to the background script
   */
  sendSyncMessage(action: string, data?: any): any {
    try {
      return chrome.runtime.sendMessage({
        type: 'automation',
        action,
        data
      });
    } catch (error) {
      throw new Error(`Failed to send sync message: ${error.message}`);
    }
  }

  /**
   * Send a message without waiting for response
   */
  sendOneWayMessage(action: string, data?: any): void {
    try {
      chrome.runtime.sendMessage({
        type: 'automation',
        action,
        data
      });
    } catch (error) {
      console.error('Failed to send one-way message:', error);
    }
  }

  /**
   * Broadcast a message to all tabs
   */
  async broadcastMessage(action: string, data?: any): Promise<void> {
    try {
      await this.sendMessage('broadcast', {
        action,
        data
      });
    } catch (error) {
      throw new Error(`Failed to broadcast message: ${error.message}`);
    }
  }

  /**
   * Get information about the current tab
   */
  async getTabInfo(): Promise<any> {
    return await this.sendMessage('getTabInfo');
  }

  /**
   * Check if the content script has the necessary permissions
   */
  async checkPermissions(): Promise<any> {
    return await this.sendMessage('checkPermissions');
  }

  /**
   * Report an error to the background script
   */
  reportError(error: Error, context?: any): void {
    this.sendOneWayMessage('reportError', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now()
    });
  }

  /**
   * Report performance metrics
   */
  reportMetrics(metrics: any): void {
    this.sendOneWayMessage('reportMetrics', metrics);
  }

  /**
   * Get the current configuration
   */
  async getConfig(): Promise<any> {
    return await this.sendMessage('getConfig');
  }

  /**
   * Update the configuration
   */
  async updateConfig(config: any): Promise<any> {
    return await this.sendMessage('updateConfig', config);
  }

  /**
   * Check if the message handler is connected to the background script
   */
  isConnected(): boolean {
    return chrome.runtime && chrome.runtime.id !== undefined;
  }

  /**
   * Wait for connection to be established
   */
  async waitForConnection(timeout: number = 5000): Promise<boolean> {
    if (this.isConnected()) {
      return true;
    }

    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkConnection = () => {
        if (this.isConnected()) {
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          resolve(false);
          return;
        }
        
        setTimeout(checkConnection, 100);
      };
      
      checkConnection();
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Clear all pending responses
    this.pendingResponses.forEach(pending => {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
    });
    this.pendingResponses.clear();
    
    // Clear all handlers
    this.handlers.clear();
    
    this.isInitialized = false;
  }
} * Message handler for communication between content script and background script
 * Manages message passing and response handling
 */

export interface MessageHandlerCallback {
  (data: any): Promise<any>;
}

export class MessageHandler {
  private handlers: Map<string, MessageHandlerCallback> = new Map();
  private isInitialized = false;
  private messageId = 0;
  private pendingResponses: Map<number, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: number;
  }> = new Map();

  /**
   * Initialize the message handler
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Set up message listener
      chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
      
      // Set up connection listener for persistent connections
      chrome.runtime.onConnect.addListener(this.handleConnection.bind(this));
      
      this.isInitialized = true;
      console.log('Message handler initialized successfully');
    } catch (error) {
      console.error('Failed to initialize message handler:', error);
      throw error;
    }
  }

  /**
   * Handle incoming messages from background script
   */
  private async handleMessage(
    request: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<boolean> {
    try {
      // Handle different message types
      switch (request.type) {
        case 'automation':
          await this.handleAutomationMessage(request, sendResponse);
          break;
          
        case 'response':
          this.handleResponseMessage(request);
          break;
          
        case 'ping':
          sendResponse({ type: 'pong', timestamp: Date.now() });
          break;
          
        default:
          console.warn('Unknown message type:', request.type);
          sendResponse({ 
            success: false, 
            error: `Unknown message type: ${request.type}` 
          });
      }
      
      return true; // Keep message channel open for async response
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
      return true;
    }
  }

  /**
   * Handle automation messages
   */
  private async handleAutomationMessage(
    request: any,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      const { action, data, messageId } = request;
      
      if (!this.handlers.has(action)) {
        sendResponse({
          success: false,
          error: `No handler registered for action: ${action}`,
          messageId
        });
        return;
      }
      
      const handler = this.handlers.get(action)!;
      const result = await handler(data);
      
      sendResponse({
        success: true,
        data: result,
        messageId
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
        messageId: request.messageId
      });
    }
  }

  /**
   * Handle response messages for async requests
   */
  private handleResponseMessage(request: any): void {
    const { messageId, success, data, error } = request;
    const pending = this.pendingResponses.get(messageId);
    
    if (!pending) {
      console.warn(`Received response for unknown message ID: ${messageId}`);
      return;
    }
    
    // Clear timeout
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }
    
    // Remove from pending
    this.pendingResponses.delete(messageId);
    
    // Resolve or reject the promise
    if (success) {
      pending.resolve(data);
    } else {
      pending.reject(new Error(error));
    }
  }

  /**
   * Handle persistent connections
   */
  private handleConnection(port: chrome.runtime.Port): void {
    console.log('Connected to background script:', port.name);
    
    port.onMessage.addListener((message) => {
      this.handleMessage(message, { 
        id: -1, 
        url: window.location.href 
      }, (response) => {
        port.postMessage(response);
      });
    });
    
    port.onDisconnect.addListener(() => {
      console.log('Disconnected from background script:', port.name);
    });
  }

  /**
   * Add a handler for a specific action
   */
  addHandler(action: string, callback: MessageHandlerCallback): void {
    this.handlers.set(action, callback);
  }

  /**
   * Remove a handler for a specific action
   */
  removeHandler(action: string): boolean {
    return this.handlers.delete(action);
  }

  /**
   * Send a message to the background script
   */
  async sendMessage(action: string, data?: any, timeout: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      const messageId = ++this.messageId;
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingResponses.delete(messageId);
        reject(new Error(`Message timeout: ${action}`));
      }, timeout);
      
      // Store pending response
      this.pendingResponses.set(messageId, {
        resolve,
        reject,
        timeout: timeoutId
      });
      
      // Send message
      chrome.runtime.sendMessage({
        type: 'automation',
        action,
        data,
        messageId
      }, (response) => {
        // Handle immediate response (synchronous)
        if (response && chrome.runtime.lastError) {
          clearTimeout(timeoutId);
          this.pendingResponses.delete(messageId);
          reject(new Error(chrome.runtime.lastError.message));
        }
      });
    });
  }

  /**
   * Send a synchronous message to the background script
   */
  sendSyncMessage(action: string, data?: any): any {
    try {
      return chrome.runtime.sendMessage({
        type: 'automation',
        action,
        data
      });
    } catch (error) {
      throw new Error(`Failed to send sync message: ${error.message}`);
    }
  }

  /**
   * Send a message without waiting for response
   */
  sendOneWayMessage(action: string, data?: any): void {
    try {
      chrome.runtime.sendMessage({
        type: 'automation',
        action,
        data
      });
    } catch (error) {
      console.error('Failed to send one-way message:', error);
    }
  }

  /**
   * Broadcast a message to all tabs
   */
  async broadcastMessage(action: string, data?: any): Promise<void> {
    try {
      await this.sendMessage('broadcast', {
        action,
        data
      });
    } catch (error) {
      throw new Error(`Failed to broadcast message: ${error.message}`);
    }
  }

  /**
   * Get information about the current tab
   */
  async getTabInfo(): Promise<any> {
    return await this.sendMessage('getTabInfo');
  }

  /**
   * Check if the content script has the necessary permissions
   */
  async checkPermissions(): Promise<any> {
    return await this.sendMessage('checkPermissions');
  }

  /**
   * Report an error to the background script
   */
  reportError(error: Error, context?: any): void {
    this.sendOneWayMessage('reportError', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now()
    });
  }

  /**
   * Report performance metrics
   */
  reportMetrics(metrics: any): void {
    this.sendOneWayMessage('reportMetrics', metrics);
  }

  /**
   * Get the current configuration
   */
  async getConfig(): Promise<any> {
    return await this.sendMessage('getConfig');
  }

  /**
   * Update the configuration
   */
  async updateConfig(config: any): Promise<any> {
    return await this.sendMessage('updateConfig', config);
  }

  /**
   * Check if the message handler is connected to the background script
   */
  isConnected(): boolean {
    return chrome.runtime && chrome.runtime.id !== undefined;
  }

  /**
   * Wait for connection to be established
   */
  async waitForConnection(timeout: number = 5000): Promise<boolean> {
    if (this.isConnected()) {
      return true;
    }

    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkConnection = () => {
        if (this.isConnected()) {
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          resolve(false);
          return;
        }
        
        setTimeout(checkConnection, 100);
      };
      
      checkConnection();
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Clear all pending responses
    this.pendingResponses.forEach(pending => {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
    });
    this.pendingResponses.clear();
    
    // Clear all handlers
    this.handlers.clear();
    
    this.isInitialized = false;
  }
}
