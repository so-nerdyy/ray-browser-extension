/**
 * API Response Performance Tests
 * Tests for API response time and performance metrics
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock API performance monitoring module
const mockAPIPerformanceMonitor = {
  // API performance monitor
  performance: {
    // Measure API response time
    measureAPIResponseTime: async (endpoint, payload) => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        
        // Simulate API call
        setTimeout(() => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          resolve({
            endpoint: endpoint,
            responseTime: responseTime,
            timestamp: new Date().toISOString(),
            payload: payload,
            metrics: {
              dnsLookup: responseTime * 0.1, // DNS lookup takes 10%
              tcpConnection: responseTime * 0.2, // TCP connection takes 20%
              sslHandshake: responseTime * 0.1, // SSL handshake takes 10%
              serverProcessing: responseTime * 0.4, // Server processing takes 40%
              contentTransfer: responseTime * 0.2 // Content transfer takes 20%
            }
          });
        }, 200); // Simulate 200ms response time
      });
    },
    
    // Measure API request size
    measureAPIRequestSize: async (endpoint, payload) => {
      return new Promise((resolve) => {
        const requestSize = JSON.stringify(payload).length;
        const headersSize = 200; // Simulate 200 bytes of headers
        
        resolve({
          endpoint: endpoint,
          requestSize: requestSize,
          headersSize: headersSize,
          totalSize: requestSize + headersSize,
          timestamp: new Date().toISOString(),
          efficiency: {
            payloadToTotalRatio: requestSize / (requestSize + headersSize),
            compressionRatio: 0.7 // Simulate 30% compression
          }
        });
      });
    },
    
    // Measure API response size
    measureAPIResponseSize: async (endpoint, response) => {
      return new Promise((resolve) => {
        const responseSize = JSON.stringify(response).length;
        const headersSize = 150; // Simulate 150 bytes of headers
        
        resolve({
          endpoint: endpoint,
          responseSize: responseSize,
          headersSize: headersSize,
          totalSize: responseSize + headersSize,
          timestamp: new Date().toISOString(),
          efficiency: {
            payloadToTotalRatio: responseSize / (responseSize + headersSize),
            compressionRatio: 0.65 // Simulate 35% compression
          }
        });
      });
    },
    
    // Measure API throughput
    measureAPIThroughput: async (endpoint, concurrency = 1) => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        let completedRequests = 0;
        const totalRequests = 10 * concurrency;
        
        // Simulate concurrent requests
        for (let i = 0; i < totalRequests; i++) {
          setTimeout(() => {
            completedRequests++;
            if (completedRequests === totalRequests) {
              const endTime = performance.now();
              const totalTime = endTime - startTime;
              
              resolve({
                endpoint: endpoint,
                concurrency: concurrency,
                totalRequests: totalRequests,
                totalTime: totalTime,
                throughput: totalRequests / (totalTime / 1000), // Requests per second
                averageResponseTime: totalTime / totalRequests,
                timestamp: new Date().toISOString()
              });
            }
          }, 200 + Math.random() * 100); // Random response time between 200-300ms
        }
      });
    },
    
    // Measure API error rate
    measureAPIErrorRate: async (endpoint, errorRate = 0.05) => {
      return new Promise((resolve) => {
        const totalRequests = 100;
        let errors = 0;
        
        // Simulate requests with error rate
        for (let i = 0; i < totalRequests; i++) {
          if (Math.random() < errorRate) {
            errors++;
          }
        }
        
        resolve({
          endpoint: endpoint,
          totalRequests: totalRequests,
          errors: errors,
          errorRate: errors / totalRequests,
          successRate: (totalRequests - errors) / totalRequests,
          timestamp: new Date().toISOString(),
          errorTypes: {
            timeout: Math.floor(errors * 0.3),
            serverError: Math.floor(errors * 0.4),
            networkError: Math.floor(errors * 0.2),
            other: Math.floor(errors * 0.1)
          }
        });
      });
    },
    
    // Measure API latency distribution
    measureAPILatencyDistribution: async (endpoint) => {
      return new Promise((resolve) => {
        const measurements = [];
        const sampleCount = 50;
        
        // Generate latency measurements
        for (let i = 0; i < sampleCount; i++) {
          measurements.push(150 + Math.random() * 200); // Random latency between 150-350ms
        }
        
        measurements.sort((a, b) => a - b);
        
        const calculatePercentile = (arr, percentile) => {
          const index = Math.ceil((percentile / 100) * arr.length) - 1;
          return arr[Math.max(0, index)];
        };
        
        resolve({
          endpoint: endpoint,
          sampleCount: sampleCount,
          distribution: {
            min: measurements[0],
            max: measurements[measurements.length - 1],
            mean: measurements.reduce((sum, val) => sum + val, 0) / measurements.length,
            median: calculatePercentile(measurements, 50),
            p50: calculatePercentile(measurements, 50),
            p75: calculatePercentile(measurements, 75),
            p90: calculatePercentile(measurements, 90),
            p95: calculatePercentile(measurements, 95),
            p99: calculatePercentile(measurements, 99)
          },
          timestamp: new Date().toISOString()
        });
      });
    },
    
    // Analyze API performance bottlenecks
    analyzeAPIPerformanceBottlenecks: async (metrics) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const bottlenecks = [];
          
          // Analyze response time
          if (metrics.responseTime > 500) {
            bottlenecks.push({
              type: 'slow_response',
              severity: 'high',
              description: 'API response time exceeds 500ms',
              recommendation: 'Optimize API endpoint or implement caching'
            });
          } else if (metrics.responseTime > 300) {
            bottlenecks.push({
              type: 'moderate_response',
              severity: 'medium',
              description: 'API response time exceeds 300ms',
              recommendation: 'Review API performance and consider optimizations'
            });
          }
          
          // Analyze request size
          if (metrics.requestSize && metrics.requestSize.totalSize > 1024 * 10) { // 10KB
            bottlenecks.push({
              type: 'large_request',
              severity: 'medium',
              description: 'API request size exceeds 10KB',
              recommendation: 'Optimize request payload and consider compression'
            });
          }
          
          // Analyze response size
          if (metrics.responseSize && metrics.responseSize.totalSize > 1024 * 100) { // 100KB
            bottlenecks.push({
              type: 'large_response',
              severity: 'medium',
              description: 'API response size exceeds 100KB',
              recommendation: 'Implement response pagination or data filtering'
            });
          }
          
          // Analyze error rate
          if (metrics.errorRate && metrics.errorRate.errorRate > 0.1) { // 10%
            bottlenecks.push({
              type: 'high_error_rate',
              severity: 'high',
              description: 'API error rate exceeds 10%',
              recommendation: 'Investigate API reliability and implement retry logic'
            });
          }
          
          // Analyze throughput
          if (metrics.throughput && metrics.throughput.throughput < 5) { // Less than 5 req/sec
            bottlenecks.push({
              type: 'low_throughput',
              severity: 'medium',
              description: 'API throughput is less than 5 requests per second',
              recommendation: 'Optimize API performance or consider load balancing'
            });
          }
          
          resolve({
            bottlenecks: bottlenecks,
            overallScore: Math.max(0, 100 - (bottlenecks.length * 20)),
            timestamp: new Date().toISOString()
          });
        }, 20); // Simulate 20ms analysis time
      });
    },
    
    // Generate API performance report
    generateAPIPerformanceReport: async (endpoint) => {
      const responseTime = await mockAPIPerformanceMonitor.performance.measureAPIResponseTime(endpoint, { test: 'data' });
      const requestSize = await mockAPIPerformanceMonitor.performance.measureAPIRequestSize(endpoint, { test: 'data' });
      const responseSize = await mockAPIPerformanceMonitor.performance.measureAPIResponseSize(endpoint, { result: 'success' });
      const throughput = await mockAPIPerformanceMonitor.performance.measureAPIThroughput(endpoint);
      const errorRate = await mockAPIPerformanceMonitor.performance.measureAPIErrorRate(endpoint);
      const latencyDistribution = await mockAPIPerformanceMonitor.performance.measureAPILatencyDistribution(endpoint);
      const bottlenecks = await mockAPIPerformanceMonitor.performance.analyzeAPIPerformanceBottlenecks({
        responseTime: responseTime.responseTime,
        requestSize: requestSize,
        responseSize: responseSize,
        errorRate: errorRate,
        throughput: throughput
      });
      
      return {
        endpoint: endpoint,
        summary: {
          averageResponseTime: responseTime.responseTime,
          requestSize: requestSize.totalSize,
          responseSize: responseSize.totalSize,
          throughput: throughput.throughput,
          errorRate: errorRate.errorRate,
          performanceScore: bottlenecks.overallScore
        },
        details: {
          responseTime: responseTime,
          requestSize: requestSize,
          responseSize: responseSize,
          throughput: throughput,
          errorRate: errorRate,
          latencyDistribution: latencyDistribution,
          bottlenecks: bottlenecks
        },
        timestamp: new Date().toISOString(),
        recommendations: bottlenecks.bottlenecks.map(b => b.recommendation)
      };
    }
  }
};

describe('API Response Performance Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock performance.now for consistent testing
    let mockTime = 0;
    global.performance = {
      now: jest.fn(() => {
        mockTime += 10;
        return mockTime;
      })
    };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('API Response Time Measurement', () => {
    test('should measure API response time within acceptable range', async () => {
      const endpoint = '/api/chat/completions';
      const payload = { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseTime(endpoint, payload);
      
      expect(result.responseTime).toBe(200); // Should match our mock
      expect(result.responseTime).toBeLessThan(500); // Should be under 500ms
      expect(result.endpoint).toBe(endpoint);
      expect(result.payload).toEqual(payload);
    });
    
    test('should provide detailed response time metrics', async () => {
      const endpoint = '/api/chat/completions';
      const payload = { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseTime(endpoint, payload);
      
      expect(result).toHaveProperty('responseTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('dnsLookup');
      expect(result.metrics).toHaveProperty('tcpConnection');
      expect(result.metrics).toHaveProperty('sslHandshake');
      expect(result.metrics).toHaveProperty('serverProcessing');
      expect(result.metrics).toHaveProperty('contentTransfer');
    });
    
    test('should verify response time components add up', async () => {
      const endpoint = '/api/chat/completions';
      const payload = { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseTime(endpoint, payload);
      
      const componentSum = Object.values(result.metrics).reduce((sum, time) => sum + time, 0);
      expect(componentSum).toBeCloseTo(result.responseTime, 1);
    });
  });
  
  describe('API Request Size Measurement', () => {
    test('should measure API request size', async () => {
      const endpoint = '/api/chat/completions';
      const payload = { 
        model: 'gpt-4', 
        messages: [{ role: 'user', content: 'Hello, how are you?' }],
        temperature: 0.7,
        max_tokens: 100
      };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIRequestSize(endpoint, payload);
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.requestSize).toBe(JSON.stringify(payload).length);
      expect(result.headersSize).toBe(200);
      expect(result.totalSize).toBe(result.requestSize + result.headersSize);
    });
    
    test('should calculate request efficiency metrics', async () => {
      const endpoint = '/api/chat/completions';
      const payload = { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIRequestSize(endpoint, payload);
      
      expect(result.efficiency).toHaveProperty('payloadToTotalRatio');
      expect(result.efficiency).toHaveProperty('compressionRatio');
      expect(result.efficiency.payloadToTotalRatio).toBeGreaterThan(0);
      expect(result.efficiency.payloadToTotalRatio).toBeLessThan(1);
    });
    
    test('should identify large requests', async () => {
      const endpoint = '/api/chat/completions';
      const largePayload = {
        model: 'gpt-4',
        messages: Array(100).fill({ role: 'user', content: 'This is a long message that will increase the payload size significantly. '.repeat(10) }),
        temperature: 0.7,
        max_tokens: 1000
      };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIRequestSize(endpoint, largePayload);
      
      expect(result.requestSize).toBeGreaterThan(1024 * 5); // Should be larger than 5KB
    });
  });
  
  describe('API Response Size Measurement', () => {
    test('should measure API response size', async () => {
      const endpoint = '/api/chat/completions';
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you today?'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 9,
          completion_tokens: 12,
          total_tokens: 21
        }
      };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseSize(endpoint, response);
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.responseSize).toBe(JSON.stringify(response).length);
      expect(result.headersSize).toBe(150);
      expect(result.totalSize).toBe(result.responseSize + result.headersSize);
    });
    
    test('should calculate response efficiency metrics', async () => {
      const endpoint = '/api/chat/completions';
      const response = { result: 'success', data: 'test' };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseSize(endpoint, response);
      
      expect(result.efficiency).toHaveProperty('payloadToTotalRatio');
      expect(result.efficiency).toHaveProperty('compressionRatio');
      expect(result.efficiency.payloadToTotalRatio).toBeGreaterThan(0);
      expect(result.efficiency.payloadToTotalRatio).toBeLessThan(1);
    });
    
    test('should identify large responses', async () => {
      const endpoint = '/api/chat/completions';
      const largeResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a very long response that will significantly increase the response size. '.repeat(100)
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 500,
          total_tokens: 600
        }
      };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseSize(endpoint, largeResponse);
      
      expect(result.responseSize).toBeGreaterThan(1024 * 10); // Should be larger than 10KB
    });
  });
  
  describe('API Throughput Measurement', () => {
    test('should measure API throughput with single concurrency', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIThroughput(endpoint, 1);
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.concurrency).toBe(1);
      expect(result.totalRequests).toBe(10);
      expect(result.throughput).toBeGreaterThan(0);
      expect(result.averageResponseTime).toBeGreaterThan(0);
    });
    
    test('should measure API throughput with higher concurrency', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIThroughput(endpoint, 5);
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.concurrency).toBe(5);
      expect(result.totalRequests).toBe(50); // 10 * 5
      expect(result.throughput).toBeGreaterThan(0);
      expect(result.averageResponseTime).toBeGreaterThan(0);
    });
    
    test('should show throughput improvement with concurrency', async () => {
      const endpoint = '/api/chat/completions';
      
      const singleConcurrency = await mockAPIPerformanceMonitor.performance.measureAPIThroughput(endpoint, 1);
      const multiConcurrency = await mockAPIPerformanceMonitor.performance.measureAPIThroughput(endpoint, 3);
      
      // Multi-concurrency should complete faster (higher throughput)
      expect(multiConcurrency.throughput).toBeGreaterThan(singleConcurrency.throughput);
    });
  });
  
  describe('API Error Rate Measurement', () => {
    test('should measure API error rate', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIErrorRate(endpoint, 0.05);
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.totalRequests).toBe(100);
      expect(result.errorRate).toBe(0.05);
      expect(result.successRate).toBe(0.95);
      expect(result.errors).toBe(5);
    });
    
    test('should categorize error types', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIErrorRate(endpoint, 0.1);
      
      expect(result.errorTypes).toHaveProperty('timeout');
      expect(result.errorTypes).toHaveProperty('serverError');
      expect(result.errorTypes).toHaveProperty('networkError');
      expect(result.errorTypes).toHaveProperty('other');
      
      const totalErrorTypes = Object.values(result.errorTypes).reduce((sum, count) => sum + count, 0);
      expect(totalErrorTypes).toBe(result.errors);
    });
    
    test('should handle high error rates', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIErrorRate(endpoint, 0.2);
      
      expect(result.errorRate).toBe(0.2);
      expect(result.successRate).toBe(0.8);
      expect(result.errors).toBe(20);
    });
  });
  
  describe('API Latency Distribution', () => {
    test('should measure API latency distribution', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPILatencyDistribution(endpoint);
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.sampleCount).toBe(50);
      expect(result.distribution).toHaveProperty('min');
      expect(result.distribution).toHaveProperty('max');
      expect(result.distribution).toHaveProperty('mean');
      expect(result.distribution).toHaveProperty('median');
      expect(result.distribution).toHaveProperty('p50');
      expect(result.distribution).toHaveProperty('p75');
      expect(result.distribution).toHaveProperty('p90');
      expect(result.distribution).toHaveProperty('p95');
      expect(result.distribution).toHaveProperty('p99');
    });
    
    test('should calculate percentiles correctly', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPILatencyDistribution(endpoint);
      
      // Percentiles should be in ascending order
      expect(result.distribution.min).toBeLessThanOrEqual(result.distribution.p50);
      expect(result.distribution.p50).toBeLessThanOrEqual(result.distribution.p75);
      expect(result.distribution.p75).toBeLessThanOrEqual(result.distribution.p90);
      expect(result.distribution.p90).toBeLessThanOrEqual(result.distribution.p95);
      expect(result.distribution.p95).toBeLessThanOrEqual(result.distribution.p99);
      expect(result.distribution.p99).toBeLessThanOrEqual(result.distribution.max);
    });
    
    test('should provide meaningful latency statistics', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPILatencyDistribution(endpoint);
      
      expect(result.distribution.mean).toBeGreaterThan(0);
      expect(result.distribution.median).toBeGreaterThan(0);
      expect(result.distribution.p95).toBeLessThan(500); // 95th percentile should be under 500ms
    });
  });
  
  describe('API Performance Bottleneck Analysis', () => {
    test('should identify performance bottlenecks', async () => {
      const metrics = {
        responseTime: 600, // Slow response time
        requestSize: { totalSize: 1024 * 15 }, // Large request
        responseSize: { totalSize: 1024 * 150 }, // Large response
        errorRate: { errorRate: 0.15 }, // High error rate
        throughput: { throughput: 3 } // Low throughput
      };
      
      const result = await mockAPIPerformanceMonitor.performance.analyzeAPIPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.length).toBeGreaterThan(0);
      expect(result.bottlenecks.some(b => b.type === 'slow_response')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'large_request')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'large_response')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'high_error_rate')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'low_throughput')).toBe(true);
      expect(result.overallScore).toBeLessThan(100);
    });
    
    test('should provide bottleneck recommendations', async () => {
      const metrics = {
        responseTime: 400,
        errorRate: { errorRate: 0.12 },
        throughput: { throughput: 4 }
      };
      
      const result = await mockAPIPerformanceMonitor.performance.analyzeAPIPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.every(b => b.recommendation)).toBe(true);
      expect(result.bottlenecks.some(b => 
        b.recommendation.includes('Optimize') || 
        b.recommendation.includes('Review') ||
        b.recommendation.includes('Investigate')
      )).toBe(true);
    });
    
    test('should calculate performance score', async () => {
      const metrics = {
        responseTime: 150, // Fast response time
        errorRate: { errorRate: 0.02 }, // Low error rate
        throughput: { throughput: 10 } // Good throughput
      };
      
      const result = await mockAPIPerformanceMonitor.performance.analyzeAPIPerformanceBottlenecks(metrics);
      
      expect(result.overallScore).toBe(100); // No bottlenecks = perfect score
    });
  });
  
  describe('API Performance Report Generation', () => {
    test('should generate comprehensive API performance report', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.generateAPIPerformanceReport(endpoint);
      
      expect(result).toHaveProperty('endpoint');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('recommendations');
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.summary.averageResponseTime).toBeDefined();
      expect(result.summary.requestSize).toBeDefined();
      expect(result.summary.responseSize).toBeDefined();
      expect(result.summary.throughput).toBeDefined();
      expect(result.summary.errorRate).toBeDefined();
      expect(result.summary.performanceScore).toBeDefined();
    });
    
    test('should include API performance recommendations', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.generateAPIPerformanceReport(endpoint);
      
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });
    
    test('should provide actionable insights', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.generateAPIPerformanceReport(endpoint);
      
      // Should provide both metrics and recommendations
      expect(result.summary.performanceScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.performanceScore).toBeLessThanOrEqual(100);
      
      if (result.summary.performanceScore < 80) {
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('API Performance Thresholds', () => {
    test('should enforce API response time threshold', async () => {
      const endpoint = '/api/chat/completions';
      const payload = { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseTime(endpoint, payload);
      
      // Response time should be under 500ms for good performance
      expect(result.responseTime).toBeLessThan(500);
    });
    
    test('should enforce API error rate threshold', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIErrorRate(endpoint);
      
      // Error rate should be under 5% for good performance
      expect(result.errorRate).toBeLessThan(0.05);
    });
    
    test('should enforce API throughput threshold', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIThroughput(endpoint);
      
      // Throughput should be at least 5 requests per second for good performance
      expect(result.throughput).toBeGreaterThanOrEqual(5);
    });
    
    test('should enforce API latency threshold', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPILatencyDistribution(endpoint);
      
      // 95th percentile latency should be under 500ms for good performance
      expect(result.distribution.p95).toBeLessThan(500);
    });
  });
}); * API Response Performance Tests
 * Tests for API response time and performance metrics
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock API performance monitoring module
const mockAPIPerformanceMonitor = {
  // API performance monitor
  performance: {
    // Measure API response time
    measureAPIResponseTime: async (endpoint, payload) => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        
        // Simulate API call
        setTimeout(() => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          resolve({
            endpoint: endpoint,
            responseTime: responseTime,
            timestamp: new Date().toISOString(),
            payload: payload,
            metrics: {
              dnsLookup: responseTime * 0.1, // DNS lookup takes 10%
              tcpConnection: responseTime * 0.2, // TCP connection takes 20%
              sslHandshake: responseTime * 0.1, // SSL handshake takes 10%
              serverProcessing: responseTime * 0.4, // Server processing takes 40%
              contentTransfer: responseTime * 0.2 // Content transfer takes 20%
            }
          });
        }, 200); // Simulate 200ms response time
      });
    },
    
    // Measure API request size
    measureAPIRequestSize: async (endpoint, payload) => {
      return new Promise((resolve) => {
        const requestSize = JSON.stringify(payload).length;
        const headersSize = 200; // Simulate 200 bytes of headers
        
        resolve({
          endpoint: endpoint,
          requestSize: requestSize,
          headersSize: headersSize,
          totalSize: requestSize + headersSize,
          timestamp: new Date().toISOString(),
          efficiency: {
            payloadToTotalRatio: requestSize / (requestSize + headersSize),
            compressionRatio: 0.7 // Simulate 30% compression
          }
        });
      });
    },
    
    // Measure API response size
    measureAPIResponseSize: async (endpoint, response) => {
      return new Promise((resolve) => {
        const responseSize = JSON.stringify(response).length;
        const headersSize = 150; // Simulate 150 bytes of headers
        
        resolve({
          endpoint: endpoint,
          responseSize: responseSize,
          headersSize: headersSize,
          totalSize: responseSize + headersSize,
          timestamp: new Date().toISOString(),
          efficiency: {
            payloadToTotalRatio: responseSize / (responseSize + headersSize),
            compressionRatio: 0.65 // Simulate 35% compression
          }
        });
      });
    },
    
    // Measure API throughput
    measureAPIThroughput: async (endpoint, concurrency = 1) => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        let completedRequests = 0;
        const totalRequests = 10 * concurrency;
        
        // Simulate concurrent requests
        for (let i = 0; i < totalRequests; i++) {
          setTimeout(() => {
            completedRequests++;
            if (completedRequests === totalRequests) {
              const endTime = performance.now();
              const totalTime = endTime - startTime;
              
              resolve({
                endpoint: endpoint,
                concurrency: concurrency,
                totalRequests: totalRequests,
                totalTime: totalTime,
                throughput: totalRequests / (totalTime / 1000), // Requests per second
                averageResponseTime: totalTime / totalRequests,
                timestamp: new Date().toISOString()
              });
            }
          }, 200 + Math.random() * 100); // Random response time between 200-300ms
        }
      });
    },
    
    // Measure API error rate
    measureAPIErrorRate: async (endpoint, errorRate = 0.05) => {
      return new Promise((resolve) => {
        const totalRequests = 100;
        let errors = 0;
        
        // Simulate requests with error rate
        for (let i = 0; i < totalRequests; i++) {
          if (Math.random() < errorRate) {
            errors++;
          }
        }
        
        resolve({
          endpoint: endpoint,
          totalRequests: totalRequests,
          errors: errors,
          errorRate: errors / totalRequests,
          successRate: (totalRequests - errors) / totalRequests,
          timestamp: new Date().toISOString(),
          errorTypes: {
            timeout: Math.floor(errors * 0.3),
            serverError: Math.floor(errors * 0.4),
            networkError: Math.floor(errors * 0.2),
            other: Math.floor(errors * 0.1)
          }
        });
      });
    },
    
    // Measure API latency distribution
    measureAPILatencyDistribution: async (endpoint) => {
      return new Promise((resolve) => {
        const measurements = [];
        const sampleCount = 50;
        
        // Generate latency measurements
        for (let i = 0; i < sampleCount; i++) {
          measurements.push(150 + Math.random() * 200); // Random latency between 150-350ms
        }
        
        measurements.sort((a, b) => a - b);
        
        const calculatePercentile = (arr, percentile) => {
          const index = Math.ceil((percentile / 100) * arr.length) - 1;
          return arr[Math.max(0, index)];
        };
        
        resolve({
          endpoint: endpoint,
          sampleCount: sampleCount,
          distribution: {
            min: measurements[0],
            max: measurements[measurements.length - 1],
            mean: measurements.reduce((sum, val) => sum + val, 0) / measurements.length,
            median: calculatePercentile(measurements, 50),
            p50: calculatePercentile(measurements, 50),
            p75: calculatePercentile(measurements, 75),
            p90: calculatePercentile(measurements, 90),
            p95: calculatePercentile(measurements, 95),
            p99: calculatePercentile(measurements, 99)
          },
          timestamp: new Date().toISOString()
        });
      });
    },
    
    // Analyze API performance bottlenecks
    analyzeAPIPerformanceBottlenecks: async (metrics) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const bottlenecks = [];
          
          // Analyze response time
          if (metrics.responseTime > 500) {
            bottlenecks.push({
              type: 'slow_response',
              severity: 'high',
              description: 'API response time exceeds 500ms',
              recommendation: 'Optimize API endpoint or implement caching'
            });
          } else if (metrics.responseTime > 300) {
            bottlenecks.push({
              type: 'moderate_response',
              severity: 'medium',
              description: 'API response time exceeds 300ms',
              recommendation: 'Review API performance and consider optimizations'
            });
          }
          
          // Analyze request size
          if (metrics.requestSize && metrics.requestSize.totalSize > 1024 * 10) { // 10KB
            bottlenecks.push({
              type: 'large_request',
              severity: 'medium',
              description: 'API request size exceeds 10KB',
              recommendation: 'Optimize request payload and consider compression'
            });
          }
          
          // Analyze response size
          if (metrics.responseSize && metrics.responseSize.totalSize > 1024 * 100) { // 100KB
            bottlenecks.push({
              type: 'large_response',
              severity: 'medium',
              description: 'API response size exceeds 100KB',
              recommendation: 'Implement response pagination or data filtering'
            });
          }
          
          // Analyze error rate
          if (metrics.errorRate && metrics.errorRate.errorRate > 0.1) { // 10%
            bottlenecks.push({
              type: 'high_error_rate',
              severity: 'high',
              description: 'API error rate exceeds 10%',
              recommendation: 'Investigate API reliability and implement retry logic'
            });
          }
          
          // Analyze throughput
          if (metrics.throughput && metrics.throughput.throughput < 5) { // Less than 5 req/sec
            bottlenecks.push({
              type: 'low_throughput',
              severity: 'medium',
              description: 'API throughput is less than 5 requests per second',
              recommendation: 'Optimize API performance or consider load balancing'
            });
          }
          
          resolve({
            bottlenecks: bottlenecks,
            overallScore: Math.max(0, 100 - (bottlenecks.length * 20)),
            timestamp: new Date().toISOString()
          });
        }, 20); // Simulate 20ms analysis time
      });
    },
    
    // Generate API performance report
    generateAPIPerformanceReport: async (endpoint) => {
      const responseTime = await mockAPIPerformanceMonitor.performance.measureAPIResponseTime(endpoint, { test: 'data' });
      const requestSize = await mockAPIPerformanceMonitor.performance.measureAPIRequestSize(endpoint, { test: 'data' });
      const responseSize = await mockAPIPerformanceMonitor.performance.measureAPIResponseSize(endpoint, { result: 'success' });
      const throughput = await mockAPIPerformanceMonitor.performance.measureAPIThroughput(endpoint);
      const errorRate = await mockAPIPerformanceMonitor.performance.measureAPIErrorRate(endpoint);
      const latencyDistribution = await mockAPIPerformanceMonitor.performance.measureAPILatencyDistribution(endpoint);
      const bottlenecks = await mockAPIPerformanceMonitor.performance.analyzeAPIPerformanceBottlenecks({
        responseTime: responseTime.responseTime,
        requestSize: requestSize,
        responseSize: responseSize,
        errorRate: errorRate,
        throughput: throughput
      });
      
      return {
        endpoint: endpoint,
        summary: {
          averageResponseTime: responseTime.responseTime,
          requestSize: requestSize.totalSize,
          responseSize: responseSize.totalSize,
          throughput: throughput.throughput,
          errorRate: errorRate.errorRate,
          performanceScore: bottlenecks.overallScore
        },
        details: {
          responseTime: responseTime,
          requestSize: requestSize,
          responseSize: responseSize,
          throughput: throughput,
          errorRate: errorRate,
          latencyDistribution: latencyDistribution,
          bottlenecks: bottlenecks
        },
        timestamp: new Date().toISOString(),
        recommendations: bottlenecks.bottlenecks.map(b => b.recommendation)
      };
    }
  }
};

describe('API Response Performance Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock performance.now for consistent testing
    let mockTime = 0;
    global.performance = {
      now: jest.fn(() => {
        mockTime += 10;
        return mockTime;
      })
    };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('API Response Time Measurement', () => {
    test('should measure API response time within acceptable range', async () => {
      const endpoint = '/api/chat/completions';
      const payload = { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseTime(endpoint, payload);
      
      expect(result.responseTime).toBe(200); // Should match our mock
      expect(result.responseTime).toBeLessThan(500); // Should be under 500ms
      expect(result.endpoint).toBe(endpoint);
      expect(result.payload).toEqual(payload);
    });
    
    test('should provide detailed response time metrics', async () => {
      const endpoint = '/api/chat/completions';
      const payload = { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseTime(endpoint, payload);
      
      expect(result).toHaveProperty('responseTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('dnsLookup');
      expect(result.metrics).toHaveProperty('tcpConnection');
      expect(result.metrics).toHaveProperty('sslHandshake');
      expect(result.metrics).toHaveProperty('serverProcessing');
      expect(result.metrics).toHaveProperty('contentTransfer');
    });
    
    test('should verify response time components add up', async () => {
      const endpoint = '/api/chat/completions';
      const payload = { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseTime(endpoint, payload);
      
      const componentSum = Object.values(result.metrics).reduce((sum, time) => sum + time, 0);
      expect(componentSum).toBeCloseTo(result.responseTime, 1);
    });
  });
  
  describe('API Request Size Measurement', () => {
    test('should measure API request size', async () => {
      const endpoint = '/api/chat/completions';
      const payload = { 
        model: 'gpt-4', 
        messages: [{ role: 'user', content: 'Hello, how are you?' }],
        temperature: 0.7,
        max_tokens: 100
      };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIRequestSize(endpoint, payload);
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.requestSize).toBe(JSON.stringify(payload).length);
      expect(result.headersSize).toBe(200);
      expect(result.totalSize).toBe(result.requestSize + result.headersSize);
    });
    
    test('should calculate request efficiency metrics', async () => {
      const endpoint = '/api/chat/completions';
      const payload = { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIRequestSize(endpoint, payload);
      
      expect(result.efficiency).toHaveProperty('payloadToTotalRatio');
      expect(result.efficiency).toHaveProperty('compressionRatio');
      expect(result.efficiency.payloadToTotalRatio).toBeGreaterThan(0);
      expect(result.efficiency.payloadToTotalRatio).toBeLessThan(1);
    });
    
    test('should identify large requests', async () => {
      const endpoint = '/api/chat/completions';
      const largePayload = {
        model: 'gpt-4',
        messages: Array(100).fill({ role: 'user', content: 'This is a long message that will increase the payload size significantly. '.repeat(10) }),
        temperature: 0.7,
        max_tokens: 1000
      };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIRequestSize(endpoint, largePayload);
      
      expect(result.requestSize).toBeGreaterThan(1024 * 5); // Should be larger than 5KB
    });
  });
  
  describe('API Response Size Measurement', () => {
    test('should measure API response size', async () => {
      const endpoint = '/api/chat/completions';
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you today?'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 9,
          completion_tokens: 12,
          total_tokens: 21
        }
      };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseSize(endpoint, response);
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.responseSize).toBe(JSON.stringify(response).length);
      expect(result.headersSize).toBe(150);
      expect(result.totalSize).toBe(result.responseSize + result.headersSize);
    });
    
    test('should calculate response efficiency metrics', async () => {
      const endpoint = '/api/chat/completions';
      const response = { result: 'success', data: 'test' };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseSize(endpoint, response);
      
      expect(result.efficiency).toHaveProperty('payloadToTotalRatio');
      expect(result.efficiency).toHaveProperty('compressionRatio');
      expect(result.efficiency.payloadToTotalRatio).toBeGreaterThan(0);
      expect(result.efficiency.payloadToTotalRatio).toBeLessThan(1);
    });
    
    test('should identify large responses', async () => {
      const endpoint = '/api/chat/completions';
      const largeResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a very long response that will significantly increase the response size. '.repeat(100)
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 500,
          total_tokens: 600
        }
      };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseSize(endpoint, largeResponse);
      
      expect(result.responseSize).toBeGreaterThan(1024 * 10); // Should be larger than 10KB
    });
  });
  
  describe('API Throughput Measurement', () => {
    test('should measure API throughput with single concurrency', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIThroughput(endpoint, 1);
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.concurrency).toBe(1);
      expect(result.totalRequests).toBe(10);
      expect(result.throughput).toBeGreaterThan(0);
      expect(result.averageResponseTime).toBeGreaterThan(0);
    });
    
    test('should measure API throughput with higher concurrency', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIThroughput(endpoint, 5);
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.concurrency).toBe(5);
      expect(result.totalRequests).toBe(50); // 10 * 5
      expect(result.throughput).toBeGreaterThan(0);
      expect(result.averageResponseTime).toBeGreaterThan(0);
    });
    
    test('should show throughput improvement with concurrency', async () => {
      const endpoint = '/api/chat/completions';
      
      const singleConcurrency = await mockAPIPerformanceMonitor.performance.measureAPIThroughput(endpoint, 1);
      const multiConcurrency = await mockAPIPerformanceMonitor.performance.measureAPIThroughput(endpoint, 3);
      
      // Multi-concurrency should complete faster (higher throughput)
      expect(multiConcurrency.throughput).toBeGreaterThan(singleConcurrency.throughput);
    });
  });
  
  describe('API Error Rate Measurement', () => {
    test('should measure API error rate', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIErrorRate(endpoint, 0.05);
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.totalRequests).toBe(100);
      expect(result.errorRate).toBe(0.05);
      expect(result.successRate).toBe(0.95);
      expect(result.errors).toBe(5);
    });
    
    test('should categorize error types', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIErrorRate(endpoint, 0.1);
      
      expect(result.errorTypes).toHaveProperty('timeout');
      expect(result.errorTypes).toHaveProperty('serverError');
      expect(result.errorTypes).toHaveProperty('networkError');
      expect(result.errorTypes).toHaveProperty('other');
      
      const totalErrorTypes = Object.values(result.errorTypes).reduce((sum, count) => sum + count, 0);
      expect(totalErrorTypes).toBe(result.errors);
    });
    
    test('should handle high error rates', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIErrorRate(endpoint, 0.2);
      
      expect(result.errorRate).toBe(0.2);
      expect(result.successRate).toBe(0.8);
      expect(result.errors).toBe(20);
    });
  });
  
  describe('API Latency Distribution', () => {
    test('should measure API latency distribution', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPILatencyDistribution(endpoint);
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.sampleCount).toBe(50);
      expect(result.distribution).toHaveProperty('min');
      expect(result.distribution).toHaveProperty('max');
      expect(result.distribution).toHaveProperty('mean');
      expect(result.distribution).toHaveProperty('median');
      expect(result.distribution).toHaveProperty('p50');
      expect(result.distribution).toHaveProperty('p75');
      expect(result.distribution).toHaveProperty('p90');
      expect(result.distribution).toHaveProperty('p95');
      expect(result.distribution).toHaveProperty('p99');
    });
    
    test('should calculate percentiles correctly', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPILatencyDistribution(endpoint);
      
      // Percentiles should be in ascending order
      expect(result.distribution.min).toBeLessThanOrEqual(result.distribution.p50);
      expect(result.distribution.p50).toBeLessThanOrEqual(result.distribution.p75);
      expect(result.distribution.p75).toBeLessThanOrEqual(result.distribution.p90);
      expect(result.distribution.p90).toBeLessThanOrEqual(result.distribution.p95);
      expect(result.distribution.p95).toBeLessThanOrEqual(result.distribution.p99);
      expect(result.distribution.p99).toBeLessThanOrEqual(result.distribution.max);
    });
    
    test('should provide meaningful latency statistics', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPILatencyDistribution(endpoint);
      
      expect(result.distribution.mean).toBeGreaterThan(0);
      expect(result.distribution.median).toBeGreaterThan(0);
      expect(result.distribution.p95).toBeLessThan(500); // 95th percentile should be under 500ms
    });
  });
  
  describe('API Performance Bottleneck Analysis', () => {
    test('should identify performance bottlenecks', async () => {
      const metrics = {
        responseTime: 600, // Slow response time
        requestSize: { totalSize: 1024 * 15 }, // Large request
        responseSize: { totalSize: 1024 * 150 }, // Large response
        errorRate: { errorRate: 0.15 }, // High error rate
        throughput: { throughput: 3 } // Low throughput
      };
      
      const result = await mockAPIPerformanceMonitor.performance.analyzeAPIPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.length).toBeGreaterThan(0);
      expect(result.bottlenecks.some(b => b.type === 'slow_response')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'large_request')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'large_response')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'high_error_rate')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'low_throughput')).toBe(true);
      expect(result.overallScore).toBeLessThan(100);
    });
    
    test('should provide bottleneck recommendations', async () => {
      const metrics = {
        responseTime: 400,
        errorRate: { errorRate: 0.12 },
        throughput: { throughput: 4 }
      };
      
      const result = await mockAPIPerformanceMonitor.performance.analyzeAPIPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.every(b => b.recommendation)).toBe(true);
      expect(result.bottlenecks.some(b => 
        b.recommendation.includes('Optimize') || 
        b.recommendation.includes('Review') ||
        b.recommendation.includes('Investigate')
      )).toBe(true);
    });
    
    test('should calculate performance score', async () => {
      const metrics = {
        responseTime: 150, // Fast response time
        errorRate: { errorRate: 0.02 }, // Low error rate
        throughput: { throughput: 10 } // Good throughput
      };
      
      const result = await mockAPIPerformanceMonitor.performance.analyzeAPIPerformanceBottlenecks(metrics);
      
      expect(result.overallScore).toBe(100); // No bottlenecks = perfect score
    });
  });
  
  describe('API Performance Report Generation', () => {
    test('should generate comprehensive API performance report', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.generateAPIPerformanceReport(endpoint);
      
      expect(result).toHaveProperty('endpoint');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('recommendations');
      
      expect(result.endpoint).toBe(endpoint);
      expect(result.summary.averageResponseTime).toBeDefined();
      expect(result.summary.requestSize).toBeDefined();
      expect(result.summary.responseSize).toBeDefined();
      expect(result.summary.throughput).toBeDefined();
      expect(result.summary.errorRate).toBeDefined();
      expect(result.summary.performanceScore).toBeDefined();
    });
    
    test('should include API performance recommendations', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.generateAPIPerformanceReport(endpoint);
      
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });
    
    test('should provide actionable insights', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.generateAPIPerformanceReport(endpoint);
      
      // Should provide both metrics and recommendations
      expect(result.summary.performanceScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.performanceScore).toBeLessThanOrEqual(100);
      
      if (result.summary.performanceScore < 80) {
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('API Performance Thresholds', () => {
    test('should enforce API response time threshold', async () => {
      const endpoint = '/api/chat/completions';
      const payload = { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] };
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIResponseTime(endpoint, payload);
      
      // Response time should be under 500ms for good performance
      expect(result.responseTime).toBeLessThan(500);
    });
    
    test('should enforce API error rate threshold', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIErrorRate(endpoint);
      
      // Error rate should be under 5% for good performance
      expect(result.errorRate).toBeLessThan(0.05);
    });
    
    test('should enforce API throughput threshold', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPIThroughput(endpoint);
      
      // Throughput should be at least 5 requests per second for good performance
      expect(result.throughput).toBeGreaterThanOrEqual(5);
    });
    
    test('should enforce API latency threshold', async () => {
      const endpoint = '/api/chat/completions';
      
      const result = await mockAPIPerformanceMonitor.performance.measureAPILatencyDistribution(endpoint);
      
      // 95th percentile latency should be under 500ms for good performance
      expect(result.distribution.p95).toBeLessThan(500);
    });
  });
});
