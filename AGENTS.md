# Personal Wiki Agent

A personal knowledge base with hybrid AI search (vector + keyword) built on Cloudflare Workers using the Agents SDK.

## Project Overview

This is a full-stack application featuring:

- **AI-powered hybrid search** using Cloudflare AI Search (vector + keyword with RRF fusion)
- **Stateful chat agent** with Durable Objects for persistent conversations
- **Document ingestion** with automatic indexing
- **Two-tab interface**: Chat (AI assistant) and Search (direct knowledge retrieval)
- **Activity logging** for agent actions (SQLite via Durable Objects)

## Architecture

### Tech Stack

- **Runtime**: Cloudflare Workers (Node.js compatibility mode)
- **Agent Framework**: Agents SDK (@cloudflare/ai-chat)
- **AI/ML**: Workers AI (@cf/moonshotai/kimi-k2.5)
- **Search**: Cloudflare AI Search (hybrid retrieval)
- **Storage**: Durable Objects (SQLite for activities), AI Search (documents)
- **Frontend**: React 19 + Kumo UI + Tailwind CSS
- **Build**: Vite + Wrangler

### Key Components

#### Server (`src/server.ts`)

- `ChatAgent` class extending `AIChatAgent`
- SQLite activity logging with `activities` table
- Tools: `ingestDocument`, `queryWiki`, `getWikiStats`, `scheduleTask`, etc.
- AI Search integration for hybrid document retrieval

#### Client (`src/app.tsx`)

- Two-tab interface (Chat / Search)
- Real-time WebSocket connection to agent
- Drag-and-drop image attachments
- Search results with relevance scoring

#### Components

- `ActivityFeed.tsx` - Sidebar showing agent activities (hidden in current UI)
- `AgentPresence.tsx` - Agent status indicator (hidden in current UI)

## Development

### Commands

| Command          | Purpose                                        |
| ---------------- | ---------------------------------------------- |
| `npm run dev`    | Start local development server                 |
| `npm run deploy` | Build and deploy to Cloudflare                 |
| `npm run types`  | Generate TypeScript types from wrangler config |
| `npm run format` | Format code with oxfmt                         |
| `npm run lint`   | Lint with oxlint                               |
| `npm run check`  | Run all checks (format, lint, typecheck)       |

### Environment Setup

Required bindings in `wrangler.jsonc`:

```json
{
  "ai": { "binding": "AI" },
  "ai_search_namespaces": [
    {
      "binding": "AI_SEARCH",
      "namespace": "default"
    }
  ],
  "durable_objects": {
    "bindings": [{ "class_name": "ChatAgent", "name": "ChatAgent" }]
  }
}
```

### Key Files

| File              | Purpose                                        |
| ----------------- | ---------------------------------------------- |
| `src/server.ts`   | Agent logic, tools, AI Search integration      |
| `src/app.tsx`     | Main React application with chat/search UI     |
| `src/components/` | React components (ActivityFeed, AgentPresence) |
| `wrangler.jsonc`  | Cloudflare Workers configuration               |

## Features

### Hybrid Search

The wiki uses Cloudflare AI Search with three retrieval modes:

- **Vector**: Semantic similarity search using embeddings
- **Keyword**: BM25 exact term matching
- **Hybrid** (default): Combines both with RRF (Reciprocal Rank Fusion)

### Document Ingestion

Documents are automatically indexed with:

- Title and content
- Document type (journal, article, note, goal, health)
- Tags for categorization
- Timestamp metadata

### Activity Logging

All agent actions are logged to SQLite:

- Document ingestion
- Search queries
- Scheduled task execution
- System events

## Cloudflare Resources

Always check current documentation at:

- Workers: https://developers.cloudflare.com/workers/
- AI Search: https://developers.cloudflare.com/ai-search/
- Agents SDK: https://developers.cloudflare.com/agents/
- Limits: https://developers.cloudflare.com/workers/platform/limits/

## Notes

- MCP functionality exists in the agent but UI components were removed
- Activity feed and agent presence components exist but are hidden from UI
- The search tab defaults to hybrid search without exposing method selection
