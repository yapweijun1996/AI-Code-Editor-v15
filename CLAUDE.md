# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a sophisticated browser-based AI code editor that integrates Senior Engineer-level AI capabilities with multiple LLM providers (Google Gemini, OpenAI GPT, Ollama). The application uses a client-centric architecture where all file operations run in the browser using the File System Access API, with a minimal Node.js backend for serving static files and URL fetching.

## Architecture

The codebase is organized as follows:

- **Frontend (`frontend/`)**: Single-page application built with vanilla JavaScript, HTML, and CSS
  - **Main entry**: `frontend/js/main.js` - orchestrates the entire application
  - **Editor**: Uses Monaco Editor for code editing capabilities
  - **LLM Services**: Multi-provider AI system in `frontend/js/llm/` with service factory pattern
  - **Tool System**: 30+ specialized tools for file operations, code analysis, and AI functionality
  - **State Management**: Uses IndexedDB for persistent storage via `frontend/js/db.js`

- **Backend (`backend/`)**: Lightweight Express server that serves the frontend and provides URL fetching
  - **Main server**: `backend/index.js` - serves static files on port 3333
  - **Minimal functionality**: Only handles tasks that browsers cannot perform

## Development Commands

### Starting the Application
```bash
# Install dependencies (first time)
npm install

# Start server using PM2
npm run start

# Alternative: direct start (for development)
node backend/index.js

# Stop server
npm run stop

# Restart server
npm run restart

# Delete PM2 process
npm run delete
```

### Code Formatting
```bash
# Format backend code
cd backend && npm run format

# Format frontend code  
cd frontend && npm run format
```

### Development Workflow
- **Development Server**: Access the application at `http://localhost:3333` after starting
- **File Watching**: The backend uses `chokidar` for file system monitoring
- **Hot Reload**: Browser refresh required for changes (no hot module replacement)
- **Debugging**: Use browser DevTools for frontend debugging; Node.js inspector for backend

### Testing
Currently no automated tests are configured. The project uses manual testing through the browser interface.

## Key Architecture Concepts

### Client-Centric Design
- All core logic runs in the browser for security
- File operations use File System Access API
- Backend only serves static files and fetches URLs
- State persisted in browser's IndexedDB

### Multi-Provider LLM Architecture
- **Service Factory Pattern**: `frontend/js/llm/service_factory.js` creates provider instances
- **Base Service**: `frontend/js/llm/base_llm_service.js` provides common interface
- **Provider Services**: Gemini, OpenAI, and Ollama implementations
- **API Key Rotation**: Gemini service supports automatic key rotation for rate limiting

### AI Auto-Completion System
- **AiCompletionOrchestrator**: Master coordinator with caching and performance optimization
- **ContextIntelligenceEngine**: Advanced semantic analysis using AST and existing Senior Engineer AI
- **CompletionModelManager**: AI model optimization and specialized prompting
- **AiCompletionProvider**: Monaco Editor integration with smart triggering
- **UserAdaptationSystem**: Personalized learning from user patterns and preferences

### Tool System
The AI has access to 30+ tools organized by category, all executed client-side:
- **Senior Engineer AI Tools**: Symbol tables, data flow analysis, systematic debugging
- **File Operations**: Create, read, update, delete files with diff support
- **Directory Operations**: Folder management and project structure
- **Search & Analysis**: Code search, semantic querying, codebase indexing
- **Editor Integration**: Direct Monaco editor interaction
- **AI Completion Tools**: Intelligent auto-completion with context analysis
- **Performance Optimization**: Smart tool selection based on context and file history

### State Management with IndexedDB
Key object stores in `CodeEditorDB`:
- `apiKeys`: LLM provider API keys
- `fileHandles`: Project directory handles for File System Access API
- `sessionState`: Complete workspace state (open files, chat history)
- `checkpoints`: Project-wide snapshots for rollback capability
- `codeIndex`: Searchable codebase index
- `settings`: User preferences and configurations
- `customRules`: Per-mode AI behavior rules

## Important Implementation Details

### File Operations
- All file operations go through `frontend/js/file_system.js`
- Uses File System Access API for direct browser-to-filesystem access
- Automatic file opening/focusing when AI tools modify files
- Path-based tab management prevents duplicate tabs

### Diffing System
- Uses line-based diffing via `diff-match-patch` library
- Avoids stack overflow on large files by converting lines to characters
- Implemented in `frontend/js/tool_executor.js`
- Smart debugging state tracks tool performance and error patterns
- Automatic tool selection optimization based on file type and operation history

### Error Handling & Stability
- API-compliant payloads for all LLM providers
- Robust session restoration after page reloads
- Automatic checkpointing before destructive operations
- Comprehensive error handling in tool execution
- Rate limiting with configurable requests per minute
- User agent rotation for web scraping stability
- Smart retry mechanisms with exponential backoff

### Custom AI Rules
- Per-mode custom rules stored in IndexedDB
- Dynamic injection into system prompts
- Rules displayed in chat interface for transparency

## Code Conventions

- **Language**: Vanilla JavaScript (ES6+), no framework dependencies
- **File Structure**: Modular architecture with clear separation of concerns  
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Comments**: Minimal inline comments, focus on clear code structure
- **Error Handling**: Comprehensive try-catch blocks with user-friendly messages
- **Async/Await**: Preferred over Promise chains for better readability

## Working with the Codebase

### Adding New Tools
1. Define tool in `frontend/js/tool_executor.js`
2. Add tool declaration to available tools list
3. Implement execution logic with proper error handling
4. Update tool documentation if needed

### Adding New LLM Providers
1. Create new service in `frontend/js/llm/`
2. Extend `BaseLLMService`
3. Register in `service_factory.js`
4. Add UI configuration in settings

### Modifying File Operations
- All changes go through `frontend/js/file_system.js`
- Maintain File System Access API compatibility
- Update path handling logic if needed
- Test with various file types and sizes

### Working with AI Completions
- **Core orchestration**: `frontend/js/ai_completion_orchestrator.js`
- **Context analysis**: `frontend/js/context_intelligence_engine.js` - integrates with Senior Engineer AI modules
- **Monaco integration**: `frontend/js/ai_completion_provider.js` - handles editor completions
- **User learning**: `frontend/js/user_adaptation_system.js` - personalization and pattern learning
- **Model management**: `frontend/js/completion_model_manager.js` - AI model optimization

### AI Completion Configuration
- Settings available via `Settings.getCompletionSettings()`
- Runtime configuration updates via `Settings.updateCompletionSettings()`
- Toggle completions: Ctrl/Cmd+Shift+A
- Manual trigger: Ctrl/Cmd+Space
- All preferences stored in IndexedDB with existing state management

## Security Considerations

- No server-side file operations to maintain security sandbox
- API keys stored only in browser's IndexedDB
- No terminal/shell execution capabilities (removed for security)
- All operations run in browser security context
- File System Access API requires explicit user permission
- Backend only handles URL fetching and static file serving
- No arbitrary code execution on server
- Rate limiting protects against abuse