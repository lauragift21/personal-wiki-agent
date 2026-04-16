import { Agent } from "agents";
import {
  withVoice,
  WorkersAIFluxSTT,
  WorkersAITTS,
  type VoiceTurnContext
} from "@cloudflare/voice";
import { streamText, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { searchWiki, uploadDocument, listDocuments } from "./ai-search";

/**
 * Voice-enabled wiki agent
 *
 * Extends the base Agent with voice capabilities using withVoice mixin.
 * Provides real-time voice interaction with the personal wiki:
 * - Voice-activated search queries
 * - Dictation for document ingestion
 * - Natural conversational responses
 *
 * Shares the same AI Search instance and SQLite database as ChatAgent.
 */
const VoiceAgent = withVoice(Agent);

export class VoiceChatAgent extends VoiceAgent<Env> {
  // Voice providers
  transcriber = new WorkersAIFluxSTT(this.env.AI);
  tts = new WorkersAITTS(this.env.AI);

  // Shared AI Search instance (same as ChatAgent)
  private instance: AiSearchInstance | null = null;
  private initialized = false;

  // Activity logging (same structure as ChatAgent)
  private activityBuffer: Array<{
    id: string;
    type: string;
    subject: string;
    details: string;
    timestamp: number;
  }> = [];

  async onStart() {
    // Initialize SQLite tables
    await this.initializeTables();

    // Initialize AI Search wiki
    await this.initializeWiki();

    // Log startup
    await this.logActivity(
      "system",
      "Voice agent started",
      "Ready for voice conversations"
    );

    console.log("[VoiceAgent] Started and ready");
  }

  // Initialize SQLite tables for activity logging
  private async initializeTables() {
    try {
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

      this.sql`
        CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC)
      `;

      this.sql`
        CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type)
      `;

      // Also create voice_messages table for conversation persistence
      this.sql`
        CREATE TABLE IF NOT EXISTS voice_messages (
          id TEXT PRIMARY KEY,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `;

      console.log("[VoiceAgent] SQLite tables initialized");
    } catch (error) {
      console.error("[VoiceAgent] Failed to initialize tables:", error);
    }
  }

  // Log activity to SQLite
  private async logActivity(
    type: string,
    subject: string,
    details: string,
    metadata?: Record<string, unknown>
  ) {
    try {
      const activity = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        subject,
        details,
        timestamp: Date.now()
      };

      this.sql`
        INSERT INTO activities (id, type, subject, details, timestamp, metadata)
        VALUES (${activity.id}, ${activity.type}, ${activity.subject}, ${activity.details}, ${activity.timestamp}, ${metadata ? JSON.stringify(metadata) : null})
      `;

      // Add to buffer for real-time updates
      this.activityBuffer.unshift(activity);
      if (this.activityBuffer.length > 50) {
        this.activityBuffer.pop();
      }
    } catch (error) {
      console.error("[VoiceAgent] Failed to log activity:", error);
    }
  }

  // Initialize the wiki with AI Search instance
  private async initializeWiki() {
    const instanceId = "test-wiki-instance";

    console.log(`[VoiceAgent] Initializing wiki instance: ${instanceId}`);

    if (!this.env.AI_SEARCH) {
      console.error("[VoiceAgent] ERROR: AI_SEARCH binding not found!");
      return;
    }

    try {
      this.instance = this.env.AI_SEARCH.get(instanceId);
      const info = await this.instance.info();

      console.log(`[VoiceAgent] Connected to wiki:`, {
        status: info.status,
        hybrid: info.index_method
      });

      this.initialized = true;
    } catch (error) {
      console.error("[VoiceAgent] Failed to connect to wiki:", error);
      this.initialized = false;
      this.instance = null;
    }
  }

  /**
   * Main voice turn handler - called when user finishes speaking
   *
   * Processes the transcript through the LLM with wiki search tools,
   * returning a streaming response for sentence-chunked TTS.
   */
  async onTurn(transcript: string, context: VoiceTurnContext) {
    console.log("[VoiceAgent] onTurn called with:", transcript);

    // Lazy initialization if needed
    if (!this.instance || !this.initialized) {
      await this.initializeWiki();
    }

    // Log the user message
    await this.logActivity("voice", "User spoke", transcript);
    await this.saveVoiceMessage("user", transcript);

    const workersai = createWorkersAI({ binding: this.env.AI });

    // Stream LLM response with wiki tools
    const result = streamText({
      model: workersai("@cf/moonshotai/kimi-k2.5", {
        sessionAffinity: crypto.randomUUID()
      }),
      system: `You are a Personal Wiki Voice Assistant. You help users access their knowledge base through natural voice conversation.

## Your Capabilities

### 1. Search the Wiki
When users ask about topics in their wiki, use the queryWiki tool to find relevant information. Synthesize the search results into a natural, conversational response.

### 2. Add Documents
When users want to save information (journal entries, notes, ideas), use the ingestDocument tool to add it to their wiki.

### 3. Wiki Stats
Users can ask about their wiki - how many documents, what's in it, etc.

## Voice Conversation Style

- Keep responses concise and natural for spoken conversation
- Use conversational language, not bullet points
- If searching, briefly mention what you found before details
- Always cite sources from search results
- Offer to read longer documents if relevant

## Example Interactions

User: "What do I know about machine learning?"
→ Search wiki, respond: "You have 3 notes on machine learning. The most detailed is titled 'ML Fundamentals' covering neural networks. Would you like me to summarize it or read it to you?"

User: "Add a journal entry about my meeting today"
→ Ask: "What would you like to record about the meeting?" Then ingest the response.

User: "How big is my wiki?"
→ Use getWikiStats and respond with the document count and categories.`,
      messages: [
        ...context.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content
        })),
        { role: "user" as const, content: transcript }
      ],
      tools: {
        // Wiki search tool
        queryWiki: tool({
          description:
            "Search the personal wiki using hybrid retrieval (vector + keyword).",
          inputSchema: z.object({
            query: z.string().describe("Natural language search query"),
            maxResults: z
              .number()
              .optional()
              .describe("Maximum results to return (default: 5)")
          }),
          execute: async ({ query, maxResults }) => {
            if (!this.instance) {
              return { error: "Wiki not initialized" };
            }

            try {
              const searchResults = await searchWiki(this.instance, query, {
                retrievalType: "hybrid",
                maxResults: maxResults || 5
              });

              await this.logActivity(
                "query",
                query,
                `Retrieved ${searchResults.chunks.length} results via voice`
              );

              return {
                query: searchResults.search_query,
                totalResults: searchResults.chunks.length,
                results: searchResults.chunks.map((chunk) => ({
                  id: chunk.id,
                  text: chunk.text,
                  source: chunk.item?.key || "unknown",
                  score: chunk.score
                }))
              };
            } catch (error) {
              return { error: String(error) };
            }
          }
        }),

        // Document ingestion tool
        ingestDocument: tool({
          description:
            "Add a new document to the personal wiki from voice dictation.",
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
              const docId = `voice-${docType}-${now}.md`;

              const metadata: Record<string, string> = {
                category: docType,
                title: title,
                tags: tags ? tags.join(", ") : "",
                createdAt: String(now),
                source: "voice"
              };

              await uploadDocument(this.instance, docId, content, metadata);
              await this.logActivity(
                "ingest",
                title,
                `Added ${docType} document via voice`,
                { docId, docType }
              );

              return {
                success: true,
                message: `Saved "${title}" to your wiki as a ${docType}.`,
                docId
              };
            } catch (error) {
              return {
                error: "Failed to save document",
                details: String(error)
              };
            }
          }
        }),

        // Wiki stats tool
        getWikiStats: tool({
          description: "Get wiki statistics including page counts.",
          inputSchema: z.object({}),
          execute: async () => {
            if (!this.instance) {
              return { error: "Wiki not initialized" };
            }

            try {
              const docs = await listDocuments(this.instance);
              const byCategory: Record<string, number> = {};

              for (const doc of docs) {
                const cat =
                  (doc.metadata?.category as string) || "uncategorized";
                byCategory[cat] = (byCategory[cat] || 0) + 1;
              }

              return {
                totalPages: docs.length,
                byCategory,
                searchMethod: "Hybrid (vector + keyword)"
              };
            } catch (error) {
              return { error: String(error) };
            }
          }
        })
      },
      abortSignal: context.signal
    });

    // Stream the response - pipeline will chunk into sentences for TTS
    return result.textStream;
  }

  // Pipeline hook: Log after transcription
  afterTranscribe(transcript: string): string | null {
    // Filter out very short utterances (likely noise)
    if (transcript.length < 2) {
      console.log("[VoiceAgent] Ignoring short transcript:", transcript);
      return null;
    }
    return transcript;
  }

  // Pipeline hook: Transform text before TTS
  beforeSynthesize(text: string): string {
    // Remove markdown formatting for better speech
    const cleaned = text
      .replace(/\*\*/g, "") // Bold
      .replace(/\*/g, "") // Italic
      .replace(/#/g, "") // Headers
      .replace(/`{1,3}[^`]*`{1,3}/g, "") // Code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
      .trim();

    return cleaned;
  }

  // Save voice message to database for shared history
  private async saveVoiceMessage(role: "user" | "assistant", content: string) {
    try {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.sql`
        INSERT INTO voice_messages (id, role, content, timestamp)
        VALUES (${id}, ${role}, ${content}, ${Date.now()})
      `;
    } catch (error) {
      console.error("[VoiceAgent] Failed to save message:", error);
    }
  }

  // Lifecycle hooks
  async onCallStart() {
    console.log("[VoiceAgent] Call started");
    await this.logActivity("voice", "Call started", "Voice conversation began");
  }

  async onCallEnd() {
    console.log("[VoiceAgent] Call ended");
    await this.logActivity(
      "voice",
      "Call ended",
      "Voice conversation finished"
    );
  }

  async onInterrupt() {
    console.log("[VoiceAgent] Interrupted");
    await this.logActivity("voice", "Interrupted", "User interrupted agent");
  }
}
