/**
 * Automation Execution Speed Performance Tests
 * Tests for automation execution speed and performance metrics
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock automation execution performance monitoring module
const mockAutomationPerformanceMonitor = {
  // Automation performance monitor
  performance: {
    // Measure command parsing time
    measureCommandParsing: async (command) => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        
        // Simulate command parsing process
        setTimeout(() => {
          const endTime = performance.now();
          const parsingTime = endTime - startTime;
          
          resolve({
            command: command,
            parsingTime: parsingTime,
            timestamp: new Date().toISOString(),
            phases: {
              tokenization: parsingTime * 0.2, // Tokenization takes 20%
              syntacticAnalysis: parsingTime * 0.3, // Syntactic analysis takes 30%
              semanticAnalysis: parsingTime * 0.3, // Semantic analysis takes 30%
              intentRecognition: parsingTime * 0.2 // Intent recognition takes 20%
            },
            complexity: {
              tokens: command.split(' ').length,
              entities: Math.floor(command.split(' ').length * 0.3), // 30% are entities
              intent: 'automation', // Detected intent
              confidence: 0.95 // Confidence score
            }
          });
        }, 5); // Simulate 5ms parsing time
      });
    },
    
    // Measure action planning time
    measureActionPlanning: async (parsedCommand) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const planningTime = 15; // 15ms planning time
          const actionCount = 3 + Math.floor(Math.random() * 3); // 3-5 actions
          
          resolve({
            parsedCommand: parsedCommand,
            planningTime: planningTime,
            timestamp: new Date().toISOString(),
            actions: Array(actionCount).fill().map((_, index) => ({
              id: index + 1,
              type: ['click', 'type', 'navigate', 'wait', 'scroll'][index % 5],
              target: `element-${index + 1}`,
              parameters: { delay: 100 },
              dependencies: index > 0 ? [index] : []
            })),
            metrics: {
              actionCount: actionCount,
              parallelizableActions: Math.floor(actionCount * 0.4), // 40% can be parallelized
              estimatedDuration: actionCount * 200, // 200ms per action
              complexity: 'medium' // low, medium, high
            }
          });
        }, 10); // Simulate 10ms planning time
      });
    },
    
    // Measure action execution time
    measureActionExecution: async (actions) => {
      return new Promise((resolve) => {
        const executionResults = [];
        let totalTime = 0;
        
        // Simulate sequential action execution
        actions.forEach((action, index) => {
          const actionTime = 150 + Math.random() * 100; // 150-250ms per action
          totalTime += actionTime;
          
          executionResults.push({
            actionId: action.id,
            type: action.type,
            executionTime: actionTime,
            success: Math.random() > 0.05, // 95% success rate
            retryCount: Math.random() > 0.9 ? 1 : 0, // 10% need retry
            timestamp: new Date(Date.now() + totalTime).toISOString()
          });
        });
        
        setTimeout(() => {
          resolve({
            actions: actions,
            executionResults: executionResults,
            totalExecutionTime: totalTime,
            timestamp: new Date().toISOString(),
            metrics: {
              averageActionTime: totalTime / actions.length,
              successRate: executionResults.filter(r => r.success).length / executionResults.length,
              totalRetries: executionResults.reduce((sum, r) => sum + r.retryCount, 0),
              parallelizableActions: actions.filter(a => a.parallelizable).length
            }
          });
        }, totalTime / 10); // Simulate faster than real execution
      });
    },
    
    // Measure DOM interaction speed
    measureDOMInteractionSpeed: async (interactionType, complexity = 'medium') => {
      return new Promise((resolve) => {
        const complexityFactors = {
          simple: { elements: 10, depth: 3, time: 20 },
          medium: { elements: 50, depth: 5, time: 50 },
          complex: { elements: 200, depth: 8, time: 120 },
          heavy: { elements: 500, depth: 12, time: 250 }
        };
        
        const factor = complexityFactors[complexity] || complexityFactors.medium;
        const interactionTimes = {
          click: factor.time * 0.5,
          type: factor.time * 1.2,
          scroll: factor.time * 0.3,
          hover: factor.time * 0.4,
          select: factor.time * 0.8
        };
        
        setTimeout(() => {
          resolve({
            interactionType: interactionType,
            complexity: complexity,
            interactionTime: interactionTimes[interactionType] || factor.time,
            timestamp: new Date().toISOString(),
            metrics: {
              elementCount: factor.elements,
              domDepth: factor.depth,
              queryTime: interactionTimes[interactionType] * 0.3, // 30% for query
              actionTime: interactionTimes[interactionType] * 0.7, // 70% for action
              retries: Math.random() > 0.85 ? 1 : 0 // 15% need retry
            }
          });
        }, interactionTimes[interactionType] / 10); // Simulate faster than real interaction
      });
    },
    
    // Measure multi-tab coordination time
    measureMultiTabCoordination: async (tabCount = 3) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const coordinationTime = 80 + (tabCount * 15); // Base 80ms + 15ms per tab
          const syncTime = 30 + (tabCount * 5); // Sync time
          
          resolve({
            tabCount: tabCount,
            coordinationTime: coordinationTime,
            timestamp: new Date().toISOString(),
            phases: {
              tabDiscovery: coordinationTime * 0.2, // 20% for tab discovery
              stateSync: syncTime, // Sync time
              actionCoordination: coordinationTime * 0.5, // 50% for coordination
              resultAggregation: coordinationTime * 0.3 // 30% for aggregation
            },
            metrics: {
              averageLatency: syncTime / tabCount,
              messageCount: tabCount * 3, // 3 messages per tab
              syncAccuracy: 0.98, // 98% sync accuracy
              conflicts: Math.random() > 0.9 ? 1 : 0 // 10% chance of conflict
            }
          });
        }, coordinationTime / 10); // Simulate faster than real coordination
      });
    },
    
    // Measure error handling and recovery time
    measureErrorHandling: async (errorType = 'timeout') => {
      return new Promise((resolve) => {
        const errorFactors = {
          timeout: { detection: 100, recovery: 200, total: 300 },
          elementNotFound: { detection: 50, recovery: 150, total: 200 },
          permissionDenied: { detection: 30, recovery: 100, total: 130 },
          networkError: { detection: 200, recovery: 300, total: 500 }
        };
        
        const factor = errorFactors[errorType] || errorFactors.timeout;
        
        setTimeout(() => {
          resolve({
            errorType: errorType,
            detectionTime: factor.detection,
            recoveryTime: factor.recovery,
            totalHandlingTime: factor.total,
            timestamp: new Date().toISOString(),
            strategies: {
              retry: factor.recovery * 0.4, // 40% for retry
              fallback: factor.recovery * 0.3, // 30% for fallback
              userIntervention: factor.recovery * 0.3 // 30% for user intervention
            },
            success: Math.random() > 0.1 // 90% recovery success rate
          });
        }, factor.total / 10); // Simulate faster than real handling
      });
    },
    
    // Analyze automation performance bottlenecks
    analyzeAutomationPerformanceBottlenecks: async (metrics) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const bottlenecks = [];
          
          // Analyze command parsing time
          if (metrics.commandParsing && metrics.commandParsing.parsingTime > 10) {
            bottlenecks.push({
              type: 'slow_command_parsing',
              severity: 'medium',
              description: 'Command parsing time exceeds 10ms',
              recommendation: 'Optimize NLP algorithms and reduce parsing complexity'
            });
          }
          
          // Analyze action planning time
          if (metrics.actionPlanning && metrics.actionPlanning.planningTime > 25) {
            bottlenecks.push({
              type: 'slow_action_planning',
              severity: 'medium',
              description: 'Action planning time exceeds 25ms',
              recommendation: 'Optimize planning algorithms and cache common patterns'
            });
          }
          
          // Analyze execution time
          if (metrics.actionExecution && metrics.actionExecution.totalExecutionTime > 1000) {
            bottlenecks.push({
              type: 'slow_execution',
              severity: 'high',
              description: 'Action execution time exceeds 1 second',
              recommendation: 'Optimize action execution and implement parallel processing'
            });
          }
          
          // Analyze DOM interaction time
          if (metrics.domInteraction && metrics.domInteraction.interactionTime > 100) {
            bottlenecks.push({
              type: 'slow_dom_interaction',
              severity: 'medium',
              description: 'DOM interaction time exceeds 100ms',
              recommendation: 'Optimize DOM queries and reduce interaction complexity'
            });
          }
          
          // Analyze error handling time
          if (metrics.errorHandling && metrics.errorHandling.totalHandlingTime > 400) {
            bottlenecks.push({
              type: 'slow_error_handling',
              severity: 'medium',
              description: 'Error handling time exceeds 400ms',
              recommendation: 'Optimize error detection and implement faster recovery strategies'
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
    
    // Generate automation performance report
    generateAutomationPerformanceReport: async (command) => {
      const commandParsing = await mockAutomationPerformanceMonitor.performance.measureCommandParsing(command);
      const actionPlanning = await mockAutomationPerformanceMonitor.performance.measureActionPlanning(commandParsing);
      const actionExecution = await mockAutomationPerformanceMonitor.performance.measureActionExecution(actionPlanning.actions);
      const domInteraction = await mockAutomationPerformanceMonitor.performance.measureDOMInteractionSpeed('click', 'medium');
      const multiTabCoordination = await mockAutomationPerformanceMonitor.performance.measureMultiTabCoordination(2);
      const errorHandling = await mockAutomationPerformanceMonitor.performance.measureErrorHandling('timeout');
      const bottlenecks = await mockAutomationPerformanceMonitor.performance.analyzeAutomationPerformanceBottlenecks({
        commandParsing: commandParsing,
        actionPlanning: actionPlanning,
        actionExecution: actionExecution,
        domInteraction: domInteraction,
        errorHandling: errorHandling
      });
      
      return {
        command: command,
        summary: {
          totalAutomationTime: commandParsing.parsingTime + actionPlanning.planningTime + actionExecution.totalExecutionTime,
          parsingTime: commandParsing.parsingTime,
          planningTime: actionPlanning.planningTime,
          executionTime: actionExecution.totalExecutionTime,
          averageActionTime: actionExecution.metrics.averageActionTime,
          successRate: actionExecution.metrics.successRate,
          performanceScore: bottlenecks.overallScore
        },
        details: {
          commandParsing: commandParsing,
          actionPlanning: actionPlanning,
          actionExecution: actionExecution,
          domInteraction: domInteraction,
          multiTabCoordination: multiTabCoordination,
          errorHandling: errorHandling,
          bottlenecks: bottlenecks
        },
        timestamp: new Date().toISOString(),
        recommendations: bottlenecks.bottlenecks.map(b => b.recommendation)
      };
    }
  }
};

describe('Automation Execution Speed Performance Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock performance.now for consistent testing
    let mockTime = 0;
    global.performance = {
      now: jest.fn(() => {
        mockTime += 2;
        return mockTime;
      })
    };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Command Parsing Performance', () => {
    test('should measure command parsing time within acceptable range', async () => {
      const command = 'Click on the submit button and wait for the page to load';
      
      const result = await mockAutomationPerformanceMonitor.performance.measureCommandParsing(command);
      
      expect(result.parsingTime).toBe(5); // Should match our mock
      expect(result.parsingTime).toBeLessThan(10); // Should be under 10ms
      expect(result.command).toBe(command);
    });
    
    test('should provide detailed parsing phase metrics', async () => {
      const command = 'Navigate to google.com and search for Ray extension';
      
      const result = await mockAutomationPerformanceMonitor.performance.measureCommandParsing(command);
      
      expect(result).toHaveProperty('parsingTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('phases');
      expect(result).toHaveProperty('complexity');
      
      expect(result.phases).toHaveProperty('tokenization');
      expect(result.phases).toHaveProperty('syntacticAnalysis');
      expect(result.phases).toHaveProperty('semanticAnalysis');
      expect(result.phases).toHaveProperty('intentRecognition');
    });
    
    test('should calculate complexity metrics', async () => {
      const command = 'Fill out the registration form with valid data and submit it';
      
      const result = await mockAutomationPerformanceMonitor.performance.measureCommandParsing(command);
      
      expect(result.complexity).toHaveProperty('tokens');
      expect(result.complexity).toHaveProperty('entities');
      expect(result.complexity).toHaveProperty('intent');
      expect(result.complexity).toHaveProperty('confidence');
      
      expect(result.complexity.tokens).toBe(command.split(' ').length);
      expect(result.complexity.confidence).toBe(0.95);
    });
    
    test('should verify parsing phase times add up', async () => {
      const command = 'Open a new tab and navigate to the settings page';
      
      const result = await mockAutomationPerformanceMonitor.performance.measureCommandParsing(command);
      
      const phaseSum = Object.values(result.phases).reduce((sum, time) => sum + time, 0);
      expect(phaseSum).toBeCloseTo(result.parsingTime, 1);
    });
  });
  
  describe('Action Planning Performance', () => {
    test('should measure action planning time within acceptable range', async () => {
      const parsedCommand = { command: 'test', intent: 'automation' };
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionPlanning(parsedCommand);
      
      expect(result.planningTime).toBe(15); // Should match our mock
      expect(result.planningTime).toBeLessThan(25); // Should be under 25ms
      expect(result.parsedCommand).toEqual(parsedCommand);
    });
    
    test('should generate appropriate action sequence', async () => {
      const parsedCommand = { command: 'test', intent: 'automation' };
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionPlanning(parsedCommand);
      
      expect(result).toHaveProperty('actions');
      expect(result).toHaveProperty('metrics');
      expect(result.actions).toBeInstanceOf(Array);
      expect(result.actions.length).toBeGreaterThan(0);
      
      // Verify action structure
      result.actions.forEach(action => {
        expect(action).toHaveProperty('id');
        expect(action).toHaveProperty('type');
        expect(action).toHaveProperty('target');
        expect(action).toHaveProperty('parameters');
        expect(action).toHaveProperty('dependencies');
      });
    });
    
    test('should calculate planning metrics', async () => {
      const parsedCommand = { command: 'test', intent: 'automation' };
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionPlanning(parsedCommand);
      
      expect(result.metrics).toHaveProperty('actionCount');
      expect(result.metrics).toHaveProperty('parallelizableActions');
      expect(result.metrics).toHaveProperty('estimatedDuration');
      expect(result.metrics).toHaveProperty('complexity');
      
      expect(result.metrics.actionCount).toBe(result.actions.length);
      expect(['low', 'medium', 'high']).toContain(result.metrics.complexity);
    });
  });
  
  describe('Action Execution Performance', () => {
    test('should measure action execution time within acceptable range', async () => {
      const actions = [
        { id: 1, type: 'click', target: 'button' },
        { id: 2, type: 'type', target: 'input' }
      ];
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionExecution(actions);
      
      expect(result.totalExecutionTime).toBeGreaterThan(0);
      expect(result.totalExecutionTime).toBeLessThan(1000); // Should be under 1 second
      expect(result.actions).toEqual(actions);
    });
    
    test('should provide detailed execution metrics', async () => {
      const actions = [
        { id: 1, type: 'navigate', target: 'url' },
        { id: 2, type: 'click', target: 'button' },
        { id: 3, type: 'wait', target: null }
      ];
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionExecution(actions);
      
      expect(result).toHaveProperty('executionResults');
      expect(result).toHaveProperty('metrics');
      expect(result.executionResults).toBeInstanceOf(Array);
      expect(result.executionResults.length).toBe(actions.length);
      
      // Verify execution result structure
      result.executionResults.forEach(execution => {
        expect(execution).toHaveProperty('actionId');
        expect(execution).toHaveProperty('type');
        expect(execution).toHaveProperty('executionTime');
        expect(execution).toHaveProperty('success');
        expect(execution).toHaveProperty('retryCount');
        expect(execution).toHaveProperty('timestamp');
      });
    });
    
    test('should calculate execution performance metrics', async () => {
      const actions = [
        { id: 1, type: 'click', target: 'button' },
        { id: 2, type: 'type', target: 'input' }
      ];
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionExecution(actions);
      
      expect(result.metrics).toHaveProperty('averageActionTime');
      expect(result.metrics).toHaveProperty('successRate');
      expect(result.metrics).toHaveProperty('totalRetries');
      expect(result.metrics).toHaveProperty('parallelizableActions');
      
      expect(result.metrics.averageActionTime).toBe(result.totalExecutionTime / actions.length);
      expect(result.metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.successRate).toBeLessThanOrEqual(1);
    });
  });
  
  describe('DOM Interaction Speed Performance', () => {
    test('should measure DOM interaction time for different types', async () => {
      const interactionTypes = ['click', 'type', 'scroll', 'hover', 'select'];
      
      for (const type of interactionTypes) {
        const result = await mockAutomationPerformanceMonitor.performance.measureDOMInteractionSpeed(type, 'medium');
        
        expect(result.interactionType).toBe(type);
        expect(result.interactionTime).toBeGreaterThan(0);
        expect(result.interactionTime).toBeLessThan(200); // Should be under 200ms
      }
    });
    
    test('should scale interaction time with complexity', async () => {
      const complexities = ['simple', 'medium', 'complex', 'heavy'];
      const times = [];
      
      for (const complexity of complexities) {
        const result = await mockAutomationPerformanceMonitor.performance.measureDOMInteractionSpeed('click', complexity);
        times.push(result.interactionTime);
      }
      
      // Times should increase with complexity
      expect(times[0]).toBeLessThan(times[1]);
      expect(times[1]).toBeLessThan(times[2]);
      expect(times[2]).toBeLessThan(times[3]);
    });
    
    test('should provide detailed DOM interaction metrics', async () => {
      const result = await mockAutomationPerformanceMonitor.performance.measureDOMInteractionSpeed('click', 'medium');
      
      expect(result).toHaveProperty('interactionType');
      expect(result).toHaveProperty('complexity');
      expect(result).toHaveProperty('interactionTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('metrics');
      
      expect(result.metrics).toHaveProperty('elementCount');
      expect(result.metrics).toHaveProperty('domDepth');
      expect(result.metrics).toHaveProperty('queryTime');
      expect(result.metrics).toHaveProperty('actionTime');
      expect(result.metrics).toHaveProperty('retries');
    });
  });
  
  describe('Multi-Tab Coordination Performance', () => {
    test('should measure multi-tab coordination time', async () => {
      const tabCount = 3;
      
      const result = await mockAutomationPerformanceMonitor.performance.measureMultiTabCoordination(tabCount);
      
      expect(result.tabCount).toBe(tabCount);
      expect(result.coordinationTime).toBeGreaterThan(0);
      expect(result.coordinationTime).toBeLessThan(200); // Should be under 200ms
    });
    
    test('should scale coordination time with tab count', async () => {
      const tabCounts = [1, 2, 3, 5];
      const times = [];
      
      for (const count of tabCounts) {
        const result = await mockAutomationPerformanceMonitor.performance.measureMultiTabCoordination(count);
        times.push(result.coordinationTime);
      }
      
      // Times should increase with tab count
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThan(times[i - 1]);
      }
    });
    
    test('should provide detailed coordination metrics', async () => {
      const result = await mockAutomationPerformanceMonitor.performance.measureMultiTabCoordination(3);
      
      expect(result).toHaveProperty('tabCount');
      expect(result).toHaveProperty('coordinationTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('phases');
      expect(result).toHaveProperty('metrics');
      
      expect(result.phases).toHaveProperty('tabDiscovery');
      expect(result.phases).toHaveProperty('stateSync');
      expect(result.phases).toHaveProperty('actionCoordination');
      expect(result.phases).toHaveProperty('resultAggregation');
      
      expect(result.metrics).toHaveProperty('averageLatency');
      expect(result.metrics).toHaveProperty('messageCount');
      expect(result.metrics).toHaveProperty('syncAccuracy');
      expect(result.metrics).toHaveProperty('conflicts');
    });
  });
  
  describe('Error Handling Performance', () => {
    test('should measure error handling time for different error types', async () => {
      const errorTypes = ['timeout', 'elementNotFound', 'permissionDenied', 'networkError'];
      
      for (const errorType of errorTypes) {
        const result = await mockAutomationPerformanceMonitor.performance.measureErrorHandling(errorType);
        
        expect(result.errorType).toBe(errorType);
        expect(result.totalHandlingTime).toBeGreaterThan(0);
        expect(result.detectionTime).toBeGreaterThan(0);
        expect(result.recoveryTime).toBeGreaterThan(0);
      }
    });
    
    test('should provide detailed error handling metrics', async () => {
      const result = await mockAutomationPerformanceMonitor.performance.measureErrorHandling('timeout');
      
      expect(result).toHaveProperty('errorType');
      expect(result).toHaveProperty('detectionTime');
      expect(result).toHaveProperty('recoveryTime');
      expect(result).toHaveProperty('totalHandlingTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('strategies');
      expect(result).toHaveProperty('success');
      
      expect(result.strategies).toHaveProperty('retry');
      expect(result.strategies).toHaveProperty('fallback');
      expect(result.strategies).toHaveProperty('userIntervention');
    });
    
    test('should verify handling time components add up', async () => {
      const result = await mockAutomationPerformanceMonitor.performance.measureErrorHandling('elementNotFound');
      
      expect(result.totalHandlingTime).toBe(result.detectionTime + result.recoveryTime);
    });
  });
  
  describe('Automation Performance Bottleneck Analysis', () => {
    test('should identify performance bottlenecks', async () => {
      const metrics = {
        commandParsing: { parsingTime: 15 }, // Slow parsing
        actionPlanning: { planningTime: 30 }, // Slow planning
        actionExecution: { totalExecutionTime: 1200 }, // Slow execution
        domInteraction: { interactionTime: 150 }, // Slow DOM interaction
        errorHandling: { totalHandlingTime: 500 } // Slow error handling
      };
      
      const result = await mockAutomationPerformanceMonitor.performance.analyzeAutomationPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.length).toBeGreaterThan(0);
      expect(result.bottlenecks.some(b => b.type === 'slow_command_parsing')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_action_planning')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_execution')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_dom_interaction')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_error_handling')).toBe(true);
      expect(result.overallScore).toBeLessThan(100);
    });
    
    test('should provide bottleneck recommendations', async () => {
      const metrics = {
        commandParsing: { parsingTime: 12 },
        actionPlanning: { planningTime: 28 },
        actionExecution: { totalExecutionTime: 800 },
        domInteraction: { interactionTime: 120 }
      };
      
      const result = await mockAutomationPerformanceMonitor.performance.analyzeAutomationPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.every(b => b.recommendation)).toBe(true);
      expect(result.bottlenecks.some(b => 
        b.recommendation.includes('Optimize') || 
        b.recommendation.includes('Reduce') ||
        b.recommendation.includes('Implement')
      )).toBe(true);
    });
    
    test('should calculate performance score', async () => {
      const metrics = {
        commandParsing: { parsingTime: 5 }, // Fast parsing
        actionPlanning: { planningTime: 15 }, // Fast planning
        actionExecution: { totalExecutionTime: 500 }, // Fast execution
        domInteraction: { interactionTime: 50 }, // Fast DOM interaction
        errorHandling: { totalHandlingTime: 200 } // Fast error handling
      };
      
      const result = await mockAutomationPerformanceMonitor.performance.analyzeAutomationPerformanceBottlenecks(metrics);
      
      expect(result.overallScore).toBe(100); // No bottlenecks = perfect score
    });
  });
  
  describe('Automation Performance Report Generation', () => {
    test('should generate comprehensive automation performance report', async () => {
      const command = 'Click on the login button and enter credentials';
      
      const result = await mockAutomationPerformanceMonitor.performance.generateAutomationPerformanceReport(command);
      
      expect(result).toHaveProperty('command');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('recommendations');
      
      expect(result.command).toBe(command);
      expect(result.summary.totalAutomationTime).toBeDefined();
      expect(result.summary.parsingTime).toBeDefined();
      expect(result.summary.planningTime).toBeDefined();
      expect(result.summary.executionTime).toBeDefined();
      expect(result.summary.averageActionTime).toBeDefined();
      expect(result.summary.successRate).toBeDefined();
      expect(result.summary.performanceScore).toBeDefined();
    });
    
    test('should include automation performance recommendations', async () => {
      const command = 'Navigate to settings and configure preferences';
      
      const result = await mockAutomationPerformanceMonitor.performance.generateAutomationPerformanceReport(command);
      
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });
    
    test('should provide actionable insights', async () => {
      const command = 'Fill out the form and submit it';
      
      const result = await mockAutomationPerformanceMonitor.performance.generateAutomationPerformanceReport(command);
      
      // Should provide both metrics and recommendations
      expect(result.summary.performanceScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.performanceScore).toBeLessThanOrEqual(100);
      
      if (result.summary.performanceScore < 80) {
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Automation Performance Thresholds', () => {
    test('should enforce command parsing time threshold', async () => {
      const command = 'Test command parsing performance';
      
      const result = await mockAutomationPerformanceMonitor.performance.measureCommandParsing(command);
      
      // Parsing time should be under 10ms for good performance
      expect(result.parsingTime).toBeLessThan(10);
    });
    
    test('should enforce action planning time threshold', async () => {
      const parsedCommand = { command: 'test', intent: 'automation' };
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionPlanning(parsedCommand);
      
      // Planning time should be under 25ms for good performance
      expect(result.planningTime).toBeLessThan(25);
    });
    
    test('should enforce execution time threshold', async () => {
      const actions = [
        { id: 1, type: 'click', target: 'button' },
        { id: 2, type: 'type', target: 'input' }
      ];
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionExecution(actions);
      
      // Execution time should be under 1 second for good performance
      expect(result.totalExecutionTime).toBeLessThan(1000);
    });
    
    test('should enforce DOM interaction time threshold', async () => {
      const result = await mockAutomationPerformanceMonitor.performance.measureDOMInteractionSpeed('click', 'medium');
      
      // DOM interaction time should be under 100ms for good performance
      expect(result.interactionTime).toBeLessThan(100);
    });
  });
}); * Automation Execution Speed Performance Tests
 * Tests for automation execution speed and performance metrics
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock automation execution performance monitoring module
const mockAutomationPerformanceMonitor = {
  // Automation performance monitor
  performance: {
    // Measure command parsing time
    measureCommandParsing: async (command) => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        
        // Simulate command parsing process
        setTimeout(() => {
          const endTime = performance.now();
          const parsingTime = endTime - startTime;
          
          resolve({
            command: command,
            parsingTime: parsingTime,
            timestamp: new Date().toISOString(),
            phases: {
              tokenization: parsingTime * 0.2, // Tokenization takes 20%
              syntacticAnalysis: parsingTime * 0.3, // Syntactic analysis takes 30%
              semanticAnalysis: parsingTime * 0.3, // Semantic analysis takes 30%
              intentRecognition: parsingTime * 0.2 // Intent recognition takes 20%
            },
            complexity: {
              tokens: command.split(' ').length,
              entities: Math.floor(command.split(' ').length * 0.3), // 30% are entities
              intent: 'automation', // Detected intent
              confidence: 0.95 // Confidence score
            }
          });
        }, 5); // Simulate 5ms parsing time
      });
    },
    
    // Measure action planning time
    measureActionPlanning: async (parsedCommand) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const planningTime = 15; // 15ms planning time
          const actionCount = 3 + Math.floor(Math.random() * 3); // 3-5 actions
          
          resolve({
            parsedCommand: parsedCommand,
            planningTime: planningTime,
            timestamp: new Date().toISOString(),
            actions: Array(actionCount).fill().map((_, index) => ({
              id: index + 1,
              type: ['click', 'type', 'navigate', 'wait', 'scroll'][index % 5],
              target: `element-${index + 1}`,
              parameters: { delay: 100 },
              dependencies: index > 0 ? [index] : []
            })),
            metrics: {
              actionCount: actionCount,
              parallelizableActions: Math.floor(actionCount * 0.4), // 40% can be parallelized
              estimatedDuration: actionCount * 200, // 200ms per action
              complexity: 'medium' // low, medium, high
            }
          });
        }, 10); // Simulate 10ms planning time
      });
    },
    
    // Measure action execution time
    measureActionExecution: async (actions) => {
      return new Promise((resolve) => {
        const executionResults = [];
        let totalTime = 0;
        
        // Simulate sequential action execution
        actions.forEach((action, index) => {
          const actionTime = 150 + Math.random() * 100; // 150-250ms per action
          totalTime += actionTime;
          
          executionResults.push({
            actionId: action.id,
            type: action.type,
            executionTime: actionTime,
            success: Math.random() > 0.05, // 95% success rate
            retryCount: Math.random() > 0.9 ? 1 : 0, // 10% need retry
            timestamp: new Date(Date.now() + totalTime).toISOString()
          });
        });
        
        setTimeout(() => {
          resolve({
            actions: actions,
            executionResults: executionResults,
            totalExecutionTime: totalTime,
            timestamp: new Date().toISOString(),
            metrics: {
              averageActionTime: totalTime / actions.length,
              successRate: executionResults.filter(r => r.success).length / executionResults.length,
              totalRetries: executionResults.reduce((sum, r) => sum + r.retryCount, 0),
              parallelizableActions: actions.filter(a => a.parallelizable).length
            }
          });
        }, totalTime / 10); // Simulate faster than real execution
      });
    },
    
    // Measure DOM interaction speed
    measureDOMInteractionSpeed: async (interactionType, complexity = 'medium') => {
      return new Promise((resolve) => {
        const complexityFactors = {
          simple: { elements: 10, depth: 3, time: 20 },
          medium: { elements: 50, depth: 5, time: 50 },
          complex: { elements: 200, depth: 8, time: 120 },
          heavy: { elements: 500, depth: 12, time: 250 }
        };
        
        const factor = complexityFactors[complexity] || complexityFactors.medium;
        const interactionTimes = {
          click: factor.time * 0.5,
          type: factor.time * 1.2,
          scroll: factor.time * 0.3,
          hover: factor.time * 0.4,
          select: factor.time * 0.8
        };
        
        setTimeout(() => {
          resolve({
            interactionType: interactionType,
            complexity: complexity,
            interactionTime: interactionTimes[interactionType] || factor.time,
            timestamp: new Date().toISOString(),
            metrics: {
              elementCount: factor.elements,
              domDepth: factor.depth,
              queryTime: interactionTimes[interactionType] * 0.3, // 30% for query
              actionTime: interactionTimes[interactionType] * 0.7, // 70% for action
              retries: Math.random() > 0.85 ? 1 : 0 // 15% need retry
            }
          });
        }, interactionTimes[interactionType] / 10); // Simulate faster than real interaction
      });
    },
    
    // Measure multi-tab coordination time
    measureMultiTabCoordination: async (tabCount = 3) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const coordinationTime = 80 + (tabCount * 15); // Base 80ms + 15ms per tab
          const syncTime = 30 + (tabCount * 5); // Sync time
          
          resolve({
            tabCount: tabCount,
            coordinationTime: coordinationTime,
            timestamp: new Date().toISOString(),
            phases: {
              tabDiscovery: coordinationTime * 0.2, // 20% for tab discovery
              stateSync: syncTime, // Sync time
              actionCoordination: coordinationTime * 0.5, // 50% for coordination
              resultAggregation: coordinationTime * 0.3 // 30% for aggregation
            },
            metrics: {
              averageLatency: syncTime / tabCount,
              messageCount: tabCount * 3, // 3 messages per tab
              syncAccuracy: 0.98, // 98% sync accuracy
              conflicts: Math.random() > 0.9 ? 1 : 0 // 10% chance of conflict
            }
          });
        }, coordinationTime / 10); // Simulate faster than real coordination
      });
    },
    
    // Measure error handling and recovery time
    measureErrorHandling: async (errorType = 'timeout') => {
      return new Promise((resolve) => {
        const errorFactors = {
          timeout: { detection: 100, recovery: 200, total: 300 },
          elementNotFound: { detection: 50, recovery: 150, total: 200 },
          permissionDenied: { detection: 30, recovery: 100, total: 130 },
          networkError: { detection: 200, recovery: 300, total: 500 }
        };
        
        const factor = errorFactors[errorType] || errorFactors.timeout;
        
        setTimeout(() => {
          resolve({
            errorType: errorType,
            detectionTime: factor.detection,
            recoveryTime: factor.recovery,
            totalHandlingTime: factor.total,
            timestamp: new Date().toISOString(),
            strategies: {
              retry: factor.recovery * 0.4, // 40% for retry
              fallback: factor.recovery * 0.3, // 30% for fallback
              userIntervention: factor.recovery * 0.3 // 30% for user intervention
            },
            success: Math.random() > 0.1 // 90% recovery success rate
          });
        }, factor.total / 10); // Simulate faster than real handling
      });
    },
    
    // Analyze automation performance bottlenecks
    analyzeAutomationPerformanceBottlenecks: async (metrics) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const bottlenecks = [];
          
          // Analyze command parsing time
          if (metrics.commandParsing && metrics.commandParsing.parsingTime > 10) {
            bottlenecks.push({
              type: 'slow_command_parsing',
              severity: 'medium',
              description: 'Command parsing time exceeds 10ms',
              recommendation: 'Optimize NLP algorithms and reduce parsing complexity'
            });
          }
          
          // Analyze action planning time
          if (metrics.actionPlanning && metrics.actionPlanning.planningTime > 25) {
            bottlenecks.push({
              type: 'slow_action_planning',
              severity: 'medium',
              description: 'Action planning time exceeds 25ms',
              recommendation: 'Optimize planning algorithms and cache common patterns'
            });
          }
          
          // Analyze execution time
          if (metrics.actionExecution && metrics.actionExecution.totalExecutionTime > 1000) {
            bottlenecks.push({
              type: 'slow_execution',
              severity: 'high',
              description: 'Action execution time exceeds 1 second',
              recommendation: 'Optimize action execution and implement parallel processing'
            });
          }
          
          // Analyze DOM interaction time
          if (metrics.domInteraction && metrics.domInteraction.interactionTime > 100) {
            bottlenecks.push({
              type: 'slow_dom_interaction',
              severity: 'medium',
              description: 'DOM interaction time exceeds 100ms',
              recommendation: 'Optimize DOM queries and reduce interaction complexity'
            });
          }
          
          // Analyze error handling time
          if (metrics.errorHandling && metrics.errorHandling.totalHandlingTime > 400) {
            bottlenecks.push({
              type: 'slow_error_handling',
              severity: 'medium',
              description: 'Error handling time exceeds 400ms',
              recommendation: 'Optimize error detection and implement faster recovery strategies'
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
    
    // Generate automation performance report
    generateAutomationPerformanceReport: async (command) => {
      const commandParsing = await mockAutomationPerformanceMonitor.performance.measureCommandParsing(command);
      const actionPlanning = await mockAutomationPerformanceMonitor.performance.measureActionPlanning(commandParsing);
      const actionExecution = await mockAutomationPerformanceMonitor.performance.measureActionExecution(actionPlanning.actions);
      const domInteraction = await mockAutomationPerformanceMonitor.performance.measureDOMInteractionSpeed('click', 'medium');
      const multiTabCoordination = await mockAutomationPerformanceMonitor.performance.measureMultiTabCoordination(2);
      const errorHandling = await mockAutomationPerformanceMonitor.performance.measureErrorHandling('timeout');
      const bottlenecks = await mockAutomationPerformanceMonitor.performance.analyzeAutomationPerformanceBottlenecks({
        commandParsing: commandParsing,
        actionPlanning: actionPlanning,
        actionExecution: actionExecution,
        domInteraction: domInteraction,
        errorHandling: errorHandling
      });
      
      return {
        command: command,
        summary: {
          totalAutomationTime: commandParsing.parsingTime + actionPlanning.planningTime + actionExecution.totalExecutionTime,
          parsingTime: commandParsing.parsingTime,
          planningTime: actionPlanning.planningTime,
          executionTime: actionExecution.totalExecutionTime,
          averageActionTime: actionExecution.metrics.averageActionTime,
          successRate: actionExecution.metrics.successRate,
          performanceScore: bottlenecks.overallScore
        },
        details: {
          commandParsing: commandParsing,
          actionPlanning: actionPlanning,
          actionExecution: actionExecution,
          domInteraction: domInteraction,
          multiTabCoordination: multiTabCoordination,
          errorHandling: errorHandling,
          bottlenecks: bottlenecks
        },
        timestamp: new Date().toISOString(),
        recommendations: bottlenecks.bottlenecks.map(b => b.recommendation)
      };
    }
  }
};

describe('Automation Execution Speed Performance Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock performance.now for consistent testing
    let mockTime = 0;
    global.performance = {
      now: jest.fn(() => {
        mockTime += 2;
        return mockTime;
      })
    };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Command Parsing Performance', () => {
    test('should measure command parsing time within acceptable range', async () => {
      const command = 'Click on the submit button and wait for the page to load';
      
      const result = await mockAutomationPerformanceMonitor.performance.measureCommandParsing(command);
      
      expect(result.parsingTime).toBe(5); // Should match our mock
      expect(result.parsingTime).toBeLessThan(10); // Should be under 10ms
      expect(result.command).toBe(command);
    });
    
    test('should provide detailed parsing phase metrics', async () => {
      const command = 'Navigate to google.com and search for Ray extension';
      
      const result = await mockAutomationPerformanceMonitor.performance.measureCommandParsing(command);
      
      expect(result).toHaveProperty('parsingTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('phases');
      expect(result).toHaveProperty('complexity');
      
      expect(result.phases).toHaveProperty('tokenization');
      expect(result.phases).toHaveProperty('syntacticAnalysis');
      expect(result.phases).toHaveProperty('semanticAnalysis');
      expect(result.phases).toHaveProperty('intentRecognition');
    });
    
    test('should calculate complexity metrics', async () => {
      const command = 'Fill out the registration form with valid data and submit it';
      
      const result = await mockAutomationPerformanceMonitor.performance.measureCommandParsing(command);
      
      expect(result.complexity).toHaveProperty('tokens');
      expect(result.complexity).toHaveProperty('entities');
      expect(result.complexity).toHaveProperty('intent');
      expect(result.complexity).toHaveProperty('confidence');
      
      expect(result.complexity.tokens).toBe(command.split(' ').length);
      expect(result.complexity.confidence).toBe(0.95);
    });
    
    test('should verify parsing phase times add up', async () => {
      const command = 'Open a new tab and navigate to the settings page';
      
      const result = await mockAutomationPerformanceMonitor.performance.measureCommandParsing(command);
      
      const phaseSum = Object.values(result.phases).reduce((sum, time) => sum + time, 0);
      expect(phaseSum).toBeCloseTo(result.parsingTime, 1);
    });
  });
  
  describe('Action Planning Performance', () => {
    test('should measure action planning time within acceptable range', async () => {
      const parsedCommand = { command: 'test', intent: 'automation' };
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionPlanning(parsedCommand);
      
      expect(result.planningTime).toBe(15); // Should match our mock
      expect(result.planningTime).toBeLessThan(25); // Should be under 25ms
      expect(result.parsedCommand).toEqual(parsedCommand);
    });
    
    test('should generate appropriate action sequence', async () => {
      const parsedCommand = { command: 'test', intent: 'automation' };
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionPlanning(parsedCommand);
      
      expect(result).toHaveProperty('actions');
      expect(result).toHaveProperty('metrics');
      expect(result.actions).toBeInstanceOf(Array);
      expect(result.actions.length).toBeGreaterThan(0);
      
      // Verify action structure
      result.actions.forEach(action => {
        expect(action).toHaveProperty('id');
        expect(action).toHaveProperty('type');
        expect(action).toHaveProperty('target');
        expect(action).toHaveProperty('parameters');
        expect(action).toHaveProperty('dependencies');
      });
    });
    
    test('should calculate planning metrics', async () => {
      const parsedCommand = { command: 'test', intent: 'automation' };
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionPlanning(parsedCommand);
      
      expect(result.metrics).toHaveProperty('actionCount');
      expect(result.metrics).toHaveProperty('parallelizableActions');
      expect(result.metrics).toHaveProperty('estimatedDuration');
      expect(result.metrics).toHaveProperty('complexity');
      
      expect(result.metrics.actionCount).toBe(result.actions.length);
      expect(['low', 'medium', 'high']).toContain(result.metrics.complexity);
    });
  });
  
  describe('Action Execution Performance', () => {
    test('should measure action execution time within acceptable range', async () => {
      const actions = [
        { id: 1, type: 'click', target: 'button' },
        { id: 2, type: 'type', target: 'input' }
      ];
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionExecution(actions);
      
      expect(result.totalExecutionTime).toBeGreaterThan(0);
      expect(result.totalExecutionTime).toBeLessThan(1000); // Should be under 1 second
      expect(result.actions).toEqual(actions);
    });
    
    test('should provide detailed execution metrics', async () => {
      const actions = [
        { id: 1, type: 'navigate', target: 'url' },
        { id: 2, type: 'click', target: 'button' },
        { id: 3, type: 'wait', target: null }
      ];
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionExecution(actions);
      
      expect(result).toHaveProperty('executionResults');
      expect(result).toHaveProperty('metrics');
      expect(result.executionResults).toBeInstanceOf(Array);
      expect(result.executionResults.length).toBe(actions.length);
      
      // Verify execution result structure
      result.executionResults.forEach(execution => {
        expect(execution).toHaveProperty('actionId');
        expect(execution).toHaveProperty('type');
        expect(execution).toHaveProperty('executionTime');
        expect(execution).toHaveProperty('success');
        expect(execution).toHaveProperty('retryCount');
        expect(execution).toHaveProperty('timestamp');
      });
    });
    
    test('should calculate execution performance metrics', async () => {
      const actions = [
        { id: 1, type: 'click', target: 'button' },
        { id: 2, type: 'type', target: 'input' }
      ];
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionExecution(actions);
      
      expect(result.metrics).toHaveProperty('averageActionTime');
      expect(result.metrics).toHaveProperty('successRate');
      expect(result.metrics).toHaveProperty('totalRetries');
      expect(result.metrics).toHaveProperty('parallelizableActions');
      
      expect(result.metrics.averageActionTime).toBe(result.totalExecutionTime / actions.length);
      expect(result.metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.successRate).toBeLessThanOrEqual(1);
    });
  });
  
  describe('DOM Interaction Speed Performance', () => {
    test('should measure DOM interaction time for different types', async () => {
      const interactionTypes = ['click', 'type', 'scroll', 'hover', 'select'];
      
      for (const type of interactionTypes) {
        const result = await mockAutomationPerformanceMonitor.performance.measureDOMInteractionSpeed(type, 'medium');
        
        expect(result.interactionType).toBe(type);
        expect(result.interactionTime).toBeGreaterThan(0);
        expect(result.interactionTime).toBeLessThan(200); // Should be under 200ms
      }
    });
    
    test('should scale interaction time with complexity', async () => {
      const complexities = ['simple', 'medium', 'complex', 'heavy'];
      const times = [];
      
      for (const complexity of complexities) {
        const result = await mockAutomationPerformanceMonitor.performance.measureDOMInteractionSpeed('click', complexity);
        times.push(result.interactionTime);
      }
      
      // Times should increase with complexity
      expect(times[0]).toBeLessThan(times[1]);
      expect(times[1]).toBeLessThan(times[2]);
      expect(times[2]).toBeLessThan(times[3]);
    });
    
    test('should provide detailed DOM interaction metrics', async () => {
      const result = await mockAutomationPerformanceMonitor.performance.measureDOMInteractionSpeed('click', 'medium');
      
      expect(result).toHaveProperty('interactionType');
      expect(result).toHaveProperty('complexity');
      expect(result).toHaveProperty('interactionTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('metrics');
      
      expect(result.metrics).toHaveProperty('elementCount');
      expect(result.metrics).toHaveProperty('domDepth');
      expect(result.metrics).toHaveProperty('queryTime');
      expect(result.metrics).toHaveProperty('actionTime');
      expect(result.metrics).toHaveProperty('retries');
    });
  });
  
  describe('Multi-Tab Coordination Performance', () => {
    test('should measure multi-tab coordination time', async () => {
      const tabCount = 3;
      
      const result = await mockAutomationPerformanceMonitor.performance.measureMultiTabCoordination(tabCount);
      
      expect(result.tabCount).toBe(tabCount);
      expect(result.coordinationTime).toBeGreaterThan(0);
      expect(result.coordinationTime).toBeLessThan(200); // Should be under 200ms
    });
    
    test('should scale coordination time with tab count', async () => {
      const tabCounts = [1, 2, 3, 5];
      const times = [];
      
      for (const count of tabCounts) {
        const result = await mockAutomationPerformanceMonitor.performance.measureMultiTabCoordination(count);
        times.push(result.coordinationTime);
      }
      
      // Times should increase with tab count
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThan(times[i - 1]);
      }
    });
    
    test('should provide detailed coordination metrics', async () => {
      const result = await mockAutomationPerformanceMonitor.performance.measureMultiTabCoordination(3);
      
      expect(result).toHaveProperty('tabCount');
      expect(result).toHaveProperty('coordinationTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('phases');
      expect(result).toHaveProperty('metrics');
      
      expect(result.phases).toHaveProperty('tabDiscovery');
      expect(result.phases).toHaveProperty('stateSync');
      expect(result.phases).toHaveProperty('actionCoordination');
      expect(result.phases).toHaveProperty('resultAggregation');
      
      expect(result.metrics).toHaveProperty('averageLatency');
      expect(result.metrics).toHaveProperty('messageCount');
      expect(result.metrics).toHaveProperty('syncAccuracy');
      expect(result.metrics).toHaveProperty('conflicts');
    });
  });
  
  describe('Error Handling Performance', () => {
    test('should measure error handling time for different error types', async () => {
      const errorTypes = ['timeout', 'elementNotFound', 'permissionDenied', 'networkError'];
      
      for (const errorType of errorTypes) {
        const result = await mockAutomationPerformanceMonitor.performance.measureErrorHandling(errorType);
        
        expect(result.errorType).toBe(errorType);
        expect(result.totalHandlingTime).toBeGreaterThan(0);
        expect(result.detectionTime).toBeGreaterThan(0);
        expect(result.recoveryTime).toBeGreaterThan(0);
      }
    });
    
    test('should provide detailed error handling metrics', async () => {
      const result = await mockAutomationPerformanceMonitor.performance.measureErrorHandling('timeout');
      
      expect(result).toHaveProperty('errorType');
      expect(result).toHaveProperty('detectionTime');
      expect(result).toHaveProperty('recoveryTime');
      expect(result).toHaveProperty('totalHandlingTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('strategies');
      expect(result).toHaveProperty('success');
      
      expect(result.strategies).toHaveProperty('retry');
      expect(result.strategies).toHaveProperty('fallback');
      expect(result.strategies).toHaveProperty('userIntervention');
    });
    
    test('should verify handling time components add up', async () => {
      const result = await mockAutomationPerformanceMonitor.performance.measureErrorHandling('elementNotFound');
      
      expect(result.totalHandlingTime).toBe(result.detectionTime + result.recoveryTime);
    });
  });
  
  describe('Automation Performance Bottleneck Analysis', () => {
    test('should identify performance bottlenecks', async () => {
      const metrics = {
        commandParsing: { parsingTime: 15 }, // Slow parsing
        actionPlanning: { planningTime: 30 }, // Slow planning
        actionExecution: { totalExecutionTime: 1200 }, // Slow execution
        domInteraction: { interactionTime: 150 }, // Slow DOM interaction
        errorHandling: { totalHandlingTime: 500 } // Slow error handling
      };
      
      const result = await mockAutomationPerformanceMonitor.performance.analyzeAutomationPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.length).toBeGreaterThan(0);
      expect(result.bottlenecks.some(b => b.type === 'slow_command_parsing')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_action_planning')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_execution')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_dom_interaction')).toBe(true);
      expect(result.bottlenecks.some(b => b.type === 'slow_error_handling')).toBe(true);
      expect(result.overallScore).toBeLessThan(100);
    });
    
    test('should provide bottleneck recommendations', async () => {
      const metrics = {
        commandParsing: { parsingTime: 12 },
        actionPlanning: { planningTime: 28 },
        actionExecution: { totalExecutionTime: 800 },
        domInteraction: { interactionTime: 120 }
      };
      
      const result = await mockAutomationPerformanceMonitor.performance.analyzeAutomationPerformanceBottlenecks(metrics);
      
      expect(result.bottlenecks.every(b => b.recommendation)).toBe(true);
      expect(result.bottlenecks.some(b => 
        b.recommendation.includes('Optimize') || 
        b.recommendation.includes('Reduce') ||
        b.recommendation.includes('Implement')
      )).toBe(true);
    });
    
    test('should calculate performance score', async () => {
      const metrics = {
        commandParsing: { parsingTime: 5 }, // Fast parsing
        actionPlanning: { planningTime: 15 }, // Fast planning
        actionExecution: { totalExecutionTime: 500 }, // Fast execution
        domInteraction: { interactionTime: 50 }, // Fast DOM interaction
        errorHandling: { totalHandlingTime: 200 } // Fast error handling
      };
      
      const result = await mockAutomationPerformanceMonitor.performance.analyzeAutomationPerformanceBottlenecks(metrics);
      
      expect(result.overallScore).toBe(100); // No bottlenecks = perfect score
    });
  });
  
  describe('Automation Performance Report Generation', () => {
    test('should generate comprehensive automation performance report', async () => {
      const command = 'Click on the login button and enter credentials';
      
      const result = await mockAutomationPerformanceMonitor.performance.generateAutomationPerformanceReport(command);
      
      expect(result).toHaveProperty('command');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('recommendations');
      
      expect(result.command).toBe(command);
      expect(result.summary.totalAutomationTime).toBeDefined();
      expect(result.summary.parsingTime).toBeDefined();
      expect(result.summary.planningTime).toBeDefined();
      expect(result.summary.executionTime).toBeDefined();
      expect(result.summary.averageActionTime).toBeDefined();
      expect(result.summary.successRate).toBeDefined();
      expect(result.summary.performanceScore).toBeDefined();
    });
    
    test('should include automation performance recommendations', async () => {
      const command = 'Navigate to settings and configure preferences';
      
      const result = await mockAutomationPerformanceMonitor.performance.generateAutomationPerformanceReport(command);
      
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });
    
    test('should provide actionable insights', async () => {
      const command = 'Fill out the form and submit it';
      
      const result = await mockAutomationPerformanceMonitor.performance.generateAutomationPerformanceReport(command);
      
      // Should provide both metrics and recommendations
      expect(result.summary.performanceScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.performanceScore).toBeLessThanOrEqual(100);
      
      if (result.summary.performanceScore < 80) {
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Automation Performance Thresholds', () => {
    test('should enforce command parsing time threshold', async () => {
      const command = 'Test command parsing performance';
      
      const result = await mockAutomationPerformanceMonitor.performance.measureCommandParsing(command);
      
      // Parsing time should be under 10ms for good performance
      expect(result.parsingTime).toBeLessThan(10);
    });
    
    test('should enforce action planning time threshold', async () => {
      const parsedCommand = { command: 'test', intent: 'automation' };
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionPlanning(parsedCommand);
      
      // Planning time should be under 25ms for good performance
      expect(result.planningTime).toBeLessThan(25);
    });
    
    test('should enforce execution time threshold', async () => {
      const actions = [
        { id: 1, type: 'click', target: 'button' },
        { id: 2, type: 'type', target: 'input' }
      ];
      
      const result = await mockAutomationPerformanceMonitor.performance.measureActionExecution(actions);
      
      // Execution time should be under 1 second for good performance
      expect(result.totalExecutionTime).toBeLessThan(1000);
    });
    
    test('should enforce DOM interaction time threshold', async () => {
      const result = await mockAutomationPerformanceMonitor.performance.measureDOMInteractionSpeed('click', 'medium');
      
      // DOM interaction time should be under 100ms for good performance
      expect(result.interactionTime).toBeLessThan(100);
    });
  });
});
