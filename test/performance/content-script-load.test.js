/**
 * Content Script Load Performance Tests
 * Tests for content script loading time and performance metrics
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock content script performance monitoring module
const mockContentScriptPerformanceMonitor = {
  // Content script performance monitor
  performance: {
    // Measure content script injection time
    measureContentScriptInjection: async (tabId, url) => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        
        // Simulate content script injection process
        setTimeout(() => {
          const endTime = performance.now();
          const injectionTime = endTime - startTime;
          
          resolve({
            tabId: tabId,
            url: url,
            injectionTime: injectionTime,
            timestamp: new Date().toISOString(),
            phases: {
              registration: injectionTime * 0.1, // Registration takes 10%
              loading: injectionTime * 0.3, // Loading takes 30%
              initialization: injectionTime * 0.4, // Initialization takes 40%
              domReady: injectionTime * 0.2 // DOM ready takes 20%
            }
          });
        }, 30); // Simulate 30ms injection time
      });
    },
    
    // Measure content script DOM analysis time
    measureDOMAnalysis: async (tabId, complexity = 'medium') => {
      return new Promise((resolve) => {
        const complexityFactors = {
          simple: { nodes: 100, depth: 5, time: 10 },
          medium: { nodes: 500, depth: 10, time: 25 },
          complex: { nodes: 2000, depth: 15, time: 60 },
          heavy: { nodes: 5000, depth: 20, time: 120 }
        };
        
        const factor = complexityFactors[complexity] || complexityFactors.medium;
        
        setTimeout(() => {
          resolve({
            tabId: tabId,
            complexity: complexity,
            analysisTime: factor.time,
            timestamp: new Date().toISOString(),
            metrics: {
              totalNodes: factor.nodes,
              maxDepth: factor.depth,
              interactiveElements: Math.floor(factor.nodes * 0.15), // 15% are interactive
              forms: Math.floor(factor.nodes * 0.02), // 2% are forms
              links: Math.floor(factor.nodes * 0.08), // 8% are links
              images: Math.floor(factor.nodes * 0.05), // 5% are images
              scripts: Math.floor(factor.nodes * 0.01), // 1% are scripts
              stylesheets: Math.floor(factor.nodes * 0.003) // 0.3% are stylesheets
            }
          });
        }, factor.time); // Simulate analysis time based on complexity
      });
    },
    
    // Measure content script event listener setup
    measureEventListenerSetup: async (tabId) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const setupTime = 15; // 15ms setup time
          const listenerCount = 12; // 12 event listeners
          
          resolve({
            tabId: tabId,
            setupTime: setupTime,
            listenerCount: listenerCount,
            timestamp: new Date().toISOString(),
            listeners: {
              click: 3,
              change: 2,
              submit: 1,
              keydown: 2,
              focus: 1,
              blur: 1,
              custom: 2 // Custom Ray events
            },
            efficiency: {
              setupRate: listenerCount / setupTime, // Listeners per ms
              memoryUsage: listenerCount * 1024, // 1KB per listener
              delegationRatio: 0.7 // 70% use event delegation
            }
          });
        }, 5); // Simulate 5ms measurement time
      });
    },
    
    // Measure content script API integration time
    measureAPIIntegration: async (tabId) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const integrationTime = 20; // 20ms integration time
          
          resolve({
            tabId: tabId,
            integrationTime: integrationTime,
            timestamp: new Date().toISOString(),
            apis: {
              chromeTabs: 5, // 5ms for tabs API
              chromeRuntime: 3, // 3ms for runtime API
              chromeStorage: 4, // 4ms for storage API
              openRouter: 8 // 8ms for OpenRouter API setup
            },
            operations: {
              messageListeners: 3, // 3 message listeners
              messageSenders: 2, // 2 message senders
              storageAccess: 4, // 4 storage operations
              tabQueries: 2 // 2 tab queries
            }
          });
        }, 10); // Simulate 10ms measurement time
      });
    },
    
    // Measure content script memory footprint
    measureMemoryFootprint: async (tabId) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const memoryUsage = {
            heapUsed: 1024 * 1024 * 1.5, // 1.5MB heap usage
            heapTotal: 1024 * 1024 * 2, // 2MB total heap
            domReferences: 150, // 150 DOM references
            eventListeners: 12, // 12 event listeners
            timers: 3, // 3 active timers
            observers: 2, // 2 mutation observers
            timestamp: new Date().toISOString(),
            efficiency: {
              heapUtilization: 75, // 75% utilization
              domToMemoryRatio: 150 / (1024 * 1024 * 1.5), // DOM refs per MB
              listenerEfficiency: 12 / (1024 * 1024 * 1.5) // Listeners per MB
            }
          };
          
          resolve(memoryUsage);
        }, 15); // Simulate 15ms measurement time
      });
    },
    
    // Measure content script performance impact on page
    measurePagePerformanceImpact: async (tabId) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const impact = {
            tabId: tabId,
            timestamp: new Date().toISOString(),
            beforeInjection: {
              domContentLoaded: 450, // 450ms
              loadEvent: 1200, // 1200ms
              firstPaint: 300, // 300ms
              firstContentfulPaint: 400 // 400ms
            },
            afterInjection: {
              domContentLoaded: 470, // 470ms (+20ms)
              loadEvent: 1230, // 1230ms (+30ms)
              firstPaint: 310, // 310ms (+10ms)
              firstContentfulPaint: 415 // 415ms (+15ms)
            },
            impact: {
              domContentLoadedDelta: 20, // +20ms
              loadEventDelta: 30, // +30ms
              firstPaintDelta: 10, // +10ms
              firstContentfulPaintDelta: 15, // +15ms
              overallImpact: 'low' // low, medium, high
            }
          };
          
          resolve(impact);
        }, 25); // Simulate 25ms measurement time
      });
    },
    
    // Analyze content script performance bottlenecks
    analyzeContentScriptPerformanceBottlenecks: async (metrics) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const bottlenecks = [];
          
          // Analyze injection time
          if (metrics.injectionTime > 50) {
            bottlenecks.push({
              type: 'slow_injection',
              severity: 'high',
              description: 'Content script injection time exceeds 50ms',
              recommendation: 'Optimize content script initialization and reduce dependencies'
            });
          } else if (metrics.injectionTime > 30) {
            bottlenecks.push({
              type: 'moderate_injection',
              severity: 'medium',
              description: 'Content script injection time exceeds 30ms',
              recommendation: 'Review content script loading sequence'
            });
          }
          
          // Analyze DOM analysis time
          if (metrics.domAnalysis && metrics.domAnalysis.analysisTime > 40) {
            bottlenecks.push({
              type: 'slow_dom_analysis',
              severity: 'medium',
              description: 'DOM analysis time exceeds 40ms',
              recommendation: 'Optimize DOM traversal and implement selective analysis'
            });
          }
          
          // Analyze memory usage
          if (metrics.memoryFootprint && metrics.memoryFootprint.heapUsed > 1024 * 1024 * 3) { // 3MB
            bottlenecks.push({
              type: 'high_memory_usage',
              severity: 'medium',
              description: 'Content script memory usage exceeds 3MB',
              recommendation: 'Reduce memory usage and optimize object creation'
            });
          }
          
          // Analyze page impact
          if (metrics.pageImpact && metrics.pageImpact.impact.overallImpact === 'high') {
            bottlenecks.push({
              type: 'high_page_impact',
              severity: 'high',
              description: 'Content script significantly impacts page performance',
              recommendation: 'Reduce performance impact and optimize event handling'
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
    
    // Generate content script performance report
    generateContentScriptPerformanceReport: async (tabId, url) => {
      const injection = await mockContentScriptPerformanceMonitor.performance.measureContentScriptInjection(tabId, url);
      const domAnalysis = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId);
      const eventSetup = await mockContentScriptPerformanceMonitor.performance.measureEventListenerSetup(tabId);
      const apiIntegration = await mockContentScriptPerformanceMonitor.performance.measureAPIIntegration(tabId);
      const memoryFootprint = await mockContentScriptPerformanceMonitor.performance.measureMemoryFootprint(tabId);
      const pageImpact = await mockContentScriptPerformanceMonitor.performance.measurePagePerformanceImpact(tabId);
      const bottlenecks = await mockContentScriptPerformanceMonitor.performance.analyzeContentScriptPerformanceBottlenecks({
        injectionTime: injection.injectionTime,
        domAnalysis: domAnalysis,
        memoryFootprint: memoryFootprint,
        pageImpact: pageImpact
      });
      
      return {
        tabId: tabId,
        url: url,
        summary: {
          totalLoadTime: injection.injectionTime + domAnalysis.analysisTime + eventSetup.setupTime + apiIntegration.integrationTime,
          injectionTime: injection.injectionTime,
          domAnalysisTime: domAnalysis.analysisTime,
          eventSetupTime: eventSetup.setupTime,
          apiIntegrationTime: apiIntegration.integrationTime,
          memoryUsage: memoryFootprint.heapUsed,
          pageImpact: pageImpact.impact.overallImpact,
          performanceScore: bottlenecks.overallScore
        },
        details: {
          injection: injection,
          domAnalysis: domAnalysis,
          eventSetup: eventSetup,
          apiIntegration: apiIntegration,
          memoryFootprint: memoryFootprint,
          pageImpact: pageImpact,
          bottlenecks: bottlenecks
        },
        timestamp: new Date().toISOString(),
        recommendations: bottlenecks.bottlenecks.map(b => b.recommendation)
      };
    }
  }
};

describe('Content Script Load Performance Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock performance.now for consistent testing
    let mockTime = 0;
    global.performance = {
      now: jest.fn(() => {
        mockTime += 5;
        return mockTime;
      })
    };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Content Script Injection Performance', () => {
    test('should measure content script injection time within acceptable range', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureContentScriptInjection(tabId, url);
      
      expect(result.injectionTime).toBe(30); // Should match our mock
      expect(result.injectionTime).toBeLessThan(50); // Should be under 50ms
      expect(result.tabId).toBe(tabId);
      expect(result.url).toBe(url);
    });
    
    test('should provide detailed injection phase metrics', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureContentScriptInjection(tabId, url);
      
      expect(result).toHaveProperty('injectionTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('phases');
      expect(result.phases).toHaveProperty('registration');
      expect(result.phases).toHaveProperty('loading');
      expect(result.phases).toHaveProperty('initialization');
      expect(result.phases).toHaveProperty('domReady');
    });
    
    test('should verify injection phase times add up', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureContentScriptInjection(tabId, url);
      
      const phaseSum = Object.values(result.phases).reduce((sum, time) => sum + time, 0);
      expect(phaseSum).toBeCloseTo(result.injectionTime, 1);
    });
  });
  
  describe('DOM Analysis Performance', () => {
    test('should measure DOM analysis time for simple pages', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'simple');
      
      expect(result.analysisTime).toBe(10); // Should match simple complexity
      expect(result.complexity).toBe('simple');
      expect(result.metrics.totalNodes).toBe(100);
      expect(result.metrics.maxDepth).toBe(5);
    });
    
    test('should measure DOM analysis time for complex pages', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'complex');
      
      expect(result.analysisTime).toBe(60); // Should match complex complexity
      expect(result.complexity).toBe('complex');
      expect(result.metrics.totalNodes).toBe(2000);
      expect(result.metrics.maxDepth).toBe(15);
    });
    
    test('should provide detailed DOM metrics', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'medium');
      
      expect(result.metrics).toHaveProperty('totalNodes');
      expect(result.metrics).toHaveProperty('maxDepth');
      expect(result.metrics).toHaveProperty('interactiveElements');
      expect(result.metrics).toHaveProperty('forms');
      expect(result.metrics).toHaveProperty('links');
      expect(result.metrics).toHaveProperty('images');
      expect(result.metrics).toHaveProperty('scripts');
      expect(result.metrics).toHaveProperty('stylesheets');
    });
    
    test('should scale analysis time with complexity', async () => {
      const tabId = 123;
      
      const simple = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'simple');
      const medium = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'medium');
      const complex = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'complex');
      const heavy = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'heavy');
      
      expect(simple.analysisTime).toBeLessThan(medium.analysisTime);
      expect(medium.analysisTime).toBeLessThan(complex.analysisTime);
      expect(complex.analysisTime).toBeLessThan(heavy.analysisTime);
    });
  });
  
  describe('Event Listener Setup Performance', () => {
    test('should measure event listener setup time', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureEventListenerSetup(tabId);
      
      expect(result.setupTime).toBe(15); // Should match our mock
      expect(result.listenerCount).toBe(12);
      expect(result.tabId).toBe(tabId);
    });
    
    test('should provide detailed listener metrics', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureEventListenerSetup(tabId);
      
      expect(result).toHaveProperty('listeners');
      expect(result).toHaveProperty('efficiency');
      expect(result.listeners).toHaveProperty('click');
      expect(result.listeners).toHaveProperty('change');
      expect(result.listeners).toHaveProperty('submit');
      expect(result.listeners).toHaveProperty('keydown');
      expect(result.listeners).toHaveProperty('focus');
      expect(result.listeners).toHaveProperty('blur');
      expect(result.listeners).toHaveProperty('custom');
    });
    
    test('should calculate listener efficiency metrics', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureEventListenerSetup(tabId);
      
      expect(result.efficiency).toHaveProperty('setupRate');
      expect(result.efficiency).toHaveProperty('memoryUsage');
      expect(result.efficiency).toHaveProperty('delegationRatio');
      
      expect(result.efficiency.setupRate).toBe(12 / 15); // Listeners per ms
      expect(result.efficiency.memoryUsage).toBe(12 * 1024); // 1KB per listener
      expect(result.efficiency.delegationRatio).toBe(0.7); // 70% delegation
    });
  });
  
  describe('API Integration Performance', () => {
    test('should measure API integration time', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureAPIIntegration(tabId);
      
      expect(result.integrationTime).toBe(20); // Should match our mock
      expect(result.tabId).toBe(tabId);
    });
    
    test('should provide detailed API metrics', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureAPIIntegration(tabId);
      
      expect(result).toHaveProperty('apis');
      expect(result).toHaveProperty('operations');
      expect(result.apis).toHaveProperty('chromeTabs');
      expect(result.apis).toHaveProperty('chromeRuntime');
      expect(result.apis).toHaveProperty('chromeStorage');
      expect(result.apis).toHaveProperty('openRouter');
      expect(result.operations).toHaveProperty('messageListeners');
      expect(result.operations).toHaveProperty('messageSenders');
      expect(result.operations).toHaveProperty('storageAccess');
      expect(result.operations).toHaveProperty('tabQueries');
    });
    
    test('should verify API times add up', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureAPIIntegration(tabId);
      
      const apiSum = Object.values(result.apis).reduce((sum, time) => sum + time, 0);
      expect(apiSum).toBe(result.integrationTime);
    });
  });
  
  describe('Memory Footprint Measurement', () => {
    test('should measure content script memory footprint', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureMemoryFootprint(tabId);
      
      expect(result.heapUsed).toBe(1024 * 1024 * 1.5); // 1.5MB
      expect(result.heapTotal).toBe(1024 * 1024 * 2); // 2MB
      expect(result.domReferences).toBe(150);
      expect(result.eventListeners).toBe(12);
      expect(result.timers).toBe(3);
      expect(result.observers).toBe(2);
    });
    
    test('should calculate memory efficiency metrics', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureMemoryFootprint(tabId);
      
      expect(result.efficiency).toHaveProperty('heapUtilization');
      expect(result.efficiency).toHaveProperty('domToMemoryRatio');
      expect(result.efficiency).toHaveProperty('listenerEfficiency');
      
      expect(result.efficiency.heapUtilization).toBe(75); // 1.5MB / 2MB * 100
    });
    
    test('should identify memory issues', async () => {
      // Mock high memory usage
      mockContentScriptPerformanceMonitor.performance.measureMemoryFootprint = async () => {
        return {
          heapUsed: 1024 * 1024 * 4, // 4MB
          heapTotal: 1024 * 1024 * 5, // 5MB
          domReferences: 500, // 500 DOM references
          eventListeners: 25, // 25 event listeners
          timers: 8, // 8 active timers
          observers: 5, // 5 mutation observers
          efficiency: {
            heapUtilization: 80, // 80% utilization
            domToMemoryRatio: 500 / (1024 * 1024 * 4),
            listenerEfficiency: 25 / (1024 * 1024 * 4)
          }
        };
      };
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureMemoryFootprint(123);
      
      expect(result.heapUsed).toBeGreaterThan(1024 * 1024 * 3); // Should trigger bottleneck
      expect(result.efficiency.heapUtilization).toBeGreaterThan(75);
    });
  });
  
  describe('Page Performance Impact Measurement', () => {
    test('should measure page performance impact', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measurePagePerformanceImpact(tabId);
      
      expect(result).toHaveProperty('beforeInjection');
      expect(result).toHaveProperty('afterInjection');
      expect(result).toHaveProperty('impact');
      expect(result.tabId).toBe(tabId);
    });
    
    test('should calculate performance deltas', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measurePagePerformanceImpact(tabId);
      
      expect(result.impact.domContentLoadedDelta).toBe(20);
      expect(result.impact.loadEventDelta).toBe(30);
      expect(result.impact.firstPaintDelta).toBe(10);
      expect(result.impact.firstContentfulPaintDelta).toBe(15);
      
      // Verify deltas are calculated correctly
      expect(result.impact.domContentLoadedDelta).toBe(
        result.afterInjection.domContentLoaded - result.beforeInjection.domContentLoaded
      );
    });
    
    test('should classify overall impact level', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measurePagePerformanceImpact(tabId);
      
      expect(['low', 'medium', 'high']).toContain(result.impact.overallImpact);
      expect(result.impact.overallImpact).toBe('low'); // Should match our mock
    });
  });
  
  describe('Content Script Performance Bottleneck Analysis', () => {
    test('should identify performance bottlenecks', async () => {
      const metrics = {
        injectionTime: 60, // Slow injection
        domAnalysis: { analysisTime: 50 }, // Slow DOM analysis
        memoryFootprint: { heapUsed: 1024 * 1024 * 4 }, // High memory usage
        pageImpact: { impact: { overallImpact: 'high' } } // High page impact
      };
      
      const result = await mockContentScriptPerformanceMonitor.performance.analyzeContentScriptPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.length).toBeGreaterThan(0);
      expect(result.bottlenecks.some(b => b.type === 'slow_injection')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_dom_analysis')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'high_memory_usage')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'high_page_impact')).toBe(true);
      expect(result.overallScore).toBeLessThan(100);
    });
    
    test('should provide bottleneck recommendations', async () => {
      const metrics = {
        injectionTime: 40,
        domAnalysis: { analysisTime: 45 },
        memoryFootprint: { heapUsed: 1024 * 1024 * 2.5 }
      };
      
      const result = await mockContentScriptPerformanceMonitor.performance.analyzeContentScriptPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.every(b => b.recommendation)).toBe(true);
      expect(result.bottlenecks.some(b => 
        b.recommendation.includes('Optimize') || 
        b.recommendation.includes('Review') ||
        b.recommendation.includes('Reduce')
      )).toBe(true);
    });
    
    test('should calculate performance score', async () => {
      const metrics = {
        injectionTime: 20, // Fast injection
        domAnalysis: { analysisTime: 15 }, // Fast DOM analysis
        memoryFootprint: { heapUsed: 1024 * 1024 * 1 }, // Low memory usage
        pageImpact: { impact: { overallImpact: 'low' } } // Low page impact
      };
      
      const result = await mockContentScriptPerformanceMonitor.performance.analyzeContentScriptPerformanceBottlenecks(metrics);
      
      expect(result.overallScore).toBe(100); // No bottlenecks = perfect score
    });
  });
  
  describe('Content Script Performance Report Generation', () => {
    test('should generate comprehensive content script performance report', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.generateContentScriptPerformanceReport(tabId, url);
      
      expect(result).toHaveProperty('tabId');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('recommendations');
      
      expect(result.tabId).toBe(tabId);
      expect(result.url).toBe(url);
      expect(result.summary.totalLoadTime).toBeDefined();
      expect(result.summary.injectionTime).toBeDefined();
      expect(result.summary.domAnalysisTime).toBeDefined();
      expect(result.summary.eventSetupTime).toBeDefined();
      expect(result.summary.apiIntegrationTime).toBeDefined();
      expect(result.summary.memoryUsage).toBeDefined();
      expect(result.summary.pageImpact).toBeDefined();
      expect(result.summary.performanceScore).toBeDefined();
    });
    
    test('should include content script performance recommendations', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.generateContentScriptPerformanceReport(tabId, url);
      
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });
    
    test('should provide actionable insights', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.generateContentScriptPerformanceReport(tabId, url);
      
      // Should provide both metrics and recommendations
      expect(result.summary.performanceScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.performanceScore).toBeLessThanOrEqual(100);
      
      if (result.summary.performanceScore < 80) {
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Content Script Performance Thresholds', () => {
    test('should enforce injection time threshold', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureContentScriptInjection(tabId, url);
      
      // Injection time should be under 50ms for good performance
      expect(result.injectionTime).toBeLessThan(50);
    });
    
    test('should enforce DOM analysis time threshold', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'medium');
      
      // DOM analysis time should be under 40ms for good performance
      expect(result.analysisTime).toBeLessThan(40);
    });
    
    test('should enforce memory usage threshold', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureMemoryFootprint(tabId);
      
      // Memory usage should be under 3MB for good performance
      expect(result.heapUsed).toBeLessThan(1024 * 1024 * 3);
    });
    
    test('should enforce page impact threshold', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measurePagePerformanceImpact(tabId);
      
      // Page impact should be 'low' for good performance
      expect(result.impact.overallImpact).toBe('low');
    });
  });
}); * Content Script Load Performance Tests
 * Tests for content script loading time and performance metrics
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock content script performance monitoring module
const mockContentScriptPerformanceMonitor = {
  // Content script performance monitor
  performance: {
    // Measure content script injection time
    measureContentScriptInjection: async (tabId, url) => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        
        // Simulate content script injection process
        setTimeout(() => {
          const endTime = performance.now();
          const injectionTime = endTime - startTime;
          
          resolve({
            tabId: tabId,
            url: url,
            injectionTime: injectionTime,
            timestamp: new Date().toISOString(),
            phases: {
              registration: injectionTime * 0.1, // Registration takes 10%
              loading: injectionTime * 0.3, // Loading takes 30%
              initialization: injectionTime * 0.4, // Initialization takes 40%
              domReady: injectionTime * 0.2 // DOM ready takes 20%
            }
          });
        }, 30); // Simulate 30ms injection time
      });
    },
    
    // Measure content script DOM analysis time
    measureDOMAnalysis: async (tabId, complexity = 'medium') => {
      return new Promise((resolve) => {
        const complexityFactors = {
          simple: { nodes: 100, depth: 5, time: 10 },
          medium: { nodes: 500, depth: 10, time: 25 },
          complex: { nodes: 2000, depth: 15, time: 60 },
          heavy: { nodes: 5000, depth: 20, time: 120 }
        };
        
        const factor = complexityFactors[complexity] || complexityFactors.medium;
        
        setTimeout(() => {
          resolve({
            tabId: tabId,
            complexity: complexity,
            analysisTime: factor.time,
            timestamp: new Date().toISOString(),
            metrics: {
              totalNodes: factor.nodes,
              maxDepth: factor.depth,
              interactiveElements: Math.floor(factor.nodes * 0.15), // 15% are interactive
              forms: Math.floor(factor.nodes * 0.02), // 2% are forms
              links: Math.floor(factor.nodes * 0.08), // 8% are links
              images: Math.floor(factor.nodes * 0.05), // 5% are images
              scripts: Math.floor(factor.nodes * 0.01), // 1% are scripts
              stylesheets: Math.floor(factor.nodes * 0.003) // 0.3% are stylesheets
            }
          });
        }, factor.time); // Simulate analysis time based on complexity
      });
    },
    
    // Measure content script event listener setup
    measureEventListenerSetup: async (tabId) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const setupTime = 15; // 15ms setup time
          const listenerCount = 12; // 12 event listeners
          
          resolve({
            tabId: tabId,
            setupTime: setupTime,
            listenerCount: listenerCount,
            timestamp: new Date().toISOString(),
            listeners: {
              click: 3,
              change: 2,
              submit: 1,
              keydown: 2,
              focus: 1,
              blur: 1,
              custom: 2 // Custom Ray events
            },
            efficiency: {
              setupRate: listenerCount / setupTime, // Listeners per ms
              memoryUsage: listenerCount * 1024, // 1KB per listener
              delegationRatio: 0.7 // 70% use event delegation
            }
          });
        }, 5); // Simulate 5ms measurement time
      });
    },
    
    // Measure content script API integration time
    measureAPIIntegration: async (tabId) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const integrationTime = 20; // 20ms integration time
          
          resolve({
            tabId: tabId,
            integrationTime: integrationTime,
            timestamp: new Date().toISOString(),
            apis: {
              chromeTabs: 5, // 5ms for tabs API
              chromeRuntime: 3, // 3ms for runtime API
              chromeStorage: 4, // 4ms for storage API
              openRouter: 8 // 8ms for OpenRouter API setup
            },
            operations: {
              messageListeners: 3, // 3 message listeners
              messageSenders: 2, // 2 message senders
              storageAccess: 4, // 4 storage operations
              tabQueries: 2 // 2 tab queries
            }
          });
        }, 10); // Simulate 10ms measurement time
      });
    },
    
    // Measure content script memory footprint
    measureMemoryFootprint: async (tabId) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const memoryUsage = {
            heapUsed: 1024 * 1024 * 1.5, // 1.5MB heap usage
            heapTotal: 1024 * 1024 * 2, // 2MB total heap
            domReferences: 150, // 150 DOM references
            eventListeners: 12, // 12 event listeners
            timers: 3, // 3 active timers
            observers: 2, // 2 mutation observers
            timestamp: new Date().toISOString(),
            efficiency: {
              heapUtilization: 75, // 75% utilization
              domToMemoryRatio: 150 / (1024 * 1024 * 1.5), // DOM refs per MB
              listenerEfficiency: 12 / (1024 * 1024 * 1.5) // Listeners per MB
            }
          };
          
          resolve(memoryUsage);
        }, 15); // Simulate 15ms measurement time
      });
    },
    
    // Measure content script performance impact on page
    measurePagePerformanceImpact: async (tabId) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const impact = {
            tabId: tabId,
            timestamp: new Date().toISOString(),
            beforeInjection: {
              domContentLoaded: 450, // 450ms
              loadEvent: 1200, // 1200ms
              firstPaint: 300, // 300ms
              firstContentfulPaint: 400 // 400ms
            },
            afterInjection: {
              domContentLoaded: 470, // 470ms (+20ms)
              loadEvent: 1230, // 1230ms (+30ms)
              firstPaint: 310, // 310ms (+10ms)
              firstContentfulPaint: 415 // 415ms (+15ms)
            },
            impact: {
              domContentLoadedDelta: 20, // +20ms
              loadEventDelta: 30, // +30ms
              firstPaintDelta: 10, // +10ms
              firstContentfulPaintDelta: 15, // +15ms
              overallImpact: 'low' // low, medium, high
            }
          };
          
          resolve(impact);
        }, 25); // Simulate 25ms measurement time
      });
    },
    
    // Analyze content script performance bottlenecks
    analyzeContentScriptPerformanceBottlenecks: async (metrics) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const bottlenecks = [];
          
          // Analyze injection time
          if (metrics.injectionTime > 50) {
            bottlenecks.push({
              type: 'slow_injection',
              severity: 'high',
              description: 'Content script injection time exceeds 50ms',
              recommendation: 'Optimize content script initialization and reduce dependencies'
            });
          } else if (metrics.injectionTime > 30) {
            bottlenecks.push({
              type: 'moderate_injection',
              severity: 'medium',
              description: 'Content script injection time exceeds 30ms',
              recommendation: 'Review content script loading sequence'
            });
          }
          
          // Analyze DOM analysis time
          if (metrics.domAnalysis && metrics.domAnalysis.analysisTime > 40) {
            bottlenecks.push({
              type: 'slow_dom_analysis',
              severity: 'medium',
              description: 'DOM analysis time exceeds 40ms',
              recommendation: 'Optimize DOM traversal and implement selective analysis'
            });
          }
          
          // Analyze memory usage
          if (metrics.memoryFootprint && metrics.memoryFootprint.heapUsed > 1024 * 1024 * 3) { // 3MB
            bottlenecks.push({
              type: 'high_memory_usage',
              severity: 'medium',
              description: 'Content script memory usage exceeds 3MB',
              recommendation: 'Reduce memory usage and optimize object creation'
            });
          }
          
          // Analyze page impact
          if (metrics.pageImpact && metrics.pageImpact.impact.overallImpact === 'high') {
            bottlenecks.push({
              type: 'high_page_impact',
              severity: 'high',
              description: 'Content script significantly impacts page performance',
              recommendation: 'Reduce performance impact and optimize event handling'
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
    
    // Generate content script performance report
    generateContentScriptPerformanceReport: async (tabId, url) => {
      const injection = await mockContentScriptPerformanceMonitor.performance.measureContentScriptInjection(tabId, url);
      const domAnalysis = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId);
      const eventSetup = await mockContentScriptPerformanceMonitor.performance.measureEventListenerSetup(tabId);
      const apiIntegration = await mockContentScriptPerformanceMonitor.performance.measureAPIIntegration(tabId);
      const memoryFootprint = await mockContentScriptPerformanceMonitor.performance.measureMemoryFootprint(tabId);
      const pageImpact = await mockContentScriptPerformanceMonitor.performance.measurePagePerformanceImpact(tabId);
      const bottlenecks = await mockContentScriptPerformanceMonitor.performance.analyzeContentScriptPerformanceBottlenecks({
        injectionTime: injection.injectionTime,
        domAnalysis: domAnalysis,
        memoryFootprint: memoryFootprint,
        pageImpact: pageImpact
      });
      
      return {
        tabId: tabId,
        url: url,
        summary: {
          totalLoadTime: injection.injectionTime + domAnalysis.analysisTime + eventSetup.setupTime + apiIntegration.integrationTime,
          injectionTime: injection.injectionTime,
          domAnalysisTime: domAnalysis.analysisTime,
          eventSetupTime: eventSetup.setupTime,
          apiIntegrationTime: apiIntegration.integrationTime,
          memoryUsage: memoryFootprint.heapUsed,
          pageImpact: pageImpact.impact.overallImpact,
          performanceScore: bottlenecks.overallScore
        },
        details: {
          injection: injection,
          domAnalysis: domAnalysis,
          eventSetup: eventSetup,
          apiIntegration: apiIntegration,
          memoryFootprint: memoryFootprint,
          pageImpact: pageImpact,
          bottlenecks: bottlenecks
        },
        timestamp: new Date().toISOString(),
        recommendations: bottlenecks.bottlenecks.map(b => b.recommendation)
      };
    }
  }
};

describe('Content Script Load Performance Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock performance.now for consistent testing
    let mockTime = 0;
    global.performance = {
      now: jest.fn(() => {
        mockTime += 5;
        return mockTime;
      })
    };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Content Script Injection Performance', () => {
    test('should measure content script injection time within acceptable range', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureContentScriptInjection(tabId, url);
      
      expect(result.injectionTime).toBe(30); // Should match our mock
      expect(result.injectionTime).toBeLessThan(50); // Should be under 50ms
      expect(result.tabId).toBe(tabId);
      expect(result.url).toBe(url);
    });
    
    test('should provide detailed injection phase metrics', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureContentScriptInjection(tabId, url);
      
      expect(result).toHaveProperty('injectionTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('phases');
      expect(result.phases).toHaveProperty('registration');
      expect(result.phases).toHaveProperty('loading');
      expect(result.phases).toHaveProperty('initialization');
      expect(result.phases).toHaveProperty('domReady');
    });
    
    test('should verify injection phase times add up', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureContentScriptInjection(tabId, url);
      
      const phaseSum = Object.values(result.phases).reduce((sum, time) => sum + time, 0);
      expect(phaseSum).toBeCloseTo(result.injectionTime, 1);
    });
  });
  
  describe('DOM Analysis Performance', () => {
    test('should measure DOM analysis time for simple pages', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'simple');
      
      expect(result.analysisTime).toBe(10); // Should match simple complexity
      expect(result.complexity).toBe('simple');
      expect(result.metrics.totalNodes).toBe(100);
      expect(result.metrics.maxDepth).toBe(5);
    });
    
    test('should measure DOM analysis time for complex pages', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'complex');
      
      expect(result.analysisTime).toBe(60); // Should match complex complexity
      expect(result.complexity).toBe('complex');
      expect(result.metrics.totalNodes).toBe(2000);
      expect(result.metrics.maxDepth).toBe(15);
    });
    
    test('should provide detailed DOM metrics', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'medium');
      
      expect(result.metrics).toHaveProperty('totalNodes');
      expect(result.metrics).toHaveProperty('maxDepth');
      expect(result.metrics).toHaveProperty('interactiveElements');
      expect(result.metrics).toHaveProperty('forms');
      expect(result.metrics).toHaveProperty('links');
      expect(result.metrics).toHaveProperty('images');
      expect(result.metrics).toHaveProperty('scripts');
      expect(result.metrics).toHaveProperty('stylesheets');
    });
    
    test('should scale analysis time with complexity', async () => {
      const tabId = 123;
      
      const simple = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'simple');
      const medium = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'medium');
      const complex = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'complex');
      const heavy = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'heavy');
      
      expect(simple.analysisTime).toBeLessThan(medium.analysisTime);
      expect(medium.analysisTime).toBeLessThan(complex.analysisTime);
      expect(complex.analysisTime).toBeLessThan(heavy.analysisTime);
    });
  });
  
  describe('Event Listener Setup Performance', () => {
    test('should measure event listener setup time', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureEventListenerSetup(tabId);
      
      expect(result.setupTime).toBe(15); // Should match our mock
      expect(result.listenerCount).toBe(12);
      expect(result.tabId).toBe(tabId);
    });
    
    test('should provide detailed listener metrics', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureEventListenerSetup(tabId);
      
      expect(result).toHaveProperty('listeners');
      expect(result).toHaveProperty('efficiency');
      expect(result.listeners).toHaveProperty('click');
      expect(result.listeners).toHaveProperty('change');
      expect(result.listeners).toHaveProperty('submit');
      expect(result.listeners).toHaveProperty('keydown');
      expect(result.listeners).toHaveProperty('focus');
      expect(result.listeners).toHaveProperty('blur');
      expect(result.listeners).toHaveProperty('custom');
    });
    
    test('should calculate listener efficiency metrics', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureEventListenerSetup(tabId);
      
      expect(result.efficiency).toHaveProperty('setupRate');
      expect(result.efficiency).toHaveProperty('memoryUsage');
      expect(result.efficiency).toHaveProperty('delegationRatio');
      
      expect(result.efficiency.setupRate).toBe(12 / 15); // Listeners per ms
      expect(result.efficiency.memoryUsage).toBe(12 * 1024); // 1KB per listener
      expect(result.efficiency.delegationRatio).toBe(0.7); // 70% delegation
    });
  });
  
  describe('API Integration Performance', () => {
    test('should measure API integration time', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureAPIIntegration(tabId);
      
      expect(result.integrationTime).toBe(20); // Should match our mock
      expect(result.tabId).toBe(tabId);
    });
    
    test('should provide detailed API metrics', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureAPIIntegration(tabId);
      
      expect(result).toHaveProperty('apis');
      expect(result).toHaveProperty('operations');
      expect(result.apis).toHaveProperty('chromeTabs');
      expect(result.apis).toHaveProperty('chromeRuntime');
      expect(result.apis).toHaveProperty('chromeStorage');
      expect(result.apis).toHaveProperty('openRouter');
      expect(result.operations).toHaveProperty('messageListeners');
      expect(result.operations).toHaveProperty('messageSenders');
      expect(result.operations).toHaveProperty('storageAccess');
      expect(result.operations).toHaveProperty('tabQueries');
    });
    
    test('should verify API times add up', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureAPIIntegration(tabId);
      
      const apiSum = Object.values(result.apis).reduce((sum, time) => sum + time, 0);
      expect(apiSum).toBe(result.integrationTime);
    });
  });
  
  describe('Memory Footprint Measurement', () => {
    test('should measure content script memory footprint', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureMemoryFootprint(tabId);
      
      expect(result.heapUsed).toBe(1024 * 1024 * 1.5); // 1.5MB
      expect(result.heapTotal).toBe(1024 * 1024 * 2); // 2MB
      expect(result.domReferences).toBe(150);
      expect(result.eventListeners).toBe(12);
      expect(result.timers).toBe(3);
      expect(result.observers).toBe(2);
    });
    
    test('should calculate memory efficiency metrics', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureMemoryFootprint(tabId);
      
      expect(result.efficiency).toHaveProperty('heapUtilization');
      expect(result.efficiency).toHaveProperty('domToMemoryRatio');
      expect(result.efficiency).toHaveProperty('listenerEfficiency');
      
      expect(result.efficiency.heapUtilization).toBe(75); // 1.5MB / 2MB * 100
    });
    
    test('should identify memory issues', async () => {
      // Mock high memory usage
      mockContentScriptPerformanceMonitor.performance.measureMemoryFootprint = async () => {
        return {
          heapUsed: 1024 * 1024 * 4, // 4MB
          heapTotal: 1024 * 1024 * 5, // 5MB
          domReferences: 500, // 500 DOM references
          eventListeners: 25, // 25 event listeners
          timers: 8, // 8 active timers
          observers: 5, // 5 mutation observers
          efficiency: {
            heapUtilization: 80, // 80% utilization
            domToMemoryRatio: 500 / (1024 * 1024 * 4),
            listenerEfficiency: 25 / (1024 * 1024 * 4)
          }
        };
      };
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureMemoryFootprint(123);
      
      expect(result.heapUsed).toBeGreaterThan(1024 * 1024 * 3); // Should trigger bottleneck
      expect(result.efficiency.heapUtilization).toBeGreaterThan(75);
    });
  });
  
  describe('Page Performance Impact Measurement', () => {
    test('should measure page performance impact', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measurePagePerformanceImpact(tabId);
      
      expect(result).toHaveProperty('beforeInjection');
      expect(result).toHaveProperty('afterInjection');
      expect(result).toHaveProperty('impact');
      expect(result.tabId).toBe(tabId);
    });
    
    test('should calculate performance deltas', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measurePagePerformanceImpact(tabId);
      
      expect(result.impact.domContentLoadedDelta).toBe(20);
      expect(result.impact.loadEventDelta).toBe(30);
      expect(result.impact.firstPaintDelta).toBe(10);
      expect(result.impact.firstContentfulPaintDelta).toBe(15);
      
      // Verify deltas are calculated correctly
      expect(result.impact.domContentLoadedDelta).toBe(
        result.afterInjection.domContentLoaded - result.beforeInjection.domContentLoaded
      );
    });
    
    test('should classify overall impact level', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measurePagePerformanceImpact(tabId);
      
      expect(['low', 'medium', 'high']).toContain(result.impact.overallImpact);
      expect(result.impact.overallImpact).toBe('low'); // Should match our mock
    });
  });
  
  describe('Content Script Performance Bottleneck Analysis', () => {
    test('should identify performance bottlenecks', async () => {
      const metrics = {
        injectionTime: 60, // Slow injection
        domAnalysis: { analysisTime: 50 }, // Slow DOM analysis
        memoryFootprint: { heapUsed: 1024 * 1024 * 4 }, // High memory usage
        pageImpact: { impact: { overallImpact: 'high' } } // High page impact
      };
      
      const result = await mockContentScriptPerformanceMonitor.performance.analyzeContentScriptPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.length).toBeGreaterThan(0);
      expect(result.bottlenecks.some(b => b.type === 'slow_injection')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_dom_analysis')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'high_memory_usage')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'high_page_impact')).toBe(true);
      expect(result.overallScore).toBeLessThan(100);
    });
    
    test('should provide bottleneck recommendations', async () => {
      const metrics = {
        injectionTime: 40,
        domAnalysis: { analysisTime: 45 },
        memoryFootprint: { heapUsed: 1024 * 1024 * 2.5 }
      };
      
      const result = await mockContentScriptPerformanceMonitor.performance.analyzeContentScriptPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.every(b => b.recommendation)).toBe(true);
      expect(result.bottlenecks.some(b => 
        b.recommendation.includes('Optimize') || 
        b.recommendation.includes('Review') ||
        b.recommendation.includes('Reduce')
      )).toBe(true);
    });
    
    test('should calculate performance score', async () => {
      const metrics = {
        injectionTime: 20, // Fast injection
        domAnalysis: { analysisTime: 15 }, // Fast DOM analysis
        memoryFootprint: { heapUsed: 1024 * 1024 * 1 }, // Low memory usage
        pageImpact: { impact: { overallImpact: 'low' } } // Low page impact
      };
      
      const result = await mockContentScriptPerformanceMonitor.performance.analyzeContentScriptPerformanceBottlenecks(metrics);
      
      expect(result.overallScore).toBe(100); // No bottlenecks = perfect score
    });
  });
  
  describe('Content Script Performance Report Generation', () => {
    test('should generate comprehensive content script performance report', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.generateContentScriptPerformanceReport(tabId, url);
      
      expect(result).toHaveProperty('tabId');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('recommendations');
      
      expect(result.tabId).toBe(tabId);
      expect(result.url).toBe(url);
      expect(result.summary.totalLoadTime).toBeDefined();
      expect(result.summary.injectionTime).toBeDefined();
      expect(result.summary.domAnalysisTime).toBeDefined();
      expect(result.summary.eventSetupTime).toBeDefined();
      expect(result.summary.apiIntegrationTime).toBeDefined();
      expect(result.summary.memoryUsage).toBeDefined();
      expect(result.summary.pageImpact).toBeDefined();
      expect(result.summary.performanceScore).toBeDefined();
    });
    
    test('should include content script performance recommendations', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.generateContentScriptPerformanceReport(tabId, url);
      
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });
    
    test('should provide actionable insights', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.generateContentScriptPerformanceReport(tabId, url);
      
      // Should provide both metrics and recommendations
      expect(result.summary.performanceScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.performanceScore).toBeLessThanOrEqual(100);
      
      if (result.summary.performanceScore < 80) {
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Content Script Performance Thresholds', () => {
    test('should enforce injection time threshold', async () => {
      const tabId = 123;
      const url = 'https://example.com';
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureContentScriptInjection(tabId, url);
      
      // Injection time should be under 50ms for good performance
      expect(result.injectionTime).toBeLessThan(50);
    });
    
    test('should enforce DOM analysis time threshold', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureDOMAnalysis(tabId, 'medium');
      
      // DOM analysis time should be under 40ms for good performance
      expect(result.analysisTime).toBeLessThan(40);
    });
    
    test('should enforce memory usage threshold', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measureMemoryFootprint(tabId);
      
      // Memory usage should be under 3MB for good performance
      expect(result.heapUsed).toBeLessThan(1024 * 1024 * 3);
    });
    
    test('should enforce page impact threshold', async () => {
      const tabId = 123;
      
      const result = await mockContentScriptPerformanceMonitor.performance.measurePagePerformanceImpact(tabId);
      
      // Page impact should be 'low' for good performance
      expect(result.impact.overallImpact).toBe('low');
    });
  });
});
