import { createWorkersAI } from "workers-ai-provider";
import { callable, routeAgentRequest, type Schedule } from "agents";
import { getSchedulePrompt, scheduleSchema } from "agents/schedule";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
  tool,
  type ModelMessage
} from "ai";
import { z } from "zod";

// AI Search helper functions
async function searchWiki(
  instance: AiSearchInstance,
  query: string,
  options: {
    retrievalType?: "vector" | "keyword" | "hybrid";
    maxResults?: number;
  } = {}
) {
  return instance.search({
    messages: [{ role: "user", content: query }],
    ai_search_options: {
      retrieval: {
        retrieval_type: options.retrievalType || "hybrid",
        fusion_method: "rrf",
        match_threshold: 0.4,
        max_num_results: options.maxResults || 10
      },
      reranking: {
        enabled: true,
        model: "@cf/baai/bge-reranker-base"
      }
    }
  });
}

async function uploadDocument(
  instance: AiSearchInstance,
  key: string,
  content: string,
  metadata?: Record<string, unknown>
) {
  // AI Search requires ALL metadata values to be strings
  const stringMetadata: Record<string, string> = {};
  if (metadata) {
    for (const [k, v] of Object.entries(metadata)) {
      stringMetadata[k] = String(v);
    }
  }
  stringMetadata.uploaded_at = String(Date.now());

  // Use uploadAndPoll to ensure document is fully processed before returning
  return instance.items.uploadAndPoll(key, content, {
    metadata: stringMetadata
  });
}

async function listDocuments(instance: AiSearchInstance) {
  const result = await instance.items.list();
  return result.result || [];
}

async function getDocument(
  instance: AiSearchInstance,
  key: string
): Promise<string | null> {
  const item = instance.items.get(key);
  const result = await item.download();
  if (!result || !result.body) return null;

  // Read the stream into a string
  const reader = result.body.getReader();
  const decoder = new TextDecoder();
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    content += decoder.decode(value, { stream: true });
  }
  content += decoder.decode();

  return content;
}

/**
 * The AI SDK's downloadAssets step runs `new URL(data)` on every file
 * part's string data. Data URIs parse as valid URLs, so it tries to
 * HTTP-fetch them and fails. Decode to Uint8Array so the SDK treats
 * them as inline data instead.
 */
function inlineDataUrls(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((msg) => {
    if (msg.role !== "user" || typeof msg.content === "string") return msg;
    return {
      ...msg,
      content: msg.content.map((part) => {
        if (part.type !== "file" || typeof part.data !== "string") return part;
        const match = part.data.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return part;
        const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
        return { ...part, data: bytes, mediaType: match[1] };
      })
    };
  });
}

// Activity types for logging agent actions
type ActivityType =
  | "ingest"
  | "query"
  | "schedule"
  | "task_execute"
  | "lint"
  | "mcp_connect"
  | "mcp_disconnect"
  | "system";

interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  details: string;
  timestamp: number;
  metadata?: string;
}

export class ChatAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 100;
  private instance: AiSearchInstance | null = null;
  private initialized = false;
  private activityBuffer: Activity[] = [];

  async onStart() {
    // Configure OAuth popup behavior for MCP servers that require authentication
    this.mcp.configureOAuthCallback({
      customHandler: (result) => {
        if (result.authSuccess) {
          return new Response("<script>window.close();</script>", {
            headers: { "content-type": "text/html" },
            status: 200
          });
        }
        return new Response(
          `Authentication Failed: ${result.authError || "Unknown error"}`,
          { headers: { "content-type": "text/plain" }, status: 400 }
        );
      }
    });

    // Initialize SQLite tables
    await this.initializeTables();

    // Initialize AI Search wiki
    await this.initializeWiki();

    // Log system startup
    await this.logActivity(
      "system",
      "Agent started",
      "Wiki agent initialized and ready"
    );

    // Broadcast agent ready state
    this.broadcastAgentStatus("ready");
  }

  // Initialize SQLite tables for agent features
  private async initializeTables() {
    try {
      // Activity log table
      this.sql`
        CREATE TABLE IF NOT EXISTS activities (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          subject TEXT NOT NULL,
          details TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          metadata TEXT
        )
      `;

      // Create index for faster queries
      this.sql`
        CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC)
      `;

      this.sql`
        CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type)
      `;

      console.log("[Agent] SQLite tables initialized");
    } catch (error) {
      console.error("[Agent] Failed to initialize tables:", error);
    }
  }

  // Log activity to SQLite
  private async logActivity(
    type: ActivityType,
    subject: string,
    details: string,
    metadata?: Record<string, unknown>
  ) {
    try {
      const activity: Activity = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        subject,
        details,
        timestamp: Date.now(),
        metadata: metadata ? JSON.stringify(metadata) : undefined
      };

      this.sql`
        INSERT INTO activities (id, type, subject, details, timestamp, metadata)
        VALUES (${activity.id}, ${activity.type}, ${activity.subject}, ${activity.details}, ${activity.timestamp}, ${activity.metadata ?? null})
      `;

      // Also add to buffer for real-time updates
      this.activityBuffer.unshift(activity);
      if (this.activityBuffer.length > 50) {
        this.activityBuffer.pop();
      }

      // Broadcast to connected clients
      this.broadcast(
        JSON.stringify({
          type: "activity",
          activity: {
            ...activity,
            timeAgo: this.formatTimeAgo(activity.timestamp)
          }
        })
      );
    } catch (error) {
      console.error("[Agent] Failed to log activity:", error);
    }
  }

  // Query recent activities from database
  private queryActivities(limit: number = 20, type?: ActivityType): Activity[] {
    try {
      let results;
      if (type) {
        results = this.sql`
          SELECT * FROM activities 
          WHERE type = ${type}
          ORDER BY timestamp DESC 
          LIMIT ${limit}
        `;
      } else {
        results = this.sql`
          SELECT * FROM activities 
          ORDER BY timestamp DESC 
          LIMIT ${limit}
        `;
      }

      return results.map((row) => ({
        id: row.id as string,
        type: row.type as ActivityType,
        subject: row.subject as string,
        details: row.details as string,
        timestamp: row.timestamp as number,
        metadata: row.metadata as string | undefined
      }));
    } catch (error) {
      console.error("[Agent] Failed to get activities:", error);
      return [];
    }
  }

  // Format timestamp to relative time
  private formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // Broadcast agent status to all connected clients
  private broadcastAgentStatus(status: "ready" | "working" | "idle") {
    this.broadcast(
      JSON.stringify({
        type: "agent-status",
        status,
        timestamp: new Date().toISOString()
      })
    );
  }

  // Initialize the wiki with AI Search instance
  private async initializeWiki() {
    const instanceId = "test-wiki-instance";

    console.log(`[Wiki] Starting initialization for instance: ${instanceId}`);

    if (!this.env.AI_SEARCH) {
      console.error("[Wiki] ERROR: AI_SEARCH binding not found!");
      return;
    }

    try {
      console.log(`[Wiki] Getting instance: ${instanceId}`);
      this.instance = this.env.AI_SEARCH.get(instanceId);

      const info = await this.instance.info();
      console.log(`[Wiki] Connected to instance: ${instanceId}`, {
        status: info.status,
        hybrid: info.index_method
      });

      this.initialized = true;
      await this.createDefaultWikiStructure();
      console.log(`[Wiki] Wiki initialized successfully`);
    } catch (error) {
      console.error("[Wiki] Failed to connect to instance:", error);
    }
  }

  // Create default wiki pages
  private async createDefaultWikiStructure() {
    if (!this.instance) return;

    const now = Date.now();

    const existingIndex = await getDocument(this.instance, "index.md");
    if (existingIndex) return;

    await uploadDocument(
      this.instance,
      "index.md",
      `# Personal Wiki Index

## Overview
This is your personal wiki agent with **hybrid search** (vector + keyword with RRF fusion).

## How It Works
1. **Ingest** documents using the "/ingest" command
2. **Search** your knowledge base with the "/search" command
3. **Ask questions** - I'll search your wiki and cite sources

## Search Methods
- **Vector**: Semantic similarity (finds conceptually related content)
- **Keyword**: BM25 exact matching (finds precise term matches)
- **Hybrid**: Combines both with RRF fusion (recommended)

---
*Initialized: ${new Date(now).toLocaleString()}*`,
      { category: "index", title: "Index" }
    );

    await uploadDocument(
      this.instance,
      "log.md",
      `# Wiki Activity Log

## [${new Date(now).toISOString()}] init | Wiki Created
- Initialized personal wiki with hybrid search (vector + keyword with RRF fusion)
- AI Search instance created

---
`,
      { category: "log", title: "Activity Log" }
    );
  }

  // Update the activity log (both markdown and SQLite)
  private async updateLog(
    operation: ActivityType,
    subject: string,
    details: string,
    metadata?: Record<string, unknown>
  ) {
    // Log to SQLite for real-time feed
    await this.logActivity(operation, subject, details, metadata);

    // Also update markdown log if instance available
    if (!this.instance) return;

    const existingLog = await getDocument(this.instance, "log.md");
    const entry = `\n## [${new Date().toISOString()}] ${operation} | ${subject}\n- ${details}\n`;

    const newLog = existingLog
      ? existingLog + entry
      : `# Wiki Activity Log\n${entry}`;

    await uploadDocument(this.instance, "log.md", newLog, {
      category: "log",
      title: "Activity Log"
    });
  }

  @callable()
  async addServer(name: string, url: string) {
    return await this.addMcpServer(name, url);
  }

  @callable()
  async removeServer(serverId: string) {
    await this.removeMcpServer(serverId);
  }

  // Get wiki stats
  @callable()
  async getWikiStats() {
    if (!this.instance) {
      return { initialized: false, stats: null };
    }

    const docs = await listDocuments(this.instance);
    const byCategory: Record<string, number> = {};

    for (const doc of docs) {
      const cat = (doc.metadata?.category as string) || "uncategorized";
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    return {
      initialized: true,
      stats: {
        totalPages: docs.length,
        byCategory
      }
    };
  }

  // Get recent activities for the activity feed
  @callable()
  async getRecentActivities(limit: number = 20, type?: ActivityType) {
    const activities = this.queryActivities(limit, type);
    return {
      activities: activities.map((a: Activity) => ({
        ...a,
        timeAgo: this.formatTimeAgo(a.timestamp),
        metadata: a.metadata ? JSON.parse(a.metadata) : undefined
      })),
      total: this.sql`SELECT COUNT(*) as count FROM activities`[0]?.count || 0
    };
  }

  // Get agent status and stats
  @callable()
  async getAgentStatus() {
    const activities = this.queryActivities(1);
    const lastActivity = activities[0];

    return {
      initialized: this.initialized,
      wikiReady: this.instance !== null,
      lastActivity: lastActivity
        ? {
            type: lastActivity.type,
            subject: lastActivity.subject,
            timeAgo: this.formatTimeAgo(lastActivity.timestamp)
          }
        : null,
      scheduledTasks: this.getSchedules().length
    };
  }

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const mcpTools = this.mcp.getAITools();
    const workersai = createWorkersAI({ binding: this.env.AI });

    const result = streamText({
      model: workersai("@cf/moonshotai/kimi-k2.5", {
        sessionAffinity: this.sessionAffinity
      }),
      system: `You are a Personal Wiki Agent with hybrid search capabilities. You help users build and query a personal knowledge base.

## Your Capabilities

### 1. Ingest Documents
When users share content (journal entries, articles, notes, goals, health data), use the ingestDocument tool to add it to their wiki. This indexes the content with hybrid search (vector + keyword).

### 2. Search the Wiki
When users ask questions, use queryWiki to search their knowledge base. This uses hybrid retrieval by default, combining:
- **Vector search**: Semantic similarity (conceptually related content)
- **Keyword search**: BM25 exact matching (precise term matches)
- **RRF fusion**: Reciprocal Rank Fusion to combine both scores

### 3. Compare Search Methods
Use compareSearchMethods to demonstrate the difference between vector, keyword, and hybrid search for the same query.

### 4. Wiki Maintenance
Use lintWiki to check wiki health and get suggestions.

## How to Respond

When showing search results:
- Present the most relevant results with their scores
- Explain the hybrid scoring (vector_score + keyword_score + fusion_method)
- Cite the source documents
- Synthesize a clear answer

When ingesting:
- Confirm what was saved
- Mention it's now searchable with hybrid retrieval
- Suggest related topics to explore

## Special Commands
Users can also use:
- "/stats" - Get wiki statistics
- "/lint" - Check wiki health
- "/compare <query>" - Compare search methods
- "/debug" - List AI Search instances for debugging

${getSchedulePrompt({ date: new Date() })}`,
      messages: pruneMessages({
        messages: inlineDataUrls(await convertToModelMessages(this.messages)),
        toolCalls: "before-last-2-messages"
      }),
      tools: {
        ...mcpTools,

        scheduleTask: tool({
          description:
            "Schedule a task to be executed at a later time. Use this when the user asks to be reminded or wants something done later.",
          inputSchema: scheduleSchema,
          execute: async ({ when, description }) => {
            if (when.type === "no-schedule") {
              return "Not a valid schedule input";
            }
            const input =
              when.type === "scheduled"
                ? when.date
                : when.type === "delayed"
                  ? when.delayInSeconds
                  : when.type === "cron"
                    ? when.cron
                    : null;
            if (!input) return "Invalid schedule type";
            try {
              this.schedule(input, "executeTask", description, {
                idempotent: true
              });
              await this.updateLog("schedule", "Task scheduled", description, {
                scheduleType: when.type,
                input
              });
              return `Task scheduled: "${description}" (${when.type}: ${input})`;
            } catch (error) {
              return `Error scheduling task: ${error}`;
            }
          }
        }),

        getScheduledTasks: tool({
          description: "List all tasks that have been scheduled",
          inputSchema: z.object({}),
          execute: async () => {
            const tasks = this.getSchedules();
            return tasks.length > 0 ? tasks : "No scheduled tasks found.";
          }
        }),

        cancelScheduledTask: tool({
          description: "Cancel a scheduled task by its ID",
          inputSchema: z.object({
            taskId: z.string().describe("The ID of the task to cancel")
          }),
          execute: async ({ taskId }) => {
            try {
              this.cancelSchedule(taskId);
              return `Task ${taskId} cancelled.`;
            } catch (error) {
              return `Error cancelling task: ${error}`;
            }
          }
        }),

        // WIKI TOOLS

        ingestDocument: tool({
          description:
            "Add a new document to the personal wiki. This indexes the content with hybrid search (vector + keyword).",
          inputSchema: z.object({
            title: z.string().describe("Title of the document"),
            content: z.string().describe("Full content of the document"),
            docType: z
              .enum(["journal", "article", "note", "goal", "health"])
              .describe("Type of document"),
            tags: z
              .array(z.string())
              .optional()
              .describe("Optional tags for categorization")
          }),
          execute: async ({ title, content, docType, tags }) => {
            if (!this.instance) {
              return { error: "Wiki not initialized" };
            }

            try {
              const now = Date.now();
              const docId = `${docType}-${now}.md`;

              const metadata: Record<string, string> = {
                category: docType,
                title: title,
                tags: tags ? tags.join(", ") : "",
                createdAt: String(now),
                source: "ingest"
              };

              await uploadDocument(this.instance, docId, content, metadata);
              await this.updateLog(
                "ingest",
                title,
                `Added ${docType} document to wiki`,
                {
                  docId,
                  docType,
                  tags: tags || []
                }
              );

              return {
                success: true,
                message: `Successfully ingested "${title}" as ${docType}. Document ID: ${docId}`,
                docId,
                searchable: true,
                method: "hybrid (vector + keyword with RRF fusion)"
              };
            } catch (error) {
              return {
                error: "Failed to upload document",
                details: String(error)
              };
            }
          }
        }),

        queryWiki: tool({
          description:
            "Search the personal wiki using hybrid retrieval. Returns results with detailed scoring (vector_score, keyword_score, fusion_method).",
          inputSchema: z.object({
            query: z.string().describe("Natural language search query"),
            retrievalType: z
              .enum(["vector", "keyword", "hybrid"])
              .optional()
              .describe("Search method (default: hybrid)"),
            maxResults: z
              .number()
              .optional()
              .describe("Maximum number of results (default: 5)")
          }),
          execute: async ({ query, retrievalType, maxResults }) => {
            if (!this.instance) {
              return { error: "Wiki not initialized" };
            }

            const searchResults = await searchWiki(this.instance, query, {
              retrievalType: retrievalType || "hybrid",
              maxResults: maxResults || 5
            });

            await this.updateLog(
              "query",
              query,
              `Retrieved ${searchResults.chunks.length} results using ${retrievalType || "hybrid"} search`
            );

            return {
              query: searchResults.search_query,
              method: retrievalType || "hybrid",
              totalResults: searchResults.chunks.length,
              results: searchResults.chunks.map((chunk) => ({
                id: chunk.id,
                text: chunk.text,
                source: chunk.item.key,
                overallScore: chunk.score,
                vectorScore: chunk.scoring_details?.vector_score || 0,
                keywordScore: chunk.scoring_details?.keyword_score || 0,
                fusionMethod: chunk.scoring_details?.fusion_method || "rrf"
              }))
            };
          }
        }),

        lintWiki: tool({
          description:
            "Check wiki health and get suggestions for improvements.",
          inputSchema: z.object({}),
          execute: async () => {
            if (!this.instance) {
              return { error: "Wiki not initialized" };
            }

            const allDocs = await listDocuments(this.instance);
            const byCategory: Record<string, number> = {};

            for (const doc of allDocs) {
              const cat = (doc.metadata?.category as string) || "uncategorized";
              byCategory[cat] = (byCategory[cat] || 0) + 1;
            }

            const suggestions: string[] = [];

            if (!byCategory["source"] || byCategory["source"] === 0) {
              suggestions.push(
                "Add some source documents (journal entries, articles) to build your wiki"
              );
            }

            await this.updateLog(
              "lint",
              "Health check",
              `Checked ${allDocs.length} pages`
            );

            return {
              totalPages: allDocs.length,
              byCategory,
              suggestions,
              healthy: suggestions.length === 0
            };
          }
        }),

        getWikiStats: tool({
          description:
            "Get wiki statistics including page counts and search method details.",
          inputSchema: z.object({}),
          execute: async () => {
            if (!this.instance) {
              return { error: "Wiki not initialized" };
            }

            const docs = await listDocuments(this.instance);
            const byCategory: Record<string, number> = {};

            for (const doc of docs) {
              const cat = (doc.metadata?.category as string) || "uncategorized";
              byCategory[cat] = (byCategory[cat] || 0) + 1;
            }

            return {
              totalPages: docs.length,
              byCategory,
              searchMethod: "Hybrid (vector + keyword with RRF fusion)",
              features: [
                "Vector index for semantic similarity",
                "Keyword index (BM25) for exact matches",
                "RRF fusion for optimal ranking",
                "Per-request retrieval type override",
                "Detailed scoring transparency"
              ]
            };
          }
        }),

        getActivityLog: tool({
          description:
            "Get recent agent activities from the activity feed. Shows what the agent has been doing autonomously.",
          inputSchema: z.object({
            limit: z
              .number()
              .optional()
              .describe("Number of activities to retrieve (default: 10)"),
            type: z
              .enum([
                "ingest",
                "query",
                "schedule",
                "task_execute",
                "lint",
                "mcp_connect",
                "mcp_disconnect",
                "system"
              ])
              .optional()
              .describe("Filter by activity type")
          }),
          execute: async ({ limit, type }) => {
            const activities = this.queryActivities(limit || 10, type);
            return {
              activities: activities.map((a: Activity) => ({
                id: a.id,
                type: a.type,
                subject: a.subject,
                details: a.details,
                timestamp: a.timestamp,
                timeAgo: this.formatTimeAgo(a.timestamp),
                metadata: a.metadata ? JSON.parse(a.metadata) : undefined
              })),
              total:
                this.sql`SELECT COUNT(*) as count FROM activities`[0]?.count ||
                0
            };
          }
        }),

        getAgentStatus: tool({
          description:
            "Get current agent status including initialization state, wiki readiness, and recent activity.",
          inputSchema: z.object({}),
          execute: async () => {
            const activities = this.queryActivities(1);
            const lastActivity = activities[0];
            const schedules = this.getSchedules();

            return {
              initialized: this.initialized,
              wikiReady: this.instance !== null,
              status: this.initialized ? "ready" : "initializing",
              lastActivity: lastActivity
                ? {
                    type: lastActivity.type,
                    subject: lastActivity.subject,
                    timeAgo: this.formatTimeAgo(lastActivity.timestamp)
                  }
                : null,
              scheduledTasks: schedules.length,
              upcomingTasks: schedules.slice(0, 5).map((s) => ({
                id: s.id,
                description: s.payload
              }))
            };
          }
        })
      },
      stopWhen: stepCountIs(10),
      abortSignal: options?.abortSignal
    });

    return result.toUIMessageStreamResponse();
  }

  async executeTask(description: string, _task: Schedule<string>) {
    console.log(`Executing scheduled task: ${description}`);

    // Log the task execution
    await this.logActivity("task_execute", "Scheduled task ran", description);

    this.broadcast(
      JSON.stringify({
        type: "scheduled-task",
        description,
        timestamp: new Date().toISOString()
      })
    );
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify(
          {
            status: "ok",
            message:
              "Server is running. Connect via WebSocket to initialize wiki.",
            wikiTools: [
              "ingestDocument",
              "queryWiki",
              "lintWiki",
              "getWikiStats",
              "getActivityLog",
              "getAgentStatus"
            ],
            agentFeatures: [
              "Activity feed with real-time updates",
              "Agent status and presence",
              "Scheduled task tracking",
              "Persistent activity logging"
            ],
            timestamp: new Date().toISOString()
          },
          null,
          2
        ),
        {
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
