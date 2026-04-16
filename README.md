# Personal Wiki Agent

A personal knowledge base powered by AI with hybrid search capabilities. Built with Cloudflare Workers, AI Search, and the Agents SDK.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lauragift21/personal-agentic-wiki)

## Features

- **Hybrid Search** — Combines vector similarity (semantic) + keyword matching (BM25) with RRF fusion
- **Document Ingestion** — Add journal entries, articles, notes, goals, and health data
- **AI-Powered Chat** — Ask questions about your knowledge base with cited sources
- **Real-time Sync** — WebSocket connection with message persistence
- **Scheduled Tasks** — Set reminders and recurring tasks
- **MCP Integration** — Connect external tools via Model Context Protocol

## Search Methods

| Method      | Best For                                          |
| ----------- | ------------------------------------------------- |
| **Vector**  | Semantic similarity, conceptually related content |
| **Keyword** | Exact term matching, precise lookups (BM25)       |
| **Hybrid**  | Best of both — recommended for most queries       |

## Quick Start

```bash
# Install dependencies
npm install

# Run locally (AI Search requires deployment)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to see your wiki.

## Deploy

```bash
npm run deploy
```

This creates your AI Search instance and deploys the worker to Cloudflare.

## Usage

Once deployed, you can:

### Ingest Documents

- **Journal entries** — "Add a journal entry about my trip to Tokyo"
- **Articles** — "Save this article about machine learning"
- **Notes** — "Create a note about project ideas"
- **Goals** — "Track my goal to run a marathon"
- **Health data** — "Log my workout for today"

### Search Your Wiki

- **Ask questions** — "What did I learn about neural networks?"
- **Find entries** — "Show me my journal entries from last month"
- **Compare methods** — Use `/compare <query>` to see vector vs keyword vs hybrid results

### Wiki Commands

- `/stats` — Get wiki statistics
- `/lint` — Check wiki health
- `/compare <query>` — Compare search methods side-by-side
- `/debug` — Show debug info

## Project Structure

```
src/
  server.ts    # Chat agent with wiki tools and AI Search integration
  app.tsx      # Chat UI with wiki-specific branding
  client.tsx   # React entry point
  styles.css   # Tailwind + Kumo styles
```

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────────┐
│   Client    │ ◄────────────────► │  ChatAgent (DO) │
│  (React)    │                    │                 │
└─────────────┘                    │  ┌───────────┐  │
                                   │  │ AI Search │  │
                                   │  │  Instance │  │
                                   │  └───────────┘  │
                                   │        ▲        │
                                   │        │        │
                                   │  ┌─────┴─────┐  │
                                   │  │  Vector   │  │
                                   │  │  Keyword  │  │
                                   │  │   Index   │  │
                                   │  └───────────┘  │
                                   └─────────────────┘
```

## Customization

### Change the AI Model

Edit `server.ts`:

```ts
const result = streamText({
  model: workersai("@cf/moonshotai/kimi-k2.5")
  // ...
});
```

### Adjust Search Settings

Modify the search options in `server.ts`:

```ts
return instance.search({
  messages: [{ role: "user", content: query }],
  ai_search_options: {
    retrieval: {
      retrieval_type: "hybrid",
      fusion_method: "rrf",
      match_threshold: 0.4, // Adjust relevance threshold
      max_num_results: 10 // Adjust result count
    },
    reranking: {
      enabled: true,
      model: "@cf/baai/bge-reranker-base"
    }
  }
});
```

### Add Custom Document Types

In the `ingestDocument` tool, extend the `docType` enum:

```ts
docType: z.enum([
  "journal",
  "article",
  "note",
  "goal",
  "health",
  "recipe" // Add your custom type
]);
```

## Learn More

- [AI Search Documentation](https://developers.cloudflare.com/ai-search/)
- [Agents SDK](https://developers.cloudflare.com/agents/)
- [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)

## License

MIT
