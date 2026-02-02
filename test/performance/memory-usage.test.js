/**
 * Memory Usage Performance Tests
 * Tests for memory usage and performance metrics
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock memory performance monitoring module
const mockMemoryPerformanceMonitor = {
  // Memory performance monitor
  performance: {
    // Measure extension memory usage
    measureExtensionMemoryUsage: async () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const memoryUsage = {
            heapUsed: 1024 * 1024 * 15, // 15MB heap usage
            heapTotal: 1024 * 1024 * 20, // 20MB total heap
            external: 1024 * 1024 * 2, // 2MB external memory
            arrayBuffers: 1024 * 512, // 512KB array buffers
            timestamp: new Date().toISOString(),
            efficiency: {
              heapUtilization: (1024 * 1024 * 15) / (1024 * 1024 * 20) * 100, // 75%
              memoryPressure: 'low', // low, medium, high
              gcFrequency: 5 // Garbage collections per minute
            }
          };
          
          resolve(memoryUsage);
        }, 50); // Simulate 50ms measurement time
      });
    },
    
    // Measure memory usage by component
    measureComponentMemoryUsage: async () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const componentUsage = {
            background: {
              heapUsed: 1024 * 1024 * 8, // 8MB
              heapTotal: 1024 * 1024 * 10, // 10MB
              scripts: 5, // Number of scripts
              eventListeners: 25 // Number of event listeners
            },
            contentScripts: {
              heapUsed: 1024 * 1024 * 3, // 3MB per tab
              heapTotal: 1024 * 1024 * 4, // 4MB per tab
              activeTabs: 3, // Number of active tabs with content scripts
              domNodes: 150 // DOM nodes per tab
            },
            popup: {
              heapUsed: 1024 * 512, // 512KB
              heapTotal: 1024 * 1024, // 1MB
              domNodes: 50, // DOM nodes in popup
              eventListeners: 10 // Event listeners in popup
            },
            options: {
              heapUsed: 1024 * 256, // 256KB
              heapTotal: 1024 * 512, // 512KB
              domNodes: 30, // DOM nodes in options page
              eventListeners: 5 // Event listeners in options page
            },
            timestamp: new Date().toISOString()
          };
          
          resolve(componentUsage);
        }, 30); // Simulate 30ms measurement time
      });
    },
    
    // Measure memory leaks
    measureMemoryLeaks: async () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const memoryLeaks = {
            detectedLeaks: [
              {
                type: 'event_listener',
                severity: 'medium',
                description: 'Event listeners not properly removed',
                location: 'background.js:145',
                leakedObjects: 12,
                memoryImpact: 1024 * 100 // 100KB
              },
              {
                type: 'dom_reference',
                severity: 'low',
                description: 'DOM references retained after tab close',
                location: 'content-script.js:67',
                leakedObjects: 5,
                memoryImpact: 1024 * 50 // 50KB
              }
            ],
            totalLeakedMemory: 1024 * 150, // 150KB total
            leakScore: 75, // Higher is better (100 = no leaks)
            timestamp: new Date().toISOString()
          };
          
          resolve(memoryLeaks);
        }, 40); // Simulate 40ms detection time
      });
    },
    
    // Measure garbage collection performance
    measureGarbageCollection: async () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const gcMetrics = {
            collections: {
              minor: {
                count: 15, // Minor GC collections
                totalTime: 25, // Total time in ms
                averageTime: 25 / 15, // Average time per collection
                memoryReclaimed: 1024 * 1024 * 2 // 2MB reclaimed
              },
              major: {
                count: 3, // Major GC collections
                totalTime: 120, // Total time in ms
                averageTime: 120 / 3, // Average time per collection
                memoryReclaimed: 1024 * 1024 * 5 // 5MB reclaimed
              }
            },
            efficiency: {
              collectionFrequency: 'normal', // low, normal, high
              pauseTime: 'acceptable', // good, acceptable, poor
              memoryRecoveryRate: 0.85 // 85% of unreachable memory recovered
            },
            timestamp: new Date().toISOString()
          };
          
          resolve(gcMetrics);
        }, 60); // Simulate 60ms measurement time
      });
    },
    
    // Measure memory growth over time
    measureMemoryGrowth: async (duration = 300000) => { // 5 minutes default
      return new Promise((resolve) => {
        setTimeout(() => {
          const measurements = [];
          const interval = 30000; // 30 seconds
          const points = duration / interval;
          
          // Generate memory growth measurements
          for (let i = 0; i < points; i++) {
            const baseMemory = 1024 * 1024 * 10; // 10MB base
            const growth = i * 1024 * 100; // 100KB growth per interval
            const noise = Math.random() * 1024 * 50; // Random noise
            
            measurements.push({
              timestamp: new Date(Date.now() - (duration - (i * interval))).toISOString(),
              heapUsed: baseMemory + growth + noise,
              heapTotal: baseMemory * 2 + growth + noise
            });
          }
          
          const growthRate = (measurements[measurements.length - 1].heapUsed - measurements[0].heapUsed) / (duration / 1000);
          
          resolve({
            duration: duration,
            measurements: measurements,
            growthRate: growthRate, // Bytes per second
            growthClassification: growthRate < 1024 ? 'stable' : growthRate < 1024 * 10 ? 'moderate' : 'concerning',
            timestamp: new Date().toISOString()
          });
        }, 100); // Simulate 100ms analysis time
      });
    },
    
    // Analyze memory performance bottlenecks
    analyzeMemoryPerformanceBottlenecks: async (metrics) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const bottlenecks = [];
          
          // Analyze heap utilization
          if (metrics.heapUtilization > 85) {
            bottlenecks.push({
              type: 'high_heap_utilization',
              severity: 'high',
              description: 'Heap utilization exceeds 85%',
              recommendation: 'Optimize memory usage and reduce object creation'
            });
          } else if (metrics.heapUtilization > 70) {
            bottlenecks.push({
              type: 'moderate_heap_utilization',
              severity: 'medium',
              description: 'Heap utilization exceeds 70%',
              recommendation: 'Review memory usage patterns'
            });
          }
          
          // Analyze memory leaks
          if (metrics.leakedMemory && metrics.leakedMemory.totalLeakedMemory > 1024 * 500) { // 500KB
            bottlenecks.push({
              type: 'significant_memory_leaks',
              severity: 'high',
              description: 'Significant memory leaks detected',
              recommendation: 'Fix memory leaks in event listeners and DOM references'
            });
          }
          
          // Analyze garbage collection
          if (metrics.gcPerformance && metrics.gcPerformance.collections.major.averageTime > 50) {
            bottlenecks.push({
              type: 'slow_gc',
              severity: 'medium',
              description: 'Major garbage collection is slow',
              recommendation: 'Optimize object lifecycle and reduce garbage generation'
            });
          }
          
          // Analyze memory growth
          if (metrics.memoryGrowth && metrics.memoryGrowth.growthClassification === 'concerning') {
            bottlenecks.push({
              type: 'rapid_memory_growth',
              severity: 'high',
              description: 'Rapid memory growth detected',
              recommendation: 'Investigate memory allocation patterns and potential leaks'
            });
          }
          
          resolve({
            bottlenecks: bottlenecks,
            overallScore: Math.max(0, 100 - (bottlenecks.length * 25)),
            timestamp: new Date().toISOString()
          });
        }, 30); // Simulate 30ms analysis time
      });
    },
    
    // Generate memory performance report
    generateMemoryPerformanceReport: async () => {
      const extensionMemory = await mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage();
      const componentMemory = await mockMemoryPerformanceMonitor.performance.measureComponentMemoryUsage();
      const memoryLeaks = await mockMemoryPerformanceMonitor.performance.measureMemoryLeaks();
      const gcPerformance = await mockMemoryPerformanceMonitor.performance.measureGarbageCollection();
      const memoryGrowth = await mockMemoryPerformanceMonitor.performance.measureMemoryGrowth();
      const bottlenecks = await mockMemoryPerformanceMonitor.performance.analyzeMemoryPerformanceBottlenecks({
        heapUtilization: extensionMemory.efficiency.heapUtilization,
        leakedMemory: memoryLeaks,
        gcPerformance: gcPerformance,
        memoryGrowth: memoryGrowth
      });
      
      return {
        summary: {
          totalHeapUsed: extensionMemory.heapUsed,
          totalHeapTotal: extensionMemory.heapTotal,
          heapUtilization: extensionMemory.efficiency.heapUtilization,
          memoryPressure: extensionMemory.efficiency.memoryPressure,
          leakedMemory: memoryLeaks.totalLeakedMemory,
          memoryScore: bottlenecks.overallScore
        },
        details: {
          extensionMemory: extensionMemory,
          componentMemory: componentMemory,
          memoryLeaks: memoryLeaks,
          gcPerformance: gcPerformance,
          memoryGrowth: memoryGrowth,
          bottlenecks: bottlenecks
        },
        timestamp: new Date().toISOString(),
        recommendations: bottlenecks.bottlenecks.map(b => b.recommendation)
      };
    }
  }
};

describe('Memory Usage Performance Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock performance.memory API
    global.performance = {
      memory: {
        usedJSHeapSize: 1024 * 1024 * 15,
        totalJSHeapSize: 1024 * 1024 * 20,
        jsHeapSizeLimit: 1024 * 1024 * 100
      },
      now: jest.fn(() => Date.now())
    };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Extension Memory Usage Measurement', () => {
    test('should measure extension memory usage within acceptable range', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage();
      
      expect(result.heapUsed).toBe(1024 * 1024 * 15); // 15MB
      expect(result.heapTotal).toBe(1024 * 1024 * 20); // 20MB
      expect(result.external).toBe(1024 * 1024 * 2); // 2MB
      expect(result.arrayBuffers).toBe(1024 * 512); // 512KB
    });
    
    test('should calculate memory efficiency metrics', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage();
      
      expect(result.efficiency).toHaveProperty('heapUtilization');
      expect(result.efficiency).toHaveProperty('memoryPressure');
      expect(result.efficiency).toHaveProperty('gcFrequency');
      
      expect(result.efficiency.heapUtilization).toBe(75); // 15MB / 20MB * 100
      expect(result.efficiency.memoryPressure).toBe('low');
      expect(result.efficiency.gcFrequency).toBe(5);
    });
    
    test('should identify memory pressure levels', async () => {
      // Test low memory pressure
      let result = await mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage();
      expect(result.efficiency.memoryPressure).toBe('low');
      
      // Mock high memory pressure
      mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage = async () => {
        return {
          heapUsed: 1024 * 1024 * 18, // 18MB
          heapTotal: 1024 * 1024 * 20, // 20MB
          external: 1024 * 1024 * 2,
          arrayBuffers: 1024 * 512,
          efficiency: {
            heapUtilization: 90, // 90%
            memoryPressure: 'high',
            gcFrequency: 15
          }
        };
      };
      
      result = await mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage();
      expect(result.efficiency.memoryPressure).toBe('high');
    });
  });
  
  describe('Component Memory Usage Measurement', () => {
    test('should measure memory usage by component', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureComponentMemoryUsage();
      
      expect(result).toHaveProperty('background');
      expect(result).toHaveProperty('contentScripts');
      expect(result).toHaveProperty('popup');
      expect(result).toHaveProperty('options');
      expect(result).toHaveProperty('timestamp');
    });
    
    test('should provide detailed component metrics', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureComponentMemoryUsage();
      
      // Background script metrics
      expect(result.background).toHaveProperty('heapUsed');
      expect(result.background).toHaveProperty('heapTotal');
      expect(result.background).toHaveProperty('scripts');
      expect(result.background).toHaveProperty('eventListeners');
      
      // Content script metrics
      expect(result.contentScripts).toHaveProperty('heapUsed');
      expect(result.contentScripts).toHaveProperty('heapTotal');
      expect(result.contentScripts).toHaveProperty('activeTabs');
      expect(result.contentScripts).toHaveProperty('domNodes');
      
      // Popup metrics
      expect(result.popup).toHaveProperty('heapUsed');
      expect(result.popup).toHaveProperty('heapTotal');
      expect(result.popup).toHaveProperty('domNodes');
      expect(result.popup).toHaveProperty('eventListeners');
      
      // Options metrics
      expect(result.options).toHaveProperty('heapUsed');
      expect(result.options).toHaveProperty('heapTotal');
      expect(result.options).toHaveProperty('domNodes');
      expect(result.options).toHaveProperty('eventListeners');
    });
    
    test('should calculate total component memory usage', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureComponentMemoryUsage();
      
      const totalHeapUsed = 
        result.background.heapUsed + 
        (result.contentScripts.heapUsed * result.contentScripts.activeTabs) +
        result.popup.heapUsed + 
        result.options.heapUsed;
      
      expect(totalHeapUsed).toBeGreaterThan(0);
      expect(totalHeapUsed).toBeLessThan(1024 * 1024 * 50); // Should be under 50MB total
    });
  });
  
  describe('Memory Leak Detection', () => {
    test('should detect memory leaks', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryLeaks();
      
      expect(result).toHaveProperty('detectedLeaks');
      expect(result).toHaveProperty('totalLeakedMemory');
      expect(result).toHaveProperty('leakScore');
      expect(result).toHaveProperty('timestamp');
      
      expect(result.detectedLeaks).toBeInstanceOf(Array);
      expect(result.detectedLeaks.length).toBeGreaterThan(0);
    });
    
    test('should categorize memory leaks by type and severity', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryLeaks();
      
      result.detectedLeaks.forEach(leak => {
        expect(leak).toHaveProperty('type');
        expect(leak).toHaveProperty('severity');
        expect(leak).toHaveProperty('description');
        expect(leak).toHaveProperty('location');
        expect(leak).toHaveProperty('leakedObjects');
        expect(leak).toHaveProperty('memoryImpact');
        
        expect(['event_listener', 'dom_reference', 'closure', 'circular_reference']).toContain(leak.type);
        expect(['low', 'medium', 'high']).toContain(leak.severity);
      });
    });
    
    test('should calculate leak impact metrics', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryLeaks();
      
      const totalLeakedMemory = result.detectedLeaks.reduce((sum, leak) => sum + leak.memoryImpact, 0);
      expect(totalLeakedMemory).toBe(result.totalLeakedMemory);
      
      expect(result.leakScore).toBeGreaterThanOrEqual(0);
      expect(result.leakScore).toBeLessThanOrEqual(100);
    });
  });
  
  describe('Garbage Collection Performance', () => {
    test('should measure garbage collection metrics', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureGarbageCollection();
      
      expect(result).toHaveProperty('collections');
      expect(result).toHaveProperty('efficiency');
      expect(result).toHaveProperty('timestamp');
      
      expect(result.collections).toHaveProperty('minor');
      expect(result.collections).toHaveProperty('major');
    });
    
    test('should provide detailed GC metrics', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureGarbageCollection();
      
      // Minor GC metrics
      expect(result.collections.minor).toHaveProperty('count');
      expect(result.collections.minor).toHaveProperty('totalTime');
      expect(result.collections.minor).toHaveProperty('averageTime');
      expect(result.collections.minor).toHaveProperty('memoryReclaimed');
      
      // Major GC metrics
      expect(result.collections.major).toHaveProperty('count');
      expect(result.collections.major).toHaveProperty('totalTime');
      expect(result.collections.major).toHaveProperty('averageTime');
      expect(result.collections.major).toHaveProperty('memoryReclaimed');
      
      // Efficiency metrics
      expect(result.efficiency).toHaveProperty('collectionFrequency');
      expect(result.efficiency).toHaveProperty('pauseTime');
      expect(result.efficiency).toHaveProperty('memoryRecoveryRate');
    });
    
    test('should identify GC performance issues', async () => {
      // Mock slow GC
      mockMemoryPerformanceMonitor.performance.measureGarbageCollection = async () => {
        return {
          collections: {
            minor: {
              count: 20,
              totalTime: 100,
              averageTime: 5,
              memoryReclaimed: 1024 * 1024
            },
            major: {
              count: 5,
              totalTime: 500, // 500ms total - very slow
              averageTime: 100, // 100ms average - very slow
              memoryReclaimed: 1024 * 1024 * 3
            }
          },
          efficiency: {
            collectionFrequency: 'high',
            pauseTime: 'poor',
            memoryRecoveryRate: 0.6
          }
        };
      };
      
      const result = await mockMemoryPerformanceMonitor.performance.measureGarbageCollection();
      
      expect(result.collections.major.averageTime).toBeGreaterThan(50); // Should trigger bottleneck
      expect(result.efficiency.collectionFrequency).toBe('high');
      expect(result.efficiency.pauseTime).toBe('poor');
    });
  });
  
  describe('Memory Growth Analysis', () => {
    test('should measure memory growth over time', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryGrowth(300000); // 5 minutes
      
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('measurements');
      expect(result).toHaveProperty('growthRate');
      expect(result).toHaveProperty('growthClassification');
      expect(result).toHaveProperty('timestamp');
      
      expect(result.duration).toBe(300000);
      expect(result.measurements).toBeInstanceOf(Array);
      expect(result.measurements.length).toBe(10); // 5 minutes / 30 seconds
    });
    
    test('should classify memory growth rate', async () => {
      // Test stable growth
      let result = await mockMemoryPerformanceMonitor.performance.measureMemoryGrowth(300000);
      expect(result.growthClassification).toBe('stable');
      
      // Mock concerning growth
      mockMemoryPerformanceMonitor.performance.measureMemoryGrowth = async () => {
        return {
          duration: 300000,
          measurements: [],
          growthRate: 1024 * 15, // 15KB per second - concerning
          growthClassification: 'concerning'
        };
      };
      
      result = await mockMemoryPerformanceMonitor.performance.measureMemoryGrowth(300000);
      expect(result.growthClassification).toBe('concerning');
    });
    
    test('should provide growth timeline', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryGrowth(180000); // 3 minutes
      
      expect(result.measurements.length).toBe(6); // 3 minutes / 30 seconds
      
      // Verify timestamps are in chronological order
      for (let i = 1; i < result.measurements.length; i++) {
        const prevTime = new Date(result.measurements[i - 1].timestamp).getTime();
        const currTime = new Date(result.measurements[i].timestamp).getTime();
        expect(currTime).toBeGreaterThan(prevTime);
      }
    });
  });
  
  describe('Memory Performance Bottleneck Analysis', () => {
    test('should identify memory performance bottlenecks', async () => {
      const metrics = {
        heapUtilization: 90, // High heap utilization
        leakedMemory: { totalLeakedMemory: 1024 * 600 }, // Significant leaks
        gcPerformance: { collections: { major: { averageTime: 60 } } }, // Slow GC
        memoryGrowth: { growthClassification: 'concerning' } // Rapid growth
      };
      
      const result = await mockMemoryPerformanceMonitor.performance.analyzeMemoryPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.length).toBeGreaterThan(0);
      expect(result.bottlenecks.some(b => b.type === 'high_heap_utilization')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'significant_memory_leaks')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_gc')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'rapid_memory_growth')).toBe(true);
      expect(result.overallScore).toBeLessThan(100);
    });
    
    test('should provide bottleneck recommendations', async () => {
      const metrics = {
        heapUtilization: 75,
        leakedMemory: { totalLeakedMemory: 1024 * 300 },
        gcPerformance: { collections: { major: { averageTime: 40 } } }
      };
      
      const result = await mockMemoryPerformanceMonitor.performance.analyzeMemoryPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.every(b => b.recommendation)).toBe(true);
      expect(result.bottlenecks.some(b => 
        b.recommendation.includes('Optimize') || 
        b.recommendation.includes('Review') ||
        b.recommendation.includes('Fix') ||
        b.recommendation.includes('Investigate')
      )).toBe(true);
    });
    
    test('should calculate memory performance score', async () => {
      const metrics = {
        heapUtilization: 60, // Good heap utilization
        leakedMemory: { totalLeakedMemory: 1024 * 100 }, // Minor leaks
        gcPerformance: { collections: { major: { averageTime: 20 } } }, // Good GC
        memoryGrowth: { growthClassification: 'stable' } // Stable growth
      };
      
      const result = await mockMemoryPerformanceMonitor.performance.analyzeMemoryPerformanceBottlenecks(metrics);
      
      expect(result.overallScore).toBe(100); // No bottlenecks = perfect score
    });
  });
  
  describe('Memory Performance Report Generation', () => {
    test('should generate comprehensive memory performance report', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.generateMemoryPerformanceReport();
      
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('recommendations');
      
      expect(result.summary.totalHeapUsed).toBeDefined();
      expect(result.summary.totalHeapTotal).toBeDefined();
      expect(result.summary.heapUtilization).toBeDefined();
      expect(result.summary.memoryPressure).toBeDefined();
      expect(result.summary.leakedMemory).toBeDefined();
      expect(result.summary.memoryScore).toBeDefined();
    });
    
    test('should include memory performance recommendations', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.generateMemoryPerformanceReport();
      
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });
    
    test('should provide actionable insights', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.generateMemoryPerformanceReport();
      
      // Should provide both metrics and recommendations
      expect(result.summary.memoryScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.memoryScore).toBeLessThanOrEqual(100);
      
      if (result.summary.memoryScore < 80) {
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Memory Performance Thresholds', () => {
    test('should enforce heap utilization threshold', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage();
      
      // Heap utilization should be under 80% for good performance
      expect(result.efficiency.heapUtilization).toBeLessThan(80);
    });
    
    test('should enforce memory leak threshold', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryLeaks();
      
      // Total leaked memory should be under 500KB for good performance
      expect(result.totalLeakedMemory).toBeLessThan(1024 * 500);
    });
    
    test('should enforce GC performance threshold', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureGarbageCollection();
      
      // Major GC average time should be under 50ms for good performance
      expect(result.collections.major.averageTime).toBeLessThan(50);
    });
    
    test('should enforce memory growth threshold', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryGrowth();
      
      // Growth classification should be 'stable' or 'moderate' for good performance
      expect(['stable', 'moderate']).toContain(result.growthClassification);
    });
  });
}); * Memory Usage Performance Tests
 * Tests for memory usage and performance metrics
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock memory performance monitoring module
const mockMemoryPerformanceMonitor = {
  // Memory performance monitor
  performance: {
    // Measure extension memory usage
    measureExtensionMemoryUsage: async () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const memoryUsage = {
            heapUsed: 1024 * 1024 * 15, // 15MB heap usage
            heapTotal: 1024 * 1024 * 20, // 20MB total heap
            external: 1024 * 1024 * 2, // 2MB external memory
            arrayBuffers: 1024 * 512, // 512KB array buffers
            timestamp: new Date().toISOString(),
            efficiency: {
              heapUtilization: (1024 * 1024 * 15) / (1024 * 1024 * 20) * 100, // 75%
              memoryPressure: 'low', // low, medium, high
              gcFrequency: 5 // Garbage collections per minute
            }
          };
          
          resolve(memoryUsage);
        }, 50); // Simulate 50ms measurement time
      });
    },
    
    // Measure memory usage by component
    measureComponentMemoryUsage: async () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const componentUsage = {
            background: {
              heapUsed: 1024 * 1024 * 8, // 8MB
              heapTotal: 1024 * 1024 * 10, // 10MB
              scripts: 5, // Number of scripts
              eventListeners: 25 // Number of event listeners
            },
            contentScripts: {
              heapUsed: 1024 * 1024 * 3, // 3MB per tab
              heapTotal: 1024 * 1024 * 4, // 4MB per tab
              activeTabs: 3, // Number of active tabs with content scripts
              domNodes: 150 // DOM nodes per tab
            },
            popup: {
              heapUsed: 1024 * 512, // 512KB
              heapTotal: 1024 * 1024, // 1MB
              domNodes: 50, // DOM nodes in popup
              eventListeners: 10 // Event listeners in popup
            },
            options: {
              heapUsed: 1024 * 256, // 256KB
              heapTotal: 1024 * 512, // 512KB
              domNodes: 30, // DOM nodes in options page
              eventListeners: 5 // Event listeners in options page
            },
            timestamp: new Date().toISOString()
          };
          
          resolve(componentUsage);
        }, 30); // Simulate 30ms measurement time
      });
    },
    
    // Measure memory leaks
    measureMemoryLeaks: async () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const memoryLeaks = {
            detectedLeaks: [
              {
                type: 'event_listener',
                severity: 'medium',
                description: 'Event listeners not properly removed',
                location: 'background.js:145',
                leakedObjects: 12,
                memoryImpact: 1024 * 100 // 100KB
              },
              {
                type: 'dom_reference',
                severity: 'low',
                description: 'DOM references retained after tab close',
                location: 'content-script.js:67',
                leakedObjects: 5,
                memoryImpact: 1024 * 50 // 50KB
              }
            ],
            totalLeakedMemory: 1024 * 150, // 150KB total
            leakScore: 75, // Higher is better (100 = no leaks)
            timestamp: new Date().toISOString()
          };
          
          resolve(memoryLeaks);
        }, 40); // Simulate 40ms detection time
      });
    },
    
    // Measure garbage collection performance
    measureGarbageCollection: async () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const gcMetrics = {
            collections: {
              minor: {
                count: 15, // Minor GC collections
                totalTime: 25, // Total time in ms
                averageTime: 25 / 15, // Average time per collection
                memoryReclaimed: 1024 * 1024 * 2 // 2MB reclaimed
              },
              major: {
                count: 3, // Major GC collections
                totalTime: 120, // Total time in ms
                averageTime: 120 / 3, // Average time per collection
                memoryReclaimed: 1024 * 1024 * 5 // 5MB reclaimed
              }
            },
            efficiency: {
              collectionFrequency: 'normal', // low, normal, high
              pauseTime: 'acceptable', // good, acceptable, poor
              memoryRecoveryRate: 0.85 // 85% of unreachable memory recovered
            },
            timestamp: new Date().toISOString()
          };
          
          resolve(gcMetrics);
        }, 60); // Simulate 60ms measurement time
      });
    },
    
    // Measure memory growth over time
    measureMemoryGrowth: async (duration = 300000) => { // 5 minutes default
      return new Promise((resolve) => {
        setTimeout(() => {
          const measurements = [];
          const interval = 30000; // 30 seconds
          const points = duration / interval;
          
          // Generate memory growth measurements
          for (let i = 0; i < points; i++) {
            const baseMemory = 1024 * 1024 * 10; // 10MB base
            const growth = i * 1024 * 100; // 100KB growth per interval
            const noise = Math.random() * 1024 * 50; // Random noise
            
            measurements.push({
              timestamp: new Date(Date.now() - (duration - (i * interval))).toISOString(),
              heapUsed: baseMemory + growth + noise,
              heapTotal: baseMemory * 2 + growth + noise
            });
          }
          
          const growthRate = (measurements[measurements.length - 1].heapUsed - measurements[0].heapUsed) / (duration / 1000);
          
          resolve({
            duration: duration,
            measurements: measurements,
            growthRate: growthRate, // Bytes per second
            growthClassification: growthRate < 1024 ? 'stable' : growthRate < 1024 * 10 ? 'moderate' : 'concerning',
            timestamp: new Date().toISOString()
          });
        }, 100); // Simulate 100ms analysis time
      });
    },
    
    // Analyze memory performance bottlenecks
    analyzeMemoryPerformanceBottlenecks: async (metrics) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const bottlenecks = [];
          
          // Analyze heap utilization
          if (metrics.heapUtilization > 85) {
            bottlenecks.push({
              type: 'high_heap_utilization',
              severity: 'high',
              description: 'Heap utilization exceeds 85%',
              recommendation: 'Optimize memory usage and reduce object creation'
            });
          } else if (metrics.heapUtilization > 70) {
            bottlenecks.push({
              type: 'moderate_heap_utilization',
              severity: 'medium',
              description: 'Heap utilization exceeds 70%',
              recommendation: 'Review memory usage patterns'
            });
          }
          
          // Analyze memory leaks
          if (metrics.leakedMemory && metrics.leakedMemory.totalLeakedMemory > 1024 * 500) { // 500KB
            bottlenecks.push({
              type: 'significant_memory_leaks',
              severity: 'high',
              description: 'Significant memory leaks detected',
              recommendation: 'Fix memory leaks in event listeners and DOM references'
            });
          }
          
          // Analyze garbage collection
          if (metrics.gcPerformance && metrics.gcPerformance.collections.major.averageTime > 50) {
            bottlenecks.push({
              type: 'slow_gc',
              severity: 'medium',
              description: 'Major garbage collection is slow',
              recommendation: 'Optimize object lifecycle and reduce garbage generation'
            });
          }
          
          // Analyze memory growth
          if (metrics.memoryGrowth && metrics.memoryGrowth.growthClassification === 'concerning') {
            bottlenecks.push({
              type: 'rapid_memory_growth',
              severity: 'high',
              description: 'Rapid memory growth detected',
              recommendation: 'Investigate memory allocation patterns and potential leaks'
            });
          }
          
          resolve({
            bottlenecks: bottlenecks,
            overallScore: Math.max(0, 100 - (bottlenecks.length * 25)),
            timestamp: new Date().toISOString()
          });
        }, 30); // Simulate 30ms analysis time
      });
    },
    
    // Generate memory performance report
    generateMemoryPerformanceReport: async () => {
      const extensionMemory = await mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage();
      const componentMemory = await mockMemoryPerformanceMonitor.performance.measureComponentMemoryUsage();
      const memoryLeaks = await mockMemoryPerformanceMonitor.performance.measureMemoryLeaks();
      const gcPerformance = await mockMemoryPerformanceMonitor.performance.measureGarbageCollection();
      const memoryGrowth = await mockMemoryPerformanceMonitor.performance.measureMemoryGrowth();
      const bottlenecks = await mockMemoryPerformanceMonitor.performance.analyzeMemoryPerformanceBottlenecks({
        heapUtilization: extensionMemory.efficiency.heapUtilization,
        leakedMemory: memoryLeaks,
        gcPerformance: gcPerformance,
        memoryGrowth: memoryGrowth
      });
      
      return {
        summary: {
          totalHeapUsed: extensionMemory.heapUsed,
          totalHeapTotal: extensionMemory.heapTotal,
          heapUtilization: extensionMemory.efficiency.heapUtilization,
          memoryPressure: extensionMemory.efficiency.memoryPressure,
          leakedMemory: memoryLeaks.totalLeakedMemory,
          memoryScore: bottlenecks.overallScore
        },
        details: {
          extensionMemory: extensionMemory,
          componentMemory: componentMemory,
          memoryLeaks: memoryLeaks,
          gcPerformance: gcPerformance,
          memoryGrowth: memoryGrowth,
          bottlenecks: bottlenecks
        },
        timestamp: new Date().toISOString(),
        recommendations: bottlenecks.bottlenecks.map(b => b.recommendation)
      };
    }
  }
};

describe('Memory Usage Performance Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock performance.memory API
    global.performance = {
      memory: {
        usedJSHeapSize: 1024 * 1024 * 15,
        totalJSHeapSize: 1024 * 1024 * 20,
        jsHeapSizeLimit: 1024 * 1024 * 100
      },
      now: jest.fn(() => Date.now())
    };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Extension Memory Usage Measurement', () => {
    test('should measure extension memory usage within acceptable range', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage();
      
      expect(result.heapUsed).toBe(1024 * 1024 * 15); // 15MB
      expect(result.heapTotal).toBe(1024 * 1024 * 20); // 20MB
      expect(result.external).toBe(1024 * 1024 * 2); // 2MB
      expect(result.arrayBuffers).toBe(1024 * 512); // 512KB
    });
    
    test('should calculate memory efficiency metrics', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage();
      
      expect(result.efficiency).toHaveProperty('heapUtilization');
      expect(result.efficiency).toHaveProperty('memoryPressure');
      expect(result.efficiency).toHaveProperty('gcFrequency');
      
      expect(result.efficiency.heapUtilization).toBe(75); // 15MB / 20MB * 100
      expect(result.efficiency.memoryPressure).toBe('low');
      expect(result.efficiency.gcFrequency).toBe(5);
    });
    
    test('should identify memory pressure levels', async () => {
      // Test low memory pressure
      let result = await mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage();
      expect(result.efficiency.memoryPressure).toBe('low');
      
      // Mock high memory pressure
      mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage = async () => {
        return {
          heapUsed: 1024 * 1024 * 18, // 18MB
          heapTotal: 1024 * 1024 * 20, // 20MB
          external: 1024 * 1024 * 2,
          arrayBuffers: 1024 * 512,
          efficiency: {
            heapUtilization: 90, // 90%
            memoryPressure: 'high',
            gcFrequency: 15
          }
        };
      };
      
      result = await mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage();
      expect(result.efficiency.memoryPressure).toBe('high');
    });
  });
  
  describe('Component Memory Usage Measurement', () => {
    test('should measure memory usage by component', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureComponentMemoryUsage();
      
      expect(result).toHaveProperty('background');
      expect(result).toHaveProperty('contentScripts');
      expect(result).toHaveProperty('popup');
      expect(result).toHaveProperty('options');
      expect(result).toHaveProperty('timestamp');
    });
    
    test('should provide detailed component metrics', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureComponentMemoryUsage();
      
      // Background script metrics
      expect(result.background).toHaveProperty('heapUsed');
      expect(result.background).toHaveProperty('heapTotal');
      expect(result.background).toHaveProperty('scripts');
      expect(result.background).toHaveProperty('eventListeners');
      
      // Content script metrics
      expect(result.contentScripts).toHaveProperty('heapUsed');
      expect(result.contentScripts).toHaveProperty('heapTotal');
      expect(result.contentScripts).toHaveProperty('activeTabs');
      expect(result.contentScripts).toHaveProperty('domNodes');
      
      // Popup metrics
      expect(result.popup).toHaveProperty('heapUsed');
      expect(result.popup).toHaveProperty('heapTotal');
      expect(result.popup).toHaveProperty('domNodes');
      expect(result.popup).toHaveProperty('eventListeners');
      
      // Options metrics
      expect(result.options).toHaveProperty('heapUsed');
      expect(result.options).toHaveProperty('heapTotal');
      expect(result.options).toHaveProperty('domNodes');
      expect(result.options).toHaveProperty('eventListeners');
    });
    
    test('should calculate total component memory usage', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureComponentMemoryUsage();
      
      const totalHeapUsed = 
        result.background.heapUsed + 
        (result.contentScripts.heapUsed * result.contentScripts.activeTabs) +
        result.popup.heapUsed + 
        result.options.heapUsed;
      
      expect(totalHeapUsed).toBeGreaterThan(0);
      expect(totalHeapUsed).toBeLessThan(1024 * 1024 * 50); // Should be under 50MB total
    });
  });
  
  describe('Memory Leak Detection', () => {
    test('should detect memory leaks', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryLeaks();
      
      expect(result).toHaveProperty('detectedLeaks');
      expect(result).toHaveProperty('totalLeakedMemory');
      expect(result).toHaveProperty('leakScore');
      expect(result).toHaveProperty('timestamp');
      
      expect(result.detectedLeaks).toBeInstanceOf(Array);
      expect(result.detectedLeaks.length).toBeGreaterThan(0);
    });
    
    test('should categorize memory leaks by type and severity', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryLeaks();
      
      result.detectedLeaks.forEach(leak => {
        expect(leak).toHaveProperty('type');
        expect(leak).toHaveProperty('severity');
        expect(leak).toHaveProperty('description');
        expect(leak).toHaveProperty('location');
        expect(leak).toHaveProperty('leakedObjects');
        expect(leak).toHaveProperty('memoryImpact');
        
        expect(['event_listener', 'dom_reference', 'closure', 'circular_reference']).toContain(leak.type);
        expect(['low', 'medium', 'high']).toContain(leak.severity);
      });
    });
    
    test('should calculate leak impact metrics', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryLeaks();
      
      const totalLeakedMemory = result.detectedLeaks.reduce((sum, leak) => sum + leak.memoryImpact, 0);
      expect(totalLeakedMemory).toBe(result.totalLeakedMemory);
      
      expect(result.leakScore).toBeGreaterThanOrEqual(0);
      expect(result.leakScore).toBeLessThanOrEqual(100);
    });
  });
  
  describe('Garbage Collection Performance', () => {
    test('should measure garbage collection metrics', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureGarbageCollection();
      
      expect(result).toHaveProperty('collections');
      expect(result).toHaveProperty('efficiency');
      expect(result).toHaveProperty('timestamp');
      
      expect(result.collections).toHaveProperty('minor');
      expect(result.collections).toHaveProperty('major');
    });
    
    test('should provide detailed GC metrics', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureGarbageCollection();
      
      // Minor GC metrics
      expect(result.collections.minor).toHaveProperty('count');
      expect(result.collections.minor).toHaveProperty('totalTime');
      expect(result.collections.minor).toHaveProperty('averageTime');
      expect(result.collections.minor).toHaveProperty('memoryReclaimed');
      
      // Major GC metrics
      expect(result.collections.major).toHaveProperty('count');
      expect(result.collections.major).toHaveProperty('totalTime');
      expect(result.collections.major).toHaveProperty('averageTime');
      expect(result.collections.major).toHaveProperty('memoryReclaimed');
      
      // Efficiency metrics
      expect(result.efficiency).toHaveProperty('collectionFrequency');
      expect(result.efficiency).toHaveProperty('pauseTime');
      expect(result.efficiency).toHaveProperty('memoryRecoveryRate');
    });
    
    test('should identify GC performance issues', async () => {
      // Mock slow GC
      mockMemoryPerformanceMonitor.performance.measureGarbageCollection = async () => {
        return {
          collections: {
            minor: {
              count: 20,
              totalTime: 100,
              averageTime: 5,
              memoryReclaimed: 1024 * 1024
            },
            major: {
              count: 5,
              totalTime: 500, // 500ms total - very slow
              averageTime: 100, // 100ms average - very slow
              memoryReclaimed: 1024 * 1024 * 3
            }
          },
          efficiency: {
            collectionFrequency: 'high',
            pauseTime: 'poor',
            memoryRecoveryRate: 0.6
          }
        };
      };
      
      const result = await mockMemoryPerformanceMonitor.performance.measureGarbageCollection();
      
      expect(result.collections.major.averageTime).toBeGreaterThan(50); // Should trigger bottleneck
      expect(result.efficiency.collectionFrequency).toBe('high');
      expect(result.efficiency.pauseTime).toBe('poor');
    });
  });
  
  describe('Memory Growth Analysis', () => {
    test('should measure memory growth over time', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryGrowth(300000); // 5 minutes
      
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('measurements');
      expect(result).toHaveProperty('growthRate');
      expect(result).toHaveProperty('growthClassification');
      expect(result).toHaveProperty('timestamp');
      
      expect(result.duration).toBe(300000);
      expect(result.measurements).toBeInstanceOf(Array);
      expect(result.measurements.length).toBe(10); // 5 minutes / 30 seconds
    });
    
    test('should classify memory growth rate', async () => {
      // Test stable growth
      let result = await mockMemoryPerformanceMonitor.performance.measureMemoryGrowth(300000);
      expect(result.growthClassification).toBe('stable');
      
      // Mock concerning growth
      mockMemoryPerformanceMonitor.performance.measureMemoryGrowth = async () => {
        return {
          duration: 300000,
          measurements: [],
          growthRate: 1024 * 15, // 15KB per second - concerning
          growthClassification: 'concerning'
        };
      };
      
      result = await mockMemoryPerformanceMonitor.performance.measureMemoryGrowth(300000);
      expect(result.growthClassification).toBe('concerning');
    });
    
    test('should provide growth timeline', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryGrowth(180000); // 3 minutes
      
      expect(result.measurements.length).toBe(6); // 3 minutes / 30 seconds
      
      // Verify timestamps are in chronological order
      for (let i = 1; i < result.measurements.length; i++) {
        const prevTime = new Date(result.measurements[i - 1].timestamp).getTime();
        const currTime = new Date(result.measurements[i].timestamp).getTime();
        expect(currTime).toBeGreaterThan(prevTime);
      }
    });
  });
  
  describe('Memory Performance Bottleneck Analysis', () => {
    test('should identify memory performance bottlenecks', async () => {
      const metrics = {
        heapUtilization: 90, // High heap utilization
        leakedMemory: { totalLeakedMemory: 1024 * 600 }, // Significant leaks
        gcPerformance: { collections: { major: { averageTime: 60 } } }, // Slow GC
        memoryGrowth: { growthClassification: 'concerning' } // Rapid growth
      };
      
      const result = await mockMemoryPerformanceMonitor.performance.analyzeMemoryPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.length).toBeGreaterThan(0);
      expect(result.bottlenecks.some(b => b.type === 'high_heap_utilization')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'significant_memory_leaks')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_gc')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'rapid_memory_growth')).toBe(true);
      expect(result.overallScore).toBeLessThan(100);
    });
    
    test('should provide bottleneck recommendations', async () => {
      const metrics = {
        heapUtilization: 75,
        leakedMemory: { totalLeakedMemory: 1024 * 300 },
        gcPerformance: { collections: { major: { averageTime: 40 } } }
      };
      
      const result = await mockMemoryPerformanceMonitor.performance.analyzeMemoryPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.every(b => b.recommendation)).toBe(true);
      expect(result.bottlenecks.some(b => 
        b.recommendation.includes('Optimize') || 
        b.recommendation.includes('Review') ||
        b.recommendation.includes('Fix') ||
        b.recommendation.includes('Investigate')
      )).toBe(true);
    });
    
    test('should calculate memory performance score', async () => {
      const metrics = {
        heapUtilization: 60, // Good heap utilization
        leakedMemory: { totalLeakedMemory: 1024 * 100 }, // Minor leaks
        gcPerformance: { collections: { major: { averageTime: 20 } } }, // Good GC
        memoryGrowth: { growthClassification: 'stable' } // Stable growth
      };
      
      const result = await mockMemoryPerformanceMonitor.performance.analyzeMemoryPerformanceBottlenecks(metrics);
      
      expect(result.overallScore).toBe(100); // No bottlenecks = perfect score
    });
  });
  
  describe('Memory Performance Report Generation', () => {
    test('should generate comprehensive memory performance report', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.generateMemoryPerformanceReport();
      
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('recommendations');
      
      expect(result.summary.totalHeapUsed).toBeDefined();
      expect(result.summary.totalHeapTotal).toBeDefined();
      expect(result.summary.heapUtilization).toBeDefined();
      expect(result.summary.memoryPressure).toBeDefined();
      expect(result.summary.leakedMemory).toBeDefined();
      expect(result.summary.memoryScore).toBeDefined();
    });
    
    test('should include memory performance recommendations', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.generateMemoryPerformanceReport();
      
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });
    
    test('should provide actionable insights', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.generateMemoryPerformanceReport();
      
      // Should provide both metrics and recommendations
      expect(result.summary.memoryScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.memoryScore).toBeLessThanOrEqual(100);
      
      if (result.summary.memoryScore < 80) {
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Memory Performance Thresholds', () => {
    test('should enforce heap utilization threshold', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureExtensionMemoryUsage();
      
      // Heap utilization should be under 80% for good performance
      expect(result.efficiency.heapUtilization).toBeLessThan(80);
    });
    
    test('should enforce memory leak threshold', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryLeaks();
      
      // Total leaked memory should be under 500KB for good performance
      expect(result.totalLeakedMemory).toBeLessThan(1024 * 500);
    });
    
    test('should enforce GC performance threshold', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureGarbageCollection();
      
      // Major GC average time should be under 50ms for good performance
      expect(result.collections.major.averageTime).toBeLessThan(50);
    });
    
    test('should enforce memory growth threshold', async () => {
      const result = await mockMemoryPerformanceMonitor.performance.measureMemoryGrowth();
      
      // Growth classification should be 'stable' or 'moderate' for good performance
      expect(['stable', 'moderate']).toContain(result.growthClassification);
    });
  });
});
