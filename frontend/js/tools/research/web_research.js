/**
 * Web research and URL reading tools
 */

import * as UI from '../../../ui.js';
import { analyzeError, withRetry, withProgressiveTimeout, buildErrorContext } from '../utils/shared_utils.js';
import { createEnhancedErrorResponse, validateToolSecurity, validateSecureUrl } from '../core/tool_interfaces.js';

export async function _readUrl({ url }) {
    const context = buildErrorContext('read_url', 'read_url', { url });
    
    try {
        // Enhanced security validation for URL
        const securityResult = await validateToolSecurity(
            { url },
            {
                toolName: 'read_url',
                operation: 'web_request',
                requireHttps: false // Allow both HTTP and HTTPS for flexibility
            }
        );
        
        const sanitizedUrl = securityResult.sanitizedParams.url || validateSecureUrl(url, 'read_url');
        // Use retry logic for network operations
        const result = await withRetry(
            async () => {
                const response = await fetch('/api/read-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: sanitizedUrl }),
                });
                
                const urlResult = await response.json();
                
                if (response.ok) {
                    return urlResult;
                } else {
                    const error = new Error(urlResult.message || 'Failed to read URL');
                    error.status = response.status;
                    error.url = sanitizedUrl;
                    throw error;
                }
            },
            {
                maxRetries: 3,
                backoffStrategy: 'exponential',
                context: context,
                toolName: 'read_url',
                retryCondition: (error, attempt, errorAnalysis) => {
                    // Retry for network issues, timeouts, and server errors (5xx)
                    return errorAnalysis.category === 'network' ||
                           errorAnalysis.category === 'timeout' ||
                           (error.status && error.status >= 500);
                },
                onRetry: async (error, attempt, delay, errorAnalysis) => {
                    console.log(`[URL Retry ${attempt}] ${sanitizedUrl}: ${error.message} (retrying in ${Math.round(delay)}ms)`);
                    UI.appendMessage(document.getElementById('chat-messages'),
                        `⚠️ URL read failed (attempt ${attempt}), retrying: ${sanitizedUrl}`, 'ai');
                }
            }
        );
        
        return result;
        
    } catch (error) {
        console.error(`Enhanced error handling for read_url '${sanitizedUrl || url}':`, error);
        
        // Analyze error and provide enhanced feedback
        const errorAnalysis = analyzeError(error, context, 'read_url');
        
        // For certain error types, provide specific guidance
        if (error.status === 403 || error.status === 401) {
            throw new Error(`Access denied to ${sanitizedUrl || url}. The website may require authentication or block automated access.`);
        } else if (error.status === 404) {
            throw new Error(`URL not found: ${sanitizedUrl || url}. Please verify the URL is correct and accessible.`);
        } else if (error.status >= 500) {
            throw new Error(`Server error when accessing ${sanitizedUrl || url}. The website may be temporarily unavailable.`);
        } else if (errorAnalysis.category === 'network') {
            throw new Error(`Network error when accessing ${sanitizedUrl || url}. Please check your internet connection and try again.`);
        }
        
        // Re-throw with enhanced context
        const enhancedError = new Error(`Failed to read URL '${sanitizedUrl || url}': ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.errorAnalysis = errorAnalysis;
        throw enhancedError;
    }
}

/**
 * Performs comprehensive web research using a sophisticated three-stage approach:
 *
 * Stage 1: Broad keyword extraction and parallel search waves
 * - Extracts key concepts from the original query
 * - Generates multiple search queries to explore different aspects
 * - Executes searches in parallel for faster and broader initial exploration
 * - Scores and prioritizes URLs based on multiple relevance factors
 *
 * Stage 2: Link aggregation and first-pass analysis
 * - Analyzes content gathered in Stage 1
 * - Identifies knowledge gaps (important topics with limited coverage)
 * - Extracts keywords from content for targeted follow-up
 * - Generates targeted search queries to fill knowledge gaps
 *
 * Stage 3: Focused content reading and synthesis
 * - Executes targeted searches to fill identified knowledge gaps
 * - Prioritizes the most authoritative and relevant sources
 * - Focuses on depth rather than breadth at this stage
 * - Aggregates comprehensive information across all stages
 *
 * This multi-stage approach provides more thorough research than single-pass methods
 * by first prioritizing breadth of coverage, then identifying gaps, and finally
 * filling those gaps with focused research.
 *
 * Tasks are properly linked and managed through the task management system,
 * ensuring all subtasks are completed in sequence and no tasks are left incomplete.
 *
 * @param {Object} params - Research parameters
 * @param {string} params.query - The research query or topic to investigate
 * @param {number} [params.max_results=3] - Maximum URLs to read per search (default: 3)
 * @param {number} [params.depth=2] - Maximum recursion depth (default: 2)
 * @param {number} [params.relevance_threshold=0.7] - Minimum relevance score to read URLs (0.3-1.0)
 * @param {string} [params.task_id] - Optional ID of a parent task to link with
 * @returns {Object} Research results containing summary, full content, and metadata
 */
export async function _performResearch({ query, max_results = 3, depth = 2, relevance_threshold = 0.7, task_id = null }) {
    try {
        // Enhanced security validation for research parameters
        const securityResult = await validateToolSecurity(
            { query, max_results, depth, relevance_threshold },
            {
                toolName: 'perform_research',
                operation: 'search',
                maxContentLength: 10000 // Limit query length
            }
        );
        
        const sanitizedQuery = securityResult.sanitizedParams.content || query;
        
        if (!sanitizedQuery) throw new Error("The 'query' parameter is required for perform_research.");
        
        // Validate numeric parameters
        const validatedMaxResults = Math.min(Math.max(1, max_results || 3), 10); // Limit to 1-10
        const validatedDepth = Math.min(Math.max(1, depth || 2), 5); // Limit to 1-5
        const validatedThreshold = Math.min(Math.max(0.1, relevance_threshold || 0.7), 1.0); // Limit to 0.1-1.0
    
    // Get task manager if a task_id is provided
    let taskTools = null;
    let stageTasks = {
        stage1: null,
        stage2: null,
        stage3: null,
        parent: task_id
    };
    
    // If task_id is provided, try to get task info and subtasks
    if (task_id) {
        try {
            // Task management system has been removed
            console.log("Task management functionality is no longer available");
            
            // Continue without task tracking
            if (parentTask) {
                console.log(`[Research] Linked to parent task: ${parentTask.title} (ID: ${task_id})`);
                
                // Get subtasks for each stage if they exist
                const subtasks = parentTask.subtasks
                    .map(id => taskTools.getById(id))
                    .filter(task => task !== undefined);
                
                // Find stage tasks by tags or title
                for (const task of subtasks) {
                    if (task.tags?.includes('stage-1') || task.title?.includes('Stage 1')) {
                        stageTasks.stage1 = task.id;
                    } else if (task.tags?.includes('stage-2') || task.title?.includes('Stage 2')) {
                        stageTasks.stage2 = task.id;
                    } else if (task.tags?.includes('stage-3') || task.title?.includes('Stage 3')) {
                        stageTasks.stage3 = task.id;
                    }
                }
            }
        } catch (error) {
            console.warn(`[Research] Failed to get task information: ${error.message}`);
            // Continue without task linking if there's an error
        }
    }

    // Research state tracking with enhanced multi-stage capabilities
    const researchState = {
        originalQuery: sanitizedQuery,
        visitedUrls: new Set(),
        allContent: [],
        references: [],
        searchHistory: [],
        searchQueries: [],          // Store all generated search queries
        urlsByRelevance: [],        // URLs sorted by relevance score
        keywordExtractions: [],     // Keywords extracted from query and content
        currentStage: 1,            // Track current research stage (1-3)
        priorityQueue: [],          // Queue of URLs to read, sorted by priority
        contentSummaries: [],       // Summaries of processed content
        knowledgeGaps: [],          // Identified gaps in the research
        maxDepth: Math.min(validatedDepth, 4),
        maxResults: Math.min(validatedMaxResults, 6),  // Increased for broader first stage
        totalUrlsRead: 0,
        maxTotalUrls: 20,           // Increased for multi-stage approach
        relevanceThreshold: Math.max(0.3, Math.min(validatedThreshold, 1.0)),
        parallelSearches: 3,        // Number of parallel searches in first stage
        stageOneComplete: false,
        stageTwoComplete: false,
        stageThreeComplete: false,
        taskId: task_id,
        stageTasks: stageTasks,
        taskTools: taskTools
    };

    /**
     * Stage 1: Keyword extraction and query generation
     * Extracts key concepts from original query and generates multiple search queries
     */
    function extractKeywordsAndGenerateQueries(query, maxQueries = 5) {
        console.log(`[Research Stage 1] Extracting keywords from: "${query}"`);
        
        // Clean the query and split into words
        const cleanQuery = query.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
            
        const words = cleanQuery.split(' ');
        
        // Extract main concepts (words longer than 3 chars, not stopwords)
        const stopwords = ['and', 'the', 'for', 'with', 'that', 'this', 'from', 'what', 'how', 'why', 'when', 'where', 'who'];
        const concepts = words.filter(word =>
            word.length > 3 && !stopwords.includes(word));
            
        // Record the keyword extraction
        researchState.keywordExtractions.push({
            source: 'original_query',
            query: query,
            extractedConcepts: concepts,
            timestamp: new Date().toISOString()
        });
        
        // Generate variations of search queries
        const searchQueries = [];
        
        // 1. The original query
        searchQueries.push(query);
        
        // 2. Focused queries with pairs of concepts
        if (concepts.length >= 2) {
            for (let i = 0; i < concepts.length - 1; i++) {
                for (let j = i + 1; j < concepts.length; j++) {
                    const focusedQuery = `${concepts[i]} ${concepts[j]} ${query.includes('how') || query.includes('what') ? query.split(' ').slice(0, 3).join(' ') : ''}`.trim();
                    searchQueries.push(focusedQuery);
                }
            }
        }
        
        // 3. Add "guide", "tutorial", "explained" to create more instructional queries
        const instructionalTerms = ['guide', 'tutorial', 'explained', 'overview'];
        const mainConcepts = concepts.slice(0, 3).join(' ');
        instructionalTerms.forEach(term => {
            searchQueries.push(`${mainConcepts} ${term}`);
        });
        
        // Deduplicate and take top queries
        const uniqueQueries = [...new Set(searchQueries)];
        const finalQueries = uniqueQueries.slice(0, maxQueries);
        
        console.log(`[Research Stage 1] Generated ${finalQueries.length} search queries:`, finalQueries);
        return finalQueries;
    }

    /**
     * Scores URL relevance based on comprehensive criteria
     * Returns a score between 0 and 1
     */
    function scoreUrlRelevance(url, title, snippet, searchQuery) {
        // Base score starts at 0.5
        let relevanceScore = 0.5;
        
        // Domain reputation scoring - weighted more heavily in multi-stage approach
        const domainScores = {
            // Tier 1: Highly authoritative sources
            'wikipedia.org': 0.30,
            '.edu': 0.25,
            '.gov': 0.25,
            'github.com': 0.20,
            
            // Tier 2: Technical and documentation sites
            'docs.': 0.20,
            'developer.': 0.20,
            'mozilla.org': 0.20,
            'w3.org': 0.20,
            'stackoverflow.com': 0.15,
            
            // Tier 3: Other reputable sites
            'ieee.org': 0.15,
            'acm.org': 0.15,
            'medium.com': 0.10,
            'research': 0.10,
            
            // Negative scoring for spam/ad domains
            'ads.': -0.50,
            'tracker.': -0.50,
            'affiliate.': -0.40,
            'popup.': -0.40,
            'analytics.': -0.30
        };
        
        // Apply domain scoring
        for (const [domain, score] of Object.entries(domainScores)) {
            if (url.includes(domain)) {
                relevanceScore += score;
                break; // Only apply the highest matching domain score
            }
        }
        
        // Content relevance based on title and snippet
        const queryTerms = searchQuery.toLowerCase().split(/\s+/);
        const contentText = `${title} ${snippet}`.toLowerCase();
        
        // Score based on percentage of query terms found in the content
        const termMatches = queryTerms.filter(term => contentText.includes(term)).length;
        relevanceScore += (termMatches / queryTerms.length) * 0.35;
        
        // Special content type bonuses
        const contentTypeScores = {
            'tutorial': 0.15,
            'guide': 0.15,
            'documentation': 0.15,
            'explained': 0.10,
            'how to': 0.10,
            'introduction': 0.10,
            'overview': 0.10,
            'example': 0.10,
            'reference': 0.10
        };
        
        // Apply content type scoring
        for (const [type, score] of Object.entries(contentTypeScores)) {
            if (title.toLowerCase().includes(type) || snippet.toLowerCase().includes(type)) {
                relevanceScore += score;
            }
        }
        
        // URL structure scoring
        const urlPathScores = {
            '/docs/': 0.15,
            '/tutorial/': 0.15,
            '/guide/': 0.15,
            '/learn/': 0.10,
            '/reference/': 0.10,
            '/examples/': 0.10,
            '/article/': 0.05
        };
        
        // Apply URL path scoring
        for (const [path, score] of Object.entries(urlPathScores)) {
            if (url.includes(path)) {
                relevanceScore += score;
                break; // Only apply the highest matching path score
            }
        }
        
        // File type bonuses for downloadable resources
        if (url.match(/\.(pdf|doc|docx)$/i)) {
            relevanceScore += 0.10; // Documents often contain comprehensive information
        }
        
        // Normalize score to 0-1 range
        relevanceScore = Math.max(0, Math.min(1, relevanceScore));
        
        return relevanceScore;
    }

    /**
     * Executes searches in parallel to quickly gather broad initial results
     */
    async function executeParallelSearches(searchQueries) {
        console.log(`[Research Stage 1] Executing ${searchQueries.length} parallel searches`);
        
        // Import search function dynamically
        const { _duckduckgoSearch } = await import('./search_engines.js');
        
        const searchPromises = searchQueries.map(async (query, index) => {
            try {
                UI.appendMessage(document.getElementById('chat-messages'),
                    `🔍 Search ${index + 1}/${searchQueries.length}: "${query}"`, 'ai');
                
                const results = await _duckduckgoSearch({ query });
                
                // Record the search
                researchState.searchHistory.push({
                    query,
                    stage: 1,
                    resultCount: results.results?.length || 0,
                    timestamp: new Date().toISOString()
                });
                
                if (!results.results || results.results.length === 0) {
                    console.log(`[Research Stage 1] No results for query: "${query}"`);
                    return [];
                }
                
                // Score and return URL information
                return results.results.map(result => ({
                    url: result.link,
                    title: result.title,
                    snippet: result.snippet,
                    query: query,
                    relevanceScore: scoreUrlRelevance(result.link, result.title, result.snippet, query),
                    stage: 1,
                    processed: false
                }));
            } catch (error) {
                console.error(`[Research Stage 1] Search failed for "${query}":`, error.message);
                return [];  // Return empty array on error to continue with other searches
            }
        });
        
        // Wait for all searches to complete
        const allSearchResults = await Promise.all(searchPromises);
        
        // Flatten results and remove duplicates
        const flatResults = allSearchResults.flat();
        const uniqueResults = [];
        const seenUrls = new Set();
        
        flatResults.forEach(result => {
            if (!seenUrls.has(result.url)) {
                seenUrls.add(result.url);
                uniqueResults.push(result);
            }
        });
        
        // Sort by relevance score
        uniqueResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        console.log(`[Research Stage 1] Aggregated ${uniqueResults.length} unique URLs from all searches`);
        return uniqueResults;
    }

    /**
     * Decides whether a URL should be read based on relevance to the research goal
     * Enhanced for multi-stage approach
     */
    function shouldReadUrl(urlInfo, stage) {
        // Already processed or visited
        if (researchState.visitedUrls.has(urlInfo.url)) return false;
        if (researchState.totalUrlsRead >= researchState.maxTotalUrls) return false;
        
        // Stage-specific threshold adjustment
        let stageThreshold = researchState.relevanceThreshold;
        
        if (stage === 1) {
            // More permissive in first stage to gather broad information
            stageThreshold -= 0.2;
        } else if (stage === 3) {
            // More strict in final stage to focus on highest quality
            stageThreshold += 0.1;
        }
        
        // Apply threshold check
        const shouldRead = urlInfo.relevanceScore >= stageThreshold;
        
        console.log(`[Research Stage ${stage}] URL: ${urlInfo.url} | Score: ${urlInfo.relevanceScore.toFixed(2)} | Threshold: ${stageThreshold.toFixed(2)} | Read: ${shouldRead}`);
        
        return shouldRead;
    }

    /**
     * Processes a URL by reading its content and analyzing it
     */
    async function processUrl(urlInfo, stage) {
        if (researchState.visitedUrls.has(urlInfo.url)) {
            return null;
        }
        
        researchState.visitedUrls.add(urlInfo.url);
        researchState.references.push(urlInfo.url);
        researchState.totalUrlsRead++;
        
        try {
            UI.appendMessage(document.getElementById('chat-messages'),
                `📖 Reading: ${urlInfo.title || urlInfo.url} (Stage ${stage})`, 'ai');
            
            const urlContent = await _readUrl({ url: urlInfo.url });
            
            if (!urlContent.content || !urlContent.content.trim()) {
                console.warn(`[Research Stage ${stage}] No content found for URL: ${urlInfo.url}`);
                return null;
            }
            
            // Create content entry with stage information
            const contentEntry = {
                url: urlInfo.url,
                title: urlInfo.title,
                snippet: urlInfo.snippet,
                content: urlContent.content,
                links: urlContent.links || [],
                stage: stage,
                relevanceScore: urlInfo.relevanceScore,
                timestamp: new Date().toISOString()
            };
            
            researchState.allContent.push(contentEntry);
            console.log(`[Research Stage ${stage}] Successfully read content from ${urlInfo.url}`);
            
            return contentEntry;
        } catch (error) {
            console.warn(`[Research Stage ${stage}] Failed to read URL ${urlInfo.url}:`, error.message);
            
            // Track failed URLs
            researchState.allContent.push({
                url: urlInfo.url,
                title: urlInfo.title,
                content: `Error reading content: ${error.message}`,
                links: [],
                stage: stage,
                error: true,
                timestamp: new Date().toISOString()
            });
            
            return null;
        }
    }

    /**
     * Extracts relevant keywords from the content for further searches
     */
    function extractKeywordsFromContent(contentEntry) {
        if (!contentEntry || !contentEntry.content) return [];
        
        // Extract most relevant terms from content
        const content = contentEntry.content.toLowerCase();
        const words = content
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);
            
        // Count word frequencies
        const wordFreq = {};
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
        
        // Get original query terms to exclude
        const queryTerms = researchState.originalQuery.toLowerCase().split(/\s+/);
        
        // Find frequently mentioned terms not in original query
        const frequentTerms = Object.entries(wordFreq)
            .filter(([word, freq]) =>
                freq >= 5 && !queryTerms.includes(word))  // Higher threshold than original
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
            
        // Record the extraction
        researchState.keywordExtractions.push({
            source: 'content',
            url: contentEntry.url,
            extractedKeywords: frequentTerms,
            timestamp: new Date().toISOString()
        });
        
        return frequentTerms;
    }

    /**
     * Stage 2: Content analysis and knowledge gap identification
     */
    function analyzeContentAndIdentifyGaps() {
        console.log(`[Research Stage 2] Analyzing ${researchState.allContent.length} content items from Stage 1`);
        
        // Create a map of key topics and their coverage
        const topicCoverage = {};
        const allKeywords = [];
        
        // Extract all keywords from content gathered in Stage 1
        researchState.allContent
            .filter(item => !item.error && item.stage === 1)
            .forEach(item => {
                const keywords = extractKeywordsFromContent(item);
                allKeywords.push(...keywords);
                
                // Map keywords to the content that covers them
                keywords.forEach(keyword => {
                    if (!topicCoverage[keyword]) {
                        topicCoverage[keyword] = [];
                    }
                    topicCoverage[keyword].push(item.url);
                });
            });
            
        // Count keyword frequencies across all content
        const keywordFreq = {};
        allKeywords.forEach(keyword => {
            keywordFreq[keyword] = (keywordFreq[keyword] || 0) + 1;
        });
        
        // Sort keywords by frequency
        const sortedKeywords = Object.entries(keywordFreq)
            .sort(([,a], [,b]) => b - a)
            .map(([keyword]) => keyword);
            
        // Identify knowledge gaps (important keywords with limited coverage)
        const knowledgeGaps = [];
        sortedKeywords.slice(0, 10).forEach(keyword => {
            const coverage = topicCoverage[keyword] || [];
            if (coverage.length < 2) {  // Only mentioned in 0 or 1 sources
                knowledgeGaps.push({
                    keyword: keyword,
                    coverageCount: coverage.length,
                    sources: coverage
                });
            }
        });
        
        console.log(`[Research Stage 2] Identified ${knowledgeGaps.length} knowledge gaps:`,
            knowledgeGaps.map(gap => gap.keyword));
            
        researchState.knowledgeGaps = knowledgeGaps;
        
        // Generate targeted search queries for knowledge gaps
        const gapQueries = knowledgeGaps.map(gap => {
            const query = `${researchState.originalQuery} ${gap.keyword}`;
            return query;
        });
        
        return gapQueries;
    }

    /**
     * Stage 3: Focused reading based on knowledge gaps
     */
    async function performFocusedReading(gapQueries) {
        console.log(`[Research Stage 3] Performing focused reading for ${gapQueries.length} knowledge gaps`);
        
        // Import search function dynamically
        const { _duckduckgoSearch } = await import('./search_engines.js');
        
        // Execute targeted searches for each knowledge gap
        for (const query of gapQueries) {
            try {
                UI.appendMessage(document.getElementById('chat-messages'),
                    `🔍 Focused search: "${query}" (Stage 3)`, 'ai');
                
                const searchResults = await _duckduckgoSearch({ query });
                
                researchState.searchHistory.push({
                    query,
                    stage: 3,
                    resultCount: searchResults.results?.length || 0,
                    timestamp: new Date().toISOString()
                });
                
                if (!searchResults.results || searchResults.results.length === 0) {
                    console.log(`[Research Stage 3] No results for gap query: "${query}"`);
                    continue;
                }
                
                // Score and prioritize results
                const scoredResults = searchResults.results.map(result => ({
                    url: result.link,
                    title: result.title,
                    snippet: result.snippet,
                    query: query,
                    relevanceScore: scoreUrlRelevance(result.link, result.title, result.snippet, query),
                    stage: 3,
                    processed: false
                }));
                
                // Sort by relevance and take top results
                scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
                const topResults = scoredResults.slice(0, 2);  // Limit to 2 per gap
                
                // Process the most relevant results
                for (const urlInfo of topResults) {
                    if (researchState.totalUrlsRead >= researchState.maxTotalUrls) break;
                    
                    if (shouldReadUrl(urlInfo, 3)) {
                        await processUrl(urlInfo, 3);
                    }
                }
                
            } catch (error) {
                console.error(`[Research Stage 3] Search failed for gap query "${query}":`, error.message);
                continue;  // Continue with other gap queries
            }
        }
    }

    /**
     * Main research execution function
     */
    async function executeResearch() {
        try {
            UI.appendMessage(document.getElementById('chat-messages'),
                `🚀 Starting multi-stage research for: "${sanitizedQuery}"`, 'ai');
            
            // Stage 1: Broad exploration with parallel searches
            UI.appendMessage(document.getElementById('chat-messages'),
                `🔬 Stage 1: Extracting key concepts and performing broad exploration...`, 'ai');
                
            // Generate multiple search queries from original query
            const searchQueries = extractKeywordsAndGenerateQueries(sanitizedQuery);
            researchState.searchQueries = searchQueries;
            
            // Execute searches in parallel
            const urlsByRelevance = await executeParallelSearches(searchQueries);
            researchState.urlsByRelevance = urlsByRelevance;
            
            // Select and process the most relevant URLs from Stage 1
            const topUrlsForStage1 = urlsByRelevance.slice(0, Math.min(10, urlsByRelevance.length));
            
            for (const urlInfo of topUrlsForStage1) {
                if (researchState.totalUrlsRead >= researchState.maxTotalUrls / 2) break;
                
                if (shouldReadUrl(urlInfo, 1)) {
                    await processUrl(urlInfo, 1);
                }
            }
            
            researchState.stageOneComplete = true;
            console.log(`[Research] Stage 1 complete. Processed ${researchState.allContent.length} content items.`);
            
            // Stage 2: Content analysis and knowledge gap identification
            UI.appendMessage(document.getElementById('chat-messages'),
                `🔬 Stage 2: Analyzing content and identifying knowledge gaps...`, 'ai');
                
            const gapQueries = analyzeContentAndIdentifyGaps();
            
            researchState.stageTwoComplete = true;
            console.log(`[Research] Stage 2 complete. Identified ${gapQueries.length} knowledge gaps.`);
            
            // Stage 3: Focused reading based on knowledge gaps
            UI.appendMessage(document.getElementById('chat-messages'),
                `🔬 Stage 3: Performing focused reading on knowledge gaps...`, 'ai');
                
            await performFocusedReading(gapQueries);
            
            researchState.stageThreeComplete = true;
            console.log(`[Research] Stage 3 complete. Final content count: ${researchState.allContent.length}.`);
            
            // Final result compilation
            UI.appendMessage(document.getElementById('chat-messages'),
                `✅ Research completed! Processed ${researchState.allContent.length} sources across 3 stages.`, 'ai');
            
            // Return results
            return compileResults();
            
        } catch (error) {
            console.error('[Research] Research process failed:', error);
            throw new Error(`Research failed: ${error.message}`);
        }
    }

    /**
     * Compiles final research results
     */
    function compileResults() {
        // Filter out error content
        const successfulContent = researchState.allContent.filter(item => !item.error);
        const failedUrls = researchState.allContent.filter(item => item.error);
        
        // Group content by stage
        const stage1Content = successfulContent.filter(item => item.stage === 1);
        const stage3Content = successfulContent.filter(item => item.stage === 3);
        
        // Generate summary
        const summary = `Research for "${sanitizedQuery}" completed successfully using multi-stage approach.
        
📊 Research Statistics:
- Total URLs visited: ${researchState.totalUrlsRead}
- Successful content retrievals: ${successfulContent.length}
- Failed retrievals: ${failedUrls.length}
- Stage 1 (Broad exploration): ${stage1Content.length} sources
- Stage 3 (Focused reading): ${stage3Content.length} sources
- Unique domains explored: ${new Set(researchState.references.map(url => {
            try { return new URL(url).hostname; } catch (e) { return 'unknown'; }
        })).size}
- Search queries performed: ${researchState.searchHistory.length}
- Knowledge gaps identified: ${researchState.knowledgeGaps.length}

The multi-stage research approach first gathered broad information, then identified knowledge gaps, and finally performed focused research to fill those gaps.`;

        // Combine content, prioritizing highest relevance sources
        successfulContent.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        const fullContent = successfulContent.map(item =>
            `--- START OF CONTENT FROM ${item.url} (Stage: ${item.stage}, Relevance: ${item.relevanceScore.toFixed(2)}) ---
Title: ${item.title}
URL: ${item.url}
Retrieved: ${item.timestamp}

${item.content}

--- END OF CONTENT ---`
        ).join('\n\n');
        
        return {
            summary: summary,
            full_content: fullContent,
            references: researchState.references,
            metadata: {
                totalUrls: researchState.totalUrlsRead,
                successfulRetrievals: successfulContent.length,
                failedRetrievals: failedUrls.length,
                searchHistory: researchState.searchHistory,
                knowledgeGaps: researchState.knowledgeGaps,
                uniqueDomains: new Set(researchState.references.map(url => {
                    try { return new URL(url).hostname; } catch (e) { return 'unknown'; }
                })).size
            }
        };
    }

    // Start the research process
    return executeResearch();
    
    } catch (error) {
        console.error('Research security validation failed:', error);
        throw new Error(`Research failed due to security validation: ${error.message}`);
    }
}

/**
 * Test function for the multi-stage research implementation
 * This is a convenience function that lets you quickly test the research functionality
 * from the console or as part of other functionality.
 *
 * @param {Object} options - Optional configuration for the test
 * @param {string} options.query - Research query to test with
 * @returns {Promise<Object>} - The research results and test metrics
 */
export async function _testResearch(options = {}) {
    console.log('🧪 Testing multi-stage research implementation...');
    
    // Import the test module dynamically
    const { testResearch } = await import('../../../test_research.js');
    
    // Run the test with provided options or defaults
    const results = await testResearch(options);
    
    console.log('✅ Test completed!');
    console.log(`To run more detailed tests, open the test page at: ./test_research.html`);
    
    return results;
}