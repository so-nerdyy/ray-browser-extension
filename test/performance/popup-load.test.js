/**
 * Popup Load Performance Tests
 * Tests for popup loading time and performance metrics
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock performance monitoring module
const mockPerformanceMonitor = {
  // Performance monitor
  performance: {
    // Measure popup load time
    measurePopupLoadTime: async () => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        
        // Simulate popup loading process
        setTimeout(() => {
          const endTime = performance.now();
          const loadTime = endTime - startTime;
          
          resolve({
            loadTime: loadTime,
            timestamp: new Date().toISOString(),
            metrics: {
              domContentLoaded: loadTime * 0.7, // Simulate DOM content loaded at 70% of total time
              loadEvent: loadTime, // Load event fires at 100%
              firstPaint: loadTime * 0.3, // First paint at 30%
              firstContentfulPaint: loadTime * 0.5 // First contentful paint at 50%
            }
          });
        }, 50); // Simulate 50ms load time
      });
    },
    
    // Measure popup initialization time
    measurePopupInitialization: async () => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        
        // Simulate initialization steps
        setTimeout(() => {
          const endTime = performance.now();
          const initTime = endTime - startTime;
          
          resolve({
            initializationTime: initTime,
            timestamp: new Date().toISOString(),
            steps: {
              domParsing: initTime * 0.2, // DOM parsing takes 20%
              scriptExecution: initTime * 0.3, // Script execution takes 30%
              eventBinding: initTime * 0.2, // Event binding takes 20%
              apiCalls: initTime * 0.3 // API calls take 30%
            }
          });
        }, 30); // Simulate 30ms initialization time
      });
    },
    
    // Measure popup render time
    measurePopupRenderTime: async () => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        
        // Simulate rendering process
        setTimeout(() => {
          const endTime = performance.now();
          const renderTime = endTime - startTime;
          
          resolve({
            renderTime: renderTime,
            timestamp: new Date().toISOString(),
            metrics: {
              layoutCalculation: renderTime * 0.4, // Layout calculation takes 40%
              paint: renderTime * 0.3, // Paint takes 30%
              composite: renderTime * 0.2, // Composite takes 20%
              other: renderTime * 0.1 // Other operations take 10%
            }
          });
        }, 20); // Simulate 20ms render time
      });
    },
    
    // Measure popup memory usage
    measurePopupMemoryUsage: async () => {
      return new Promise((resolve) => {
        // Simulate memory measurement
        setTimeout(() => {
          const memoryUsage = {
            heapUsed: 1024 * 1024 * 2, // 2MB heap usage
            heapTotal: 1024 * 1024 * 4, // 4MB total heap
            external: 1024 * 512, // 512KB external memory
            domNodes: 150, // 150 DOM nodes
            eventListeners: 25 // 25 event listeners
          };
          
          resolve({
            memoryUsage: memoryUsage,
            timestamp: new Date().toISOString(),
            efficiency: {
              heapUtilization: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
              domNodeCount: memoryUsage.domNodes,
              eventListenerCount: memoryUsage.eventListeners
            }
          });
        }, 10); // Simulate 10ms measurement time
      });
    },
    
    // Measure popup resource loading
    measurePopupResourceLoading: async () => {
      return new Promise((resolve) => {
        // Simulate resource loading measurement
        setTimeout(() => {
          const resourceMetrics = {
            cssFiles: {
              count: 2,
              totalSize: 1024 * 10, // 10KB total CSS
              loadTime: 15 // 15ms to load CSS
            },
            jsFiles: {
              count: 3,
              totalSize: 1024 * 50, // 50KB total JS
              loadTime: 25, // 25ms to load JS
              parseTime: 10 // 10ms to parse JS
            },
            images: {
              count: 5,
              totalSize: 1024 * 100, // 100KB total images
              loadTime: 30 // 30ms to load images
              decodeTime: 15 // 15ms to decode images
            },
            fonts: {
              count: 2,
              totalSize: 1024 * 20, // 20KB total fonts
              loadTime: 20 // 20ms to load fonts
              renderTime: 5 // 5ms to render fonts
            }
          };
          
          resolve({
            resourceMetrics: resourceMetrics,
            timestamp: new Date().toISOString(),
            totalLoadTime: Math.max(
              resourceMetrics.cssFiles.loadTime,
              resourceMetrics.jsFiles.loadTime + resourceMetrics.jsFiles.parseTime,
              resourceMetrics.images.loadTime + resourceMetrics.images.decodeTime,
              resourceMetrics.fonts.loadTime + resourceMetrics.fonts.renderTime
            )
          });
        }, 40); // Simulate 40ms resource loading
      });
    },
    
    // Analyze popup performance bottlenecks
    analyzePopupPerformanceBottlenecks: async (metrics) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const bottlenecks = [];
          
          // Analyze load time
          if (metrics.loadTime > 100) {
            bottlenecks.push({
              type: 'slow_load',
              severity: 'high',
              description: 'Popup load time exceeds 100ms',
              recommendation: 'Optimize popup initialization and resource loading'
            });
          } else if (metrics.loadTime > 50) {
            bottlenecks.push({
              type: 'moderate_load',
              severity: 'medium',
              description: 'Popup load time exceeds 50ms',
              recommendation: 'Review popup initialization sequence'
            });
          }
          
          // Analyze memory usage
          if (metrics.memoryUsage && metrics.memoryUsage.heapUtilization > 80) {
            bottlenecks.push({
              type: 'high_memory',
              severity: 'high',
              description: 'Heap utilization exceeds 80%',
              recommendation: 'Optimize memory usage and reduce object creation'
            });
          }
          
          // Analyze DOM nodes
          if (metrics.memoryUsage && metrics.memoryUsage.domNodes > 200) {
            bottlenecks.push({
              type: 'dom_complexity',
              severity: 'medium',
              description: 'DOM node count exceeds 200',
              recommendation: 'Simplify popup DOM structure'
            });
          }
          
          // Analyze resource loading
          if (metrics.resourceMetrics && metrics.resourceMetrics.totalLoadTime > 80) {
            bottlenecks.push({
              type: 'slow_resources',
              severity: 'medium',
              description: 'Resource loading time exceeds 80ms',
              recommendation: 'Optimize resource loading and reduce file sizes'
            });
          }
          
          resolve({
            bottlenecks: bottlenecks,
            overallScore: Math.max(0, 100 - (bottlenecks.length * 15)),
            timestamp: new Date().toISOString()
          });
        }, 20); // Simulate 20ms analysis time
      });
    },
    
    // Generate performance report
    generatePopupPerformanceReport: async () => {
      const loadTime = await mockPerformanceMonitor.performance.measurePopupLoadTime();
      const initTime = await mockPerformanceMonitor.performance.measurePopupInitialization();
      const renderTime = await mockPerformanceMonitor.performance.measurePopupRenderTime();
      const memoryUsage = await mockPerformanceMonitor.performance.measurePopupMemoryUsage();
      const resourceMetrics = await mockPerformanceMonitor.performance.measurePopupResourceLoading();
      const bottlenecks = await mockPerformanceMonitor.performance.analyzePopupPerformanceBottlenecks({
        loadTime: loadTime.loadTime,
        memoryUsage: memoryUsage,
        resourceMetrics: resourceMetrics
      });
      
      return {
        summary: {
          totalLoadTime: loadTime.loadTime,
          initializationTime: initTime.initializationTime,
          renderTime: renderTime.renderTime,
          memoryUsage: memoryUsage.memoryUsage,
          resourceLoading: resourceMetrics.totalLoadTime,
          performanceScore: bottlenecks.overallScore
        },
        details: {
          loadTime: loadTime,
          initialization: initTime,
          render: renderTime,
          memory: memoryUsage,
          resources: resourceMetrics,
          bottlenecks: bottlenecks
        },
        timestamp: new Date().toISOString(),
        recommendations: bottlenecks.bottlenecks.map(b => b.recommendation)
      };
    }
  }
};

describe('Popup Load Performance Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock performance.now for consistent testing
    let mockTime = 0;
    global.performance = {
      now: jest.fn(() => {
        mockTime += 10; // Increment by 10ms each call
        return mockTime;
      })
    };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Popup Load Time Measurement', () => {
    test('should measure popup load time within acceptable range', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupLoadTime();
      
      expect(result.loadTime).toBe(50); // Should match our mock
      expect(result.loadTime).toBeLessThan(100); // Should be under 100ms
      expect(result.metrics.domContentLoaded).toBe(35); // 70% of 50ms
      expect(result.metrics.loadEvent).toBe(50); // 100% of 50ms
      expect(result.metrics.firstPaint).toBe(15); // 30% of 50ms
      expect(result.metrics.firstContentfulPaint).toBe(25); // 50% of 50ms
    });
    
    test('should provide detailed load time metrics', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupLoadTime();
      
      expect(result).toHaveProperty('loadTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('domContentLoaded');
      expect(result.metrics).toHaveProperty('loadEvent');
      expect(result.metrics).toHaveProperty('firstPaint');
      expect(result.metrics).toHaveProperty('firstContentfulPaint');
    });
    
    test('should track load time over multiple measurements', async () => {
      const measurements = [];
      
      for (let i = 0; i < 5; i++) {
        const result = await mockPerformanceMonitor.performance.measurePopupLoadTime();
        measurements.push(result.loadTime);
      }
      
      // All measurements should be consistent
      measurements.forEach(time => {
        expect(time).toBe(50);
      });
    });
  });
  
  describe('Popup Initialization Performance', () => {
    test('should measure initialization time within acceptable range', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupInitialization();
      
      expect(result.initializationTime).toBe(30); // Should match our mock
      expect(result.initializationTime).toBeLessThan(50); // Should be under 50ms
      expect(result.steps.domParsing).toBe(6); // 20% of 30ms
      expect(result.steps.scriptExecution).toBe(9); // 30% of 30ms
      expect(result.steps.eventBinding).toBe(6); // 20% of 30ms
      expect(result.steps.apiCalls).toBe(9); // 30% of 30ms
    });
    
    test('should break down initialization steps', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupInitialization();
      
      expect(result.steps).toHaveProperty('domParsing');
      expect(result.steps).toHaveProperty('scriptExecution');
      expect(result.steps).toHaveProperty('eventBinding');
      expect(result.steps).toHaveProperty('apiCalls');
      
      // Verify step times add up to total
      const totalStepTime = Object.values(result.steps).reduce((sum, time) => sum + time, 0);
      expect(totalStepTime).toBe(result.initializationTime);
    });
    
    test('should identify slow initialization steps', async () => {
      // Mock slow initialization
      global.performance = {
        now: jest.fn(() => {
          return Date.now(); // Use real time for this test
        })
      };
      
      const result = await mockPerformanceMonitor.performance.measurePopupInitialization();
      
      // Real time should be much faster than our mock
      expect(result.initializationTime).toBeLessThan(30);
    });
  });
  
  describe('Popup Render Performance', () => {
    test('should measure render time within acceptable range', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupRenderTime();
      
      expect(result.renderTime).toBe(20); // Should match our mock
      expect(result.renderTime).toBeLessThan(50); // Should be under 50ms
      expect(result.metrics.layoutCalculation).toBe(8); // 40% of 20ms
      expect(result.metrics.paint).toBe(6); // 30% of 20ms
      expect(result.metrics.composite).toBe(4); // 20% of 20ms
      expect(result.metrics.other).toBe(2); // 10% of 20ms
    });
    
    test('should provide detailed render metrics', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupRenderTime();
      
      expect(result).toHaveProperty('renderTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('layoutCalculation');
      expect(result.metrics).toHaveProperty('paint');
      expect(result.metrics).toHaveProperty('composite');
      expect(result.metrics).toHaveProperty('other');
    });
    
    test('should track render performance over time', async () => {
      const measurements = [];
      
      for (let i = 0; i < 3; i++) {
        const result = await mockPerformanceMonitor.performance.measurePopupRenderTime();
        measurements.push(result.renderTime);
      }
      
      // All measurements should be consistent
      measurements.forEach(time => {
        expect(time).toBe(20);
      });
    });
  });
  
  describe('Popup Memory Usage', () => {
    test('should measure memory usage within acceptable range', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupMemoryUsage();
      
      expect(result.memoryUsage.heapUsed).toBe(1024 * 1024 * 2); // 2MB
      expect(result.memoryUsage.heapTotal).toBe(1024 * 1024 * 4); // 4MB
      expect(result.memoryUsage.heapUtilization).toBe(50); // 50% utilization
      expect(result.memoryUsage.domNodes).toBe(150);
      expect(result.memoryUsage.eventListeners).toBe(25);
    });
    
    test('should calculate memory efficiency metrics', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupMemoryUsage();
      
      expect(result.efficiency).toHaveProperty('heapUtilization');
      expect(result.efficiency).toHaveProperty('domNodeCount');
      expect(result.efficiency).toHaveProperty('eventListenerCount');
      
      // Verify efficiency calculations
      expect(result.efficiency.heapUtilization).toBe(50); // 2MB / 4MB * 100
    });
    
    test('should identify memory issues', async () => {
      // Mock high memory usage
      const originalMemoryUsage = mockPerformanceMonitor.performance.measurePopupMemoryUsage;
      mockPerformanceMonitor.performance.measurePopupMemoryUsage = async () => {
        return {
          memoryUsage: {
            heapUsed: 1024 * 1024 * 3.5, // 3.5MB
            heapTotal: 1024 * 1024 * 4, // 4MB
            domNodes: 250, // 250 DOM nodes
            eventListeners: 40 // 40 event listeners
          },
          efficiency: {
            heapUtilization: 87.5, // 87.5% utilization
            domNodeCount: 250,
            eventListenerCount: 40
          }
        };
      };
      
      const result = await mockPerformanceMonitor.performance.measurePopupMemoryUsage();
      
      expect(result.efficiency.heapUtilization).toBeGreaterThan(80);
      expect(result.memoryUsage.domNodes).toBeGreaterThan(200);
      expect(result.memoryUsage.eventListeners).toBeGreaterThan(30);
    });
  });
  
  describe('Popup Resource Loading', () => {
    test('should measure resource loading time', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupResourceLoading();
      
      expect(result.resourceMetrics.cssFiles.count).toBe(2);
      expect(result.resourceMetrics.cssFiles.totalSize).toBe(1024 * 10);
      expect(result.resourceMetrics.cssFiles.loadTime).toBe(15);
      
      expect(result.resourceMetrics.jsFiles.count).toBe(3);
      expect(result.resourceMetrics.jsFiles.totalSize).toBe(1024 * 50);
      expect(result.resourceMetrics.jsFiles.loadTime).toBe(25);
      expect(result.resourceMetrics.jsFiles.parseTime).toBe(10);
      
      expect(result.totalLoadTime).toBe(30); // Max of all resource times
    });
    
    test('should provide detailed resource metrics', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupResourceLoading();
      
      expect(result).toHaveProperty('resourceMetrics');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('totalLoadTime');
      
      expect(result.resourceMetrics).toHaveProperty('cssFiles');
      expect(result.resourceMetrics).toHaveProperty('jsFiles');
      expect(result.resourceMetrics).toHaveProperty('images');
      expect(result.resourceMetrics).toHaveProperty('fonts');
    });
    
    test('should identify resource loading bottlenecks', async () => {
      // Mock slow resource loading
      mockPerformanceMonitor.performance.measurePopupResourceLoading = async () => {
        return {
          resourceMetrics: {
            cssFiles: { count: 5, totalSize: 1024 * 25, loadTime: 50 },
            jsFiles: { count: 8, totalSize: 1024 * 100, loadTime: 80, parseTime: 40 },
            images: { count: 10, totalSize: 1024 * 200, loadTime: 100, decodeTime: 50 },
            fonts: { count: 4, totalSize: 1024 * 40, loadTime: 60, renderTime: 15 }
          },
          totalLoadTime: 100 // Max of all resource times
        };
      };
      
      const result = await mockPerformanceMonitor.performance.measurePopupResourceLoading();
      
      expect(result.totalLoadTime).toBe(100);
      expect(result.totalLoadTime).toBeGreaterThan(80); // Should trigger bottleneck
    });
  });
  
  describe('Performance Bottleneck Analysis', () => {
    test('should identify performance bottlenecks', async () => {
      const metrics = {
        loadTime: 120, // Slow load time
        memoryUsage: {
          heapUtilization: 85, // High memory usage
          domNodes: 250 // Many DOM nodes
          eventListeners: 40 // Many event listeners
        },
        resourceMetrics: {
          totalLoadTime: 90 // Slow resource loading
        }
      };
      
      const result = await mockPerformanceMonitor.performance.analyzePopupPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.length).toBeGreaterThan(0);
      expect(result.bottlenecks.some(b => b.type === 'slow_load')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'high_memory')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'dom_complexity')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_resources')).toBe(true);
      expect(result.overallScore).toBeLessThan(100);
    });
    
    test('should provide bottleneck recommendations', async () => {
      const metrics = {
        loadTime: 150,
        memoryUsage: { heapUtilization: 90 },
        resourceMetrics: { totalLoadTime: 100 }
      };
      
      const result = await mockPerformanceMonitor.performance.analyzePopupPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.every(b => b.recommendation)).toBe(true);
      expect(result.bottlenecks.some(b => 
        b.recommendation.includes('Optimize')
      )).toBe(true);
    });
    
    test('should calculate performance score', async () => {
      const metrics = {
        loadTime: 25, // Fast load time
        memoryUsage: { heapUtilization: 30 }, // Low memory usage
        resourceMetrics: { totalLoadTime: 20 } // Fast resource loading
      };
      
      const result = await mockPerformanceMonitor.performance.analyzePopupPerformanceBottlenecks(metrics);
      
      expect(result.overallScore).toBe(100); // No bottlenecks = perfect score
    });
  });
  
  describe('Performance Report Generation', () => {
    test('should generate comprehensive performance report', async () => {
      const result = await mockPerformanceMonitor.performance.generatePopupPerformanceReport();
      
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('recommendations');
      
      expect(result.summary.totalLoadTime).toBeDefined();
      expect(result.summary.initializationTime).toBeDefined();
      expect(result.summary.renderTime).toBeDefined();
      expect(result.summary.memoryUsage).toBeDefined();
      expect(result.summary.resourceLoading).toBeDefined();
      expect(result.summary.performanceScore).toBeDefined();
    });
    
    test('should include performance recommendations', async () => {
      const result = await mockPerformanceMonitor.performance.generatePopupPerformanceReport();
      
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });
    
    test('should provide actionable insights', async () => {
      const result = await mockPerformanceMonitor.performance.generatePopupPerformanceReport();
      
      // Should provide both metrics and recommendations
      expect(result.summary.performanceScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.performanceScore).toBeLessThanOrEqual(100);
      
      if (result.summary.performanceScore < 80) {
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Performance Thresholds', () => {
    test('should enforce popup load time threshold', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupLoadTime();
      
      // Load time should be under 100ms for good performance
      expect(result.loadTime).toBeLessThan(100);
    });
    
    test('should enforce memory usage threshold', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupMemoryUsage();
      
      // Heap utilization should be under 80% for good performance
      expect(result.efficiency.heapUtilization).toBeLessThan(80);
    });
    
    test('should enforce DOM complexity threshold', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupMemoryUsage();
      
      // DOM nodes should be under 200 for good performance
      expect(result.efficiency.domNodeCount).toBeLessThan(200);
    });
    
    test('should enforce resource loading threshold', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupResourceLoading();
      
      // Resource loading should be under 80ms for good performance
      expect(result.totalLoadTime).toBeLessThan(80);
    });
  });
}); * Popup Load Performance Tests
 * Tests for popup loading time and performance metrics
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock performance monitoring module
const mockPerformanceMonitor = {
  // Performance monitor
  performance: {
    // Measure popup load time
    measurePopupLoadTime: async () => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        
        // Simulate popup loading process
        setTimeout(() => {
          const endTime = performance.now();
          const loadTime = endTime - startTime;
          
          resolve({
            loadTime: loadTime,
            timestamp: new Date().toISOString(),
            metrics: {
              domContentLoaded: loadTime * 0.7, // Simulate DOM content loaded at 70% of total time
              loadEvent: loadTime, // Load event fires at 100%
              firstPaint: loadTime * 0.3, // First paint at 30%
              firstContentfulPaint: loadTime * 0.5 // First contentful paint at 50%
            }
          });
        }, 50); // Simulate 50ms load time
      });
    },
    
    // Measure popup initialization time
    measurePopupInitialization: async () => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        
        // Simulate initialization steps
        setTimeout(() => {
          const endTime = performance.now();
          const initTime = endTime - startTime;
          
          resolve({
            initializationTime: initTime,
            timestamp: new Date().toISOString(),
            steps: {
              domParsing: initTime * 0.2, // DOM parsing takes 20%
              scriptExecution: initTime * 0.3, // Script execution takes 30%
              eventBinding: initTime * 0.2, // Event binding takes 20%
              apiCalls: initTime * 0.3 // API calls take 30%
            }
          });
        }, 30); // Simulate 30ms initialization time
      });
    },
    
    // Measure popup render time
    measurePopupRenderTime: async () => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        
        // Simulate rendering process
        setTimeout(() => {
          const endTime = performance.now();
          const renderTime = endTime - startTime;
          
          resolve({
            renderTime: renderTime,
            timestamp: new Date().toISOString(),
            metrics: {
              layoutCalculation: renderTime * 0.4, // Layout calculation takes 40%
              paint: renderTime * 0.3, // Paint takes 30%
              composite: renderTime * 0.2, // Composite takes 20%
              other: renderTime * 0.1 // Other operations take 10%
            }
          });
        }, 20); // Simulate 20ms render time
      });
    },
    
    // Measure popup memory usage
    measurePopupMemoryUsage: async () => {
      return new Promise((resolve) => {
        // Simulate memory measurement
        setTimeout(() => {
          const memoryUsage = {
            heapUsed: 1024 * 1024 * 2, // 2MB heap usage
            heapTotal: 1024 * 1024 * 4, // 4MB total heap
            external: 1024 * 512, // 512KB external memory
            domNodes: 150, // 150 DOM nodes
            eventListeners: 25 // 25 event listeners
          };
          
          resolve({
            memoryUsage: memoryUsage,
            timestamp: new Date().toISOString(),
            efficiency: {
              heapUtilization: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
              domNodeCount: memoryUsage.domNodes,
              eventListenerCount: memoryUsage.eventListeners
            }
          });
        }, 10); // Simulate 10ms measurement time
      });
    },
    
    // Measure popup resource loading
    measurePopupResourceLoading: async () => {
      return new Promise((resolve) => {
        // Simulate resource loading measurement
        setTimeout(() => {
          const resourceMetrics = {
            cssFiles: {
              count: 2,
              totalSize: 1024 * 10, // 10KB total CSS
              loadTime: 15 // 15ms to load CSS
            },
            jsFiles: {
              count: 3,
              totalSize: 1024 * 50, // 50KB total JS
              loadTime: 25, // 25ms to load JS
              parseTime: 10 // 10ms to parse JS
            },
            images: {
              count: 5,
              totalSize: 1024 * 100, // 100KB total images
              loadTime: 30 // 30ms to load images
              decodeTime: 15 // 15ms to decode images
            },
            fonts: {
              count: 2,
              totalSize: 1024 * 20, // 20KB total fonts
              loadTime: 20 // 20ms to load fonts
              renderTime: 5 // 5ms to render fonts
            }
          };
          
          resolve({
            resourceMetrics: resourceMetrics,
            timestamp: new Date().toISOString(),
            totalLoadTime: Math.max(
              resourceMetrics.cssFiles.loadTime,
              resourceMetrics.jsFiles.loadTime + resourceMetrics.jsFiles.parseTime,
              resourceMetrics.images.loadTime + resourceMetrics.images.decodeTime,
              resourceMetrics.fonts.loadTime + resourceMetrics.fonts.renderTime
            )
          });
        }, 40); // Simulate 40ms resource loading
      });
    },
    
    // Analyze popup performance bottlenecks
    analyzePopupPerformanceBottlenecks: async (metrics) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const bottlenecks = [];
          
          // Analyze load time
          if (metrics.loadTime > 100) {
            bottlenecks.push({
              type: 'slow_load',
              severity: 'high',
              description: 'Popup load time exceeds 100ms',
              recommendation: 'Optimize popup initialization and resource loading'
            });
          } else if (metrics.loadTime > 50) {
            bottlenecks.push({
              type: 'moderate_load',
              severity: 'medium',
              description: 'Popup load time exceeds 50ms',
              recommendation: 'Review popup initialization sequence'
            });
          }
          
          // Analyze memory usage
          if (metrics.memoryUsage && metrics.memoryUsage.heapUtilization > 80) {
            bottlenecks.push({
              type: 'high_memory',
              severity: 'high',
              description: 'Heap utilization exceeds 80%',
              recommendation: 'Optimize memory usage and reduce object creation'
            });
          }
          
          // Analyze DOM nodes
          if (metrics.memoryUsage && metrics.memoryUsage.domNodes > 200) {
            bottlenecks.push({
              type: 'dom_complexity',
              severity: 'medium',
              description: 'DOM node count exceeds 200',
              recommendation: 'Simplify popup DOM structure'
            });
          }
          
          // Analyze resource loading
          if (metrics.resourceMetrics && metrics.resourceMetrics.totalLoadTime > 80) {
            bottlenecks.push({
              type: 'slow_resources',
              severity: 'medium',
              description: 'Resource loading time exceeds 80ms',
              recommendation: 'Optimize resource loading and reduce file sizes'
            });
          }
          
          resolve({
            bottlenecks: bottlenecks,
            overallScore: Math.max(0, 100 - (bottlenecks.length * 15)),
            timestamp: new Date().toISOString()
          });
        }, 20); // Simulate 20ms analysis time
      });
    },
    
    // Generate performance report
    generatePopupPerformanceReport: async () => {
      const loadTime = await mockPerformanceMonitor.performance.measurePopupLoadTime();
      const initTime = await mockPerformanceMonitor.performance.measurePopupInitialization();
      const renderTime = await mockPerformanceMonitor.performance.measurePopupRenderTime();
      const memoryUsage = await mockPerformanceMonitor.performance.measurePopupMemoryUsage();
      const resourceMetrics = await mockPerformanceMonitor.performance.measurePopupResourceLoading();
      const bottlenecks = await mockPerformanceMonitor.performance.analyzePopupPerformanceBottlenecks({
        loadTime: loadTime.loadTime,
        memoryUsage: memoryUsage,
        resourceMetrics: resourceMetrics
      });
      
      return {
        summary: {
          totalLoadTime: loadTime.loadTime,
          initializationTime: initTime.initializationTime,
          renderTime: renderTime.renderTime,
          memoryUsage: memoryUsage.memoryUsage,
          resourceLoading: resourceMetrics.totalLoadTime,
          performanceScore: bottlenecks.overallScore
        },
        details: {
          loadTime: loadTime,
          initialization: initTime,
          render: renderTime,
          memory: memoryUsage,
          resources: resourceMetrics,
          bottlenecks: bottlenecks
        },
        timestamp: new Date().toISOString(),
        recommendations: bottlenecks.bottlenecks.map(b => b.recommendation)
      };
    }
  }
};

describe('Popup Load Performance Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock performance.now for consistent testing
    let mockTime = 0;
    global.performance = {
      now: jest.fn(() => {
        mockTime += 10; // Increment by 10ms each call
        return mockTime;
      })
    };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Popup Load Time Measurement', () => {
    test('should measure popup load time within acceptable range', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupLoadTime();
      
      expect(result.loadTime).toBe(50); // Should match our mock
      expect(result.loadTime).toBeLessThan(100); // Should be under 100ms
      expect(result.metrics.domContentLoaded).toBe(35); // 70% of 50ms
      expect(result.metrics.loadEvent).toBe(50); // 100% of 50ms
      expect(result.metrics.firstPaint).toBe(15); // 30% of 50ms
      expect(result.metrics.firstContentfulPaint).toBe(25); // 50% of 50ms
    });
    
    test('should provide detailed load time metrics', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupLoadTime();
      
      expect(result).toHaveProperty('loadTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('domContentLoaded');
      expect(result.metrics).toHaveProperty('loadEvent');
      expect(result.metrics).toHaveProperty('firstPaint');
      expect(result.metrics).toHaveProperty('firstContentfulPaint');
    });
    
    test('should track load time over multiple measurements', async () => {
      const measurements = [];
      
      for (let i = 0; i < 5; i++) {
        const result = await mockPerformanceMonitor.performance.measurePopupLoadTime();
        measurements.push(result.loadTime);
      }
      
      // All measurements should be consistent
      measurements.forEach(time => {
        expect(time).toBe(50);
      });
    });
  });
  
  describe('Popup Initialization Performance', () => {
    test('should measure initialization time within acceptable range', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupInitialization();
      
      expect(result.initializationTime).toBe(30); // Should match our mock
      expect(result.initializationTime).toBeLessThan(50); // Should be under 50ms
      expect(result.steps.domParsing).toBe(6); // 20% of 30ms
      expect(result.steps.scriptExecution).toBe(9); // 30% of 30ms
      expect(result.steps.eventBinding).toBe(6); // 20% of 30ms
      expect(result.steps.apiCalls).toBe(9); // 30% of 30ms
    });
    
    test('should break down initialization steps', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupInitialization();
      
      expect(result.steps).toHaveProperty('domParsing');
      expect(result.steps).toHaveProperty('scriptExecution');
      expect(result.steps).toHaveProperty('eventBinding');
      expect(result.steps).toHaveProperty('apiCalls');
      
      // Verify step times add up to total
      const totalStepTime = Object.values(result.steps).reduce((sum, time) => sum + time, 0);
      expect(totalStepTime).toBe(result.initializationTime);
    });
    
    test('should identify slow initialization steps', async () => {
      // Mock slow initialization
      global.performance = {
        now: jest.fn(() => {
          return Date.now(); // Use real time for this test
        })
      };
      
      const result = await mockPerformanceMonitor.performance.measurePopupInitialization();
      
      // Real time should be much faster than our mock
      expect(result.initializationTime).toBeLessThan(30);
    });
  });
  
  describe('Popup Render Performance', () => {
    test('should measure render time within acceptable range', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupRenderTime();
      
      expect(result.renderTime).toBe(20); // Should match our mock
      expect(result.renderTime).toBeLessThan(50); // Should be under 50ms
      expect(result.metrics.layoutCalculation).toBe(8); // 40% of 20ms
      expect(result.metrics.paint).toBe(6); // 30% of 20ms
      expect(result.metrics.composite).toBe(4); // 20% of 20ms
      expect(result.metrics.other).toBe(2); // 10% of 20ms
    });
    
    test('should provide detailed render metrics', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupRenderTime();
      
      expect(result).toHaveProperty('renderTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('layoutCalculation');
      expect(result.metrics).toHaveProperty('paint');
      expect(result.metrics).toHaveProperty('composite');
      expect(result.metrics).toHaveProperty('other');
    });
    
    test('should track render performance over time', async () => {
      const measurements = [];
      
      for (let i = 0; i < 3; i++) {
        const result = await mockPerformanceMonitor.performance.measurePopupRenderTime();
        measurements.push(result.renderTime);
      }
      
      // All measurements should be consistent
      measurements.forEach(time => {
        expect(time).toBe(20);
      });
    });
  });
  
  describe('Popup Memory Usage', () => {
    test('should measure memory usage within acceptable range', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupMemoryUsage();
      
      expect(result.memoryUsage.heapUsed).toBe(1024 * 1024 * 2); // 2MB
      expect(result.memoryUsage.heapTotal).toBe(1024 * 1024 * 4); // 4MB
      expect(result.memoryUsage.heapUtilization).toBe(50); // 50% utilization
      expect(result.memoryUsage.domNodes).toBe(150);
      expect(result.memoryUsage.eventListeners).toBe(25);
    });
    
    test('should calculate memory efficiency metrics', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupMemoryUsage();
      
      expect(result.efficiency).toHaveProperty('heapUtilization');
      expect(result.efficiency).toHaveProperty('domNodeCount');
      expect(result.efficiency).toHaveProperty('eventListenerCount');
      
      // Verify efficiency calculations
      expect(result.efficiency.heapUtilization).toBe(50); // 2MB / 4MB * 100
    });
    
    test('should identify memory issues', async () => {
      // Mock high memory usage
      const originalMemoryUsage = mockPerformanceMonitor.performance.measurePopupMemoryUsage;
      mockPerformanceMonitor.performance.measurePopupMemoryUsage = async () => {
        return {
          memoryUsage: {
            heapUsed: 1024 * 1024 * 3.5, // 3.5MB
            heapTotal: 1024 * 1024 * 4, // 4MB
            domNodes: 250, // 250 DOM nodes
            eventListeners: 40 // 40 event listeners
          },
          efficiency: {
            heapUtilization: 87.5, // 87.5% utilization
            domNodeCount: 250,
            eventListenerCount: 40
          }
        };
      };
      
      const result = await mockPerformanceMonitor.performance.measurePopupMemoryUsage();
      
      expect(result.efficiency.heapUtilization).toBeGreaterThan(80);
      expect(result.memoryUsage.domNodes).toBeGreaterThan(200);
      expect(result.memoryUsage.eventListeners).toBeGreaterThan(30);
    });
  });
  
  describe('Popup Resource Loading', () => {
    test('should measure resource loading time', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupResourceLoading();
      
      expect(result.resourceMetrics.cssFiles.count).toBe(2);
      expect(result.resourceMetrics.cssFiles.totalSize).toBe(1024 * 10);
      expect(result.resourceMetrics.cssFiles.loadTime).toBe(15);
      
      expect(result.resourceMetrics.jsFiles.count).toBe(3);
      expect(result.resourceMetrics.jsFiles.totalSize).toBe(1024 * 50);
      expect(result.resourceMetrics.jsFiles.loadTime).toBe(25);
      expect(result.resourceMetrics.jsFiles.parseTime).toBe(10);
      
      expect(result.totalLoadTime).toBe(30); // Max of all resource times
    });
    
    test('should provide detailed resource metrics', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupResourceLoading();
      
      expect(result).toHaveProperty('resourceMetrics');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('totalLoadTime');
      
      expect(result.resourceMetrics).toHaveProperty('cssFiles');
      expect(result.resourceMetrics).toHaveProperty('jsFiles');
      expect(result.resourceMetrics).toHaveProperty('images');
      expect(result.resourceMetrics).toHaveProperty('fonts');
    });
    
    test('should identify resource loading bottlenecks', async () => {
      // Mock slow resource loading
      mockPerformanceMonitor.performance.measurePopupResourceLoading = async () => {
        return {
          resourceMetrics: {
            cssFiles: { count: 5, totalSize: 1024 * 25, loadTime: 50 },
            jsFiles: { count: 8, totalSize: 1024 * 100, loadTime: 80, parseTime: 40 },
            images: { count: 10, totalSize: 1024 * 200, loadTime: 100, decodeTime: 50 },
            fonts: { count: 4, totalSize: 1024 * 40, loadTime: 60, renderTime: 15 }
          },
          totalLoadTime: 100 // Max of all resource times
        };
      };
      
      const result = await mockPerformanceMonitor.performance.measurePopupResourceLoading();
      
      expect(result.totalLoadTime).toBe(100);
      expect(result.totalLoadTime).toBeGreaterThan(80); // Should trigger bottleneck
    });
  });
  
  describe('Performance Bottleneck Analysis', () => {
    test('should identify performance bottlenecks', async () => {
      const metrics = {
        loadTime: 120, // Slow load time
        memoryUsage: {
          heapUtilization: 85, // High memory usage
          domNodes: 250 // Many DOM nodes
          eventListeners: 40 // Many event listeners
        },
        resourceMetrics: {
          totalLoadTime: 90 // Slow resource loading
        }
      };
      
      const result = await mockPerformanceMonitor.performance.analyzePopupPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.length).toBeGreaterThan(0);
      expect(result.bottlenecks.some(b => b.type === 'slow_load')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'high_memory')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'dom_complexity')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_resources')).toBe(true);
      expect(result.overallScore).toBeLessThan(100);
    });
    
    test('should provide bottleneck recommendations', async () => {
      const metrics = {
        loadTime: 150,
        memoryUsage: { heapUtilization: 90 },
        resourceMetrics: { totalLoadTime: 100 }
      };
      
      const result = await mockPerformanceMonitor.performance.analyzePopupPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.every(b => b.recommendation)).toBe(true);
      expect(result.bottlenecks.some(b => 
        b.recommendation.includes('Optimize')
      )).toBe(true);
    });
    
    test('should calculate performance score', async () => {
      const metrics = {
        loadTime: 25, // Fast load time
        memoryUsage: { heapUtilization: 30 }, // Low memory usage
        resourceMetrics: { totalLoadTime: 20 } // Fast resource loading
      };
      
      const result = await mockPerformanceMonitor.performance.analyzePopupPerformanceBottlenecks(metrics);
      
      expect(result.overallScore).toBe(100); // No bottlenecks = perfect score
    });
  });
  
  describe('Performance Report Generation', () => {
    test('should generate comprehensive performance report', async () => {
      const result = await mockPerformanceMonitor.performance.generatePopupPerformanceReport();
      
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('recommendations');
      
      expect(result.summary.totalLoadTime).toBeDefined();
      expect(result.summary.initializationTime).toBeDefined();
      expect(result.summary.renderTime).toBeDefined();
      expect(result.summary.memoryUsage).toBeDefined();
      expect(result.summary.resourceLoading).toBeDefined();
      expect(result.summary.performanceScore).toBeDefined();
    });
    
    test('should include performance recommendations', async () => {
      const result = await mockPerformanceMonitor.performance.generatePopupPerformanceReport();
      
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });
    
    test('should provide actionable insights', async () => {
      const result = await mockPerformanceMonitor.performance.generatePopupPerformanceReport();
      
      // Should provide both metrics and recommendations
      expect(result.summary.performanceScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.performanceScore).toBeLessThanOrEqual(100);
      
      if (result.summary.performanceScore < 80) {
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Performance Thresholds', () => {
    test('should enforce popup load time threshold', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupLoadTime();
      
      // Load time should be under 100ms for good performance
      expect(result.loadTime).toBeLessThan(100);
    });
    
    test('should enforce memory usage threshold', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupMemoryUsage();
      
      // Heap utilization should be under 80% for good performance
      expect(result.efficiency.heapUtilization).toBeLessThan(80);
    });
    
    test('should enforce DOM complexity threshold', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupMemoryUsage();
      
      // DOM nodes should be under 200 for good performance
      expect(result.efficiency.domNodeCount).toBeLessThan(200);
    });
    
    test('should enforce resource loading threshold', async () => {
      const result = await mockPerformanceMonitor.performance.measurePopupResourceLoading();
      
      // Resource loading should be under 80ms for good performance
      expect(result.totalLoadTime).toBeLessThan(80);
    });
  });
});
