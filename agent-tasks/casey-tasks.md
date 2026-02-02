# Agent Casey: AI Integration & Command Processing

## Agent Overview
**Name**: Casey  
**Focus**: OpenRouter API integration, natural language processing, command parsing, and AI model interaction  
**Timeline**: Days 3-6 (AI Integration phase)

## Primary Responsibilities
Casey will implement the AI brain of the Ray Chrome Extension, integrating OpenRouter API with GPT-OSS-120B model, parsing natural language commands, and orchestrating the execution workflow. Casey bridges user input from Blake to browser automation by Dakota.

## Detailed Tasks

### Task 1: OpenRouter API Client Implementation
**Files to Create** (spec.md lines 97, 206-227):
- `lib/openrouter-client.ts` - OpenRouter API integration
- `lib/openrouter/types.ts` - TypeScript interfaces for API
- `lib/openrouter/config.ts` - Configuration and constants

**API Requirements** (spec.md lines 48, 200-234):
- Use GPT-OSS-120B:free model
- Implement proper authentication with API key
- Handle rate limiting and retry logic
- Error handling for API failures
- Response validation and sanitization

**API Integration Pattern**:
```typescript
// Using fetch API (spec.md lines 206-227)
async function callOpenRouter(prompt, apiKey) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://ray-extension.com',
    },
    body: JSON.stringify({
      model: 'gpt-oss-120b:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    })
  });
  
  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

### Task 2: Natural Language Command Processing
**Files to Create** (spec.md lines 98, 240-244):
- `lib/command-parser.ts` - Natural language to command translation
- `lib/command-validator.ts` - Command validation and security
- `lib/types/commands.ts` - Command type definitions

**Processing Requirements**:
- Parse natural language input into structured commands
- Extract intent, entities, and parameters
- Handle ambiguous commands with clarification requests
- Support multi-language command processing
- Categorize commands by complexity and requirements

**Intent Recognition**:
- Identify user intent (navigation, form filling, data extraction)
- Detect multi-step workflows and dependencies
- Handle follow-up commands and context maintenance
- Extract URLs, form data, search queries

### Task 3: Command Validation & Security
**Security Implementation** (spec.md lines 295-296):
- Validate command syntax and semantics
- Check for security risks and malicious inputs
- Verify required permissions and capabilities
- Implement input sanitization and escaping
- Never hardcode API keys

**Error Handling**:
- Handle ambiguous or unclear commands
- Provide clarification prompts to users
- Implement fallback strategies for failed parsing
- Log parsing errors for improvement

### Task 4: Execution Orchestration
**Files to Create**:
- `lib/orchestrator.ts` - Workflow management
- `lib/execution-engine.ts` - Command execution coordination
- `lib/context-manager.ts` - State and context management

**Orchestration Requirements** (spec.md lines 250-253):
- Create and manage multi-step execution plans
- Handle step dependencies and sequencing
- Implement parallel execution where possible
- Manage execution state and context
- Coordinate between AI parsing and browser automation

**Workflow Management**:
- Maintain execution context across steps
- Handle state persistence for long-running workflows
- Manage tab and page context during automation
- Implement context recovery after interruptions
- Handle execution failures and retries

### Task 5: Background Service Worker Integration
**Files to Create** (spec.md lines 95, 428-430):
- `background/service-worker.ts` - Main service worker logic
- `background/message-handlers.ts` - Communication with popup
- `background/task-processor.ts` - AI command processing

**Service Worker Requirements**:
- Implement service worker lifecycle handlers
- Set up event listeners for extension events
- Initialize chrome.storage for state persistence
- Handle communication with popup and content scripts
- Implement proper error handling and logging

### Task 6: Response Processing & User Feedback
**Files to Create**:
- `lib/response-processor.ts` - AI response handling
- `lib/feedback-generator.ts` - User feedback creation
- `lib/learning-system.ts` - Command pattern learning

**Response Processing**:
- Parse and validate AI model responses
- Extract actionable commands from responses
- Handle partial or incomplete responses
- Implement response caching and optimization

**User Feedback Generation**:
- Create human-readable execution summaries
- Generate progress reports and status updates
- Provide error explanations and suggestions
- Format results for user consumption

## Dependencies & Coordination
**Dependencies**:
- **Alex**: Needs Chrome API wrappers and service worker foundation
- **Blake**: Receives user commands, sends back status and results
- **Ellis**: Requires secure API key storage and validation
- **Dakota**: Sends parsed commands for browser automation execution

**Coordination Points**:
- Use Alex's Chrome API wrappers for storage and messaging
- Integrate with Blake's command input interface
- Use Ellis's secure API key management
- Send structured commands to Dakota for execution

## Technical Requirements (spec.md lines 200-234)
### API Integration Standards
- Use model name "gpt-oss-120b:free" for cost efficiency
- Implement proper prompt engineering for reliable parsing
- Handle API rate limits and quota management
- Ensure robust error handling for network issues
- Use TypeScript for type safety in API interactions

### Command Processing Requirements
- Support complex multi-step workflows
- Handle ambiguous commands gracefully
- Provide clear feedback for failed commands
- Maintain context across related commands
- Support command cancellation and interruption

### Performance Requirements
- API response time < 3 seconds (spec.md line 484)
- Command execution start < 1 second after submit
- Implement caching to reduce API calls and costs
- Optimize for service worker constraints

## Files Casey Will Create
```
lib/
├── openrouter/
│   ├── client.ts           # OpenRouter API client
│   ├── types.ts           # API type definitions
│   └── config.ts          # Configuration constants
├── commands/
│   ├── parser.ts          # Natural language processing
│   ├── validator.ts       # Command validation
│   └── types.ts           # Command type definitions
├── orchestration/
│   ├── orchestrator.ts     # Workflow management
│   ├── execution-engine.ts # Command coordination
│   └── context-manager.ts # State management
├── processing/
│   ├── response-processor.ts # AI response handling
│   ├── feedback-generator.ts # User feedback
│   └── learning-system.ts   # Pattern learning
└── background/
    ├── service-worker.ts    # Main service worker
    ├── message-handlers.ts  # Communication logic
    └── task-processor.ts   # AI command processing
```

## Success Criteria
- [ ] Natural language commands are parsed accurately (>90% success rate)
- [ ] API integration is reliable with proper error handling
- [ ] Multi-step workflows execute in correct sequence
- [ ] Users receive clear feedback on command status
- [ ] System handles edge cases and errors gracefully
- [ ] Response times are under 3 seconds for most commands
- [ ] No security vulnerabilities in command processing
- [ ] System learns and improves from user interactions
- [ ] Service worker properly manages lifecycle and state

## Notes for Casey
1. **Security**: Never hardcode API keys (spec.md lines 295-296)
2. **Model**: Use GPT-OSS-120B:free model for cost efficiency
3. **Error Handling**: Implement comprehensive error handling for all async operations
4. **Service Worker**: Handle termination risks, persist state in chrome.storage
5. **Rate Limiting**: Implement exponential backoff for API requests
6. **Validation**: Sanitize all user inputs before passing to AI model
7. **Coordination**: Maintain clear communication interfaces with other agents

## Files Casey Should Not Touch
- `manifest.json` (Alex's responsibility)
- `popup/` directory (Blake's responsibility)
- `content/` directory (Dakota's responsibility)
- `lib/browser-automation.*` (Dakota's responsibility)
- UI styling and themes (Blake's responsibility)
- Test files (Finley's responsibility)

## Integration Points
- **With Blake**: Receive user commands, send processing status and results
- **With Dakota**: Send parsed automation commands, receive execution status
- **With Ellis**: Retrieve API keys securely, implement security validations
- **With Alex**: Use Chrome API wrappers, service worker foundation
## Agent Overview
**Name**: Casey  
**Focus**: OpenRouter API integration, natural language processing, command parsing, and AI model interaction  
**Timeline**: Days 3-6 (AI Integration phase)

## Primary Responsibilities
Casey will implement the AI brain of the Ray Chrome Extension, integrating OpenRouter API with GPT-OSS-120B model, parsing natural language commands, and orchestrating the execution workflow. Casey bridges user input from Blake to browser automation by Dakota.

## Detailed Tasks

### Task 1: OpenRouter API Client Implementation
**Files to Create** (spec.md lines 97, 206-227):
- `lib/openrouter-client.ts` - OpenRouter API integration
- `lib/openrouter/types.ts` - TypeScript interfaces for API
- `lib/openrouter/config.ts` - Configuration and constants

**API Requirements** (spec.md lines 48, 200-234):
- Use GPT-OSS-120B:free model
- Implement proper authentication with API key
- Handle rate limiting and retry logic
- Error handling for API failures
- Response validation and sanitization

**API Integration Pattern**:
```typescript
// Using fetch API (spec.md lines 206-227)
async function callOpenRouter(prompt, apiKey) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://ray-extension.com',
    },
    body: JSON.stringify({
      model: 'gpt-oss-120b:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    })
  });
  
  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

### Task 2: Natural Language Command Processing
**Files to Create** (spec.md lines 98, 240-244):
- `lib/command-parser.ts` - Natural language to command translation
- `lib/command-validator.ts` - Command validation and security
- `lib/types/commands.ts` - Command type definitions

**Processing Requirements**:
- Parse natural language input into structured commands
- Extract intent, entities, and parameters
- Handle ambiguous commands with clarification requests
- Support multi-language command processing
- Categorize commands by complexity and requirements

**Intent Recognition**:
- Identify user intent (navigation, form filling, data extraction)
- Detect multi-step workflows and dependencies
- Handle follow-up commands and context maintenance
- Extract URLs, form data, search queries

### Task 3: Command Validation & Security
**Security Implementation** (spec.md lines 295-296):
- Validate command syntax and semantics
- Check for security risks and malicious inputs
- Verify required permissions and capabilities
- Implement input sanitization and escaping
- Never hardcode API keys

**Error Handling**:
- Handle ambiguous or unclear commands
- Provide clarification prompts to users
- Implement fallback strategies for failed parsing
- Log parsing errors for improvement

### Task 4: Execution Orchestration
**Files to Create**:
- `lib/orchestrator.ts` - Workflow management
- `lib/execution-engine.ts` - Command execution coordination
- `lib/context-manager.ts` - State and context management

**Orchestration Requirements** (spec.md lines 250-253):
- Create and manage multi-step execution plans
- Handle step dependencies and sequencing
- Implement parallel execution where possible
- Manage execution state and context
- Coordinate between AI parsing and browser automation

**Workflow Management**:
- Maintain execution context across steps
- Handle state persistence for long-running workflows
- Manage tab and page context during automation
- Implement context recovery after interruptions
- Handle execution failures and retries

### Task 5: Background Service Worker Integration
**Files to Create** (spec.md lines 95, 428-430):
- `background/service-worker.ts` - Main service worker logic
- `background/message-handlers.ts` - Communication with popup
- `background/task-processor.ts` - AI command processing

**Service Worker Requirements**:
- Implement service worker lifecycle handlers
- Set up event listeners for extension events
- Initialize chrome.storage for state persistence
- Handle communication with popup and content scripts
- Implement proper error handling and logging

### Task 6: Response Processing & User Feedback
**Files to Create**:
- `lib/response-processor.ts` - AI response handling
- `lib/feedback-generator.ts` - User feedback creation
- `lib/learning-system.ts` - Command pattern learning

**Response Processing**:
- Parse and validate AI model responses
- Extract actionable commands from responses
- Handle partial or incomplete responses
- Implement response caching and optimization

**User Feedback Generation**:
- Create human-readable execution summaries
- Generate progress reports and status updates
- Provide error explanations and suggestions
- Format results for user consumption

## Dependencies & Coordination
**Dependencies**:
- **Alex**: Needs Chrome API wrappers and service worker foundation
- **Blake**: Receives user commands, sends back status and results
- **Ellis**: Requires secure API key storage and validation
- **Dakota**: Sends parsed commands for browser automation execution

**Coordination Points**:
- Use Alex's Chrome API wrappers for storage and messaging
- Integrate with Blake's command input interface
- Use Ellis's secure API key management
- Send structured commands to Dakota for execution

## Technical Requirements (spec.md lines 200-234)
### API Integration Standards
- Use model name "gpt-oss-120b:free" for cost efficiency
- Implement proper prompt engineering for reliable parsing
- Handle API rate limits and quota management
- Ensure robust error handling for network issues
- Use TypeScript for type safety in API interactions

### Command Processing Requirements
- Support complex multi-step workflows
- Handle ambiguous commands gracefully
- Provide clear feedback for failed commands
- Maintain context across related commands
- Support command cancellation and interruption

### Performance Requirements
- API response time < 3 seconds (spec.md line 484)
- Command execution start < 1 second after submit
- Implement caching to reduce API calls and costs
- Optimize for service worker constraints

## Files Casey Will Create
```
lib/
├── openrouter/
│   ├── client.ts           # OpenRouter API client
│   ├── types.ts           # API type definitions
│   └── config.ts          # Configuration constants
├── commands/
│   ├── parser.ts          # Natural language processing
│   ├── validator.ts       # Command validation
│   └── types.ts           # Command type definitions
├── orchestration/
│   ├── orchestrator.ts     # Workflow management
│   ├── execution-engine.ts # Command coordination
│   └── context-manager.ts # State management
├── processing/
│   ├── response-processor.ts # AI response handling
│   ├── feedback-generator.ts # User feedback
│   └── learning-system.ts   # Pattern learning
└── background/
    ├── service-worker.ts    # Main service worker
    ├── message-handlers.ts  # Communication logic
    └── task-processor.ts   # AI command processing
```

## Success Criteria
- [ ] Natural language commands are parsed accurately (>90% success rate)
- [ ] API integration is reliable with proper error handling
- [ ] Multi-step workflows execute in correct sequence
- [ ] Users receive clear feedback on command status
- [ ] System handles edge cases and errors gracefully
- [ ] Response times are under 3 seconds for most commands
- [ ] No security vulnerabilities in command processing
- [ ] System learns and improves from user interactions
- [ ] Service worker properly manages lifecycle and state

## Notes for Casey
1. **Security**: Never hardcode API keys (spec.md lines 295-296)
2. **Model**: Use GPT-OSS-120B:free model for cost efficiency
3. **Error Handling**: Implement comprehensive error handling for all async operations
4. **Service Worker**: Handle termination risks, persist state in chrome.storage
5. **Rate Limiting**: Implement exponential backoff for API requests
6. **Validation**: Sanitize all user inputs before passing to AI model
7. **Coordination**: Maintain clear communication interfaces with other agents

## Files Casey Should Not Touch
- `manifest.json` (Alex's responsibility)
- `popup/` directory (Blake's responsibility)
- `content/` directory (Dakota's responsibility)
- `lib/browser-automation.*` (Dakota's responsibility)
- UI styling and themes (Blake's responsibility)
- Test files (Finley's responsibility)

## Integration Points
- **With Blake**: Receive user commands, send processing status and results
- **With Dakota**: Send parsed automation commands, receive execution status
- **With Ellis**: Retrieve API keys securely, implement security validations
- **With Alex**: Use Chrome API wrappers, service worker foundation
