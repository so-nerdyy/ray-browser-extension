/**
 * OpenRouter API type definitions
 */

import { OpenRouterMessage, OpenRouterRequest, OpenRouterResponse, RayError } from '../shared/contracts';

// Enhanced request types for our specific use case
export interface RayOpenRouterRequest extends OpenRouterRequest {
  // Additional metadata for our application
  sessionId?: string;
  userId?: string;
  commandContext?: {
    currentUrl?: string;
    pageTitle?: string;
    previousCommands?: string[];
  };
}

// Enhanced response types
export interface RayOpenRouterResponse extends OpenRouterResponse {
  // Additional metadata
  requestId: string;
  processingTime: number;
  cached: boolean;
}

// Command parsing response from AI
export interface ParsedAIResponse {
  commands: Array<{
    type: 'navigate' | 'click' | 'fill' | 'scroll' | 'submit' | 'extract' | 'wait';
    selector?: string;
    value?: string;
    url?: string;
    description: string;
    confidence?: number;
    timeout?: number;
  }>;
  confidence: number;
  requiresClarification: boolean;
  clarificationQuestion?: string;
  alternativeCommands?: Array<{
    description: string;
    commands: any[];
  }>;
}

// API error response structure
export interface OpenRouterAPIError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

// Rate limit information
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// Request options
export interface RequestOptions {
  timeout?: number;
  retries?: number;
  useCache?: boolean;
  priority?: 'low' | 'normal' | 'high';
}

// Cache entry for API responses
export interface APIResponseCache {
  [key: string]: {
    response: RayOpenRouterResponse;
    timestamp: number;
    ttl: number;
    hitCount: number;
  };
}

// API client configuration
export interface OpenRouterClientConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retries?: number;
  enableCache?: boolean;
  cacheSize?: number;
  cacheTTL?: number;
}

// Error handling types
export interface OpenRouterError extends RayError {
  type: 'network' | 'api' | 'rate_limit' | 'timeout' | 'auth' | 'quota' | 'validation';
  statusCode?: number;
  rateLimitInfo?: RateLimitInfo;
}

// Response validation result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedResponse?: RayOpenRouterResponse;
}

// Usage statistics
export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cachedRequests: number;
  totalTokens: number;
  averageResponseTime: number;
  lastRequestTime: number;
}

// Event types for monitoring
export type OpenRouterEvent = 
  | { type: 'request_start'; data: { requestId: string; prompt: string } }
  | { type: 'request_success'; data: { requestId: string; response: RayOpenRouterResponse } }
  | { type: 'request_error'; data: { requestId: string; error: OpenRouterError } }
  | { type: 'cache_hit'; data: { requestId: string; cacheKey: string } }
  | { type: 'rate_limit'; data: { retryAfter: number } }
  | { type: 'quota_exceeded'; data: { resetTime: number } };

// Event listener type
export type OpenRouterEventListener = (event: OpenRouterEvent) => void; * OpenRouter API type definitions
 */

import { OpenRouterMessage, OpenRouterRequest, OpenRouterResponse, RayError } from '../shared/contracts';

// Enhanced request types for our specific use case
export interface RayOpenRouterRequest extends OpenRouterRequest {
  // Additional metadata for our application
  sessionId?: string;
  userId?: string;
  commandContext?: {
    currentUrl?: string;
    pageTitle?: string;
    previousCommands?: string[];
  };
}

// Enhanced response types
export interface RayOpenRouterResponse extends OpenRouterResponse {
  // Additional metadata
  requestId: string;
  processingTime: number;
  cached: boolean;
}

// Command parsing response from AI
export interface ParsedAIResponse {
  commands: Array<{
    type: 'navigate' | 'click' | 'fill' | 'scroll' | 'submit' | 'extract' | 'wait';
    selector?: string;
    value?: string;
    url?: string;
    description: string;
    confidence?: number;
    timeout?: number;
  }>;
  confidence: number;
  requiresClarification: boolean;
  clarificationQuestion?: string;
  alternativeCommands?: Array<{
    description: string;
    commands: any[];
  }>;
}

// API error response structure
export interface OpenRouterAPIError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

// Rate limit information
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// Request options
export interface RequestOptions {
  timeout?: number;
  retries?: number;
  useCache?: boolean;
  priority?: 'low' | 'normal' | 'high';
}

// Cache entry for API responses
export interface APIResponseCache {
  [key: string]: {
    response: RayOpenRouterResponse;
    timestamp: number;
    ttl: number;
    hitCount: number;
  };
}

// API client configuration
export interface OpenRouterClientConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retries?: number;
  enableCache?: boolean;
  cacheSize?: number;
  cacheTTL?: number;
}

// Error handling types
export interface OpenRouterError extends RayError {
  type: 'network' | 'api' | 'rate_limit' | 'timeout' | 'auth' | 'quota' | 'validation';
  statusCode?: number;
  rateLimitInfo?: RateLimitInfo;
}

// Response validation result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedResponse?: RayOpenRouterResponse;
}

// Usage statistics
export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cachedRequests: number;
  totalTokens: number;
  averageResponseTime: number;
  lastRequestTime: number;
}

// Event types for monitoring
export type OpenRouterEvent = 
  | { type: 'request_start'; data: { requestId: string; prompt: string } }
  | { type: 'request_success'; data: { requestId: string; response: RayOpenRouterResponse } }
  | { type: 'request_error'; data: { requestId: string; error: OpenRouterError } }
  | { type: 'cache_hit'; data: { requestId: string; cacheKey: string } }
  | { type: 'rate_limit'; data: { retryAfter: number } }
  | { type: 'quota_exceeded'; data: { resetTime: number } };

// Event listener type
export type OpenRouterEventListener = (event: OpenRouterEvent) => void;
