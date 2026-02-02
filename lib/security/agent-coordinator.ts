/**
 * Agent Coordinator for Ray Chrome Extension
 * Provides cross-agent security integration and coordination
 */

export interface AgentInfo {
  id: string;
  name: string;
  type: 'security' | 'api' | 'ui' | 'storage' | 'network' | 'ai';
  status: 'active' | 'inactive' | 'error';
  capabilities: string[];
  permissions: string[];
  lastActivity: number;
  metadata: Record<string, any>;
}

export interface SecurityEvent {
  id: string;
  timestamp: number;
  type: 'threat' | 'violation' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'api' | 'permission' | 'csp' | 'input' | 'storage' | 'network' | 'system';
  source: string;
  target?: string;
  title: string;
  description: string;
  data?: any;
  handled: boolean;
  handledBy?: string;
  resolvedAt?: number;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  type: 'access' | 'data' | 'network' | 'execution' | 'storage';
  enabled: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  rules: SecurityPolicyRule[];
  exceptions: SecurityPolicyException[];
  lastUpdated: number;
  updatedBy: string;
}

export interface SecurityPolicyRule {
  id: string;
  name: string;
  condition: string;
  action: 'allow' | 'block' | 'warn' | 'log';
  enabled: boolean;
}

export interface SecurityPolicyException {
  id: string;
  name: string;
  description: string;
  condition: string;
  reason: string;
  approvedBy: string;
  approvedAt: number;
  expiresAt?: number;
}

export interface AgentCoordinatorConfig {
  enableCoordination: boolean;
  enablePolicyEnforcement: boolean;
  enableEventSharing: boolean;
  enableCrossAgentAuth: boolean;
  maxAgents: number;
  eventRetentionDays: number;
  policyRefreshInterval: number; // in minutes
  autoResolveEvents: boolean;
  notificationChannels: ('console' | 'storage' | 'api')[];
}

export class AgentCoordinator {
  private static readonly DEFAULT_CONFIG: AgentCoordinatorConfig = {
    enableCoordination: true,
    enablePolicyEnforcement: true,
    enableEventSharing: true,
    enableCrossAgentAuth: true,
    maxAgents: 10,
    eventRetentionDays: 30,
    policyRefreshInterval: 60,
    autoResolveEvents: false,
    notificationChannels: ['console', 'storage']
  };

  private static readonly AGENTS_KEY = 'registeredAgents';
  private static readonly EVENTS_KEY = 'securityEvents';
  private static readonly POLICIES_KEY = 'securityPolicies';
  private static readonly CONFIG_KEY = 'agentCoordinatorConfig';
  
  private static config: AgentCoordinatorConfig;
  private static agents: Map<string, AgentInfo> = new Map();
  private static policies: Map<string, SecurityPolicy> = new Map();
  private static eventHandlers: Map<string, (event: SecurityEvent) => void> = new Map();
  private static policyRefreshTimer?: number;

  /**
   * Initialize agent coordinator
   * @param config Optional configuration
   */
  static async initialize(config?: Partial<AgentCoordinatorConfig>): Promise<void> {
    try {
      // Load or create configuration
      this.config = { ...this.DEFAULT_CONFIG, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });

      // Load agents and policies
      await this.loadAgents();
      await this.loadPolicies();

      // Start policy refresh timer
      this.startPolicyRefreshTimer();

      // Register this coordinator as an agent
      await this.registerAgent({
        id: 'agent-coordinator',
        name: 'Agent Coordinator',
        type: 'security',
        status: 'active',
        capabilities: ['coordination', 'policy_enforcement', 'event_sharing'],
        permissions: ['read_agents', 'write_agents', 'read_policies', 'write_policies'],
        lastActivity: Date.now(),
        metadata: {
          version: '1.0.0',
          config: this.config
        }
      });

      console.log('Agent Coordinator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Agent Coordinator:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Agent Coordinator initialization failed');
    }
  }

  /**
   * Register an agent
   * @param agent Agent information
   * @returns True if registration successful
   */
  static async registerAgent(agent: AgentInfo): Promise<boolean> {
    try {
      // Check if coordinator is enabled
      if (!this.config.enableCoordination) {
        console.warn('Agent coordination is disabled');
        return false;
      }

      // Check agent limit
      if (this.agents.size >= this.config.maxAgents) {
        console.warn(`Maximum number of agents (${this.config.maxAgents}) reached`);
        return false;
      }

      // Validate agent
      if (!this.validateAgent(agent)) {
        console.warn('Agent validation failed');
        return false;
      }

      // Add agent
      this.agents.set(agent.id, agent);
      await this.saveAgents();

      // Log registration
      await this.logEvent({
        type: 'info',
        severity: 'low',
        category: 'system',
        source: 'agent-coordinator',
        title: 'Agent Registered',
        description: `Agent ${agent.name} (${agent.id}) registered successfully`,
        data: { agent }
      });

      return true;
    } catch (error) {
      console.error('Failed to register agent:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Unregister an agent
   * @param agentId ID of agent to unregister
   * @returns True if unregistration successful
   */
  static async unregisterAgent(agentId: string): Promise<boolean> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        console.warn(`Agent ${agentId} not found`);
        return false;
      }

      // Remove agent
      this.agents.delete(agentId);
      await this.saveAgents();

      // Log unregistration
      await this.logEvent({
        type: 'info',
        severity: 'low',
        category: 'system',
        source: 'agent-coordinator',
        title: 'Agent Unregistered',
        description: `Agent ${agent.name} (${agentId}) unregistered`,
        data: { agent }
      });

      return true;
    } catch (error) {
      console.error('Failed to unregister agent:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Update agent status
   * @param agentId ID of agent to update
   * @param status New status
   * @returns True if update successful
   */
  static async updateAgentStatus(agentId: string, status: AgentInfo['status']): Promise<boolean> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        console.warn(`Agent ${agentId} not found`);
        return false;
      }

      // Update agent
      agent.status = status;
      agent.lastActivity = Date.now();
      this.agents.set(agentId, agent);
      await this.saveAgents();

      // Log status change
      await this.logEvent({
        type: 'info',
        severity: 'low',
        category: 'system',
        source: 'agent-coordinator',
        title: 'Agent Status Updated',
        description: `Agent ${agent.name} (${agentId}) status changed to ${status}`,
        data: { agentId, status }
      });

      return true;
    } catch (error) {
      console.error('Failed to update agent status:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get registered agents
   * @param filters Optional filters
   * @returns Array of agents
   */
  static async getAgents(filters?: {
    type?: AgentInfo['type'];
    status?: AgentInfo['status'];
    capability?: string;
  }): Promise<AgentInfo[]> {
    try {
      let agents = Array.from(this.agents.values());

      // Apply filters
      if (filters) {
        if (filters.type) {
          agents = agents.filter(agent => agent.type === filters.type);
        }
        if (filters.status) {
          agents = agents.filter(agent => agent.status === filters.status);
        }
        if (filters.capability) {
          agents = agents.filter(agent => agent.capabilities.includes(filters.capability!));
        }
      }

      return agents;
    } catch (error) {
      console.error('Failed to get agents:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Report a security event
   * @param event Security event to report
   * @returns Event ID
   */
  static async reportEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'handled'>): Promise<string> {
    try {
      const fullEvent: SecurityEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: Date.now(),
        handled: false
      };

      // Store event
      await this.storeEvent(fullEvent);

      // Check policy enforcement
      if (this.config.enablePolicyEnforcement) {
        await this.enforcePolicies(fullEvent);
      }

      // Share event with other agents
      if (this.config.enableEventSharing) {
        await this.shareEvent(fullEvent);
      }

      // Trigger event handlers
      this.triggerEventHandlers(fullEvent);

      // Auto-resolve if enabled
      if (this.config.autoResolveEvents) {
        await this.autoResolveEvent(fullEvent);
      }

      return fullEvent.id;
    } catch (error) {
      console.error('Failed to report security event:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to report security event');
    }
  }

  /**
   * Get security events
   * @param filters Optional filters
   * @param limit Maximum number of events to return
   * @returns Array of security events
   */
  static async getEvents(filters?: {
    type?: SecurityEvent['type'];
    severity?: SecurityEvent['severity'];
    category?: SecurityEvent['category'];
    source?: string;
    handled?: boolean;
    startDate?: number;
    endDate?: number;
  }, limit?: number): Promise<SecurityEvent[]> {
    try {
      const result = await chrome.storage.local.get([this.EVENTS_KEY]);
      let events: SecurityEvent[] = result[this.EVENTS_KEY] || [];

      // Apply filters
      if (filters) {
        if (filters.type) {
          events = events.filter(event => event.type === filters.type);
        }
        if (filters.severity) {
          events = events.filter(event => event.severity === filters.severity);
        }
        if (filters.category) {
          events = events.filter(event => event.category === filters.category);
        }
        if (filters.source) {
          events = events.filter(event => event.source === filters.source);
        }
        if (filters.handled !== undefined) {
          events = events.filter(event => event.handled === filters.handled);
        }
        if (filters.startDate) {
          events = events.filter(event => event.timestamp >= filters.startDate!);
        }
        if (filters.endDate) {
          events = events.filter(event => event.timestamp <= filters.endDate!);
        }
      }

      // Sort by timestamp (newest first)
      events.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (limit) {
        events = events.slice(0, limit);
      }

      return events;
    } catch (error) {
      console.error('Failed to get security events:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Create a security policy
   * @param policy Policy to create
   * @returns Policy ID
   */
  static async createPolicy(policy: Omit<SecurityPolicy, 'id' | 'lastUpdated'>): Promise<string> {
    try {
      const newPolicy: SecurityPolicy = {
        ...policy,
        id: this.generatePolicyId(),
        lastUpdated: Date.now()
      };

      this.policies.set(newPolicy.id, newPolicy);
      await this.savePolicies();

      // Log policy creation
      await this.logEvent({
        type: 'info',
        severity: 'medium',
        category: 'system',
        source: 'agent-coordinator',
        title: 'Security Policy Created',
        description: `Security policy ${newPolicy.name} created`,
        data: { policy: newPolicy }
      });

      return newPolicy.id;
    } catch (error) {
      console.error('Failed to create security policy:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to create security policy');
    }
  }

  /**
   * Update a security policy
   * @param policyId ID of policy to update
   * @param updates Policy updates
   * @returns True if update successful
   */
  static async updatePolicy(policyId: string, updates: Partial<SecurityPolicy>): Promise<boolean> {
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        console.warn(`Policy ${policyId} not found`);
        return false;
      }

      // Update policy
      const updatedPolicy: SecurityPolicy = {
        ...policy,
        ...updates,
        id: policyId,
        lastUpdated: Date.now()
      };

      this.policies.set(policyId, updatedPolicy);
      await this.savePolicies();

      // Log policy update
      await this.logEvent({
        type: 'info',
        severity: 'medium',
        category: 'system',
        source: 'agent-coordinator',
        title: 'Security Policy Updated',
        description: `Security policy ${updatedPolicy.name} updated`,
        data: { policyId, updates }
      });

      return true;
    } catch (error) {
      console.error('Failed to update security policy:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get security policies
   * @param filters Optional filters
   * @returns Array of security policies
   */
  static async getPolicies(filters?: {
    type?: SecurityPolicy['type'];
    enabled?: boolean;
    priority?: SecurityPolicy['priority'];
  }): Promise<SecurityPolicy[]> {
    try {
      let policies = Array.from(this.policies.values());

      // Apply filters
      if (filters) {
        if (filters.type) {
          policies = policies.filter(policy => policy.type === filters.type);
        }
        if (filters.enabled !== undefined) {
          policies = policies.filter(policy => policy.enabled === filters.enabled);
        }
        if (filters.priority) {
          policies = policies.filter(policy => policy.priority === filters.priority);
        }
      }

      return policies;
    } catch (error) {
      console.error('Failed to get security policies:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Register event handler
   * @param id Handler ID
   * @param handler Event handler function
   */
  static registerEventHandler(id: string, handler: (event: SecurityEvent) => void): void {
    this.eventHandlers.set(id, handler);
  }

  /**
   * Unregister event handler
   * @param id Handler ID
   */
  static unregisterEventHandler(id: string): void {
    this.eventHandlers.delete(id);
  }

  /**
   * Authenticate agent
   * @param agentId Agent ID
   * @param token Authentication token
   * @returns True if authentication successful
   */
  static async authenticateAgent(agentId: string, token: string): Promise<boolean> {
    try {
      if (!this.config.enableCrossAgentAuth) {
        return true; // Skip authentication if disabled
      }

      const agent = this.agents.get(agentId);
      if (!agent) {
        console.warn(`Agent ${agentId} not found`);
        return false;
      }

      // This is a placeholder for authentication logic
      // In a real implementation, this would validate the token
      const isValidToken = token === `${agentId}-${agent.lastActivity}`;

      if (isValidToken) {
        // Update last activity
        agent.lastActivity = Date.now();
        this.agents.set(agentId, agent);
        await this.saveAgents();
      }

      return isValidToken;
    } catch (error) {
      console.error('Failed to authenticate agent:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Generate agent authentication token
   * @param agentId Agent ID
   * @returns Authentication token
   */
  static generateAuthToken(agentId: string): string {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return `${agentId}-${agent.lastActivity}`;
  }

  /**
   * Validate agent information
   * @param agent Agent to validate
   * @returns True if valid
   */
  private static validateAgent(agent: AgentInfo): boolean {
    // Check required fields
    if (!agent.id || !agent.name || !agent.type || !agent.status) {
      return false;
    }

    // Check ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(agent.id)) {
      return false;
    }

    // Check type
    const validTypes: AgentInfo['type'][] = ['security', 'api', 'ui', 'storage', 'network', 'ai'];
    if (!validTypes.includes(agent.type)) {
      return false;
    }

    // Check status
    const validStatuses: AgentInfo['status'][] = ['active', 'inactive', 'error'];
    if (!validStatuses.includes(agent.status)) {
      return false;
    }

    return true;
  }

  /**
   * Store security event
   * @param event Event to store
   */
  private static async storeEvent(event: SecurityEvent): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.EVENTS_KEY]);
      const events: SecurityEvent[] = result[this.EVENTS_KEY] || [];

      events.push(event);

      // Apply retention policy
      const cutoffDate = Date.now() - (this.config.eventRetentionDays * 24 * 60 * 60 * 1000);
      const filteredEvents = events.filter(e => e.timestamp >= cutoffDate);

      await chrome.storage.local.set({ [this.EVENTS_KEY]: filteredEvents });
    } catch (error) {
      console.error('Failed to store security event:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Enforce security policies
   * @param event Event to check against policies
   */
  private static async enforcePolicies(event: SecurityEvent): Promise<void> {
    try {
      const policies = await this.getPolicies({ enabled: true });
      
      for (const policy of policies) {
        for (const rule of policy.rules) {
          if (!rule.enabled) {
            continue;
          }

          // Check if rule applies to event
          if (this.evaluateRuleCondition(rule.condition, event)) {
            // Apply rule action
            switch (rule.action) {
              case 'block':
                await this.blockEvent(event, policy.name, rule.name);
                break;
              case 'warn':
                await this.warnEvent(event, policy.name, rule.name);
                break;
              case 'log':
                // Event is already logged
                break;
              case 'allow':
                // Allow event
                break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to enforce policies:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Evaluate rule condition
   * @param condition Rule condition
   * @param event Event to evaluate
   * @returns True if condition matches
   */
  private static evaluateRuleCondition(condition: string, event: SecurityEvent): boolean {
    // This is a placeholder for condition evaluation
    // In a real implementation, this would parse and evaluate the condition
    try {
      // Simple string matching for now
      if (condition.includes('type:')) {
        const expectedType = condition.split('type:')[1].trim();
        return event.type === expectedType;
      }
      
      if (condition.includes('severity:')) {
        const expectedSeverity = condition.split('severity:')[1].trim();
        return event.severity === expectedSeverity;
      }
      
      if (condition.includes('category:')) {
        const expectedCategory = condition.split('category:')[1].trim();
        return event.category === expectedCategory;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to evaluate rule condition:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Block an event
   * @param event Event to block
   * @param policyName Policy name
   * @param ruleName Rule name
   */
  private static async blockEvent(event: SecurityEvent, policyName: string, ruleName: string): Promise<void> {
    // Log block action
    await this.logEvent({
      type: 'warning',
      severity: 'high',
      category: 'system',
      source: 'agent-coordinator',
      title: 'Event Blocked',
      description: `Event blocked by policy ${policyName}, rule ${ruleName}`,
      data: { originalEvent: event, policyName, ruleName }
    });

    // In a real implementation, this would prevent the event from proceeding
    console.warn(`Event blocked by policy ${policyName}, rule ${ruleName}:`, event);
  }

  /**
   * Warn about an event
   * @param event Event to warn about
   * @param policyName Policy name
   * @param ruleName Rule name
   */
  private static async warnEvent(event: SecurityEvent, policyName: string, ruleName: string): Promise<void> {
    // Log warning
    await this.logEvent({
      type: 'warning',
      severity: 'medium',
      category: 'system',
      source: 'agent-coordinator',
      title: 'Event Warning',
      description: `Event warning by policy ${policyName}, rule ${ruleName}`,
      data: { originalEvent: event, policyName, ruleName }
    });

    console.warn(`Event warning by policy ${policyName}, rule ${ruleName}:`, event);
  }

  /**
   * Share event with other agents
   * @param event Event to share
   */
  private static async shareEvent(event: SecurityEvent): Promise<void> {
    try {
      const agents = await this.getAgents({ status: 'active' });
      
      for (const agent of agents) {
        if (agent.id === 'agent-coordinator') {
          continue; // Skip self
        }

        // In a real implementation, this would send the event to the agent
        console.log(`Sharing event with agent ${agent.name}:`, event);
      }
    } catch (error) {
      console.error('Failed to share event:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Trigger event handlers
   * @param event Event to handle
   */
  private static triggerEventHandlers(event: SecurityEvent): void {
    for (const [id, handler] of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`Event handler ${id} failed:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  /**
   * Auto-resolve event if possible
   * @param event Event to resolve
   */
  private static async autoResolveEvent(event: SecurityEvent): Promise<void> {
    try {
      // Only auto-resolve low severity events
      if (event.severity !== 'low') {
        return;
      }

      // Mark as handled
      event.handled = true;
      event.handledBy = 'agent-coordinator';
      event.resolvedAt = Date.now();

      await this.storeEvent(event);

      console.log(`Auto-resolved event ${event.id}:`, event);
    } catch (error) {
      console.error('Failed to auto-resolve event:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Start policy refresh timer
   */
  private static startPolicyRefreshTimer(): void {
    if (this.policyRefreshTimer) {
      clearInterval(this.policyRefreshTimer);
    }

    this.policyRefreshTimer = setInterval(async () => {
      try {
        await this.refreshPolicies();
      } catch (error) {
        console.error('Policy refresh failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }, this.config.policyRefreshInterval * 60 * 1000); // Convert minutes to milliseconds
  }

  /**
   * Refresh policies
   */
  private static async refreshPolicies(): Promise<void> {
    try {
      // This is a placeholder for policy refresh
      // In a real implementation, this would fetch policies from a central source
      console.log('Refreshing policies...');
      
      // Log refresh
      await this.logEvent({
        type: 'info',
        severity: 'low',
        category: 'system',
        source: 'agent-coordinator',
        title: 'Policies Refreshed',
        description: 'Security policies refreshed successfully'
      });
    } catch (error) {
      console.error('Failed to refresh policies:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Log an event
   * @param event Event to log
   */
  private static async logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'handled'>): Promise<void> {
    try {
      const fullEvent: SecurityEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: Date.now(),
        handled: false
      };

      await this.storeEvent(fullEvent);
    } catch (error) {
      console.error('Failed to log event:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Load agents
   */
  private static async loadAgents(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.AGENTS_KEY]);
      const agents: Record<string, AgentInfo> = result[this.AGENTS_KEY] || {};
      
      this.agents = new Map(Object.entries(agents));
    } catch (error) {
      console.error('Failed to load agents:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Save agents
   */
  private static async saveAgents(): Promise<void> {
    try {
      const agents = Object.fromEntries(this.agents);
      await chrome.storage.local.set({ [this.AGENTS_KEY]: agents });
    } catch (error) {
      console.error('Failed to save agents:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Load policies
   */
  private static async loadPolicies(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.POLICIES_KEY]);
      const policies: Record<string, SecurityPolicy> = result[this.POLICIES_KEY] || {};
      
      this.policies = new Map(Object.entries(policies));
    } catch (error) {
      console.error('Failed to load policies:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Save policies
   */
  private static async savePolicies(): Promise<void> {
    try {
      const policies = Object.fromEntries(this.policies);
      await chrome.storage.local.set({ [this.POLICIES_KEY]: policies });
    } catch (error) {
      console.error('Failed to save policies:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Generate event ID
   * @returns Unique event ID
   */
  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate policy ID
   * @returns Unique policy ID
   */
  private static generatePolicyId(): string {
    return `pol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get agent coordinator configuration
   * @returns Configuration
   */
  static async getConfig(): Promise<AgentCoordinatorConfig> {
    try {
      const result = await chrome.storage.local.get([this.CONFIG_KEY]);
      return result[this.CONFIG_KEY] || this.DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to get agent coordinator config:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Update agent coordinator configuration
   * @param config New configuration
   */
  static async updateConfig(config: Partial<AgentCoordinatorConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });

      // Restart policy refresh timer if interval changed
      if (config.policyRefreshInterval) {
        this.startPolicyRefreshTimer();
      }
    } catch (error) {
      console.error('Failed to update agent coordinator config:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to update agent coordinator config');
    }
  }

  /**
   * Cleanup resources
   */
  static cleanup(): void {
    if (this.policyRefreshTimer) {
      clearInterval(this.policyRefreshTimer);
      this.policyRefreshTimer = undefined;
    }
    
    this.agents.clear();
    this.policies.clear();
    this.eventHandlers.clear();
  }
} * Agent Coordinator for Ray Chrome Extension
 * Provides cross-agent security integration and coordination
 */

export interface AgentInfo {
  id: string;
  name: string;
  type: 'security' | 'api' | 'ui' | 'storage' | 'network' | 'ai';
  status: 'active' | 'inactive' | 'error';
  capabilities: string[];
  permissions: string[];
  lastActivity: number;
  metadata: Record<string, any>;
}

export interface SecurityEvent {
  id: string;
  timestamp: number;
  type: 'threat' | 'violation' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'api' | 'permission' | 'csp' | 'input' | 'storage' | 'network' | 'system';
  source: string;
  target?: string;
  title: string;
  description: string;
  data?: any;
  handled: boolean;
  handledBy?: string;
  resolvedAt?: number;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  type: 'access' | 'data' | 'network' | 'execution' | 'storage';
  enabled: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  rules: SecurityPolicyRule[];
  exceptions: SecurityPolicyException[];
  lastUpdated: number;
  updatedBy: string;
}

export interface SecurityPolicyRule {
  id: string;
  name: string;
  condition: string;
  action: 'allow' | 'block' | 'warn' | 'log';
  enabled: boolean;
}

export interface SecurityPolicyException {
  id: string;
  name: string;
  description: string;
  condition: string;
  reason: string;
  approvedBy: string;
  approvedAt: number;
  expiresAt?: number;
}

export interface AgentCoordinatorConfig {
  enableCoordination: boolean;
  enablePolicyEnforcement: boolean;
  enableEventSharing: boolean;
  enableCrossAgentAuth: boolean;
  maxAgents: number;
  eventRetentionDays: number;
  policyRefreshInterval: number; // in minutes
  autoResolveEvents: boolean;
  notificationChannels: ('console' | 'storage' | 'api')[];
}

export class AgentCoordinator {
  private static readonly DEFAULT_CONFIG: AgentCoordinatorConfig = {
    enableCoordination: true,
    enablePolicyEnforcement: true,
    enableEventSharing: true,
    enableCrossAgentAuth: true,
    maxAgents: 10,
    eventRetentionDays: 30,
    policyRefreshInterval: 60,
    autoResolveEvents: false,
    notificationChannels: ['console', 'storage']
  };

  private static readonly AGENTS_KEY = 'registeredAgents';
  private static readonly EVENTS_KEY = 'securityEvents';
  private static readonly POLICIES_KEY = 'securityPolicies';
  private static readonly CONFIG_KEY = 'agentCoordinatorConfig';
  
  private static config: AgentCoordinatorConfig;
  private static agents: Map<string, AgentInfo> = new Map();
  private static policies: Map<string, SecurityPolicy> = new Map();
  private static eventHandlers: Map<string, (event: SecurityEvent) => void> = new Map();
  private static policyRefreshTimer?: number;

  /**
   * Initialize agent coordinator
   * @param config Optional configuration
   */
  static async initialize(config?: Partial<AgentCoordinatorConfig>): Promise<void> {
    try {
      // Load or create configuration
      this.config = { ...this.DEFAULT_CONFIG, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });

      // Load agents and policies
      await this.loadAgents();
      await this.loadPolicies();

      // Start policy refresh timer
      this.startPolicyRefreshTimer();

      // Register this coordinator as an agent
      await this.registerAgent({
        id: 'agent-coordinator',
        name: 'Agent Coordinator',
        type: 'security',
        status: 'active',
        capabilities: ['coordination', 'policy_enforcement', 'event_sharing'],
        permissions: ['read_agents', 'write_agents', 'read_policies', 'write_policies'],
        lastActivity: Date.now(),
        metadata: {
          version: '1.0.0',
          config: this.config
        }
      });

      console.log('Agent Coordinator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Agent Coordinator:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Agent Coordinator initialization failed');
    }
  }

  /**
   * Register an agent
   * @param agent Agent information
   * @returns True if registration successful
   */
  static async registerAgent(agent: AgentInfo): Promise<boolean> {
    try {
      // Check if coordinator is enabled
      if (!this.config.enableCoordination) {
        console.warn('Agent coordination is disabled');
        return false;
      }

      // Check agent limit
      if (this.agents.size >= this.config.maxAgents) {
        console.warn(`Maximum number of agents (${this.config.maxAgents}) reached`);
        return false;
      }

      // Validate agent
      if (!this.validateAgent(agent)) {
        console.warn('Agent validation failed');
        return false;
      }

      // Add agent
      this.agents.set(agent.id, agent);
      await this.saveAgents();

      // Log registration
      await this.logEvent({
        type: 'info',
        severity: 'low',
        category: 'system',
        source: 'agent-coordinator',
        title: 'Agent Registered',
        description: `Agent ${agent.name} (${agent.id}) registered successfully`,
        data: { agent }
      });

      return true;
    } catch (error) {
      console.error('Failed to register agent:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Unregister an agent
   * @param agentId ID of agent to unregister
   * @returns True if unregistration successful
   */
  static async unregisterAgent(agentId: string): Promise<boolean> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        console.warn(`Agent ${agentId} not found`);
        return false;
      }

      // Remove agent
      this.agents.delete(agentId);
      await this.saveAgents();

      // Log unregistration
      await this.logEvent({
        type: 'info',
        severity: 'low',
        category: 'system',
        source: 'agent-coordinator',
        title: 'Agent Unregistered',
        description: `Agent ${agent.name} (${agentId}) unregistered`,
        data: { agent }
      });

      return true;
    } catch (error) {
      console.error('Failed to unregister agent:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Update agent status
   * @param agentId ID of agent to update
   * @param status New status
   * @returns True if update successful
   */
  static async updateAgentStatus(agentId: string, status: AgentInfo['status']): Promise<boolean> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        console.warn(`Agent ${agentId} not found`);
        return false;
      }

      // Update agent
      agent.status = status;
      agent.lastActivity = Date.now();
      this.agents.set(agentId, agent);
      await this.saveAgents();

      // Log status change
      await this.logEvent({
        type: 'info',
        severity: 'low',
        category: 'system',
        source: 'agent-coordinator',
        title: 'Agent Status Updated',
        description: `Agent ${agent.name} (${agentId}) status changed to ${status}`,
        data: { agentId, status }
      });

      return true;
    } catch (error) {
      console.error('Failed to update agent status:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get registered agents
   * @param filters Optional filters
   * @returns Array of agents
   */
  static async getAgents(filters?: {
    type?: AgentInfo['type'];
    status?: AgentInfo['status'];
    capability?: string;
  }): Promise<AgentInfo[]> {
    try {
      let agents = Array.from(this.agents.values());

      // Apply filters
      if (filters) {
        if (filters.type) {
          agents = agents.filter(agent => agent.type === filters.type);
        }
        if (filters.status) {
          agents = agents.filter(agent => agent.status === filters.status);
        }
        if (filters.capability) {
          agents = agents.filter(agent => agent.capabilities.includes(filters.capability!));
        }
      }

      return agents;
    } catch (error) {
      console.error('Failed to get agents:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Report a security event
   * @param event Security event to report
   * @returns Event ID
   */
  static async reportEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'handled'>): Promise<string> {
    try {
      const fullEvent: SecurityEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: Date.now(),
        handled: false
      };

      // Store event
      await this.storeEvent(fullEvent);

      // Check policy enforcement
      if (this.config.enablePolicyEnforcement) {
        await this.enforcePolicies(fullEvent);
      }

      // Share event with other agents
      if (this.config.enableEventSharing) {
        await this.shareEvent(fullEvent);
      }

      // Trigger event handlers
      this.triggerEventHandlers(fullEvent);

      // Auto-resolve if enabled
      if (this.config.autoResolveEvents) {
        await this.autoResolveEvent(fullEvent);
      }

      return fullEvent.id;
    } catch (error) {
      console.error('Failed to report security event:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to report security event');
    }
  }

  /**
   * Get security events
   * @param filters Optional filters
   * @param limit Maximum number of events to return
   * @returns Array of security events
   */
  static async getEvents(filters?: {
    type?: SecurityEvent['type'];
    severity?: SecurityEvent['severity'];
    category?: SecurityEvent['category'];
    source?: string;
    handled?: boolean;
    startDate?: number;
    endDate?: number;
  }, limit?: number): Promise<SecurityEvent[]> {
    try {
      const result = await chrome.storage.local.get([this.EVENTS_KEY]);
      let events: SecurityEvent[] = result[this.EVENTS_KEY] || [];

      // Apply filters
      if (filters) {
        if (filters.type) {
          events = events.filter(event => event.type === filters.type);
        }
        if (filters.severity) {
          events = events.filter(event => event.severity === filters.severity);
        }
        if (filters.category) {
          events = events.filter(event => event.category === filters.category);
        }
        if (filters.source) {
          events = events.filter(event => event.source === filters.source);
        }
        if (filters.handled !== undefined) {
          events = events.filter(event => event.handled === filters.handled);
        }
        if (filters.startDate) {
          events = events.filter(event => event.timestamp >= filters.startDate!);
        }
        if (filters.endDate) {
          events = events.filter(event => event.timestamp <= filters.endDate!);
        }
      }

      // Sort by timestamp (newest first)
      events.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (limit) {
        events = events.slice(0, limit);
      }

      return events;
    } catch (error) {
      console.error('Failed to get security events:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Create a security policy
   * @param policy Policy to create
   * @returns Policy ID
   */
  static async createPolicy(policy: Omit<SecurityPolicy, 'id' | 'lastUpdated'>): Promise<string> {
    try {
      const newPolicy: SecurityPolicy = {
        ...policy,
        id: this.generatePolicyId(),
        lastUpdated: Date.now()
      };

      this.policies.set(newPolicy.id, newPolicy);
      await this.savePolicies();

      // Log policy creation
      await this.logEvent({
        type: 'info',
        severity: 'medium',
        category: 'system',
        source: 'agent-coordinator',
        title: 'Security Policy Created',
        description: `Security policy ${newPolicy.name} created`,
        data: { policy: newPolicy }
      });

      return newPolicy.id;
    } catch (error) {
      console.error('Failed to create security policy:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to create security policy');
    }
  }

  /**
   * Update a security policy
   * @param policyId ID of policy to update
   * @param updates Policy updates
   * @returns True if update successful
   */
  static async updatePolicy(policyId: string, updates: Partial<SecurityPolicy>): Promise<boolean> {
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        console.warn(`Policy ${policyId} not found`);
        return false;
      }

      // Update policy
      const updatedPolicy: SecurityPolicy = {
        ...policy,
        ...updates,
        id: policyId,
        lastUpdated: Date.now()
      };

      this.policies.set(policyId, updatedPolicy);
      await this.savePolicies();

      // Log policy update
      await this.logEvent({
        type: 'info',
        severity: 'medium',
        category: 'system',
        source: 'agent-coordinator',
        title: 'Security Policy Updated',
        description: `Security policy ${updatedPolicy.name} updated`,
        data: { policyId, updates }
      });

      return true;
    } catch (error) {
      console.error('Failed to update security policy:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get security policies
   * @param filters Optional filters
   * @returns Array of security policies
   */
  static async getPolicies(filters?: {
    type?: SecurityPolicy['type'];
    enabled?: boolean;
    priority?: SecurityPolicy['priority'];
  }): Promise<SecurityPolicy[]> {
    try {
      let policies = Array.from(this.policies.values());

      // Apply filters
      if (filters) {
        if (filters.type) {
          policies = policies.filter(policy => policy.type === filters.type);
        }
        if (filters.enabled !== undefined) {
          policies = policies.filter(policy => policy.enabled === filters.enabled);
        }
        if (filters.priority) {
          policies = policies.filter(policy => policy.priority === filters.priority);
        }
      }

      return policies;
    } catch (error) {
      console.error('Failed to get security policies:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Register event handler
   * @param id Handler ID
   * @param handler Event handler function
   */
  static registerEventHandler(id: string, handler: (event: SecurityEvent) => void): void {
    this.eventHandlers.set(id, handler);
  }

  /**
   * Unregister event handler
   * @param id Handler ID
   */
  static unregisterEventHandler(id: string): void {
    this.eventHandlers.delete(id);
  }

  /**
   * Authenticate agent
   * @param agentId Agent ID
   * @param token Authentication token
   * @returns True if authentication successful
   */
  static async authenticateAgent(agentId: string, token: string): Promise<boolean> {
    try {
      if (!this.config.enableCrossAgentAuth) {
        return true; // Skip authentication if disabled
      }

      const agent = this.agents.get(agentId);
      if (!agent) {
        console.warn(`Agent ${agentId} not found`);
        return false;
      }

      // This is a placeholder for authentication logic
      // In a real implementation, this would validate the token
      const isValidToken = token === `${agentId}-${agent.lastActivity}`;

      if (isValidToken) {
        // Update last activity
        agent.lastActivity = Date.now();
        this.agents.set(agentId, agent);
        await this.saveAgents();
      }

      return isValidToken;
    } catch (error) {
      console.error('Failed to authenticate agent:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Generate agent authentication token
   * @param agentId Agent ID
   * @returns Authentication token
   */
  static generateAuthToken(agentId: string): string {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return `${agentId}-${agent.lastActivity}`;
  }

  /**
   * Validate agent information
   * @param agent Agent to validate
   * @returns True if valid
   */
  private static validateAgent(agent: AgentInfo): boolean {
    // Check required fields
    if (!agent.id || !agent.name || !agent.type || !agent.status) {
      return false;
    }

    // Check ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(agent.id)) {
      return false;
    }

    // Check type
    const validTypes: AgentInfo['type'][] = ['security', 'api', 'ui', 'storage', 'network', 'ai'];
    if (!validTypes.includes(agent.type)) {
      return false;
    }

    // Check status
    const validStatuses: AgentInfo['status'][] = ['active', 'inactive', 'error'];
    if (!validStatuses.includes(agent.status)) {
      return false;
    }

    return true;
  }

  /**
   * Store security event
   * @param event Event to store
   */
  private static async storeEvent(event: SecurityEvent): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.EVENTS_KEY]);
      const events: SecurityEvent[] = result[this.EVENTS_KEY] || [];

      events.push(event);

      // Apply retention policy
      const cutoffDate = Date.now() - (this.config.eventRetentionDays * 24 * 60 * 60 * 1000);
      const filteredEvents = events.filter(e => e.timestamp >= cutoffDate);

      await chrome.storage.local.set({ [this.EVENTS_KEY]: filteredEvents });
    } catch (error) {
      console.error('Failed to store security event:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Enforce security policies
   * @param event Event to check against policies
   */
  private static async enforcePolicies(event: SecurityEvent): Promise<void> {
    try {
      const policies = await this.getPolicies({ enabled: true });
      
      for (const policy of policies) {
        for (const rule of policy.rules) {
          if (!rule.enabled) {
            continue;
          }

          // Check if rule applies to event
          if (this.evaluateRuleCondition(rule.condition, event)) {
            // Apply rule action
            switch (rule.action) {
              case 'block':
                await this.blockEvent(event, policy.name, rule.name);
                break;
              case 'warn':
                await this.warnEvent(event, policy.name, rule.name);
                break;
              case 'log':
                // Event is already logged
                break;
              case 'allow':
                // Allow event
                break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to enforce policies:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Evaluate rule condition
   * @param condition Rule condition
   * @param event Event to evaluate
   * @returns True if condition matches
   */
  private static evaluateRuleCondition(condition: string, event: SecurityEvent): boolean {
    // This is a placeholder for condition evaluation
    // In a real implementation, this would parse and evaluate the condition
    try {
      // Simple string matching for now
      if (condition.includes('type:')) {
        const expectedType = condition.split('type:')[1].trim();
        return event.type === expectedType;
      }
      
      if (condition.includes('severity:')) {
        const expectedSeverity = condition.split('severity:')[1].trim();
        return event.severity === expectedSeverity;
      }
      
      if (condition.includes('category:')) {
        const expectedCategory = condition.split('category:')[1].trim();
        return event.category === expectedCategory;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to evaluate rule condition:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Block an event
   * @param event Event to block
   * @param policyName Policy name
   * @param ruleName Rule name
   */
  private static async blockEvent(event: SecurityEvent, policyName: string, ruleName: string): Promise<void> {
    // Log block action
    await this.logEvent({
      type: 'warning',
      severity: 'high',
      category: 'system',
      source: 'agent-coordinator',
      title: 'Event Blocked',
      description: `Event blocked by policy ${policyName}, rule ${ruleName}`,
      data: { originalEvent: event, policyName, ruleName }
    });

    // In a real implementation, this would prevent the event from proceeding
    console.warn(`Event blocked by policy ${policyName}, rule ${ruleName}:`, event);
  }

  /**
   * Warn about an event
   * @param event Event to warn about
   * @param policyName Policy name
   * @param ruleName Rule name
   */
  private static async warnEvent(event: SecurityEvent, policyName: string, ruleName: string): Promise<void> {
    // Log warning
    await this.logEvent({
      type: 'warning',
      severity: 'medium',
      category: 'system',
      source: 'agent-coordinator',
      title: 'Event Warning',
      description: `Event warning by policy ${policyName}, rule ${ruleName}`,
      data: { originalEvent: event, policyName, ruleName }
    });

    console.warn(`Event warning by policy ${policyName}, rule ${ruleName}:`, event);
  }

  /**
   * Share event with other agents
   * @param event Event to share
   */
  private static async shareEvent(event: SecurityEvent): Promise<void> {
    try {
      const agents = await this.getAgents({ status: 'active' });
      
      for (const agent of agents) {
        if (agent.id === 'agent-coordinator') {
          continue; // Skip self
        }

        // In a real implementation, this would send the event to the agent
        console.log(`Sharing event with agent ${agent.name}:`, event);
      }
    } catch (error) {
      console.error('Failed to share event:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Trigger event handlers
   * @param event Event to handle
   */
  private static triggerEventHandlers(event: SecurityEvent): void {
    for (const [id, handler] of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`Event handler ${id} failed:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  /**
   * Auto-resolve event if possible
   * @param event Event to resolve
   */
  private static async autoResolveEvent(event: SecurityEvent): Promise<void> {
    try {
      // Only auto-resolve low severity events
      if (event.severity !== 'low') {
        return;
      }

      // Mark as handled
      event.handled = true;
      event.handledBy = 'agent-coordinator';
      event.resolvedAt = Date.now();

      await this.storeEvent(event);

      console.log(`Auto-resolved event ${event.id}:`, event);
    } catch (error) {
      console.error('Failed to auto-resolve event:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Start policy refresh timer
   */
  private static startPolicyRefreshTimer(): void {
    if (this.policyRefreshTimer) {
      clearInterval(this.policyRefreshTimer);
    }

    this.policyRefreshTimer = setInterval(async () => {
      try {
        await this.refreshPolicies();
      } catch (error) {
        console.error('Policy refresh failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }, this.config.policyRefreshInterval * 60 * 1000); // Convert minutes to milliseconds
  }

  /**
   * Refresh policies
   */
  private static async refreshPolicies(): Promise<void> {
    try {
      // This is a placeholder for policy refresh
      // In a real implementation, this would fetch policies from a central source
      console.log('Refreshing policies...');
      
      // Log refresh
      await this.logEvent({
        type: 'info',
        severity: 'low',
        category: 'system',
        source: 'agent-coordinator',
        title: 'Policies Refreshed',
        description: 'Security policies refreshed successfully'
      });
    } catch (error) {
      console.error('Failed to refresh policies:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Log an event
   * @param event Event to log
   */
  private static async logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'handled'>): Promise<void> {
    try {
      const fullEvent: SecurityEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: Date.now(),
        handled: false
      };

      await this.storeEvent(fullEvent);
    } catch (error) {
      console.error('Failed to log event:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Load agents
   */
  private static async loadAgents(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.AGENTS_KEY]);
      const agents: Record<string, AgentInfo> = result[this.AGENTS_KEY] || {};
      
      this.agents = new Map(Object.entries(agents));
    } catch (error) {
      console.error('Failed to load agents:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Save agents
   */
  private static async saveAgents(): Promise<void> {
    try {
      const agents = Object.fromEntries(this.agents);
      await chrome.storage.local.set({ [this.AGENTS_KEY]: agents });
    } catch (error) {
      console.error('Failed to save agents:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Load policies
   */
  private static async loadPolicies(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.POLICIES_KEY]);
      const policies: Record<string, SecurityPolicy> = result[this.POLICIES_KEY] || {};
      
      this.policies = new Map(Object.entries(policies));
    } catch (error) {
      console.error('Failed to load policies:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Save policies
   */
  private static async savePolicies(): Promise<void> {
    try {
      const policies = Object.fromEntries(this.policies);
      await chrome.storage.local.set({ [this.POLICIES_KEY]: policies });
    } catch (error) {
      console.error('Failed to save policies:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Generate event ID
   * @returns Unique event ID
   */
  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate policy ID
   * @returns Unique policy ID
   */
  private static generatePolicyId(): string {
    return `pol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get agent coordinator configuration
   * @returns Configuration
   */
  static async getConfig(): Promise<AgentCoordinatorConfig> {
    try {
      const result = await chrome.storage.local.get([this.CONFIG_KEY]);
      return result[this.CONFIG_KEY] || this.DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to get agent coordinator config:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Update agent coordinator configuration
   * @param config New configuration
   */
  static async updateConfig(config: Partial<AgentCoordinatorConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });

      // Restart policy refresh timer if interval changed
      if (config.policyRefreshInterval) {
        this.startPolicyRefreshTimer();
      }
    } catch (error) {
      console.error('Failed to update agent coordinator config:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to update agent coordinator config');
    }
  }

  /**
   * Cleanup resources
   */
  static cleanup(): void {
    if (this.policyRefreshTimer) {
      clearInterval(this.policyRefreshTimer);
      this.policyRefreshTimer = undefined;
    }
    
    this.agents.clear();
    this.policies.clear();
    this.eventHandlers.clear();
  }
}
