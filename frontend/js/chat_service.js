import { LLMServiceFactory } from './llm/service_factory.js';
import { Settings } from './settings.js';
import { DbManager } from './db.js';
import { CodebaseIndexer } from './code_intel.js';
import * as FileSystem from './file_system.js';
import * as ToolExecutor from './tool_executor.js';
import * as Editor from './editor.js';
import * as UI from './ui.js';
import { performanceOptimizer } from './performance_optimizer.js';
import { providerOptimizer } from './provider_optimizer.js';
// taskManager import removed
import { contextAnalyzer } from './context_analyzer.js';
import { contextBuilder } from './context_builder.js';
import { todoManager, TodoStatus } from './todo_manager.js';
import { AITodoManager } from './ai_todo_manager.js';

export const ChatService = {
    isSending: false,
    isCancelled: false,
    llmService: null,
    rootDirectoryHandle: null,
    activePlan: null,
    todoMode: false,
    lastUserQuery: '',
    errorTracker: {
        filePath: null,
        errorSignature: null,
        count: 0,
    },

    async initialize(rootDirectoryHandle) {
        this.rootDirectoryHandle = rootDirectoryHandle;
        await this._initializeLLMService();

        const chatHistory = await DbManager.getChatHistory();
        if (chatHistory.length > 0) {
            console.log(`[Chat History] Found ${chatHistory.length} messages.`);
            const chatMessages = document.getElementById('chat-messages');
            UI.renderChatHistory(chatMessages, chatHistory);
        }
    },

    async _initializeLLMService() {
        const llmSettings = Settings.getLLMSettings();
        this.llmService = LLMServiceFactory.create(llmSettings.provider, llmSettings);
        
        // Initialize provider-specific optimizations
        this.currentProvider = llmSettings.provider;
        console.log(`LLM Service initialized with provider: ${llmSettings.provider}`);
        
        // Set up performance monitoring
        performanceOptimizer.startTimer('llm_initialization');
        performanceOptimizer.endTimer('llm_initialization');
    },

    async _startChat(history = []) {
        // This method will now be simpler. The complex setup (prompts, tools)
        // will be handled by the specific LLMService implementation.
        // For now, we just ensure the service is ready.
        if (!this.llmService || !(await this.llmService.isConfigured())) {
            console.warn("LLM service not configured. Chat will not start. Please configure settings.");
            return;
        }

        try {
            // The actual chat session object might be managed within the LLMService
            // or we can still store it here. For now, we'll assume the service
            // manages its own state and this method just signals readiness.
            const mode = document.getElementById('agent-mode-selector').value;
            await DbManager.saveSetting('selectedMode', mode);
            this.activeMode = mode;
            console.log(`Chat ready to start with provider: ${this.llmService.constructor.name}, mode: ${mode}`);
        } catch (error) {
            console.error('Failed to start chat:', error);
            UI.showError(`Error: Could not start chat. ${error.message}`);
        }
    },



    _updateUiState(isSending) {
        const chatSendButton = document.getElementById('chat-send-button');
        const chatCancelButton = document.getElementById('chat-cancel-button');
        chatSendButton.style.display = isSending ? 'none' : 'inline-block';
        chatCancelButton.style.display = isSending ? 'inline-block' : 'none';
    },


    async _handleRateLimiting(chatMessages) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const rateLimitMs = this.rateLimit;

        if (timeSinceLastRequest < rateLimitMs) {
            const delay = rateLimitMs - timeSinceLastRequest;
            UI.appendMessage(chatMessages, `Rate limit active. Waiting for ${Math.ceil(delay / 1000)}s...`, 'ai');
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        this.lastRequestTime = Date.now();
    },

    _prepareAndRenderUserMessage(chatInput, chatMessages, uploadedImage, clearImagePreview) {
        // Handle both DOM elements and string inputs
        let userPrompt;
        if (typeof chatInput === 'string') {
            userPrompt = chatInput.trim();
        } else if (chatInput && chatInput.value) {
            userPrompt = chatInput.value.trim();
        } else {
            userPrompt = '';
        }
        let displayMessage = userPrompt;
        const initialParts = [];

        // Intelligent auto-context injection
        const contextAnalysis = this._analyzeAndInjectContext(userPrompt);
        let enhancedPrompt = userPrompt;
        
        if (contextAnalysis.contextInjected) {
            enhancedPrompt = contextAnalysis.enhancedPrompt;
            displayMessage += `\n🤖 Auto-context: ${contextAnalysis.summary}`;
            console.log(`[Auto-Context] ${contextAnalysis.summary}`);
        }

        if (enhancedPrompt) initialParts.push({ text: enhancedPrompt });

        if (uploadedImage) {
            displayMessage += `\n📷 Attached: ${uploadedImage.name}`;
            initialParts.push({
                inlineData: {
                    mimeType: uploadedImage.type,
                    data: uploadedImage.data,
                },
            });
        }

        // Only update UI if we have DOM elements
        if (chatMessages) {
            UI.appendMessage(chatMessages, displayMessage.trim(), 'user');
        }
        
        // Only clear input if it's a DOM element
        if (chatInput && typeof chatInput !== 'string' && chatInput.value !== undefined) {
            chatInput.value = '';
        }
        
        // Only clear image preview if callback provided
        if (clearImagePreview && typeof clearImagePreview === 'function') {
            clearImagePreview();
        }
        console.log(`[User Query] ${userPrompt}`);

        return initialParts;
    },

    /**
     * Analyze user query and inject context if needed
     */
    async _analyzeAndInjectContext(userPrompt) {
        const result = {
            contextInjected: false,
            enhancedPrompt: userPrompt,
            summary: '',
            analysis: null
        };

        try {
            // Skip auto-context for certain types of queries
            if (userPrompt.length > 150 && this._containsComplexQueryIndicators(userPrompt)) {
                console.log(`[Context Analysis] Skipping auto-context for complex query`);
                return result;
            }

            // Get current file info
            const currentFileInfo = this._getCurrentFileInfo();
            if (!currentFileInfo) {
                return result; // No file open, no context to inject
            }

            // Analyze if context should be included
            const analysis = contextAnalyzer.analyzeQuery(userPrompt, currentFileInfo);
            result.analysis = analysis;

            if (!analysis.shouldIncludeContext) {
                console.log(`[Context Analysis] ${analysis.reason}`);
                return result;
            }

            // Build context
            const context = contextBuilder.buildContext(analysis.suggestedContext, currentFileInfo);
            if (!context) {
                return result;
            }

            // Format context for AI
            const contextText = contextBuilder.formatContextForAI(context);
            
            // Enhance the prompt with context
            result.enhancedPrompt = `${contextText}\n\n---\n\n**User Question:** ${userPrompt}`;
            result.contextInjected = true;
            result.summary = `${context.file.name} (${context.content.totalLines} lines, confidence: ${Math.round(analysis.confidence * 100)}%)`;

            console.log(`[Context Injected] ${result.summary} - ${analysis.reason}`);

        } catch (error) {
            console.error('[Context Injection Error]', error);
            // Fail gracefully - return original prompt
        }

        return result;
    },

    /**
     * Check if query contains indicators of a complex request
     */
    _containsComplexQueryIndicators(userPrompt) {
        // Simple heuristic check for complex query indicators
        const complexQueryIndicators = [
            'review all', 'make', 'create', 'build', 'implement', 'develop',
            'update all', 'change all', 'modify', 'refactor', 'optimize',
            'redesign', 'restructure', 'dashboard', 'application', 'system'
        ];
        
        return complexQueryIndicators.some(indicator =>
            userPrompt.toLowerCase().includes(indicator)
        ) && userPrompt.split(' ').length > 5; // Complex queries are typically longer
    },

    /**
     * Get current file information for context analysis
     */
    _getCurrentFileInfo() {
        const activeFile = Editor.getActiveFile();
        const activeFilePath = Editor.getActiveFilePath();
        const editorInstance = Editor.getEditorInstance();

        if (!activeFile || !editorInstance) {
            return null;
        }

        const model = activeFile.model;
        const position = editorInstance.getPosition();
        const selection = editorInstance.getSelection();

        return {
            path: activeFilePath,
            name: activeFile.name,
            language: model.getLanguageId(),
            totalLines: model.getLineCount(),
            content: model.getValue(),
            cursor: {
                line: position ? position.lineNumber : 1,
                column: position ? position.column : 1
            },
            selection: selection && !selection.isEmpty() ? {
                startLine: selection.startLineNumber,
                startColumn: selection.startColumn,
                endLine: selection.endLineNumber,
                endColumn: selection.endColumn,
                text: model.getValueInRange(selection)
            } : null
        };
    },

    async _performApiCall(history, chatMessages, singleTurn = false) {
        if (!this.llmService) {
            UI.showError("LLM Service is not initialized. Please check your settings.");
            return;
        }

        let functionCalls;
        let continueLoop = true;
        let totalRequestTokens = 0;
        let totalResponseTokens = 0;

        // Estimate request tokens
        if (typeof GPTTokenizer_cl100k_base !== 'undefined') {
            const { encode } = GPTTokenizer_cl100k_base;
            const historyText = history.map(turn => turn.parts.map(p => p.text || '').join('\n')).join('\n');
            totalRequestTokens = encode(historyText).length;
        }
        
        while (continueLoop && !this.isCancelled) {
            try {
                UI.showThinkingIndicator(chatMessages, 'AI is thinking...');
                const mode = document.getElementById('agent-mode-selector').value;
                const customRules = Settings.get(`custom.${mode}.rules`);
                
                // Enhanced tool definitions with smart recommendations
                let tools = ToolExecutor.getToolDefinitions();
                
                // Optimize tool selection for amend mode
                if (mode === 'amend') {
                    // Prioritize safer tools for amend mode
                    const amendOptimizedTools = tools.functionDeclarations.map(tool => {
                        if (tool.name === 'apply_diff') {
                            return {
                                ...tool,
                                description: `🔧 RECOMMENDED FOR AMEND MODE: ${tool.description}`
                            };
                        }
                        if (tool.name === 'read_file') {
                            return {
                                ...tool,
                                description: `📖 ESSENTIAL FOR AMEND MODE: ${tool.description} Always use with include_line_numbers=true for precise editing.`
                            };
                        }
                        if (tool.name === 'search_in_file') {
                            return {
                                ...tool,
                                description: `🔍 PREFERRED FOR AMEND MODE: ${tool.description}`
                            };
                        }
                        return tool;
                    });
                    tools = { functionDeclarations: amendOptimizedTools };
                }
                
                const stream = this.llmService.sendMessageStream(history, tools, customRules);

                let modelResponseText = '';
                let displayText = '';
                functionCalls = []; // Reset for this iteration

                for await (const chunk of stream) {
                    if (this.isCancelled) return;

                    if (chunk.text) {
                        const text = chunk.text;
                        modelResponseText += text;
                        displayText += text;
                        UI.appendMessage(chatMessages, displayText, 'ai', true);
                    }
                    if (chunk.functionCalls) {
                        functionCalls.push(...chunk.functionCalls);
                    }
                    if (chunk.usageMetadata) {
                        // This is for Gemini, which provides accurate counts
                        totalRequestTokens = chunk.usageMetadata.promptTokenCount || 0;
                        totalResponseTokens += chunk.usageMetadata.candidatesTokenCount || 0;
                    }
                }

                // For OpenAI, estimate response tokens
                if (typeof GPTTokenizer_cl100k_base !== 'undefined' && this.llmService.constructor.name === 'OpenAIService') {
                    const { encode } = GPTTokenizer_cl100k_base;
                    totalResponseTokens = encode(modelResponseText).length;
                }
                
                console.log(`[Token Usage] Final totals - Req: ${totalRequestTokens}, Res: ${totalResponseTokens}`);
                UI.updateTokenDisplay(totalRequestTokens, totalResponseTokens);
                

                const modelResponseParts = [];
                if (modelResponseText) modelResponseParts.push({ text: modelResponseText });
                if (functionCalls.length > 0) {
                    functionCalls.forEach(fc => modelResponseParts.push({ functionCall: fc }));
                }

                if (modelResponseParts.length > 0) {
                    history.push({ role: 'model', parts: modelResponseParts });
                }

                if (functionCalls.length > 0) {
                    // Execute all tools sequentially for all providers
                    const toolResults = [];
                    for (const call of functionCalls) {
                        if (this.isCancelled) return;
                        console.log(`Executing tool: ${call.name} sequentially...`);
                        UI.showThinkingIndicator(chatMessages, `Executing tool: ${call.name}...`);
                        const result = await ToolExecutor.execute(call, this.rootDirectoryHandle);
                        toolResults.push({
                            id: call.id,
                            name: result.toolResponse.name,
                            response: result.toolResponse.response,
                        });
                    }
                    history.push({ role: 'user', parts: toolResults.map(functionResponse => ({ functionResponse })) });
                    
                    if (singleTurn) {
                        continueLoop = false;
                    } else {
                        // For OpenAI: Continue the loop to get AI's next response
                        // For other providers (Gemini, Ollama): Check if AI wants to continue with more tools
                        if (this.llmService.constructor.name === 'OpenAIService') {
                            continueLoop = true; // Always continue for OpenAI to get next response
                        } else {
                            // For Gemini/Ollama: Continue the loop to allow them to make more tool calls if needed
                            continueLoop = true;
                        }
                    }
                } else {
                    // No tools called, conversation is complete
                    continueLoop = false;
                }

            } catch (error) {
                console.error(`Error during API call with ${this.llmService.constructor.name}:`, error);
                console.error(`Error stack:`, error.stack); // Log the stack trace
                UI.showError(`An error occurred during AI communication: ${error.message}. Please check your API key and network connection.`);
                continueLoop = false;
            }
        }

        // Only save to DB if it's not part of an autonomous plan
        if (!this.activePlan) {
            await DbManager.saveChatHistory(history);
        }
    },

    /**
     * Simplified method for programmatic API calls (used by TaskManager, etc.)
     */
    async sendPrompt(prompt, options = {}) {
        try {
            await this._initializeLLMService();
            
            if (!(await this.llmService.isConfigured())) {
                throw new Error("LLM service not configured");
            }

            const history = options.history || [];
            const tools = options.tools || ToolExecutor.getToolDefinitions();
            const customRules = options.customRules || '';

            // Create a simple message history
            const messageHistory = [...history, {
                role: 'user',
                parts: [{ text: prompt }]
            }];

            let fullResponse = '';
            const streamGenerator = this.llmService.sendMessageStream(messageHistory, tools, customRules);
            
            for await (const chunk of streamGenerator) {
                if (chunk.text) {
                    fullResponse += chunk.text;
                }
            }

            return fullResponse.trim();
        } catch (error) {
            console.error('[ChatService] sendPrompt failed:', error);
            throw error;
        }
    },

    async sendMessage(chatInput, chatMessages, chatSendButton, chatCancelButton, uploadedImage, clearImagePreview) {
        // Handle both DOM elements and string inputs
        let userPrompt;
        if (typeof chatInput === 'string') {
            userPrompt = chatInput.trim();
        } else if (chatInput && chatInput.value) {
            userPrompt = chatInput.value.trim();
        } else {
            userPrompt = '';
        }
        
        if ((!userPrompt && !uploadedImage) || this.isSending) return;

        this.isSending = true;
        this.isCancelled = false;
        
        // Only update UI if we have DOM elements
        if (chatSendButton && chatCancelButton) {
            this._updateUiState(true);
        }
        this.resetErrorTracker();
        
        // Store the original user query for todo management
        this.lastUserQuery = userPrompt;

        try {
            // Check if todo mode is active and this is a follow-up query
            if (this.todoMode && AITodoManager.activePlan) {
                await this._handleTodoModeMessage(userPrompt, chatMessages);
            } else {
                // Analyze if this query should use todo list approach
                const todoAnalysis = AITodoManager.analyzeQuery(userPrompt);
                
                if (todoAnalysis.shouldCreateTodoList) {
                    // Handle as a todo list task
                    await this._handleTodoListQuery(userPrompt, chatMessages);
                } else {
                    // Regular message handling
                    // Prepare user message with intelligent context injection
                    const messageParts = this._prepareAndRenderUserMessage(chatInput, chatMessages, uploadedImage, clearImagePreview);
                    
                    // Process the message directly (task management functionality has been removed)
                    const history = await DbManager.getChatHistory();
                    
                    // Use the enhanced message parts that may include auto-context
                    history.push({ role: 'user', parts: messageParts });
                    
                    // Process the request with a single API call
                    await this._performApiCall(history, chatMessages, false); // singleTurn = false to allow tool chains
                    
                    await DbManager.saveChatHistory(history);
                }
            }
        } catch (error) {
            UI.showError(`An error occurred: ${error.message}`);
            console.error('Chat Error:', error);
        } finally {
            this.isSending = false;
            this._updateUiState(false);
            // Don't clear input here since it's already cleared in _prepareAndRenderUserMessage
        }
    },

    cancelMessage() {
        if (this.isSending) {
            this.isCancelled = true;
        }
    },

    async sendDirectCommand(prompt, chatMessages) {
        if (this.isSending) return;

        this.isSending = true;
        this.isCancelled = false;
        this._updateUiState(true);

        try {
            UI.appendMessage(chatMessages, prompt, 'user');
            const history = await DbManager.getChatHistory();
            history.push({ role: 'user', parts: [{ text: prompt }] });

            await this._performApiCall(history, chatMessages, true); // singleTurn = true

            await DbManager.saveChatHistory(history);
        } catch (error) {
            UI.showError(`An error occurred: ${error.message}`);
            console.error('Direct Command Error:', error);
        } finally {
            this.isSending = false;
            this._updateUiState(false);
        }
    },

    async clearHistory(chatMessages) {
        chatMessages.innerHTML = '';
        UI.appendMessage(chatMessages, 'Conversation history cleared.', 'ai');
        await DbManager.clearChatHistory();
        await this._initializeLLMService();
    },

    async condenseHistory(chatMessages) {
        UI.appendMessage(chatMessages, 'Condensing history... This will start a new session.', 'ai');
        const history = await DbManager.getChatHistory();
        if (history.length === 0) {
            UI.appendMessage(chatMessages, 'History is already empty.', 'ai');
            return;
        }

        const condensationPrompt =
            "Please summarize our conversation so far in a concise way. Include all critical decisions, file modifications, and key insights. The goal is to reduce the context size while retaining the essential information for our ongoing task. Start the summary with 'Here is a summary of our conversation so far:'.";
        
        // This needs to be a one-off call, not part of the main loop
        const condensationHistory = history.concat([{ role: 'user', parts: [{ text: condensationPrompt }] }]);
        const stream = this.llmService.sendMessageStream(condensationHistory, [], ''); // No tools, no custom rules for summary
        let summaryText = '';
        for await (const chunk of stream) {
            if (chunk.text) {
                summaryText += chunk.text;
            }
        }
        
        chatMessages.innerHTML = '';
        UI.appendMessage(chatMessages, 'Original conversation history has been condensed.', 'ai');
        UI.appendMessage(chatMessages, summaryText, 'ai');

        await this._startChat();
    },

    async viewHistory() {
        const history = await DbManager.getChatHistory();
        return JSON.stringify(history, null, 2);
    },

   trackError(filePath, errorSignature) {
       if (this.errorTracker.filePath === filePath && this.errorTracker.errorSignature === errorSignature) {
           this.errorTracker.count++;
       } else {
           this.errorTracker.filePath = filePath;
           this.errorTracker.errorSignature = errorSignature;
           this.errorTracker.count = 1;
       }
       console.log(`Error tracked:`, this.errorTracker);
   },

   getConsecutiveErrorCount(filePath, errorSignature) {
       if (this.errorTracker.filePath === filePath && this.errorTracker.errorSignature === errorSignature) {
           return this.errorTracker.count;
       }
       return 0;
   },

   resetErrorTracker() {
       this.errorTracker.filePath = null;
       this.errorTracker.errorSignature = null;
       this.errorTracker.count = 0;
       console.log('Error tracker reset.');
   },

   async runToolDirectly(toolName, params, silent = false) {
       if (this.isSending && !this.activePlan) { // Allow tool use during autonomous plan
           UI.showError("Please wait for the current AI operation to complete.");
           return;
       }

       const toolCall = { name: toolName, args: params };
       const chatMessages = document.getElementById('chat-messages');
       if (!silent) {
           UI.appendMessage(chatMessages, `Running tool: ${toolName}...`, 'ai');
       }

       try {
           const result = await ToolExecutor.execute(toolCall, this.rootDirectoryHandle, silent);
           if (!silent) {
               let resultMessage = `Tool '${toolName}' executed successfully.`;
               if (result.toolResponse && result.toolResponse.response && result.toolResponse.response.message) {
                   resultMessage = result.toolResponse.response.message;
               } else if (result.toolResponse && result.toolResponse.response && result.toolResponse.response.error) {
                   throw new Error(result.toolResponse.response.error);
               }
               UI.appendMessage(chatMessages, resultMessage, 'ai');
           }
       } catch (error) {
           const errorMessage = `Error running tool '${toolName}': ${error.message}`;
           UI.showError(errorMessage);
           if (!silent) {
               UI.appendMessage(chatMessages, errorMessage, 'ai');
           }
           console.error(errorMessage, error);
       }
   },

   // Task-related methods (_buildTaskContext, _analyzeTaskError, and getExecutionInsights) have been removed
   
   /**
    * Handle a user query that should be processed as a todo list
    * @param {string} userQuery - The user's query
    * @param {HTMLElement} chatMessages - The chat messages container
    */
   async _handleTodoListQuery(userQuery, chatMessages) {
       try {
           // Append user message to the UI
           UI.appendMessage(chatMessages, userQuery, 'user');
           
           // Get initial AI analysis of the query for task planning
           UI.showThinkingIndicator(chatMessages, 'Analyzing your request and creating a plan...');
           
           const initialPrompt = `
               Analyze the following user request and break it down into a clear, sequential task list.
               For each task, provide a brief, actionable description.
               Present your response as a numbered list of tasks, with 3-7 specific steps.
               
               User request: ${userQuery}
               
               Response format:
               # Task Analysis
               
               Here's a plan to accomplish this:
               
               1. First task
               2. Second task
               ...
           `;
           
           const initialResponse = await this.sendPrompt(initialPrompt, {
               customRules: 'You are a task planning assistant that breaks down complex requests into clear, actionable steps.'
           });
           
           // Generate todo items from the AI response
           const todoItems = await AITodoManager.generateTodoList(userQuery, initialResponse);
           
           // Update the UI with todo list
           UI.updateTodoList(todoItems);
           
           // Format and display the initial plan response
           const formattedResponse = AITodoManager.formatAIResponse('initial', todoItems);
           UI.appendMessage(chatMessages, formattedResponse, 'ai');
           
           // Set todo mode active
           this.todoMode = true;
           
           // Start working on the first task
           if (todoItems.length > 0) {
               const firstTask = todoItems[0];
               await AITodoManager.updateTodoStatus(firstTask.id, TodoStatus.IN_PROGRESS);
               
               // Execute the first task
               await this._executeTodoTask(firstTask, chatMessages);
           }
       } catch (error) {
           console.error('Error handling todo list query:', error);
           UI.appendMessage(chatMessages, 'Sorry, I encountered an error while creating your todo list plan.', 'ai');
           this.todoMode = false;
       }
   },
   
   /**
    * Handle a message when todo mode is active
    * @param {string} userMessage - The user's message
    * @param {HTMLElement} chatMessages - The chat messages container
    */
   async _handleTodoModeMessage(userMessage, chatMessages) {
       // Display user message
       UI.appendMessage(chatMessages, userMessage, 'user');
       
       // Check for plan termination commands
       if (userMessage.toLowerCase().match(/cancel|stop|abort|quit|exit/)) {
           AITodoManager.reset();
           this.todoMode = false;
           UI.appendMessage(chatMessages, "Todo plan has been canceled. Is there anything else I can help you with?", 'ai');
           return;
       }
       
       try {
           // Get all current todos
           const allTodos = await todoManager.getAllTodos();
           const planTodos = allTodos.filter(todo =>
               AITodoManager.activePlan &&
               AITodoManager.activePlan.todoItems.includes(todo.id)
           );
           
           // Process user feedback on current task
           const inProgressTasks = planTodos.filter(todo => todo.status === TodoStatus.IN_PROGRESS);
           
           if (inProgressTasks.length > 0) {
               const currentTask = inProgressTasks[0];
               
               // Check if user message indicates task completion
               const completionIndicators = /done|complete|finished|next|proceed|continue|good|completed/i;
               if (completionIndicators.test(userMessage)) {
                   // Mark current task as completed
                   await AITodoManager.updateTodoStatus(currentTask.id, TodoStatus.COMPLETED);
                   
                   // Update the todo list UI
                   UI.updateTodoList(await todoManager.getAllTodos());
                   
                   // Check if plan is complete
                   if (await AITodoManager.isPlanComplete()) {
                       const summary = await AITodoManager.generatePlanSummary();
                       UI.appendMessage(chatMessages, summary, 'ai');
                       this.todoMode = false;
                   } else {
                       // Find the next task and execute it
                       const pendingTasks = planTodos.filter(todo => todo.status === TodoStatus.PENDING);
                       if (pendingTasks.length > 0) {
                           const nextTask = pendingTasks[0];
                           await AITodoManager.updateTodoStatus(nextTask.id, TodoStatus.IN_PROGRESS);
                           
                           // Update UI with progress
                           const progressResponse = AITodoManager.formatAIResponse(
                               'progress',
                               await todoManager.getAllTodos(),
                               "Moving to the next task..."
                           );
                           UI.appendMessage(chatMessages, progressResponse, 'ai');
                           
                           // Execute the next task
                           await this._executeTodoTask(nextTask, chatMessages);
                       }
                   }
               } else {
                   // User provided feedback but not completion - incorporate feedback into current task
                   const taskPrompt = `
                       I'm currently working on this task: "${currentTask.text}"
                       
                       The user has provided this feedback: "${userMessage}"
                       
                       Please incorporate this feedback and continue with the task.
                   `;
                   
                   const response = await this.sendPrompt(taskPrompt);
                   UI.appendMessage(chatMessages, response, 'ai');
               }
           }
       } catch (error) {
           console.error('Error handling todo mode message:', error);
           UI.appendMessage(chatMessages, 'Sorry, I encountered an error while processing your feedback.', 'ai');
       }
   },
   
   /**
    * Execute a single todo task
    * @param {Object} todoItem - The todo item to execute
    * @param {HTMLElement} chatMessages - The chat messages container
    */
   async _executeTodoTask(todoItem, chatMessages) {
       try {
           // Generate a detailed prompt based on the task
           const taskPrompt = `
               I'm helping the user with this overall goal: "${this.lastUserQuery}"
               
               I'm now working on this specific task: "${todoItem.text}"
               
               Please provide a detailed response addressing this specific task.
               Be thorough but focused only on this particular step.
           `;
           
           // Show thinking indicator
           UI.showThinkingIndicator(chatMessages, `Working on task: ${todoItem.text}...`);
           
           // Get AI response for this task
           const taskResponse = await this.sendPrompt(taskPrompt);
           
           // Show task response to user
           UI.appendMessage(chatMessages, taskResponse, 'ai');
           
           // Update the todo list UI
           UI.updateTodoList(await todoManager.getAllTodos());
           
       } catch (error) {
           console.error(`Error executing todo task "${todoItem.text}":`, error);
           UI.appendMessage(chatMessages, `I encountered an error while working on the task "${todoItem.text}". Let me know if you'd like to continue or try a different approach.`, 'ai');
       }
   }
};
