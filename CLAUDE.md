# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-Powered Browser-Based Code Editor with Senior Engineer AI capabilities. It's a sophisticated single-page application that integrates multiple LLM providers (Google Gemini, OpenAI GPT, Ollama) with advanced coding assistance features.

## Core Architecture

The project follows a **client-centric design** where most logic runs in the browser:

- **Frontend** (`frontend/`): Vanilla JavaScript application using Monaco Editor
- **Backend** (`backend/`): Minimal Express.js server for serving static files and URL fetching
- **File Operations**: Uses browser's File System Access API (no server-side file handling)
- **AI System**: Multi-provider tool-calling system managed entirely client-side

## Development Commands

### Backend
```bash
cd backend
npm start              # Start the Express server
npm run format         # Format code with Prettier
```

### Frontend  
```bash
cd frontend
npm run format         # Format JS/HTML/CSS/JSON files with Prettier
```

### Root Level
```bash
npm start              # Start server via PM2
npm stop               # Stop PM2 server
npm restart            # Restart PM2 server
npm delete             # Delete PM2 process
```

### Application Management
Use the interactive scripts for full setup and management:
- **Windows**: Run `app.bat`
- **macOS/Linux**: Run `./app.sh` (after `chmod +x ./app.sh`)

The scripts handle dependency installation, server management, and PM2 process control.

## Key Components

### Tool Execution System
The heart of the AI functionality is in `frontend/js/tool_executor.js`, which:
- Implements 30+ specialized tools for file operations, code analysis, and AI assistance
- Manages performance tracking and optimization
- Handles Senior Engineer AI capabilities (symbol resolution, data flow analysis, debugging)
- Provides smart tool selection based on context

### LLM Services
Located in `frontend/js/llm/`:
- `service_factory.js` - Creates appropriate LLM service instances
- `gemini_service.js`, `openai_service.js`, `ollama_service.js` - Provider implementations
- `chat_service.js` - Orchestrates all provider interactions

### Core Modules
- `main.js` - Application initialization and state management
- `editor.js` - Monaco Editor integration and file management
- `file_system.js` - Browser File System Access API handling
- `ui.js` - Resizable panels and interface management
- `task_manager.js` - Task execution and workflow management

## Senior Engineer AI Features

The application includes advanced AI capabilities:
- **Symbol Resolution**: Build comprehensive symbol tables
- **Data Flow Analysis**: Trace variable flow and dependencies  
- **Systematic Debugging**: Hypothesis-driven debugging approach
- **Code Quality Analysis**: Comprehensive metrics and smell detection
- **Architecture Optimization**: Pattern recognition and optimization suggestions

These are implemented across multiple specialized modules in the `frontend/js/` directory.

## Development Notes

- No traditional build system - uses vanilla JavaScript modules
- All dependencies managed via npm in respective `frontend/` and `backend/` directories
- IndexedDB used for client-side persistence (settings, checkpoints, chat history)
- PM2 used for production server management
- Prettier configured for code formatting (no linting setup currently)

## File Structure

```
frontend/js/
├── llm/                    # LLM provider services
├── lib/                    # Third-party libraries
├── workers/                # Web Workers
├── main.js                 # Application entry point
├── tool_executor.js        # Core tool system
├── editor.js               # Monaco Editor integration
├── file_system.js          # File operations
└── [30+ specialized modules]
```

The application serves from `backend/index.js` on port 3333, serving frontend assets and providing minimal backend services for URL fetching and codebase indexing.