/**
 * Natural language command parser
 */

import { 
  CommandIntent,
  CommandEntities,
  CommandParameters,
  EnhancedParsedCommand,
  CommandPattern,
  CommandContext,
  ParsingResult,
  LanguageDetection,
  CommandClassification,
  CommandParsingError,
  ElementInfo,
  UserPreferences,
  SessionInfo
} from './types';
import { AutomationCommand } from '../shared/contracts';
import { OpenRouterClient } from '../openrouter/client';

export class CommandParser {
  private patterns: CommandPattern[] = [];
  private openRouterClient: OpenRouterClient;
  private context: CommandContext;
  private userPreferences: UserPreferences;

  constructor(
    openRouterClient: OpenRouterClient,
    context: CommandContext = {},
    userPreferences: UserPreferences = {
      language: 'en',
      defaultSearchEngine: 'google',
      securityLevel: 'medium',
      enableAutoCorrection: true,
      enableSuggestions: true,
    }
  ) {
    this.openRouterClient = openRouterClient;
    this.context = context;
    this.userPreferences = userPreferences;
    this.initializePatterns();
  }

  /**
   * Parse natural language command into structured commands
   */
  async parseCommand(
    input: string,
    context?: CommandContext
  ): Promise<ParsingResult> {
    const startTime = Date.now();
    const mergedContext = { ...this.context, ...context };
    
    try {
      // Detect language
      const language = this.detectLanguage(input);
      
      // Preprocess input
      const preprocessedInput = this.preprocessInput(input, language);
      
      // Try pattern matching first
      const patternResult = this.tryPatternMatching(preprocessedInput, mergedContext);
      
      if (patternResult.confidence > 0.8) {
        return {
          ...patternResult,
          processingTime: Date.now() - startTime,
        };
      }
      
      // Use AI for complex parsing
      const aiResult = await this.useAIParsing(preprocessedInput, mergedContext, language);
      
      // Merge results
      const mergedResult = this.mergeParsingResults(patternResult, aiResult);
      
      return {
        ...mergedResult,
        processingTime: Date.now() - startTime,
      };

    } catch (error) {
      return {
        commands: [],
        workflows: [],
        confidence: 0,
        requiresClarification: true,
        clarificationQuestions: ['I had trouble understanding your command. Could you please rephrase it?'],
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        warnings: [],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Detect the language of the input
   */
  private detectLanguage(input: string): LanguageDetection {
    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const spanishWords = ['el', 'la', 'y', 'o', 'pero', 'en', 'a', 'para', 'de', 'con', 'por'];
    const frenchWords = ['le', 'la', 'et', 'ou', 'mais', 'dans', 'à', 'pour', 'de', 'avec', 'par'];
    
    const words = input.toLowerCase().split(/\s+/);
    const englishCount = words.filter(word => englishWords.includes(word)).length;
    const spanishCount = words.filter(word => spanishWords.includes(word)).length;
    const frenchCount = words.filter(word => frenchWords.includes(word)).length;
    
    const total = englishCount + spanishCount + frenchCount;
    
    if (total === 0) {
      return {
        language: 'en',
        confidence: 0.5,
        alternatives: [],
      };
    }
    
    const englishConfidence = englishCount / total;
    const spanishConfidence = spanishCount / total;
    const frenchConfidence = frenchCount / total;
    
    const maxConfidence = Math.max(englishConfidence, spanishConfidence, frenchConfidence);
    
    if (maxConfidence === englishConfidence) {
      return {
        language: 'en',
        confidence: maxConfidence,
        alternatives: [
          { language: 'es', confidence: spanishConfidence },
          { language: 'fr', confidence: frenchConfidence },
        ],
      };
    } else if (maxConfidence === spanishConfidence) {
      return {
        language: 'es',
        confidence: maxConfidence,
        alternatives: [
          { language: 'en', confidence: englishConfidence },
          { language: 'fr', confidence: frenchConfidence },
        ],
      };
    } else {
      return {
        language: 'fr',
        confidence: maxConfidence,
        alternatives: [
          { language: 'en', confidence: englishConfidence },
          { language: 'es', confidence: spanishConfidence },
        ],
      };
    }
  }

  /**
   * Preprocess the input text
   */
  private preprocessInput(input: string, language: LanguageDetection): string {
    let processed = input.toLowerCase().trim();
    
    // Remove extra whitespace
    processed = processed.replace(/\s+/g, ' ');
    
    // Expand common abbreviations
    const abbreviations = {
      'en': {
        'click': 'click on',
        'go': 'navigate to',
        'search': 'search for',
        'fill': 'fill in',
        'type': 'type in',
        'scroll': 'scroll down',
      },
      'es': {
        'haz clic': 'click en',
        'ir': 'navegar a',
        'buscar': 'buscar en',
        'rellenar': 'rellenar en',
        'escribir': 'escribir en',
        'desplazar': 'desplazar hacia abajo',
      },
      'fr': {
        'cliquez': 'cliquez sur',
        'aller': 'naviguer vers',
        'rechercher': 'rechercher',
        'remplir': 'remplir',
        'écrire': 'écrire',
        'défiler': 'défiler vers le bas',
      },
    };
    
    const langAbbrevs = abbreviations[language.language as keyof typeof abbreviations] || abbreviations.en;
    
    Object.entries(langAbbrevs).forEach(([abbr, expansion]) => {
      const regex = new RegExp(`\\b${abbr}\\b`, 'g');
      processed = processed.replace(regex, expansion);
    });
    
    return processed;
  }

  /**
   * Try to match against known patterns
   */
  private tryPatternMatching(input: string, context: CommandContext): ParsingResult {
    const commands: EnhancedParsedCommand[] = [];
    const errors: CommandParsingError[] = [];
    const warnings: string[] = [];
    
    let bestMatch: { pattern: CommandPattern; match: RegExpMatchArray; confidence: number } | null = null;
    
    // Find best matching pattern
    for (const pattern of this.patterns) {
      const match = input.match(pattern.pattern);
      if (match) {
        const confidence = this.calculatePatternConfidence(pattern, match, input, context);
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { pattern, match, confidence };
        }
      }
    }
    
    if (bestMatch) {
      const command = this.createCommandFromPattern(bestMatch.pattern, bestMatch.match, input, context);
      commands.push(command);
    }
    
    // If no pattern matched, create a basic unknown command
    if (commands.length === 0) {
      const unknownCommand: EnhancedParsedCommand = {
        intent: 'unknown',
        entities: {},
        parameters: {},
        confidence: 0.1,
        requiresClarification: true,
        clarificationQuestion: 'I didn\'t understand that command. Could you please be more specific?',
        originalText: input,
        language: 'en',
        complexity: 'simple',
        requiredPermissions: [],
        securityLevel: 'low',
      };
      commands.push(unknownCommand);
    }
    
    return {
      commands,
      workflows: [],
      confidence: bestMatch?.confidence || 0.1,
      requiresClarification: bestMatch?.confidence < 0.8,
      errors: errors.map(e => e.message),
      warnings,
      processingTime: 0,
    };
  }

  /**
   * Use AI for command parsing
   */
  private async useAIParsing(
    input: string,
    context: CommandContext,
    language: LanguageDetection
  ): Promise<ParsingResult> {
    try {
      const contextPrompt = this.buildContextPrompt(context);
      const languagePrompt = language.language !== 'en' ? `Please respond in ${language.language}.` : '';
      
      const prompt = `
Parse the following natural language command into structured automation commands:

Command: "${input}"

${contextPrompt}

${languagePrompt}

Please analyze this command and provide a structured response in JSON format with:
1. The detected intent
2. Extracted entities (URLs, selectors, text, numbers, etc.)
3. Required parameters for execution
4. Confidence level (0-1)
5. Whether clarification is needed
6. Security risk level
7. Required permissions

Focus on browser automation tasks like navigation, clicking, form filling, scrolling, and data extraction.
Be conservative and safe - never suggest actions that could be harmful.
`;

      const aiResponse = await this.openRouterClient.parseCommand(prompt, context);
      
      const commands: EnhancedParsedCommand[] = [];
      
      for (const cmd of aiResponse.commands) {
        const enhancedCommand: EnhancedParsedCommand = {
          intent: cmd.type as CommandIntent,
          entities: this.extractEntitiesFromCommand(cmd),
          parameters: this.extractParametersFromCommand(cmd),
          confidence: cmd.confidence || aiResponse.confidence,
          requiresClarification: aiResponse.requiresClarification,
          clarificationQuestion: aiResponse.clarificationQuestion,
          originalText: input,
          language: language.language,
          complexity: this.assessComplexity(cmd),
          requiredPermissions: this.getRequiredPermissions(cmd),
          securityLevel: this.assessSecurityLevel(cmd),
        };
        
        commands.push(enhancedCommand);
      }
      
      return {
        commands,
        workflows: [],
        confidence: aiResponse.confidence,
        requiresClarification: aiResponse.requiresClarification,
        clarificationQuestions: aiResponse.clarificationQuestion ? [aiResponse.clarificationQuestion] : [],
        suggestions: aiResponse.alternativeCommands?.map(alt => alt.description),
        errors: [],
        warnings: [],
        processingTime: 0,
      };

    } catch (error) {
      return {
        commands: [],
        workflows: [],
        confidence: 0,
        requiresClarification: true,
        clarificationQuestions: ['I had trouble processing your command. Please try again.'],
        errors: [error instanceof Error ? error.message : 'AI parsing failed'],
        warnings: [],
        processingTime: 0,
      };
    }
  }

  /**
   * Initialize command patterns
   */
  private initializePatterns(): void {
    this.patterns = [
      // Navigation patterns
      {
        id: 'navigate_to_url',
        pattern: /\b(go to|navigate to|open|visit)\s+(https?:\/\/[^\s]+)/i,
        intent: 'navigate',
        parameters: { url: '' },
        examples: ['go to https://example.com', 'navigate to https://google.com'],
        confidence: 0.9,
        requiredEntities: ['urls'],
        optionalEntities: [],
      },
      {
        id: 'navigate_search',
        pattern: /\b(go to|navigate to|open|visit)\s+(.+?)(?:\s+website|\s+site)?$/i,
        intent: 'navigate',
        parameters: { url: '' },
        examples: ['go to google', 'navigate to facebook'],
        confidence: 0.7,
        requiredEntities: ['text'],
        optionalEntities: [],
      },
      
      // Click patterns
      {
        id: 'click_element',
        pattern: /\b(click|click on|press)\s+(?:the\s+)?(.+?)(?:\s+button|\s+link|\s+element)?$/i,
        intent: 'click',
        parameters: { selector: '', text: '' },
        examples: ['click submit button', 'click on the login link'],
        confidence: 0.8,
        requiredEntities: ['text'],
        optionalEntities: ['selectors'],
      },
      
      // Fill patterns
      {
        id: 'fill_form',
        pattern: /\b(fill|fill in|type|enter)\s+(.+?)\s+in(?:to)?\s+(.+?)(?:\s+field|\s+input)?$/i,
        intent: 'fill',
        parameters: { value: '', selector: '' },
        examples: ['fill john in the name field', 'type password123 in the password input'],
        confidence: 0.85,
        requiredEntities: ['text'],
        optionalEntities: ['selectors'],
      },
      
      // Search patterns
      {
        id: 'search_query',
        pattern: /\bsearch\s+(?:for\s+)?(.+?)(?:\s+on\s+(.+?))?$/i,
        intent: 'search',
        parameters: { query: '', searchEngine: 'google' },
        examples: ['search for cats', 'search for restaurants on bing'],
        confidence: 0.9,
        requiredEntities: ['text'],
        optionalEntities: ['text'],
      },
      
      // Scroll patterns
      {
        id: 'scroll_direction',
        pattern: /\bscroll\s+(up|down|left|right)(?:\s+(\d+|page|to\s+(?:top|bottom)))?$/i,
        intent: 'scroll',
        parameters: { direction: 'down', amount: 'page' },
        examples: ['scroll down', 'scroll up 2', 'scroll to bottom'],
        confidence: 0.95,
        requiredEntities: ['directions'],
        optionalEntities: ['numbers'],
      },
      
      // Extract patterns
      {
        id: 'extract_data',
        pattern: /\b(extract|get|copy|save)\s+(.+?)(?:\s+from\s+(.+?))?$/i,
        intent: 'extract',
        parameters: { extractType: 'text' },
        examples: ['extract all links', 'get the prices from the table'],
        confidence: 0.8,
        requiredEntities: ['text'],
        optionalEntities: ['text'],
      },
      
      // Wait patterns
      {
        id: 'wait_duration',
        pattern: /\bwait\s+(?:for\s+)?(\d+)\s+(seconds?|minutes?|ms)?$/i,
        intent: 'wait',
        parameters: { duration: 0 },
        examples: ['wait 5 seconds', 'wait for 2 minutes'],
        confidence: 0.95,
        requiredEntities: ['numbers'],
        optionalEntities: [],
      },
    ];
  }

  /**
   * Calculate confidence for pattern matching
   */
  private calculatePatternConfidence(
    pattern: CommandPattern,
    match: RegExpMatchArray,
    input: string,
    context: CommandContext
  ): number {
    let confidence = pattern.confidence;
    
    // Adjust based on match quality
    const matchLength = match[0]?.length || 0;
    const inputLength = input.length;
    const coverage = matchLength / inputLength;
    confidence *= (0.5 + 0.5 * coverage);
    
    // Adjust based on required entities
    const hasRequiredEntities = this.checkRequiredEntities(pattern, match, context);
    if (!hasRequiredEntities) {
      confidence *= 0.7;
    }
    
    // Adjust based on context relevance
    if (context.currentUrl && pattern.intent === 'navigate') {
      confidence *= 0.8; // Less likely to navigate when already on a page
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Create command from pattern match
   */
  private createCommandFromPattern(
    pattern: CommandPattern,
    match: RegExpMatchArray,
    input: string,
    context: CommandContext
  ): EnhancedParsedCommand {
    const entities = this.extractEntities(pattern, match, context);
    const parameters = this.extractParameters(pattern, match, entities);
    
    return {
      intent: pattern.intent,
      entities,
      parameters,
      confidence: this.calculatePatternConfidence(pattern, match, input, context),
      requiresClarification: false,
      originalText: input,
      language: this.userPreferences.language,
      complexity: 'simple',
      requiredPermissions: this.getRequiredPermissionsFromIntent(pattern.intent),
      securityLevel: this.assessSecurityLevelFromIntent(pattern.intent),
    };
  }

  /**
   * Extract entities from pattern match
   */
  private extractEntities(
    pattern: CommandPattern,
    match: RegExpMatchArray,
    context: CommandContext
  ): CommandEntities {
    const entities: CommandEntities = {};
    
    // Extract URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = match.input.match(urlRegex) || [];
    if (urls.length > 0) {
      entities.urls = urls;
    }
    
    // Extract numbers
    const numberRegex = /\b\d+(\.\d+)?\b/g;
    const numbers = (match.input.match(numberRegex) || []).map(n => parseFloat(n));
    if (numbers.length > 0) {
      entities.numbers = numbers;
    }
    
    // Extract text content from capture groups
    const textContent = match.slice(1).filter(group => group && !group.match(/^https?:\/\//));
    if (textContent.length > 0) {
      entities.text = textContent;
    }
    
    return entities;
  }

  /**
   * Extract parameters from pattern match
   */
  private extractParameters(
    pattern: CommandPattern,
    match: RegExpMatchArray,
    entities: CommandEntities
  ): CommandParameters {
    const parameters: CommandParameters = { ...pattern.parameters };
    
    // Fill parameters based on entities
    if (entities.urls && entities.urls.length > 0) {
      parameters.url = entities.urls[0];
    }
    
    if (entities.text && entities.text.length > 0) {
      if (pattern.intent === 'click') {
        parameters.text = entities.text[0];
      } else if (pattern.intent === 'fill') {
        parameters.value = entities.text[0];
        if (entities.text.length > 1) {
          parameters.fieldName = entities.text[1];
        }
      } else if (pattern.intent === 'search') {
        parameters.query = entities.text[0];
      }
    }
    
    if (entities.numbers && entities.numbers.length > 0) {
      if (pattern.intent === 'wait') {
        parameters.duration = entities.numbers[0];
      } else if (pattern.intent === 'scroll') {
        parameters.amount = entities.numbers[0];
      }
    }
    
    return parameters;
  }

  /**
   * Check if required entities are present
   */
  private checkRequiredEntities(
    pattern: CommandPattern,
    match: RegExpMatchArray,
    context: CommandContext
  ): boolean {
    for (const requiredEntity of pattern.requiredEntities) {
      switch (requiredEntity) {
        case 'urls':
          if (!match.input.match(/https?:\/\/[^\s]+/)) {
            return false;
          }
          break;
        case 'text':
          if (match.slice(1).every(group => !group || group.match(/^https?:\/\//))) {
            return false;
          }
          break;
        case 'numbers':
          if (!match.input.match(/\b\d+(\.\d+)?\b/)) {
            return false;
          }
          break;
        case 'directions':
          if (!match.input.match(/\b(up|down|left|right)\b/i)) {
            return false;
          }
          break;
      }
    }
    return true;
  }

  /**
   * Build context prompt for AI
   */
  private buildContextPrompt(context: CommandContext): string {
    let contextPrompt = '';
    
    if (context.currentUrl) {
      contextPrompt += `Current URL: ${context.currentUrl}\n`;
    }
    
    if (context.pageTitle) {
      contextPrompt += `Page title: ${context.pageTitle}\n`;
    }
    
    if (context.availableElements && context.availableElements.length > 0) {
      contextPrompt += `Available elements:\n`;
      context.availableElements.slice(0, 10).forEach(element => {
        contextPrompt += `- ${element.selector}: ${element.text}\n`;
      });
    }
    
    if (context.previousCommands && context.previousCommands.length > 0) {
      contextPrompt += `Previous commands: ${context.previousCommands.slice(-3).join(', ')}\n`;
    }
    
    return contextPrompt;
  }

  /**
   * Merge parsing results from pattern matching and AI
   */
  private mergeParsingResults(
    patternResult: ParsingResult,
    aiResult: ParsingResult
  ): ParsingResult {
    // If AI result is much better, use it
    if (aiResult.confidence > patternResult.confidence + 0.2) {
      return aiResult;
    }
    
    // If pattern result is good, use it
    if (patternResult.confidence > 0.8) {
      return patternResult;
    }
    
    // Otherwise, combine results
    const combinedCommands = [...patternResult.commands, ...aiResult.commands];
    const combinedConfidence = Math.max(patternResult.confidence, aiResult.confidence);
    
    return {
      commands: combinedCommands,
      workflows: [...patternResult.workflows, ...aiResult.workflows],
      confidence: combinedConfidence,
      requiresClarification: combinedConfidence < 0.7,
      clarificationQuestions: [
        ...patternResult.clarificationQuestions || [],
        ...aiResult.clarificationQuestions || [],
      ],
      suggestions: [
        ...patternResult.suggestions || [],
        ...aiResult.suggestions || [],
      ],
      errors: [...patternResult.errors, ...aiResult.errors],
      warnings: [...patternResult.warnings, ...aiResult.warnings],
      processingTime: patternResult.processingTime + aiResult.processingTime,
    };
  }

  /**
   * Extract entities from AI command
   */
  private extractEntitiesFromCommand(cmd: any): CommandEntities {
    const entities: CommandEntities = {};
    
    if (cmd.url) {
      entities.urls = [cmd.url];
    }
    
    if (cmd.selector) {
      entities.selectors = [cmd.selector];
    }
    
    if (cmd.value || cmd.text) {
      entities.text = [cmd.value || cmd.text];
    }
    
    if (cmd.timeout || cmd.duration) {
      entities.waitTimes = [cmd.timeout || cmd.duration];
    }
    
    return entities;
  }

  /**
   * Extract parameters from AI command
   */
  private extractParametersFromCommand(cmd: any): CommandParameters {
    return {
      url: cmd.url,
      selector: cmd.selector,
      value: cmd.value,
      text: cmd.text,
      duration: cmd.timeout || cmd.duration,
      direction: cmd.direction,
      amount: cmd.amount,
      query: cmd.query,
      extractType: cmd.extractType,
      options: cmd.options,
    };
  }

  /**
   * Assess command complexity
   */
  private assessComplexity(cmd: any): 'simple' | 'moderate' | 'complex' {
    let complexity = 0;
    
    if (cmd.url) complexity += 1;
    if (cmd.selector) complexity += 2;
    if (cmd.value) complexity += 1;
    if (cmd.options && Object.keys(cmd.options).length > 0) complexity += 2;
    
    if (complexity <= 2) return 'simple';
    if (complexity <= 4) return 'moderate';
    return 'complex';
  }

  /**
   * Get required permissions for a command
   */
  private getRequiredPermissions(cmd: any): string[] {
    const permissions: string[] = [];
    
    if (cmd.url) permissions.push('navigation');
    if (cmd.selector) permissions.push('dom_access');
    if (cmd.value) permissions.push('form_interaction');
    if (cmd.extractType) permissions.push('data_extraction');
    
    return permissions;
  }

  /**
   * Assess security level of a command
   */
  private assessSecurityLevel(cmd: any): 'low' | 'medium' | 'high' {
    let riskScore = 0;
    
    if (cmd.url && cmd.url.includes('http://')) riskScore += 1;
    if (cmd.value && cmd.value.includes('password')) riskScore += 2;
    if (cmd.options && cmd.options.sensitive) riskScore += 2;
    
    if (riskScore >= 3) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }

  /**
   * Get required permissions from intent
   */
  private getRequiredPermissionsFromIntent(intent: CommandIntent): string[] {
    const permissionMap: Record<CommandIntent, string[]> = {
      navigate: ['navigation'],
      click: ['dom_access'],
      fill: ['dom_access', 'form_interaction'],
      scroll: ['dom_access'],
      submit: ['dom_access', 'form_interaction'],
      extract: ['dom_access', 'data_extraction'],
      wait: [],
      search: ['navigation', 'dom_access'],
      login: ['dom_access', 'form_interaction'],
      logout: ['dom_access', 'form_interaction'],
      select: ['dom_access'],
      hover: ['dom_access'],
      drag: ['dom_access'],
      upload: ['dom_access', 'form_interaction', 'file_access'],
      download: ['file_access'],
      screenshot: ['dom_access', 'data_extraction'],
      unknown: [],
    };
    
    return permissionMap[intent] || [];
  }

  /**
   * Assess security level from intent
   */
  private assessSecurityLevelFromIntent(intent: CommandIntent): 'low' | 'medium' | 'high' {
    const riskMap: Record<CommandIntent, 'low' | 'medium' | 'high'> = {
      navigate: 'low',
      click: 'low',
      fill: 'medium',
      scroll: 'low',
      submit: 'medium',
      extract: 'medium',
      wait: 'low',
      search: 'low',
      login: 'high',
      logout: 'medium',
      select: 'low',
      hover: 'low',
      drag: 'low',
      upload: 'high',
      download: 'medium',
      screenshot: 'medium',
      unknown: 'low',
    };
    
    return riskMap[intent] || 'low';
  }

  /**
   * Update parser context
   */
  public updateContext(context: Partial<CommandContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Update user preferences
   */
  public updateUserPreferences(preferences: Partial<UserPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...preferences };
  }

  /**
   * Add custom pattern
   */
  public addPattern(pattern: CommandPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Remove pattern by ID
   */
  public removePattern(patternId: string): boolean {
    const index = this.patterns.findIndex(p => p.id === patternId);
    if (index > -1) {
      this.patterns.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all patterns
   */
  public getPatterns(): CommandPattern[] {
    return [...this.patterns];
  }
} * Natural language command parser
 */

import { 
  CommandIntent,
  CommandEntities,
  CommandParameters,
  EnhancedParsedCommand,
  CommandPattern,
  CommandContext,
  ParsingResult,
  LanguageDetection,
  CommandClassification,
  CommandParsingError,
  ElementInfo,
  UserPreferences,
  SessionInfo
} from './types';
import { AutomationCommand } from '../shared/contracts';
import { OpenRouterClient } from '../openrouter/client';

export class CommandParser {
  private patterns: CommandPattern[] = [];
  private openRouterClient: OpenRouterClient;
  private context: CommandContext;
  private userPreferences: UserPreferences;

  constructor(
    openRouterClient: OpenRouterClient,
    context: CommandContext = {},
    userPreferences: UserPreferences = {
      language: 'en',
      defaultSearchEngine: 'google',
      securityLevel: 'medium',
      enableAutoCorrection: true,
      enableSuggestions: true,
    }
  ) {
    this.openRouterClient = openRouterClient;
    this.context = context;
    this.userPreferences = userPreferences;
    this.initializePatterns();
  }

  /**
   * Parse natural language command into structured commands
   */
  async parseCommand(
    input: string,
    context?: CommandContext
  ): Promise<ParsingResult> {
    const startTime = Date.now();
    const mergedContext = { ...this.context, ...context };
    
    try {
      // Detect language
      const language = this.detectLanguage(input);
      
      // Preprocess input
      const preprocessedInput = this.preprocessInput(input, language);
      
      // Try pattern matching first
      const patternResult = this.tryPatternMatching(preprocessedInput, mergedContext);
      
      if (patternResult.confidence > 0.8) {
        return {
          ...patternResult,
          processingTime: Date.now() - startTime,
        };
      }
      
      // Use AI for complex parsing
      const aiResult = await this.useAIParsing(preprocessedInput, mergedContext, language);
      
      // Merge results
      const mergedResult = this.mergeParsingResults(patternResult, aiResult);
      
      return {
        ...mergedResult,
        processingTime: Date.now() - startTime,
      };

    } catch (error) {
      return {
        commands: [],
        workflows: [],
        confidence: 0,
        requiresClarification: true,
        clarificationQuestions: ['I had trouble understanding your command. Could you please rephrase it?'],
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        warnings: [],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Detect the language of the input
   */
  private detectLanguage(input: string): LanguageDetection {
    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const spanishWords = ['el', 'la', 'y', 'o', 'pero', 'en', 'a', 'para', 'de', 'con', 'por'];
    const frenchWords = ['le', 'la', 'et', 'ou', 'mais', 'dans', 'à', 'pour', 'de', 'avec', 'par'];
    
    const words = input.toLowerCase().split(/\s+/);
    const englishCount = words.filter(word => englishWords.includes(word)).length;
    const spanishCount = words.filter(word => spanishWords.includes(word)).length;
    const frenchCount = words.filter(word => frenchWords.includes(word)).length;
    
    const total = englishCount + spanishCount + frenchCount;
    
    if (total === 0) {
      return {
        language: 'en',
        confidence: 0.5,
        alternatives: [],
      };
    }
    
    const englishConfidence = englishCount / total;
    const spanishConfidence = spanishCount / total;
    const frenchConfidence = frenchCount / total;
    
    const maxConfidence = Math.max(englishConfidence, spanishConfidence, frenchConfidence);
    
    if (maxConfidence === englishConfidence) {
      return {
        language: 'en',
        confidence: maxConfidence,
        alternatives: [
          { language: 'es', confidence: spanishConfidence },
          { language: 'fr', confidence: frenchConfidence },
        ],
      };
    } else if (maxConfidence === spanishConfidence) {
      return {
        language: 'es',
        confidence: maxConfidence,
        alternatives: [
          { language: 'en', confidence: englishConfidence },
          { language: 'fr', confidence: frenchConfidence },
        ],
      };
    } else {
      return {
        language: 'fr',
        confidence: maxConfidence,
        alternatives: [
          { language: 'en', confidence: englishConfidence },
          { language: 'es', confidence: spanishConfidence },
        ],
      };
    }
  }

  /**
   * Preprocess the input text
   */
  private preprocessInput(input: string, language: LanguageDetection): string {
    let processed = input.toLowerCase().trim();
    
    // Remove extra whitespace
    processed = processed.replace(/\s+/g, ' ');
    
    // Expand common abbreviations
    const abbreviations = {
      'en': {
        'click': 'click on',
        'go': 'navigate to',
        'search': 'search for',
        'fill': 'fill in',
        'type': 'type in',
        'scroll': 'scroll down',
      },
      'es': {
        'haz clic': 'click en',
        'ir': 'navegar a',
        'buscar': 'buscar en',
        'rellenar': 'rellenar en',
        'escribir': 'escribir en',
        'desplazar': 'desplazar hacia abajo',
      },
      'fr': {
        'cliquez': 'cliquez sur',
        'aller': 'naviguer vers',
        'rechercher': 'rechercher',
        'remplir': 'remplir',
        'écrire': 'écrire',
        'défiler': 'défiler vers le bas',
      },
    };
    
    const langAbbrevs = abbreviations[language.language as keyof typeof abbreviations] || abbreviations.en;
    
    Object.entries(langAbbrevs).forEach(([abbr, expansion]) => {
      const regex = new RegExp(`\\b${abbr}\\b`, 'g');
      processed = processed.replace(regex, expansion);
    });
    
    return processed;
  }

  /**
   * Try to match against known patterns
   */
  private tryPatternMatching(input: string, context: CommandContext): ParsingResult {
    const commands: EnhancedParsedCommand[] = [];
    const errors: CommandParsingError[] = [];
    const warnings: string[] = [];
    
    let bestMatch: { pattern: CommandPattern; match: RegExpMatchArray; confidence: number } | null = null;
    
    // Find best matching pattern
    for (const pattern of this.patterns) {
      const match = input.match(pattern.pattern);
      if (match) {
        const confidence = this.calculatePatternConfidence(pattern, match, input, context);
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { pattern, match, confidence };
        }
      }
    }
    
    if (bestMatch) {
      const command = this.createCommandFromPattern(bestMatch.pattern, bestMatch.match, input, context);
      commands.push(command);
    }
    
    // If no pattern matched, create a basic unknown command
    if (commands.length === 0) {
      const unknownCommand: EnhancedParsedCommand = {
        intent: 'unknown',
        entities: {},
        parameters: {},
        confidence: 0.1,
        requiresClarification: true,
        clarificationQuestion: 'I didn\'t understand that command. Could you please be more specific?',
        originalText: input,
        language: 'en',
        complexity: 'simple',
        requiredPermissions: [],
        securityLevel: 'low',
      };
      commands.push(unknownCommand);
    }
    
    return {
      commands,
      workflows: [],
      confidence: bestMatch?.confidence || 0.1,
      requiresClarification: bestMatch?.confidence < 0.8,
      errors: errors.map(e => e.message),
      warnings,
      processingTime: 0,
    };
  }

  /**
   * Use AI for command parsing
   */
  private async useAIParsing(
    input: string,
    context: CommandContext,
    language: LanguageDetection
  ): Promise<ParsingResult> {
    try {
      const contextPrompt = this.buildContextPrompt(context);
      const languagePrompt = language.language !== 'en' ? `Please respond in ${language.language}.` : '';
      
      const prompt = `
Parse the following natural language command into structured automation commands:

Command: "${input}"

${contextPrompt}

${languagePrompt}

Please analyze this command and provide a structured response in JSON format with:
1. The detected intent
2. Extracted entities (URLs, selectors, text, numbers, etc.)
3. Required parameters for execution
4. Confidence level (0-1)
5. Whether clarification is needed
6. Security risk level
7. Required permissions

Focus on browser automation tasks like navigation, clicking, form filling, scrolling, and data extraction.
Be conservative and safe - never suggest actions that could be harmful.
`;

      const aiResponse = await this.openRouterClient.parseCommand(prompt, context);
      
      const commands: EnhancedParsedCommand[] = [];
      
      for (const cmd of aiResponse.commands) {
        const enhancedCommand: EnhancedParsedCommand = {
          intent: cmd.type as CommandIntent,
          entities: this.extractEntitiesFromCommand(cmd),
          parameters: this.extractParametersFromCommand(cmd),
          confidence: cmd.confidence || aiResponse.confidence,
          requiresClarification: aiResponse.requiresClarification,
          clarificationQuestion: aiResponse.clarificationQuestion,
          originalText: input,
          language: language.language,
          complexity: this.assessComplexity(cmd),
          requiredPermissions: this.getRequiredPermissions(cmd),
          securityLevel: this.assessSecurityLevel(cmd),
        };
        
        commands.push(enhancedCommand);
      }
      
      return {
        commands,
        workflows: [],
        confidence: aiResponse.confidence,
        requiresClarification: aiResponse.requiresClarification,
        clarificationQuestions: aiResponse.clarificationQuestion ? [aiResponse.clarificationQuestion] : [],
        suggestions: aiResponse.alternativeCommands?.map(alt => alt.description),
        errors: [],
        warnings: [],
        processingTime: 0,
      };

    } catch (error) {
      return {
        commands: [],
        workflows: [],
        confidence: 0,
        requiresClarification: true,
        clarificationQuestions: ['I had trouble processing your command. Please try again.'],
        errors: [error instanceof Error ? error.message : 'AI parsing failed'],
        warnings: [],
        processingTime: 0,
      };
    }
  }

  /**
   * Initialize command patterns
   */
  private initializePatterns(): void {
    this.patterns = [
      // Navigation patterns
      {
        id: 'navigate_to_url',
        pattern: /\b(go to|navigate to|open|visit)\s+(https?:\/\/[^\s]+)/i,
        intent: 'navigate',
        parameters: { url: '' },
        examples: ['go to https://example.com', 'navigate to https://google.com'],
        confidence: 0.9,
        requiredEntities: ['urls'],
        optionalEntities: [],
      },
      {
        id: 'navigate_search',
        pattern: /\b(go to|navigate to|open|visit)\s+(.+?)(?:\s+website|\s+site)?$/i,
        intent: 'navigate',
        parameters: { url: '' },
        examples: ['go to google', 'navigate to facebook'],
        confidence: 0.7,
        requiredEntities: ['text'],
        optionalEntities: [],
      },
      
      // Click patterns
      {
        id: 'click_element',
        pattern: /\b(click|click on|press)\s+(?:the\s+)?(.+?)(?:\s+button|\s+link|\s+element)?$/i,
        intent: 'click',
        parameters: { selector: '', text: '' },
        examples: ['click submit button', 'click on the login link'],
        confidence: 0.8,
        requiredEntities: ['text'],
        optionalEntities: ['selectors'],
      },
      
      // Fill patterns
      {
        id: 'fill_form',
        pattern: /\b(fill|fill in|type|enter)\s+(.+?)\s+in(?:to)?\s+(.+?)(?:\s+field|\s+input)?$/i,
        intent: 'fill',
        parameters: { value: '', selector: '' },
        examples: ['fill john in the name field', 'type password123 in the password input'],
        confidence: 0.85,
        requiredEntities: ['text'],
        optionalEntities: ['selectors'],
      },
      
      // Search patterns
      {
        id: 'search_query',
        pattern: /\bsearch\s+(?:for\s+)?(.+?)(?:\s+on\s+(.+?))?$/i,
        intent: 'search',
        parameters: { query: '', searchEngine: 'google' },
        examples: ['search for cats', 'search for restaurants on bing'],
        confidence: 0.9,
        requiredEntities: ['text'],
        optionalEntities: ['text'],
      },
      
      // Scroll patterns
      {
        id: 'scroll_direction',
        pattern: /\bscroll\s+(up|down|left|right)(?:\s+(\d+|page|to\s+(?:top|bottom)))?$/i,
        intent: 'scroll',
        parameters: { direction: 'down', amount: 'page' },
        examples: ['scroll down', 'scroll up 2', 'scroll to bottom'],
        confidence: 0.95,
        requiredEntities: ['directions'],
        optionalEntities: ['numbers'],
      },
      
      // Extract patterns
      {
        id: 'extract_data',
        pattern: /\b(extract|get|copy|save)\s+(.+?)(?:\s+from\s+(.+?))?$/i,
        intent: 'extract',
        parameters: { extractType: 'text' },
        examples: ['extract all links', 'get the prices from the table'],
        confidence: 0.8,
        requiredEntities: ['text'],
        optionalEntities: ['text'],
      },
      
      // Wait patterns
      {
        id: 'wait_duration',
        pattern: /\bwait\s+(?:for\s+)?(\d+)\s+(seconds?|minutes?|ms)?$/i,
        intent: 'wait',
        parameters: { duration: 0 },
        examples: ['wait 5 seconds', 'wait for 2 minutes'],
        confidence: 0.95,
        requiredEntities: ['numbers'],
        optionalEntities: [],
      },
    ];
  }

  /**
   * Calculate confidence for pattern matching
   */
  private calculatePatternConfidence(
    pattern: CommandPattern,
    match: RegExpMatchArray,
    input: string,
    context: CommandContext
  ): number {
    let confidence = pattern.confidence;
    
    // Adjust based on match quality
    const matchLength = match[0]?.length || 0;
    const inputLength = input.length;
    const coverage = matchLength / inputLength;
    confidence *= (0.5 + 0.5 * coverage);
    
    // Adjust based on required entities
    const hasRequiredEntities = this.checkRequiredEntities(pattern, match, context);
    if (!hasRequiredEntities) {
      confidence *= 0.7;
    }
    
    // Adjust based on context relevance
    if (context.currentUrl && pattern.intent === 'navigate') {
      confidence *= 0.8; // Less likely to navigate when already on a page
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Create command from pattern match
   */
  private createCommandFromPattern(
    pattern: CommandPattern,
    match: RegExpMatchArray,
    input: string,
    context: CommandContext
  ): EnhancedParsedCommand {
    const entities = this.extractEntities(pattern, match, context);
    const parameters = this.extractParameters(pattern, match, entities);
    
    return {
      intent: pattern.intent,
      entities,
      parameters,
      confidence: this.calculatePatternConfidence(pattern, match, input, context),
      requiresClarification: false,
      originalText: input,
      language: this.userPreferences.language,
      complexity: 'simple',
      requiredPermissions: this.getRequiredPermissionsFromIntent(pattern.intent),
      securityLevel: this.assessSecurityLevelFromIntent(pattern.intent),
    };
  }

  /**
   * Extract entities from pattern match
   */
  private extractEntities(
    pattern: CommandPattern,
    match: RegExpMatchArray,
    context: CommandContext
  ): CommandEntities {
    const entities: CommandEntities = {};
    
    // Extract URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = match.input.match(urlRegex) || [];
    if (urls.length > 0) {
      entities.urls = urls;
    }
    
    // Extract numbers
    const numberRegex = /\b\d+(\.\d+)?\b/g;
    const numbers = (match.input.match(numberRegex) || []).map(n => parseFloat(n));
    if (numbers.length > 0) {
      entities.numbers = numbers;
    }
    
    // Extract text content from capture groups
    const textContent = match.slice(1).filter(group => group && !group.match(/^https?:\/\//));
    if (textContent.length > 0) {
      entities.text = textContent;
    }
    
    return entities;
  }

  /**
   * Extract parameters from pattern match
   */
  private extractParameters(
    pattern: CommandPattern,
    match: RegExpMatchArray,
    entities: CommandEntities
  ): CommandParameters {
    const parameters: CommandParameters = { ...pattern.parameters };
    
    // Fill parameters based on entities
    if (entities.urls && entities.urls.length > 0) {
      parameters.url = entities.urls[0];
    }
    
    if (entities.text && entities.text.length > 0) {
      if (pattern.intent === 'click') {
        parameters.text = entities.text[0];
      } else if (pattern.intent === 'fill') {
        parameters.value = entities.text[0];
        if (entities.text.length > 1) {
          parameters.fieldName = entities.text[1];
        }
      } else if (pattern.intent === 'search') {
        parameters.query = entities.text[0];
      }
    }
    
    if (entities.numbers && entities.numbers.length > 0) {
      if (pattern.intent === 'wait') {
        parameters.duration = entities.numbers[0];
      } else if (pattern.intent === 'scroll') {
        parameters.amount = entities.numbers[0];
      }
    }
    
    return parameters;
  }

  /**
   * Check if required entities are present
   */
  private checkRequiredEntities(
    pattern: CommandPattern,
    match: RegExpMatchArray,
    context: CommandContext
  ): boolean {
    for (const requiredEntity of pattern.requiredEntities) {
      switch (requiredEntity) {
        case 'urls':
          if (!match.input.match(/https?:\/\/[^\s]+/)) {
            return false;
          }
          break;
        case 'text':
          if (match.slice(1).every(group => !group || group.match(/^https?:\/\//))) {
            return false;
          }
          break;
        case 'numbers':
          if (!match.input.match(/\b\d+(\.\d+)?\b/)) {
            return false;
          }
          break;
        case 'directions':
          if (!match.input.match(/\b(up|down|left|right)\b/i)) {
            return false;
          }
          break;
      }
    }
    return true;
  }

  /**
   * Build context prompt for AI
   */
  private buildContextPrompt(context: CommandContext): string {
    let contextPrompt = '';
    
    if (context.currentUrl) {
      contextPrompt += `Current URL: ${context.currentUrl}\n`;
    }
    
    if (context.pageTitle) {
      contextPrompt += `Page title: ${context.pageTitle}\n`;
    }
    
    if (context.availableElements && context.availableElements.length > 0) {
      contextPrompt += `Available elements:\n`;
      context.availableElements.slice(0, 10).forEach(element => {
        contextPrompt += `- ${element.selector}: ${element.text}\n`;
      });
    }
    
    if (context.previousCommands && context.previousCommands.length > 0) {
      contextPrompt += `Previous commands: ${context.previousCommands.slice(-3).join(', ')}\n`;
    }
    
    return contextPrompt;
  }

  /**
   * Merge parsing results from pattern matching and AI
   */
  private mergeParsingResults(
    patternResult: ParsingResult,
    aiResult: ParsingResult
  ): ParsingResult {
    // If AI result is much better, use it
    if (aiResult.confidence > patternResult.confidence + 0.2) {
      return aiResult;
    }
    
    // If pattern result is good, use it
    if (patternResult.confidence > 0.8) {
      return patternResult;
    }
    
    // Otherwise, combine results
    const combinedCommands = [...patternResult.commands, ...aiResult.commands];
    const combinedConfidence = Math.max(patternResult.confidence, aiResult.confidence);
    
    return {
      commands: combinedCommands,
      workflows: [...patternResult.workflows, ...aiResult.workflows],
      confidence: combinedConfidence,
      requiresClarification: combinedConfidence < 0.7,
      clarificationQuestions: [
        ...patternResult.clarificationQuestions || [],
        ...aiResult.clarificationQuestions || [],
      ],
      suggestions: [
        ...patternResult.suggestions || [],
        ...aiResult.suggestions || [],
      ],
      errors: [...patternResult.errors, ...aiResult.errors],
      warnings: [...patternResult.warnings, ...aiResult.warnings],
      processingTime: patternResult.processingTime + aiResult.processingTime,
    };
  }

  /**
   * Extract entities from AI command
   */
  private extractEntitiesFromCommand(cmd: any): CommandEntities {
    const entities: CommandEntities = {};
    
    if (cmd.url) {
      entities.urls = [cmd.url];
    }
    
    if (cmd.selector) {
      entities.selectors = [cmd.selector];
    }
    
    if (cmd.value || cmd.text) {
      entities.text = [cmd.value || cmd.text];
    }
    
    if (cmd.timeout || cmd.duration) {
      entities.waitTimes = [cmd.timeout || cmd.duration];
    }
    
    return entities;
  }

  /**
   * Extract parameters from AI command
   */
  private extractParametersFromCommand(cmd: any): CommandParameters {
    return {
      url: cmd.url,
      selector: cmd.selector,
      value: cmd.value,
      text: cmd.text,
      duration: cmd.timeout || cmd.duration,
      direction: cmd.direction,
      amount: cmd.amount,
      query: cmd.query,
      extractType: cmd.extractType,
      options: cmd.options,
    };
  }

  /**
   * Assess command complexity
   */
  private assessComplexity(cmd: any): 'simple' | 'moderate' | 'complex' {
    let complexity = 0;
    
    if (cmd.url) complexity += 1;
    if (cmd.selector) complexity += 2;
    if (cmd.value) complexity += 1;
    if (cmd.options && Object.keys(cmd.options).length > 0) complexity += 2;
    
    if (complexity <= 2) return 'simple';
    if (complexity <= 4) return 'moderate';
    return 'complex';
  }

  /**
   * Get required permissions for a command
   */
  private getRequiredPermissions(cmd: any): string[] {
    const permissions: string[] = [];
    
    if (cmd.url) permissions.push('navigation');
    if (cmd.selector) permissions.push('dom_access');
    if (cmd.value) permissions.push('form_interaction');
    if (cmd.extractType) permissions.push('data_extraction');
    
    return permissions;
  }

  /**
   * Assess security level of a command
   */
  private assessSecurityLevel(cmd: any): 'low' | 'medium' | 'high' {
    let riskScore = 0;
    
    if (cmd.url && cmd.url.includes('http://')) riskScore += 1;
    if (cmd.value && cmd.value.includes('password')) riskScore += 2;
    if (cmd.options && cmd.options.sensitive) riskScore += 2;
    
    if (riskScore >= 3) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }

  /**
   * Get required permissions from intent
   */
  private getRequiredPermissionsFromIntent(intent: CommandIntent): string[] {
    const permissionMap: Record<CommandIntent, string[]> = {
      navigate: ['navigation'],
      click: ['dom_access'],
      fill: ['dom_access', 'form_interaction'],
      scroll: ['dom_access'],
      submit: ['dom_access', 'form_interaction'],
      extract: ['dom_access', 'data_extraction'],
      wait: [],
      search: ['navigation', 'dom_access'],
      login: ['dom_access', 'form_interaction'],
      logout: ['dom_access', 'form_interaction'],
      select: ['dom_access'],
      hover: ['dom_access'],
      drag: ['dom_access'],
      upload: ['dom_access', 'form_interaction', 'file_access'],
      download: ['file_access'],
      screenshot: ['dom_access', 'data_extraction'],
      unknown: [],
    };
    
    return permissionMap[intent] || [];
  }

  /**
   * Assess security level from intent
   */
  private assessSecurityLevelFromIntent(intent: CommandIntent): 'low' | 'medium' | 'high' {
    const riskMap: Record<CommandIntent, 'low' | 'medium' | 'high'> = {
      navigate: 'low',
      click: 'low',
      fill: 'medium',
      scroll: 'low',
      submit: 'medium',
      extract: 'medium',
      wait: 'low',
      search: 'low',
      login: 'high',
      logout: 'medium',
      select: 'low',
      hover: 'low',
      drag: 'low',
      upload: 'high',
      download: 'medium',
      screenshot: 'medium',
      unknown: 'low',
    };
    
    return riskMap[intent] || 'low';
  }

  /**
   * Update parser context
   */
  public updateContext(context: Partial<CommandContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Update user preferences
   */
  public updateUserPreferences(preferences: Partial<UserPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...preferences };
  }

  /**
   * Add custom pattern
   */
  public addPattern(pattern: CommandPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Remove pattern by ID
   */
  public removePattern(patternId: string): boolean {
    const index = this.patterns.findIndex(p => p.id === patternId);
    if (index > -1) {
      this.patterns.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all patterns
   */
  public getPatterns(): CommandPattern[] {
    return [...this.patterns];
  }
}
