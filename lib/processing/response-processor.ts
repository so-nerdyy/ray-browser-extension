/**
 * Response processor for handling AI responses and user feedback
 */

import { 
  AutomationCommand, 
  UIStatus, 
  AgentMessage,
  RayError
} from '../shared/contracts';
import { 
  EnhancedParsedCommand,
  ParsingResult,
  ValidationResult
} from '../commands/types';

export interface ResponseProcessorConfig {
  enableCaching: boolean;
  cacheTimeout: number;
  maxCacheSize: number;
  enableFormatting: boolean;
  enableSummarization: boolean;
}

export interface ProcessedResponse {
  id: string;
  originalResponse: any;
  processedResponse: any;
  formatting: ResponseFormatting;
  summary: ResponseSummary;
  metadata: ResponseMetadata;
  timestamp: number;
}

export interface ResponseFormatting {
  format: 'json' | 'text' | 'html' | 'markdown';
  content: string;
  structured: any;
  styling: ResponseStyling;
}

export interface ResponseStyling {
  theme: 'light' | 'dark' | 'auto';
  colors: Record<string, string>;
  typography: {
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
  };
  layout: {
    spacing: string;
    padding: string;
    borderRadius: string;
  };
}

export interface ResponseSummary {
  title: string;
  description: string;
  keyPoints: string[];
  commands: CommandSummary[];
  confidence: number;
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CommandSummary {
  id: string;
  description: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface ResponseMetadata {
  processingTime: number;
  source: 'ai' | 'cache' | 'fallback';
  confidence: number;
  tokensUsed: number;
  model: string;
  requestId: string;
  userId: string;
  context: any;
}

export class ResponseProcessor {
  private config: ResponseProcessorConfig;
  private responseCache: Map<string, ProcessedResponse> = new Map();
  private formatters: Map<string, ResponseFormatter> = new Map();
  private summarizers: Map<string, ResponseSummarizer> = new Map();

  constructor(config: Partial<ResponseProcessorConfig> = {}) {
    this.config = {
      enableCaching: true,
      cacheTimeout: 300000, // 5 minutes
      maxCacheSize: 100,
      enableFormatting: true,
      enableSummarization: true,
      ...config,
    };

    this.initializeFormatters();
    this.initializeSummarizers();
  }

  /**
   * Process AI response
   */
  async processResponse(
    response: any,
    context?: any,
    options: ProcessingOptions = {}
  ): Promise<ProcessedResponse> {
    const startTime = Date.now();
    const responseId = this.generateResponseId();

    try {
      // Check cache first
      if (this.config.enableCaching && !options.bypassCache) {
        const cacheKey = this.generateCacheKey(response, context);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          return {
            ...cached,
            id: responseId,
            metadata: {
              ...cached.metadata,
              source: 'cache',
              processingTime: Date.now() - startTime,
            },
          };
        }
      }
      }

      // Process the response
      const processedResponse = await this.processResponseInternal(response, context, options);
      
      const result: ProcessedResponse = {
        id: responseId,
        originalResponse: response,
        processedResponse: processedResponse.data,
        formatting: processedResponse.formatting,
        summary: processedResponse.summary,
        metadata: {
          processingTime: Date.now() - startTime,
          source: 'ai',
          confidence: processedResponse.confidence || 0.5,
          tokensUsed: processedResponse.tokensUsed || 0,
          model: processedResponse.model || 'unknown',
          requestId: responseId,
          userId: context?.userId || 'anonymous',
          context,
        },
        timestamp: Date.now(),
      };

      // Cache the result
      if (this.config.enableCaching) {
        const cacheKey = this.generateCacheKey(response, context);
        this.setCache(cacheKey, result);
      }

      return result;

    } catch (error) {
      const rayError: RayError = {
        code: 'RESPONSE_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error processing response',
        timestamp: Date.now(),
        details: error,
      };

      throw rayError;
    }
  }

  /**
   * Process command results
   */
  async processCommandResults(
    commands: AutomationCommand[],
    results: any[],
    context?: any
  ): Promise<ProcessedResponse> {
    const responseId = this.generateResponseId();
    const startTime = Date.now();

    try {
      // Create command summaries
      const commandSummaries: CommandSummary[] = commands.map((cmd, index) => ({
        id: cmd.id,
        description: this.generateCommandDescription(cmd),
        type: cmd.type,
        status: this.determineCommandStatus(results[index]),
        result: results[index],
        error: this.extractCommandError(results[index]),
      }));

      // Generate overall summary
      const summary: ResponseSummary = {
        title: `Executed ${commands.length} command${commands.length === 1 ? '' : 's'}`,
        description: this.generateExecutionDescription(commands, results),
        keyPoints: this.extractKeyPoints(commands, results),
        commands: commandSummaries,
        confidence: this.calculateOverallConfidence(results),
        estimatedDuration: this.calculateEstimatedDuration(results),
        riskLevel: this.calculateRiskLevel(commands),
      };

      // Format the response
      const formatting = await this.formatExecutionResults(commands, results, context);

      const result: ProcessedResponse = {
        id: responseId,
        originalResponse: { commands, results },
        processedResponse: { commandSummaries, summary },
        formatting,
        summary,
        metadata: {
          processingTime: Date.now() - startTime,
          source: 'ai',
          confidence: summary.confidence,
          tokensUsed: 0,
          model: 'execution_engine',
          requestId: responseId,
          userId: context?.userId || 'anonymous',
          context,
        },
        timestamp: Date.now(),
      };

      return result;

    } catch (error) {
      const rayError: RayError = {
        code: 'COMMAND_RESULTS_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error processing command results',
        timestamp: Date.now(),
        details: error,
      };

      throw rayError;
    }
  }

  /**
   * Process error response
   */
  async processErrorResponse(
    error: RayError,
    context?: any
  ): Promise<ProcessedResponse> {
    const responseId = this.generateResponseId();
    const startTime = Date.now();

    try {
      // Format error for user display
      const formatting = await this.formatErrorResponse(error, context);

      // Generate error summary
      const summary: ResponseSummary = {
        title: 'Error Occurred',
        description: error.message,
        keyPoints: [
          `Error Code: ${error.code}`,
          `Time: ${new Date(error.timestamp).toLocaleString()}`,
        ],
        commands: [],
        confidence: 0,
        estimatedDuration: 0,
        riskLevel: 'high',
      };

      const result: ProcessedResponse = {
        id: responseId,
        originalResponse: error,
        processedResponse: { error },
        formatting,
        summary,
        metadata: {
          processingTime: Date.now() - startTime,
          source: 'ai',
          confidence: 0,
          tokensUsed: 0,
          model: 'error_processor',
          requestId: responseId,
          userId: context?.userId || 'anonymous',
          context,
        },
        timestamp: Date.now(),
      };

      return result;

    } catch (processingError) {
      const rayError: RayError = {
        code: 'ERROR_PROCESSING_ERROR',
        message: processingError instanceof Error ? processingError.message : 'Unknown error processing error',
        timestamp: Date.now(),
        details: processingError,
      };

      throw rayError;
    }
  }

  /**
   * Process response internally
   */
  private async processResponseInternal(
    response: any,
    context?: any,
    options: ProcessingOptions = {}
  ): Promise<any> {
    let processedData = response;
    let confidence = 0.5;
    let tokensUsed = 0;
    let model = 'unknown';

    // Extract AI response metadata if available
    if (response.usage) {
      tokensUsed = response.usage.total_tokens || 0;
    }

    if (response.model) {
      model = response.model;
    }

    // Apply formatters
    if (this.config.enableFormatting && options.format) {
      const formatter = this.formatters.get(options.format);
      if (formatter) {
        processedData = await formatter.format(response, context);
      }
    }

    // Apply summarizers
    if (this.config.enableSummarization && options.enableSummary) {
      const summarizer = this.summarizers.get(options.summaryType || 'default');
      if (summarizer) {
        const summary = await summarizer.summarize(response, context);
        processedData.summary = summary;
      }
    }

    // Extract confidence if available
    if (response.confidence !== undefined) {
      confidence = response.confidence;
    }

    return {
      data: processedData,
      confidence,
      tokensUsed,
      model,
    };
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(response: any, context?: any): string {
    const keyData = {
      response: typeof response === 'object' ? JSON.stringify(response) : response,
      context: context ? JSON.stringify(context) : '',
    };
    return btoa(JSON.stringify(keyData));
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): ProcessedResponse | null {
    const cached = this.responseCache.get(key);
    if (!cached) {
      return null;
    }

    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > this.config.cacheTimeout) {
      this.responseCache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Set cache
   */
  private setCache(key: string, response: ProcessedResponse): void {
    // Remove oldest entries if cache is full
    if (this.responseCache.size >= this.config.maxCacheSize) {
      const oldestKey = this.responseCache.keys().next().value;
      if (oldestKey) {
        this.responseCache.delete(oldestKey);
      }
    }

    this.responseCache.set(key, response);
  }

  /**
   * Generate response ID
   */
  private generateResponseId(): string {
    return `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate command description
   */
  private generateCommandDescription(command: AutomationCommand): string {
    const descriptions: Record<string, string> = {
      navigate: `Navigate to ${command.url}`,
      click: `Click element: ${command.selector || command.value}`,
      fill: `Fill form field: ${command.selector}`,
      scroll: `Scroll ${command.options?.direction || 'down'}`,
      submit: `Submit form`,
      extract: `Extract data: ${command.options?.extractType || 'text'}`,
      wait: `Wait ${command.timeout || 'default'}ms`,
    };

    return descriptions[command.type] || `Execute ${command.type}`;
  }

  /**
   * Determine command status
   */
  private determineCommandStatus(result: any): CommandSummary['status'] {
    if (!result) {
      return 'failed';
    }

    if (result.success === false) {
      return 'failed';
    }

    if (result.status === 'completed') {
      return 'completed';
    }

    return 'completed';
  }

  /**
   * Extract command error
   */
  private extractCommandError(result: any): string | undefined {
    if (!result || result.success !== false) {
      return undefined;
    }

    return result.error || result.message || 'Unknown error';
  }

  /**
   * Generate execution description
   */
  private generateExecutionDescription(commands: AutomationCommand[], results: any[]): string {
    const successCount = results.filter(r => r && r.success !== false).length;
    const totalCount = commands.length;

    if (successCount === totalCount) {
      return `Successfully executed ${totalCount} command${totalCount === 1 ? '' : 's'}`;
    } else {
      return `Executed ${totalCount} command${totalCount === 1 ? '' : 's'} with ${successCount} success${successCount === 1 ? '' : 'es'}`;
    }
  }

  /**
   * Extract key points from execution
   */
  private extractKeyPoints(commands: AutomationCommand[], results: any[]): string[] {
    const keyPoints: string[] = [];

    commands.forEach((cmd, index) => {
      const result = results[index];
      
      if (cmd.type === 'navigate' && result?.url) {
        keyPoints.push(`Navigated to: ${result.url}`);
      }
      
      if (cmd.type === 'click' && result?.element) {
        keyPoints.push(`Clicked: ${result.element}`);
      }
      
      if (cmd.type === 'fill' && result?.field) {
        keyPoints.push(`Filled: ${result.field}`);
      }
    });

    return keyPoints;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(results: any[]): number {
    const validResults = results.filter(r => r && r.confidence !== undefined);
    if (validResults.length === 0) {
      return 0.5;
    }

    const totalConfidence = validResults.reduce((sum, r) => sum + r.confidence, 0);
    return totalConfidence / validResults.length;
  }

  /**
   * Calculate estimated duration
   */
  private calculateEstimatedDuration(results: any[]): number {
    const validResults = results.filter(r => r && r.duration !== undefined);
    if (validResults.length === 0) {
      return 0;
    }

    return validResults.reduce((sum, r) => sum + r.duration, 0);
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(commands: AutomationCommand[]): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    commands.forEach(cmd => {
      if (cmd.type === 'navigate' && cmd.url?.includes('http://')) {
        riskScore += 1;
      }
      
      if (cmd.type === 'fill' && cmd.value?.includes('password')) {
        riskScore += 2;
      }
      
      if (cmd.type === 'submit') {
        riskScore += 1;
      }
    });

    if (riskScore >= 3) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }

  /**
   * Initialize formatters
   */
  private initializeFormatters(): void {
    this.formatters.set('json', new JsonResponseFormatter());
    this.formatters.set('text', new TextResponseFormatter());
    this.formatters.set('html', new HtmlResponseFormatter());
    this.formatters.set('markdown', new MarkdownResponseFormatter());
  }

  /**
   * Initialize summarizers
   */
  private initializeSummarizers(): void {
    this.summarizers.set('default', new DefaultResponseSummarizer());
    this.summarizers.set('detailed', new DetailedResponseSummarizer());
    this.summarizers.set('brief', new BriefResponseSummarizer());
  }

  /**
   * Format execution results
   */
  private async formatExecutionResults(
    commands: AutomationCommand[],
    results: any[],
    context?: any
  ): Promise<ResponseFormatting> {
    const formatter = this.formatters.get('html');
    if (!formatter) {
      throw new Error('HTML formatter not found');
    }

    const executionData = {
      commands,
      results,
      summary: this.generateExecutionDescription(commands, results),
      timestamp: Date.now(),
    };

    return await formatter.format(executionData, context);
  }

  /**
   * Format error response
   */
  private async formatErrorResponse(
    error: RayError,
    context?: any
  ): Promise<ResponseFormatting> {
    const formatter = this.formatters.get('html');
    if (!formatter) {
      throw new Error('HTML formatter not found');
    }

    const errorData = {
      error,
      context,
      timestamp: Date.now(),
    };

    return await formatter.format(errorData, context);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.responseCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.responseCache.size,
      maxSize: this.config.maxCacheSize,
      hitRate: 0, // Would need to track hits/misses
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ResponseProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Supporting interfaces
export interface ProcessingOptions {
  format?: string;
  enableSummary?: boolean;
  summaryType?: string;
  bypassCache?: boolean;
}

// Formatter interface
export interface ResponseFormatter {
  format(response: any, context?: any): Promise<ResponseFormatting>;
}

// Summarizer interface
export interface ResponseSummarizer {
  summarize(response: any, context?: any): Promise<any>;
}

// Concrete formatter implementations
class JsonResponseFormatter implements ResponseFormatter {
  async format(response: any, context?: any): Promise<ResponseFormatting> {
    return {
      format: 'json',
      content: JSON.stringify(response, null, 2),
      structured: response,
      styling: {
        theme: 'auto',
        colors: {},
        typography: {
          fontFamily: 'monospace',
          fontSize: '12px',
          lineHeight: '1.4',
        },
        layout: {
          spacing: 'normal',
          padding: '8px',
          borderRadius: '4px',
        },
      },
    };
  }
}

class TextResponseFormatter implements ResponseFormatter {
  async format(response: any, context?: any): Promise<ResponseFormatting> {
    let content = '';
    
    if (typeof response === 'string') {
      content = response;
    } else if (response.choices && response.choices[0]?.message?.content) {
      content = response.choices[0].message.content;
    } else {
      content = JSON.stringify(response, null, 2);
    }

    return {
      format: 'text',
      content,
      structured: response,
      styling: {
        theme: 'auto',
        colors: {},
        typography: {
          fontFamily: 'sans-serif',
          fontSize: '14px',
          lineHeight: '1.5',
        },
        layout: {
          spacing: 'normal',
          padding: '12px',
          borderRadius: '0px',
        },
      },
    };
  }
}

class HtmlResponseFormatter implements ResponseFormatter {
  async format(response: any, context?: any): Promise<ResponseFormatting> {
    let content = '';
    
    if (typeof response === 'string') {
      content = `<div class="ray-response">${this.escapeHtml(response)}</div>`;
    } else if (response.commands && response.results) {
      content = this.formatExecutionResultsHtml(response);
    } else {
      content = `<div class="ray-response"><pre>${this.escapeHtml(JSON.stringify(response, null, 2))}</pre></div>`;
    }

    return {
      format: 'html',
      content,
      structured: response,
      styling: {
        theme: 'auto',
        colors: {
          primary: '#007bff',
          success: '#28a745',
          error: '#dc3545',
          warning: '#ffc107',
          background: '#ffffff',
          text: '#333333',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '14px',
          lineHeight: '1.5',
        },
        layout: {
          spacing: 'normal',
          padding: '16px',
          borderRadius: '8px',
        },
      },
    };
  }

  private formatExecutionResultsHtml(data: any): string {
    const { commands, results, summary } = data;
    
    let html = '<div class="execution-results">';
    html += `<h3>${summary}</h3>`;
    html += '<div class="commands-list">';
    
    commands.forEach((cmd: any, index: number) => {
      const result = results[index];
      const status = result?.success !== false ? 'success' : 'error';
      const statusClass = status === 'success' ? 'success' : 'error';
      
      html += `<div class="command-item ${statusClass}">`;
      html += `<div class="command-type">${cmd.type}</div>`;
      html += `<div class="command-description">${this.escapeHtml(cmd.description || cmd.type)}</div>`;
      
      if (result?.error) {
        html += `<div class="command-error">${this.escapeHtml(result.error)}</div>`;
      }
      
      html += '</div>';
    });
    
    html += '</div>';
    html += '</div>';
    
    return html;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

class MarkdownResponseFormatter implements ResponseFormatter {
  async format(response: any, context?: any): Promise<ResponseFormatting> {
    let content = '';
    
    if (typeof response === 'string') {
      content = response;
    } else if (response.choices && response.choices[0]?.message?.content) {
      content = response.choices[0].message.content;
    } else {
      content = '```json\n' + JSON.stringify(response, null, 2) + '\n```';
    }

    return {
      format: 'markdown',
      content,
      structured: response,
      styling: {
        theme: 'auto',
        colors: {},
        typography: {
          fontFamily: 'monospace',
          fontSize: '13px',
          lineHeight: '1.4',
        },
        layout: {
          spacing: 'normal',
          padding: '8px',
          borderRadius: '4px',
        },
      },
    };
  }
}

// Summarizer implementations
class DefaultResponseSummarizer implements ResponseSummarizer {
  async summarize(response: any, context?: any): Promise<any> {
    if (response.choices && response.choices[0]?.message?.content) {
      return {
        type: 'ai_response',
        content: response.choices[0].message.content,
        confidence: response.confidence || 0.5,
      };
    }
    
    return {
      type: 'raw_response',
      content: response,
      confidence: 0.5,
    };
  }
}

class DetailedResponseSummarizer implements ResponseSummarizer {
  async summarize(response: any, context?: any): Promise<any> {
    const summary = {
      type: 'detailed',
      content: response,
      metadata: {
        timestamp: Date.now(),
        context: context,
        model: response.model,
        usage: response.usage,
      },
      confidence: response.confidence || 0.5,
    };
    
    if (response.choices && response.choices[0]) {
      summary.analysis = {
        reasoning: response.choices[0].reasoning,
        safety: response.choices[0].safety,
        alternatives: response.choices[0].alternatives,
      };
    }
    
    return summary;
  }
}

class BriefResponseSummarizer implements ResponseSummarizer {
  async summarize(response: any, context?: any): Promise<any> {
    let briefContent = '';
    
    if (response.choices && response.choices[0]?.message?.content) {
      const content = response.choices[0].message.content;
      briefContent = content.length > 200 ? content.substring(0, 197) + '...' : content;
    } else {
      const str = JSON.stringify(response);
      briefContent = str.length > 200 ? str.substring(0, 197) + '...' : str;
    }
    
    return {
      type: 'brief',
      content: briefContent,
      confidence: response.confidence || 0.5,
      truncated: JSON.stringify(response).length > 200 || (response.choices?.[0]?.message?.content?.length || 0) > 200,
    };
  }
} * Response processor for handling AI responses and user feedback
 */

import { 
  AutomationCommand, 
  UIStatus, 
  AgentMessage,
  RayError
} from '../shared/contracts';
import { 
  EnhancedParsedCommand,
  ParsingResult,
  ValidationResult
} from '../commands/types';

export interface ResponseProcessorConfig {
  enableCaching: boolean;
  cacheTimeout: number;
  maxCacheSize: number;
  enableFormatting: boolean;
  enableSummarization: boolean;
}

export interface ProcessedResponse {
  id: string;
  originalResponse: any;
  processedResponse: any;
  formatting: ResponseFormatting;
  summary: ResponseSummary;
  metadata: ResponseMetadata;
  timestamp: number;
}

export interface ResponseFormatting {
  format: 'json' | 'text' | 'html' | 'markdown';
  content: string;
  structured: any;
  styling: ResponseStyling;
}

export interface ResponseStyling {
  theme: 'light' | 'dark' | 'auto';
  colors: Record<string, string>;
  typography: {
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
  };
  layout: {
    spacing: string;
    padding: string;
    borderRadius: string;
  };
}

export interface ResponseSummary {
  title: string;
  description: string;
  keyPoints: string[];
  commands: CommandSummary[];
  confidence: number;
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CommandSummary {
  id: string;
  description: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface ResponseMetadata {
  processingTime: number;
  source: 'ai' | 'cache' | 'fallback';
  confidence: number;
  tokensUsed: number;
  model: string;
  requestId: string;
  userId: string;
  context: any;
}

export class ResponseProcessor {
  private config: ResponseProcessorConfig;
  private responseCache: Map<string, ProcessedResponse> = new Map();
  private formatters: Map<string, ResponseFormatter> = new Map();
  private summarizers: Map<string, ResponseSummarizer> = new Map();

  constructor(config: Partial<ResponseProcessorConfig> = {}) {
    this.config = {
      enableCaching: true,
      cacheTimeout: 300000, // 5 minutes
      maxCacheSize: 100,
      enableFormatting: true,
      enableSummarization: true,
      ...config,
    };

    this.initializeFormatters();
    this.initializeSummarizers();
  }

  /**
   * Process AI response
   */
  async processResponse(
    response: any,
    context?: any,
    options: ProcessingOptions = {}
  ): Promise<ProcessedResponse> {
    const startTime = Date.now();
    const responseId = this.generateResponseId();

    try {
      // Check cache first
      if (this.config.enableCaching && !options.bypassCache) {
        const cacheKey = this.generateCacheKey(response, context);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          return {
            ...cached,
            id: responseId,
            metadata: {
              ...cached.metadata,
              source: 'cache',
              processingTime: Date.now() - startTime,
            },
          };
        }
      }
      }

      // Process the response
      const processedResponse = await this.processResponseInternal(response, context, options);
      
      const result: ProcessedResponse = {
        id: responseId,
        originalResponse: response,
        processedResponse: processedResponse.data,
        formatting: processedResponse.formatting,
        summary: processedResponse.summary,
        metadata: {
          processingTime: Date.now() - startTime,
          source: 'ai',
          confidence: processedResponse.confidence || 0.5,
          tokensUsed: processedResponse.tokensUsed || 0,
          model: processedResponse.model || 'unknown',
          requestId: responseId,
          userId: context?.userId || 'anonymous',
          context,
        },
        timestamp: Date.now(),
      };

      // Cache the result
      if (this.config.enableCaching) {
        const cacheKey = this.generateCacheKey(response, context);
        this.setCache(cacheKey, result);
      }

      return result;

    } catch (error) {
      const rayError: RayError = {
        code: 'RESPONSE_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error processing response',
        timestamp: Date.now(),
        details: error,
      };

      throw rayError;
    }
  }

  /**
   * Process command results
   */
  async processCommandResults(
    commands: AutomationCommand[],
    results: any[],
    context?: any
  ): Promise<ProcessedResponse> {
    const responseId = this.generateResponseId();
    const startTime = Date.now();

    try {
      // Create command summaries
      const commandSummaries: CommandSummary[] = commands.map((cmd, index) => ({
        id: cmd.id,
        description: this.generateCommandDescription(cmd),
        type: cmd.type,
        status: this.determineCommandStatus(results[index]),
        result: results[index],
        error: this.extractCommandError(results[index]),
      }));

      // Generate overall summary
      const summary: ResponseSummary = {
        title: `Executed ${commands.length} command${commands.length === 1 ? '' : 's'}`,
        description: this.generateExecutionDescription(commands, results),
        keyPoints: this.extractKeyPoints(commands, results),
        commands: commandSummaries,
        confidence: this.calculateOverallConfidence(results),
        estimatedDuration: this.calculateEstimatedDuration(results),
        riskLevel: this.calculateRiskLevel(commands),
      };

      // Format the response
      const formatting = await this.formatExecutionResults(commands, results, context);

      const result: ProcessedResponse = {
        id: responseId,
        originalResponse: { commands, results },
        processedResponse: { commandSummaries, summary },
        formatting,
        summary,
        metadata: {
          processingTime: Date.now() - startTime,
          source: 'ai',
          confidence: summary.confidence,
          tokensUsed: 0,
          model: 'execution_engine',
          requestId: responseId,
          userId: context?.userId || 'anonymous',
          context,
        },
        timestamp: Date.now(),
      };

      return result;

    } catch (error) {
      const rayError: RayError = {
        code: 'COMMAND_RESULTS_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error processing command results',
        timestamp: Date.now(),
        details: error,
      };

      throw rayError;
    }
  }

  /**
   * Process error response
   */
  async processErrorResponse(
    error: RayError,
    context?: any
  ): Promise<ProcessedResponse> {
    const responseId = this.generateResponseId();
    const startTime = Date.now();

    try {
      // Format error for user display
      const formatting = await this.formatErrorResponse(error, context);

      // Generate error summary
      const summary: ResponseSummary = {
        title: 'Error Occurred',
        description: error.message,
        keyPoints: [
          `Error Code: ${error.code}`,
          `Time: ${new Date(error.timestamp).toLocaleString()}`,
        ],
        commands: [],
        confidence: 0,
        estimatedDuration: 0,
        riskLevel: 'high',
      };

      const result: ProcessedResponse = {
        id: responseId,
        originalResponse: error,
        processedResponse: { error },
        formatting,
        summary,
        metadata: {
          processingTime: Date.now() - startTime,
          source: 'ai',
          confidence: 0,
          tokensUsed: 0,
          model: 'error_processor',
          requestId: responseId,
          userId: context?.userId || 'anonymous',
          context,
        },
        timestamp: Date.now(),
      };

      return result;

    } catch (processingError) {
      const rayError: RayError = {
        code: 'ERROR_PROCESSING_ERROR',
        message: processingError instanceof Error ? processingError.message : 'Unknown error processing error',
        timestamp: Date.now(),
        details: processingError,
      };

      throw rayError;
    }
  }

  /**
   * Process response internally
   */
  private async processResponseInternal(
    response: any,
    context?: any,
    options: ProcessingOptions = {}
  ): Promise<any> {
    let processedData = response;
    let confidence = 0.5;
    let tokensUsed = 0;
    let model = 'unknown';

    // Extract AI response metadata if available
    if (response.usage) {
      tokensUsed = response.usage.total_tokens || 0;
    }

    if (response.model) {
      model = response.model;
    }

    // Apply formatters
    if (this.config.enableFormatting && options.format) {
      const formatter = this.formatters.get(options.format);
      if (formatter) {
        processedData = await formatter.format(response, context);
      }
    }

    // Apply summarizers
    if (this.config.enableSummarization && options.enableSummary) {
      const summarizer = this.summarizers.get(options.summaryType || 'default');
      if (summarizer) {
        const summary = await summarizer.summarize(response, context);
        processedData.summary = summary;
      }
    }

    // Extract confidence if available
    if (response.confidence !== undefined) {
      confidence = response.confidence;
    }

    return {
      data: processedData,
      confidence,
      tokensUsed,
      model,
    };
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(response: any, context?: any): string {
    const keyData = {
      response: typeof response === 'object' ? JSON.stringify(response) : response,
      context: context ? JSON.stringify(context) : '',
    };
    return btoa(JSON.stringify(keyData));
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): ProcessedResponse | null {
    const cached = this.responseCache.get(key);
    if (!cached) {
      return null;
    }

    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > this.config.cacheTimeout) {
      this.responseCache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Set cache
   */
  private setCache(key: string, response: ProcessedResponse): void {
    // Remove oldest entries if cache is full
    if (this.responseCache.size >= this.config.maxCacheSize) {
      const oldestKey = this.responseCache.keys().next().value;
      if (oldestKey) {
        this.responseCache.delete(oldestKey);
      }
    }

    this.responseCache.set(key, response);
  }

  /**
   * Generate response ID
   */
  private generateResponseId(): string {
    return `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate command description
   */
  private generateCommandDescription(command: AutomationCommand): string {
    const descriptions: Record<string, string> = {
      navigate: `Navigate to ${command.url}`,
      click: `Click element: ${command.selector || command.value}`,
      fill: `Fill form field: ${command.selector}`,
      scroll: `Scroll ${command.options?.direction || 'down'}`,
      submit: `Submit form`,
      extract: `Extract data: ${command.options?.extractType || 'text'}`,
      wait: `Wait ${command.timeout || 'default'}ms`,
    };

    return descriptions[command.type] || `Execute ${command.type}`;
  }

  /**
   * Determine command status
   */
  private determineCommandStatus(result: any): CommandSummary['status'] {
    if (!result) {
      return 'failed';
    }

    if (result.success === false) {
      return 'failed';
    }

    if (result.status === 'completed') {
      return 'completed';
    }

    return 'completed';
  }

  /**
   * Extract command error
   */
  private extractCommandError(result: any): string | undefined {
    if (!result || result.success !== false) {
      return undefined;
    }

    return result.error || result.message || 'Unknown error';
  }

  /**
   * Generate execution description
   */
  private generateExecutionDescription(commands: AutomationCommand[], results: any[]): string {
    const successCount = results.filter(r => r && r.success !== false).length;
    const totalCount = commands.length;

    if (successCount === totalCount) {
      return `Successfully executed ${totalCount} command${totalCount === 1 ? '' : 's'}`;
    } else {
      return `Executed ${totalCount} command${totalCount === 1 ? '' : 's'} with ${successCount} success${successCount === 1 ? '' : 'es'}`;
    }
  }

  /**
   * Extract key points from execution
   */
  private extractKeyPoints(commands: AutomationCommand[], results: any[]): string[] {
    const keyPoints: string[] = [];

    commands.forEach((cmd, index) => {
      const result = results[index];
      
      if (cmd.type === 'navigate' && result?.url) {
        keyPoints.push(`Navigated to: ${result.url}`);
      }
      
      if (cmd.type === 'click' && result?.element) {
        keyPoints.push(`Clicked: ${result.element}`);
      }
      
      if (cmd.type === 'fill' && result?.field) {
        keyPoints.push(`Filled: ${result.field}`);
      }
    });

    return keyPoints;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(results: any[]): number {
    const validResults = results.filter(r => r && r.confidence !== undefined);
    if (validResults.length === 0) {
      return 0.5;
    }

    const totalConfidence = validResults.reduce((sum, r) => sum + r.confidence, 0);
    return totalConfidence / validResults.length;
  }

  /**
   * Calculate estimated duration
   */
  private calculateEstimatedDuration(results: any[]): number {
    const validResults = results.filter(r => r && r.duration !== undefined);
    if (validResults.length === 0) {
      return 0;
    }

    return validResults.reduce((sum, r) => sum + r.duration, 0);
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(commands: AutomationCommand[]): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    commands.forEach(cmd => {
      if (cmd.type === 'navigate' && cmd.url?.includes('http://')) {
        riskScore += 1;
      }
      
      if (cmd.type === 'fill' && cmd.value?.includes('password')) {
        riskScore += 2;
      }
      
      if (cmd.type === 'submit') {
        riskScore += 1;
      }
    });

    if (riskScore >= 3) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }

  /**
   * Initialize formatters
   */
  private initializeFormatters(): void {
    this.formatters.set('json', new JsonResponseFormatter());
    this.formatters.set('text', new TextResponseFormatter());
    this.formatters.set('html', new HtmlResponseFormatter());
    this.formatters.set('markdown', new MarkdownResponseFormatter());
  }

  /**
   * Initialize summarizers
   */
  private initializeSummarizers(): void {
    this.summarizers.set('default', new DefaultResponseSummarizer());
    this.summarizers.set('detailed', new DetailedResponseSummarizer());
    this.summarizers.set('brief', new BriefResponseSummarizer());
  }

  /**
   * Format execution results
   */
  private async formatExecutionResults(
    commands: AutomationCommand[],
    results: any[],
    context?: any
  ): Promise<ResponseFormatting> {
    const formatter = this.formatters.get('html');
    if (!formatter) {
      throw new Error('HTML formatter not found');
    }

    const executionData = {
      commands,
      results,
      summary: this.generateExecutionDescription(commands, results),
      timestamp: Date.now(),
    };

    return await formatter.format(executionData, context);
  }

  /**
   * Format error response
   */
  private async formatErrorResponse(
    error: RayError,
    context?: any
  ): Promise<ResponseFormatting> {
    const formatter = this.formatters.get('html');
    if (!formatter) {
      throw new Error('HTML formatter not found');
    }

    const errorData = {
      error,
      context,
      timestamp: Date.now(),
    };

    return await formatter.format(errorData, context);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.responseCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.responseCache.size,
      maxSize: this.config.maxCacheSize,
      hitRate: 0, // Would need to track hits/misses
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ResponseProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Supporting interfaces
export interface ProcessingOptions {
  format?: string;
  enableSummary?: boolean;
  summaryType?: string;
  bypassCache?: boolean;
}

// Formatter interface
export interface ResponseFormatter {
  format(response: any, context?: any): Promise<ResponseFormatting>;
}

// Summarizer interface
export interface ResponseSummarizer {
  summarize(response: any, context?: any): Promise<any>;
}

// Concrete formatter implementations
class JsonResponseFormatter implements ResponseFormatter {
  async format(response: any, context?: any): Promise<ResponseFormatting> {
    return {
      format: 'json',
      content: JSON.stringify(response, null, 2),
      structured: response,
      styling: {
        theme: 'auto',
        colors: {},
        typography: {
          fontFamily: 'monospace',
          fontSize: '12px',
          lineHeight: '1.4',
        },
        layout: {
          spacing: 'normal',
          padding: '8px',
          borderRadius: '4px',
        },
      },
    };
  }
}

class TextResponseFormatter implements ResponseFormatter {
  async format(response: any, context?: any): Promise<ResponseFormatting> {
    let content = '';
    
    if (typeof response === 'string') {
      content = response;
    } else if (response.choices && response.choices[0]?.message?.content) {
      content = response.choices[0].message.content;
    } else {
      content = JSON.stringify(response, null, 2);
    }

    return {
      format: 'text',
      content,
      structured: response,
      styling: {
        theme: 'auto',
        colors: {},
        typography: {
          fontFamily: 'sans-serif',
          fontSize: '14px',
          lineHeight: '1.5',
        },
        layout: {
          spacing: 'normal',
          padding: '12px',
          borderRadius: '0px',
        },
      },
    };
  }
}

class HtmlResponseFormatter implements ResponseFormatter {
  async format(response: any, context?: any): Promise<ResponseFormatting> {
    let content = '';
    
    if (typeof response === 'string') {
      content = `<div class="ray-response">${this.escapeHtml(response)}</div>`;
    } else if (response.commands && response.results) {
      content = this.formatExecutionResultsHtml(response);
    } else {
      content = `<div class="ray-response"><pre>${this.escapeHtml(JSON.stringify(response, null, 2))}</pre></div>`;
    }

    return {
      format: 'html',
      content,
      structured: response,
      styling: {
        theme: 'auto',
        colors: {
          primary: '#007bff',
          success: '#28a745',
          error: '#dc3545',
          warning: '#ffc107',
          background: '#ffffff',
          text: '#333333',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '14px',
          lineHeight: '1.5',
        },
        layout: {
          spacing: 'normal',
          padding: '16px',
          borderRadius: '8px',
        },
      },
    };
  }

  private formatExecutionResultsHtml(data: any): string {
    const { commands, results, summary } = data;
    
    let html = '<div class="execution-results">';
    html += `<h3>${summary}</h3>`;
    html += '<div class="commands-list">';
    
    commands.forEach((cmd: any, index: number) => {
      const result = results[index];
      const status = result?.success !== false ? 'success' : 'error';
      const statusClass = status === 'success' ? 'success' : 'error';
      
      html += `<div class="command-item ${statusClass}">`;
      html += `<div class="command-type">${cmd.type}</div>`;
      html += `<div class="command-description">${this.escapeHtml(cmd.description || cmd.type)}</div>`;
      
      if (result?.error) {
        html += `<div class="command-error">${this.escapeHtml(result.error)}</div>`;
      }
      
      html += '</div>';
    });
    
    html += '</div>';
    html += '</div>';
    
    return html;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

class MarkdownResponseFormatter implements ResponseFormatter {
  async format(response: any, context?: any): Promise<ResponseFormatting> {
    let content = '';
    
    if (typeof response === 'string') {
      content = response;
    } else if (response.choices && response.choices[0]?.message?.content) {
      content = response.choices[0].message.content;
    } else {
      content = '```json\n' + JSON.stringify(response, null, 2) + '\n```';
    }

    return {
      format: 'markdown',
      content,
      structured: response,
      styling: {
        theme: 'auto',
        colors: {},
        typography: {
          fontFamily: 'monospace',
          fontSize: '13px',
          lineHeight: '1.4',
        },
        layout: {
          spacing: 'normal',
          padding: '8px',
          borderRadius: '4px',
        },
      },
    };
  }
}

// Summarizer implementations
class DefaultResponseSummarizer implements ResponseSummarizer {
  async summarize(response: any, context?: any): Promise<any> {
    if (response.choices && response.choices[0]?.message?.content) {
      return {
        type: 'ai_response',
        content: response.choices[0].message.content,
        confidence: response.confidence || 0.5,
      };
    }
    
    return {
      type: 'raw_response',
      content: response,
      confidence: 0.5,
    };
  }
}

class DetailedResponseSummarizer implements ResponseSummarizer {
  async summarize(response: any, context?: any): Promise<any> {
    const summary = {
      type: 'detailed',
      content: response,
      metadata: {
        timestamp: Date.now(),
        context: context,
        model: response.model,
        usage: response.usage,
      },
      confidence: response.confidence || 0.5,
    };
    
    if (response.choices && response.choices[0]) {
      summary.analysis = {
        reasoning: response.choices[0].reasoning,
        safety: response.choices[0].safety,
        alternatives: response.choices[0].alternatives,
      };
    }
    
    return summary;
  }
}

class BriefResponseSummarizer implements ResponseSummarizer {
  async summarize(response: any, context?: any): Promise<any> {
    let briefContent = '';
    
    if (response.choices && response.choices[0]?.message?.content) {
      const content = response.choices[0].message.content;
      briefContent = content.length > 200 ? content.substring(0, 197) + '...' : content;
    } else {
      const str = JSON.stringify(response);
      briefContent = str.length > 200 ? str.substring(0, 197) + '...' : str;
    }
    
    return {
      type: 'brief',
      content: briefContent,
      confidence: response.confidence || 0.5,
      truncated: JSON.stringify(response).length > 200 || (response.choices?.[0]?.message?.content?.length || 0) > 200,
    };
  }
}
