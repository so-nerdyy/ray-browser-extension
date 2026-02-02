# Ray - AI Browser Automation Extension

Ray is an AI-powered Chrome extension that provides intelligent browser automation capabilities through natural language commands.

## Features

- **Natural Language Processing**: Convert user commands into browser automation actions
- **AI-Powered Automation**: Leverages advanced AI models for intelligent task execution
- **Secure Execution**: Built-in security validation and permission management
- **Cross-Site Compatibility**: Works across different websites and web applications
- **Real-time Feedback**: Provides status updates and progress indicators

## Development

This project is built using:

- **Framework**: WXT (TypeScript-first Chrome extension framework)
- **Language**: TypeScript
- **Build System**: Vite (via WXT)
- **Manifest**: Chrome Extension Manifest V3

### Project Structure

```
ray-browser-extension/
├── manifest.json          # Chrome Extension manifest
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── popup/                 # Extension popup UI (Blake's domain)
├── background/            # Service worker implementation
├── content/               # Content scripts for page interaction
├── lib/                   # Shared utilities and types
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── icons/                # Extension icons
└── _metadata/            # Framework-specific metadata
```

### Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

### Available Scripts

- `npm run dev` - Start development build with hot reload
- `npm run build` - Build production version
- `npm run build:firefox` - Build for Firefox
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking

## Agent Coordination

This project is developed by a team of 6 specialized agents:

- **Alex** (Core Infrastructure): Foundation, manifest, build system
- **Blake** (UI/Popup): User interface and interaction design
- **Casey** (AI Integration): OpenRouter API and command processing
- **Dakota** (Browser Automation): Content scripts and DOM manipulation
- **Ellis** (Security & Storage): API key security and permissions
- **Finley** (Testing & QA): Unit tests, integration tests, and validation

## Security

- API keys are securely stored using Chrome extension storage APIs
- Content Security Policy (CSP) is configured for maximum security
- Permissions follow the principle of least privilege
- All automation actions are validated before execution

## Contributing

Please refer to the `CONTRIBUTING.md` file for development guidelines and the coordination strategy in `agent-tasks/coordination-strategy.md`.

## License

MIT License - see LICENSE file for details.
Ray is an AI-powered Chrome extension that provides intelligent browser automation capabilities through natural language commands.

## Features

- **Natural Language Processing**: Convert user commands into browser automation actions
- **AI-Powered Automation**: Leverages advanced AI models for intelligent task execution
- **Secure Execution**: Built-in security validation and permission management
- **Cross-Site Compatibility**: Works across different websites and web applications
- **Real-time Feedback**: Provides status updates and progress indicators

## Development

This project is built using:

- **Framework**: WXT (TypeScript-first Chrome extension framework)
- **Language**: TypeScript
- **Build System**: Vite (via WXT)
- **Manifest**: Chrome Extension Manifest V3

### Project Structure

```
ray-browser-extension/
├── manifest.json          # Chrome Extension manifest
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── popup/                 # Extension popup UI (Blake's domain)
├── background/            # Service worker implementation
├── content/               # Content scripts for page interaction
├── lib/                   # Shared utilities and types
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── icons/                # Extension icons
└── _metadata/            # Framework-specific metadata
```

### Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

### Available Scripts

- `npm run dev` - Start development build with hot reload
- `npm run build` - Build production version
- `npm run build:firefox` - Build for Firefox
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking

## Agent Coordination

This project is developed by a team of 6 specialized agents:

- **Alex** (Core Infrastructure): Foundation, manifest, build system
- **Blake** (UI/Popup): User interface and interaction design
- **Casey** (AI Integration): OpenRouter API and command processing
- **Dakota** (Browser Automation): Content scripts and DOM manipulation
- **Ellis** (Security & Storage): API key security and permissions
- **Finley** (Testing & QA): Unit tests, integration tests, and validation

## Security

- API keys are securely stored using Chrome extension storage APIs
- Content Security Policy (CSP) is configured for maximum security
- Permissions follow the principle of least privilege
- All automation actions are validated before execution

## Contributing

Please refer to the `CONTRIBUTING.md` file for development guidelines and the coordination strategy in `agent-tasks/coordination-strategy.md`.

## License

MIT License - see LICENSE file for details.
