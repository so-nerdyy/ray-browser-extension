/**
 * OpenRouter API client implementation
 */

import { 
  OPENROUTER_CONFIG, 
  OPENROUTER_ERRORS 
} from './config';
import { 
  RayOpenRouterRequest, 
  RayOpenRouterResponse, 
  OpenRouterClientConfig,
  OpenRouterError,
  RequestOptions,
  APIResponseCache,
  UsageStats,
  OpenRouterEvent,
  OpenRouterEventListener,
  ParsedAIResponse,
  RateLimitInfo,
  ValidationResult
} from './types';
import { 
  OpenRouterMessage, 
  OpenRouterResponse 
} from '../shared/contracts';

export class OpenRouterClient {
  private config: OpenRouterClientConfig;
  private cache: APIResponseCache = {};
  private usageStats: UsageStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cachedRequests: 0,
    totalTokens: 0,
    averageResponseTime: 0,
    lastRequestTime: 0,
  };
  private eventListeners: Map<string, OpenRouterEventListener[]> = new Map();
  private rateLimitInfo: RateLimitInfo | null = null;

  constructor(config: OpenRouterClientConfig) {
    this.config = {
      baseUrl: OPENROUTER_CONFIG.BASE_URL,
      model: OPENROUTER_CONFIG.DEFAULT_MODEL,
      temperature: OPENROUTER_CONFIG.DEFAULT_TEMPERATURE,
      maxTokens: OPENROUTER_CONFIG.DEFAULT_MAX_TOKENS,
      timeout: OPENROUTER_CONFIG.REQUEST_TIMEOUT,
      retries: OPENROUTER_CONFIG.MAX_RETRIES,
      enableCache: true,
      cacheSize: OPENROUTER_CONFIG.MAX_CACHE_SIZE,
      cacheTTL: OPENROUTER_CONFIG.CACHE_TTL,
      ...config,
    };
  }

  /**
   * Send a chat completion request to OpenRouter
   */
  async chatCompletion(
    messages: OpenRouterMessage[], 
    options: RequestOptions = {}
  ): Promise<RayOpenRouterResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.emitEvent({ type: 'request_start', data: { requestId, prompt: messages[messages.length - 1]?.content || '' } });

    try {
      // Check cache first
      if (options.useCache !== false && this.config.enableCache) {
        const cacheKey = this.generateCacheKey(messages, options);
        const cachedResponse = this.getFromCache(cacheKey);
        if (cachedResponse) {
          this.emitEvent({ type: 'cache_hit', data: { requestId, cacheKey } });
          this.usageStats.cachedRequests++;
          return { ...cachedResponse, requestId, cached: true };
        }
      }

      // Make the API request
      const response = await this.makeRequest(requestId, messages, options);
      const processingTime = Date.now() - startTime;

      // Update usage stats
      this.updateUsageStats(response, processingTime, true);

      // Cache the response
      if (this.config.enableCache && options.useCache !== false) {
        const cacheKey = this.generateCacheKey(messages, options);
        this.setCache(cacheKey, response);
      }

      this.emitEvent({ type: 'request_success', data: { requestId, response } });

      return {
        ...response,
        requestId,
        processingTime,
        cached: false,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateUsageStats(null as any, processingTime, false);
      
      const openRouterError = this.handleError(error, requestId);
      this.emitEvent({ type: 'request_error', data: { requestId, error: openRouterError } });
      throw openRouterError;
    }
  }

  /**
   * Parse natural language command into automation commands
   */
  async parseCommand(
    command: string, 
    context?: any,
    options: RequestOptions = {}
  ): Promise<ParsedAIResponse> {
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: OPENROUTER_CONFIG.SYSTEM_PROMPT },
      { 
        role: 'user', 
        content: `Command: "${command}"${context ? `\n\nContext: ${JSON.stringify(context)}` : ''}` 
      }
    ];

    const response = await this.chatCompletion(messages, options);
    
    try {
      // Parse the AI response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI model');
      }

      // Try to parse as JSON first
      let parsedResponse: ParsedAIResponse;
      try {
        parsedResponse = JSON.parse(content);
      } catch {
        // If not JSON, try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: create a basic response
          parsedResponse = {
            commands: [{
              type: 'extract' as const,
              description: content,
              confidence: 0.5,
            }],
            confidence: 0.5,
            requiresClarification: true,
            clarificationQuestion: 'Could you please be more specific about what you want me to do?',
          };
        }
      }

      // Validate the response
      const validation = this.validateParsedResponse(parsedResponse);
      if (!validation.isValid) {
        throw new Error(`Invalid AI response: ${validation.errors.join(', ')}`);
      }

      return parsedResponse;

    } catch (error) {
      throw new OpenRouterError({
        code: OPENROUTER_ERRORS.INVALID_RESPONSE,
        message: `Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        type: 'validation',
      });
    }
  }

  /**
   * Make the actual HTTP request to OpenRouter API
   */
  private async makeRequest(
    requestId: string,
    messages: OpenRouterMessage[],
    options: RequestOptions
  ): Promise<OpenRouterResponse> {
    const url = `${this.config.baseUrl}${OPENROUTER_CONFIG.CHAT_ENDPOINT}`;
    
    const requestBody: RayOpenRouterRequest = {
      model: this.config.model!,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      ...options,
    };

    const headers = {
      ...OPENROUTER_CONFIG.DEFAULT_HEADERS,
      'Authorization': `Bearer ${this.config.apiKey}`,
    };

    let lastError: Error | null = null;
    const maxRetries = options.retries ?? this.config.retries!;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check rate limits
        if (this.rateLimitInfo && this.rateLimitInfo.remaining <= 0) {
          const waitTime = Math.max(0, this.rateLimitInfo.resetTime - Date.now());
          if (waitTime > 0) {
            this.emitEvent({ type: 'rate_limit', data: { retryAfter: waitTime } });
            await this.sleep(waitTime);
          }
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(options.timeout ?? this.config.timeout!),
        });

        // Handle rate limiting
        if (response.status === 429) {
          const rateLimitData = this.parseRateLimitHeaders(response);
          this.rateLimitInfo = rateLimitData;
          
          if (attempt < maxRetries) {
            const waitTime = rateLimitData.retryAfter || this.calculateRetryDelay(attempt);
            await this.sleep(waitTime);
            continue;
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new OpenRouterError({
            code: OPENROUTER_ERRORS.API_ERROR,
            message: `OpenRouter API error: ${response.status} ${response.statusText}`,
            details: errorData,
            timestamp: Date.now(),
            type: 'api',
            statusCode: response.status,
          });
        }

        const data: OpenRouterResponse = await response.json();
        
        // Update rate limit info from successful response
        this.updateRateLimitInfo(response);

        return data;

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries && this.shouldRetry(error as OpenRouterError)) {
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
          continue;
        }
        
        break;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Validate the parsed AI response
   */
  private validateParsedResponse(response: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!response || typeof response !== 'object') {
      errors.push('Response must be an object');
      return { isValid: false, errors, warnings };
    }

    if (!Array.isArray(response.commands)) {
      errors.push('Response must contain a commands array');
    } else {
      response.commands.forEach((cmd: any, index: number) => {
        if (!cmd.type || typeof cmd.type !== 'string') {
          errors.push(`Command ${index}: missing or invalid type`);
        }
        
        if (!cmd.description || typeof cmd.description !== 'string') {
          warnings.push(`Command ${index}: missing or invalid description`);
        }
      });
    }

    if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
      warnings.push('Invalid confidence value, should be between 0 and 1');
    }

    if (typeof response.requiresClarification !== 'boolean') {
      warnings.push('Invalid requiresClarification value, should be boolean');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedResponse: response,
    };
  }

  /**
   * Cache management
   */
  private generateCacheKey(messages: OpenRouterMessage[], options: RequestOptions): string {
    const keyData = {
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      model: this.config.model,
      temperature: this.config.temperature,
      ...options,
    };
    return btoa(JSON.stringify(keyData));
  }

  private getFromCache(key: string): RayOpenRouterResponse | null {
    const entry = this.cache[key];
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      delete this.cache[key];
      return null;
    }

    entry.hitCount++;
    return entry.response;
  }

  private setCache(key: string, response: RayOpenRouterResponse): void {
    // Remove oldest entries if cache is full
    const cacheKeys = Object.keys(this.cache);
    if (cacheKeys.length >= this.config.cacheSize!) {
      const oldestKey = cacheKeys.reduce((oldest, current) => 
        this.cache[current].timestamp < this.cache[oldest].timestamp ? current : oldest
      );
      delete this.cache[oldestKey];
    }

    this.cache[key] = {
      response,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL!,
      hitCount: 0,
    };
  }

  /**
   * Rate limit handling
   */
  private parseRateLimitHeaders(response: Response): RateLimitInfo {
    return {
      limit: parseInt(response.headers.get('X-RateLimit-Limit') || '100'),
      remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0'),
      resetTime: parseInt(response.headers.get('X-RateLimit-Reset') || '0') * 1000,
      retryAfter: parseInt(response.headers.get('Retry-After') || '0') * 1000,
    };
  }

  private updateRateLimitInfo(response: Response): void {
    const rateLimitData = this.parseRateLimitHeaders(response);
    this.rateLimitInfo = rateLimitData;
  }

  /**
   * Error handling
   */
  private handleError(error: any, requestId: string): OpenRouterError {
    if (error instanceof OpenRouterError) {
      return error;
    }

    if (error.name === 'AbortError') {
      return new OpenRouterError({
        code: OPENROUTER_ERRORS.TIMEOUT,
        message: 'Request timeout',
        timestamp: Date.now(),
        type: 'timeout',
      });
    }

    if (error.message?.includes('fetch')) {
      return new OpenRouterError({
        code: OPENROUTER_ERRORS.NETWORK_ERROR,
        message: 'Network error',
        details: error,
        timestamp: Date.now(),
        type: 'network',
      });
    }

    return new OpenRouterError({
      code: OPENROUTER_ERRORS.API_ERROR,
      message: error.message || 'Unknown error occurred',
      details: error,
      timestamp: Date.now(),
      type: 'api',
    });
  }

  private shouldRetry(error: OpenRouterError): boolean {
    return error.type === 'network' || 
           error.type === 'timeout' || 
           error.type === 'rate_limit';
  }

  /**
   * Utility methods
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateRetryDelay(attempt: number): number {
    const delay = OPENROUTER_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt);
    return Math.min(delay, OPENROUTER_CONFIG.RETRY_DELAY_MAX);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateUsageStats(response: OpenRouterResponse | null, processingTime: number, success: boolean): void {
    this.usageStats.totalRequests++;
    this.usageStats.lastRequestTime = Date.now();

    if (success) {
      this.usageStats.successfulRequests++;
      if (response?.usage) {
        this.usageStats.totalTokens += response.usage.total_tokens;
      }
    } else {
      this.usageStats.failedRequests++;
    }

    // Update average response time
    const totalTime = this.usageStats.averageResponseTime * (this.usageStats.totalRequests - 1) + processingTime;
    this.usageStats.averageResponseTime = totalTime / this.usageStats.totalRequests;
  }

  /**
   * Event handling
   */
  public addEventListener(eventType: string, listener: OpenRouterEventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  public removeEventListener(eventType: string, listener: OpenRouterEventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: OpenRouterEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }

  /**
   * Public API methods
   */
  public getUsageStats(): UsageStats {
    return { ...this.usageStats };
  }

  public getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo ? { ...this.rateLimitInfo } : null;
  }

  public clearCache(): void {
    this.cache = {};
  }

  public updateConfig(newConfig: Partial<OpenRouterClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
} * OpenRouter API client implementation
 */

import { 
  OPENROUTER_CONFIG, 
  OPENROUTER_ERRORS 
} from './config';
import { 
  RayOpenRouterRequest, 
  RayOpenRouterResponse, 
  OpenRouterClientConfig,
  OpenRouterError,
  RequestOptions,
  APIResponseCache,
  UsageStats,
  OpenRouterEvent,
  OpenRouterEventListener,
  ParsedAIResponse,
  RateLimitInfo,
  ValidationResult
} from './types';
import { 
  OpenRouterMessage, 
  OpenRouterResponse 
} from '../shared/contracts';

export class OpenRouterClient {
  private config: OpenRouterClientConfig;
  private cache: APIResponseCache = {};
  private usageStats: UsageStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cachedRequests: 0,
    totalTokens: 0,
    averageResponseTime: 0,
    lastRequestTime: 0,
  };
  private eventListeners: Map<string, OpenRouterEventListener[]> = new Map();
  private rateLimitInfo: RateLimitInfo | null = null;

  constructor(config: OpenRouterClientConfig) {
    this.config = {
      baseUrl: OPENROUTER_CONFIG.BASE_URL,
      model: OPENROUTER_CONFIG.DEFAULT_MODEL,
      temperature: OPENROUTER_CONFIG.DEFAULT_TEMPERATURE,
      maxTokens: OPENROUTER_CONFIG.DEFAULT_MAX_TOKENS,
      timeout: OPENROUTER_CONFIG.REQUEST_TIMEOUT,
      retries: OPENROUTER_CONFIG.MAX_RETRIES,
      enableCache: true,
      cacheSize: OPENROUTER_CONFIG.MAX_CACHE_SIZE,
      cacheTTL: OPENROUTER_CONFIG.CACHE_TTL,
      ...config,
    };
  }

  /**
   * Send a chat completion request to OpenRouter
   */
  async chatCompletion(
    messages: OpenRouterMessage[], 
    options: RequestOptions = {}
  ): Promise<RayOpenRouterResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.emitEvent({ type: 'request_start', data: { requestId, prompt: messages[messages.length - 1]?.content || '' } });

    try {
      // Check cache first
      if (options.useCache !== false && this.config.enableCache) {
        const cacheKey = this.generateCacheKey(messages, options);
        const cachedResponse = this.getFromCache(cacheKey);
        if (cachedResponse) {
          this.emitEvent({ type: 'cache_hit', data: { requestId, cacheKey } });
          this.usageStats.cachedRequests++;
          return { ...cachedResponse, requestId, cached: true };
        }
      }

      // Make the API request
      const response = await this.makeRequest(requestId, messages, options);
      const processingTime = Date.now() - startTime;

      // Update usage stats
      this.updateUsageStats(response, processingTime, true);

      // Cache the response
      if (this.config.enableCache && options.useCache !== false) {
        const cacheKey = this.generateCacheKey(messages, options);
        this.setCache(cacheKey, response);
      }

      this.emitEvent({ type: 'request_success', data: { requestId, response } });

      return {
        ...response,
        requestId,
        processingTime,
        cached: false,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateUsageStats(null as any, processingTime, false);
      
      const openRouterError = this.handleError(error, requestId);
      this.emitEvent({ type: 'request_error', data: { requestId, error: openRouterError } });
      throw openRouterError;
    }
  }

  /**
   * Parse natural language command into automation commands
   */
  async parseCommand(
    command: string, 
    context?: any,
    options: RequestOptions = {}
  ): Promise<ParsedAIResponse> {
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: OPENROUTER_CONFIG.SYSTEM_PROMPT },
      { 
        role: 'user', 
        content: `Command: "${command}"${context ? `\n\nContext: ${JSON.stringify(context)}` : ''}` 
      }
    ];

    const response = await this.chatCompletion(messages, options);
    
    try {
      // Parse the AI response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI model');
      }

      // Try to parse as JSON first
      let parsedResponse: ParsedAIResponse;
      try {
        parsedResponse = JSON.parse(content);
      } catch {
        // If not JSON, try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: create a basic response
          parsedResponse = {
            commands: [{
              type: 'extract' as const,
              description: content,
              confidence: 0.5,
            }],
            confidence: 0.5,
            requiresClarification: true,
            clarificationQuestion: 'Could you please be more specific about what you want me to do?',
          };
        }
      }

      // Validate the response
      const validation = this.validateParsedResponse(parsedResponse);
      if (!validation.isValid) {
        throw new Error(`Invalid AI response: ${validation.errors.join(', ')}`);
      }

      return parsedResponse;

    } catch (error) {
      throw new OpenRouterError({
        code: OPENROUTER_ERRORS.INVALID_RESPONSE,
        message: `Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        type: 'validation',
      });
    }
  }

  /**
   * Make the actual HTTP request to OpenRouter API
   */
  private async makeRequest(
    requestId: string,
    messages: OpenRouterMessage[],
    options: RequestOptions
  ): Promise<OpenRouterResponse> {
    const url = `${this.config.baseUrl}${OPENROUTER_CONFIG.CHAT_ENDPOINT}`;
    
    const requestBody: RayOpenRouterRequest = {
      model: this.config.model!,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      ...options,
    };

    const headers = {
      ...OPENROUTER_CONFIG.DEFAULT_HEADERS,
      'Authorization': `Bearer ${this.config.apiKey}`,
    };

    let lastError: Error | null = null;
    const maxRetries = options.retries ?? this.config.retries!;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check rate limits
        if (this.rateLimitInfo && this.rateLimitInfo.remaining <= 0) {
          const waitTime = Math.max(0, this.rateLimitInfo.resetTime - Date.now());
          if (waitTime > 0) {
            this.emitEvent({ type: 'rate_limit', data: { retryAfter: waitTime } });
            await this.sleep(waitTime);
          }
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(options.timeout ?? this.config.timeout!),
        });

        // Handle rate limiting
        if (response.status === 429) {
          const rateLimitData = this.parseRateLimitHeaders(response);
          this.rateLimitInfo = rateLimitData;
          
          if (attempt < maxRetries) {
            const waitTime = rateLimitData.retryAfter || this.calculateRetryDelay(attempt);
            await this.sleep(waitTime);
            continue;
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new OpenRouterError({
            code: OPENROUTER_ERRORS.API_ERROR,
            message: `OpenRouter API error: ${response.status} ${response.statusText}`,
            details: errorData,
            timestamp: Date.now(),
            type: 'api',
            statusCode: response.status,
          });
        }

        const data: OpenRouterResponse = await response.json();
        
        // Update rate limit info from successful response
        this.updateRateLimitInfo(response);

        return data;

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries && this.shouldRetry(error as OpenRouterError)) {
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
          continue;
        }
        
        break;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Validate the parsed AI response
   */
  private validateParsedResponse(response: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!response || typeof response !== 'object') {
      errors.push('Response must be an object');
      return { isValid: false, errors, warnings };
    }

    if (!Array.isArray(response.commands)) {
      errors.push('Response must contain a commands array');
    } else {
      response.commands.forEach((cmd: any, index: number) => {
        if (!cmd.type || typeof cmd.type !== 'string') {
          errors.push(`Command ${index}: missing or invalid type`);
        }
        
        if (!cmd.description || typeof cmd.description !== 'string') {
          warnings.push(`Command ${index}: missing or invalid description`);
        }
      });
    }

    if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
      warnings.push('Invalid confidence value, should be between 0 and 1');
    }

    if (typeof response.requiresClarification !== 'boolean') {
      warnings.push('Invalid requiresClarification value, should be boolean');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedResponse: response,
    };
  }

  /**
   * Cache management
   */
  private generateCacheKey(messages: OpenRouterMessage[], options: RequestOptions): string {
    const keyData = {
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      model: this.config.model,
      temperature: this.config.temperature,
      ...options,
    };
    return btoa(JSON.stringify(keyData));
  }

  private getFromCache(key: string): RayOpenRouterResponse | null {
    const entry = this.cache[key];
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      delete this.cache[key];
      return null;
    }

    entry.hitCount++;
    return entry.response;
  }

  private setCache(key: string, response: RayOpenRouterResponse): void {
    // Remove oldest entries if cache is full
    const cacheKeys = Object.keys(this.cache);
    if (cacheKeys.length >= this.config.cacheSize!) {
      const oldestKey = cacheKeys.reduce((oldest, current) => 
        this.cache[current].timestamp < this.cache[oldest].timestamp ? current : oldest
      );
      delete this.cache[oldestKey];
    }

    this.cache[key] = {
      response,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL!,
      hitCount: 0,
    };
  }

  /**
   * Rate limit handling
   */
  private parseRateLimitHeaders(response: Response): RateLimitInfo {
    return {
      limit: parseInt(response.headers.get('X-RateLimit-Limit') || '100'),
      remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0'),
      resetTime: parseInt(response.headers.get('X-RateLimit-Reset') || '0') * 1000,
      retryAfter: parseInt(response.headers.get('Retry-After') || '0') * 1000,
    };
  }

  private updateRateLimitInfo(response: Response): void {
    const rateLimitData = this.parseRateLimitHeaders(response);
    this.rateLimitInfo = rateLimitData;
  }

  /**
   * Error handling
   */
  private handleError(error: any, requestId: string): OpenRouterError {
    if (error instanceof OpenRouterError) {
      return error;
    }

    if (error.name === 'AbortError') {
      return new OpenRouterError({
        code: OPENROUTER_ERRORS.TIMEOUT,
        message: 'Request timeout',
        timestamp: Date.now(),
        type: 'timeout',
      });
    }

    if (error.message?.includes('fetch')) {
      return new OpenRouterError({
        code: OPENROUTER_ERRORS.NETWORK_ERROR,
        message: 'Network error',
        details: error,
        timestamp: Date.now(),
        type: 'network',
      });
    }

    return new OpenRouterError({
      code: OPENROUTER_ERRORS.API_ERROR,
      message: error.message || 'Unknown error occurred',
      details: error,
      timestamp: Date.now(),
      type: 'api',
    });
  }

  private shouldRetry(error: OpenRouterError): boolean {
    return error.type === 'network' || 
           error.type === 'timeout' || 
           error.type === 'rate_limit';
  }

  /**
   * Utility methods
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateRetryDelay(attempt: number): number {
    const delay = OPENROUTER_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt);
    return Math.min(delay, OPENROUTER_CONFIG.RETRY_DELAY_MAX);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateUsageStats(response: OpenRouterResponse | null, processingTime: number, success: boolean): void {
    this.usageStats.totalRequests++;
    this.usageStats.lastRequestTime = Date.now();

    if (success) {
      this.usageStats.successfulRequests++;
      if (response?.usage) {
        this.usageStats.totalTokens += response.usage.total_tokens;
      }
    } else {
      this.usageStats.failedRequests++;
    }

    // Update average response time
    const totalTime = this.usageStats.averageResponseTime * (this.usageStats.totalRequests - 1) + processingTime;
    this.usageStats.averageResponseTime = totalTime / this.usageStats.totalRequests;
  }

  /**
   * Event handling
   */
  public addEventListener(eventType: string, listener: OpenRouterEventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  public removeEventListener(eventType: string, listener: OpenRouterEventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: OpenRouterEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }

  /**
   * Public API methods
   */
  public getUsageStats(): UsageStats {
    return { ...this.usageStats };
  }

  public getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo ? { ...this.rateLimitInfo } : null;
  }

  public clearCache(): void {
    this.cache = {};
  }

  public updateConfig(newConfig: Partial<OpenRouterClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
