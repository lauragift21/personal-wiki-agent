# Cloudflare Workers Complete Guide

## Introduction

Cloudflare Workers is a serverless platform that runs JavaScript, TypeScript, Rust, C, and C++ at the edge - across Cloudflare's global network of data centers. Code runs close to users, reducing latency.

## Core Concepts

### The Edge Network

Cloudflare operates 300+ data centers worldwide. When a request comes in, it's automatically routed to the nearest data center.

**Traditional Architecture:**

```
User (Tokyo) → Origin Server (Virginia) → Response
                ↑ 150ms latency
```

**Edge Architecture:**

```
User (Tokyo) → Edge Worker (Tokyo) → Response
                ↑ 5ms latency
```

### Request Lifecycle

1. **Request arrives** at nearest Cloudflare data center
2. **Worker runs** in V8 isolate (cold start or warm)
3. **Subrequests** can be made to origin or other services
4. **Response returned** to user

## Getting Started

### Basic Worker Structure

```typescript
// src/index.ts
export interface Env {
  // Define your bindings here
  MY_KV_NAMESPACE: KVNamespace;
  MY_DURABLE_OBJECT: DurableObjectNamespace;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return new Response("Hello World!");
  }
};
```

### HTTP Methods Handling

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    switch (request.method) {
      case "GET":
        return handleGet(request, url);
      case "POST":
        return handlePost(request, url);
      case "PUT":
        return handlePut(request, url);
      case "DELETE":
        return handleDelete(request, url);
      default:
        return new Response("Method not allowed", { status: 405 });
    }
  }
};
```

## Storage Options

### KV (Key-Value Store)

**Best for:** Configuration, user sessions, A/B testing flags, caching

**Characteristics:**

- Eventual consistency (up to 60 seconds globally)
- Read-heavy workloads
- Max 25MB value size
- Keys up to 512 bytes

**Example:**

```typescript
// Write
await env.MY_KV.put("user:123", JSON.stringify({ name: "Alice" }));

// Read
const user = await env.MY_KV.get("user:123");

// With metadata and TTL
await env.MY_KV.put("session:abc", data, {
  metadata: { created: Date.now() },
  expirationTtl: 3600 // 1 hour
});

// List keys
const list = await env.MY_KV.list({ prefix: "user:" });
```

### D1 (SQLite Database)

**Best for:** Relational data, structured queries, complex relationships

**Example:**

```typescript
// Using Workers Binding
const stmt = env.DB.prepare("SELECT * FROM users WHERE id = ?");
const user = await stmt.bind(userId).first();

// Batch operations
const batch = [
  env.DB.prepare("INSERT INTO users (name) VALUES (?)", ["Alice"]),
  env.DB.prepare("INSERT INTO users (name) VALUES (?)", ["Bob"])
];
await env.DB.batch(batch);
```

### R2 (Object Storage)

**Best for:** Files, images, backups, static assets

**S3-compatible API:**

```typescript
// Upload
await env.MY_BUCKET.put("image.png", imageData, {
  httpMetadata: { contentType: "image/png" }
});

// Download
const object = await env.MY_BUCKET.get("image.png");
if (object) {
  return new Response(object.body);
}

// List
const objects = await env.MY_BUCKET.list({ prefix: "images/" });
```

### Durable Objects

**Best for:** Coordination, real-time apps, multiplayer games, chat rooms

**Key Features:**

- Single-threaded execution guarantee
- In-memory state persistence
- Alarms for scheduled tasks
- WebSocket support

**Basic Example:**

```typescript
export class ChatRoom implements DurableObject {
  private sessions: Map<WebSocket, string> = new Map();

  async fetch(request: Request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.sessions.set(server, "Anonymous");

    server.accept();
    server.addEventListener("message", (msg) => {
      // Broadcast to all connected clients
      this.sessions.forEach((_, ws) => {
        if (ws.readyState === WebSocket.READY_STATE_OPEN) {
          ws.send(msg.data);
        }
      });
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
}
```

## Workers AI

### Running Models

```typescript
const response = await env.AI.run("@cf/meta/llama-2-7b-chat-int8", {
  messages: [
    { role: "system", content: "You are a helpful assistant" },
    { role: "user", content: "What is Cloudflare Workers?" }
  ]
});

return Response.json(response);
```

### Available Model Categories

- **Text Generation:** LLaMA, Mistral, CodeLlama
- **Embeddings:** bge-large-en-v1.5
- **Image Generation:** Stable Diffusion XL
- **Translation:** m2m100
- **Speech-to-Text:** Whisper

### AI Gateway

Add observability and control to AI workloads:

```typescript
const gateway = env.AI.gateway("my-gateway");

const response = await gateway.run("@cf/meta/llama-2-7b", {
  messages: [{ role: "user", content: "Hello" }]
});
```

## Advanced Features

### Service Bindings

Call other Workers directly without HTTP overhead:

```typescript
// worker-a
export default {
  async fetch(request, env) {
    // Direct method call to worker-b
    const response = await env.WORKER_B.fetch(
      new Request("http://internal/api")
    );
    return response;
  }
};
```

### Queues

Process background jobs asynchronously:

```typescript
// Producer
await env.MY_QUEUE.send({
  type: "send-email",
  to: "user@example.com",
  subject: "Welcome"
});

// Consumer (in separate worker)
export default {
  async queue(batch: MessageBatch<EmailJob>, env: Env) {
    for (const msg of batch.messages) {
      await sendEmail(msg.body);
      msg.ack(); // Acknowledge successful processing
    }
  }
};
```

### Cron Triggers

Schedule periodic tasks:

```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Runs on schedule defined in wrangler.toml
    await cleanupOldData();
    await generateReports();
  }
};
```

```toml
# wrangler.toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
```

### Analytics Engine

High-volume data ingestion:

```typescript
// Write data point
env.ANALYTICS.writeDataPoint({
  blobs: ["POST", "/api/users"],
  doubles: [responseTime, memoryUsed],
  indexes: ["api"]
});
```

## Best Practices

### Error Handling

```typescript
async function handleRequest(request: Request): Promise<Response> {
  try {
    const data = await fetchData();
    return Response.json(data);
  } catch (error) {
    console.error("Request failed:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        requestId: crypto.randomUUID()
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
```

### Caching

```typescript
export default {
  async fetch(request, env, ctx) {
    const cache = caches.default;
    const cacheKey = new Request(request.url, request);

    // Check cache
    let response = await cache.match(cacheKey);
    if (response) {
      return response;
    }

    // Generate response
    response = await generateResponse(request);

    // Store in cache
    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  }
};
```

### Request Context

Use `ctx.waitUntil()` for background work:

```typescript
export default {
  async fetch(request, env, ctx) {
    // Send immediate response
    const response = new Response("OK");

    // Continue processing without blocking
    ctx.waitUntil(logAnalytics(request));
    ctx.waitUntil(updateCache(request));

    return response;
  }
};
```

## Testing

### Local Development

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Local dev server
wrangler dev

# Deploy
wrangler deploy
```

### Unit Testing with Vitest

```typescript
// test/index.test.ts
import { describe, it, expect } from "vitest";
import worker from "../src/index";

describe("Worker", () => {
  it("returns hello world", async () => {
    const env = getMiniflareBindings();
    const request = new Request("http://localhost/");
    const response = await worker.fetch(request, env);

    expect(await response.text()).toBe("Hello World!");
  });
});
```

## Security

### Secrets Management

```bash
# Store secret
wrangler secret put API_KEY

# Access in code
const apiKey = env.API_KEY;
```

### Request Validation

```typescript
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150)
});

const result = schema.safeParse(await request.json());
if (!result.success) {
  return new Response("Invalid input", { status: 400 });
}
```

### Rate Limiting

```typescript
async function rateLimit(request: Request, env: Env): boolean {
  const ip = request.headers.get("CF-Connecting-IP");
  const key = `rate_limit:${ip}`;

  const current = await env.RATE_LIMIT_KV.get(key);
  const count = current ? parseInt(current) : 0;

  if (count > 100) {
    return false; // Rate limit exceeded
  }

  await env.RATE_LIMIT_KV.put(key, String(count + 1), {
    expirationTtl: 60 // 1 minute window
  });

  return true;
}
```

## Limits & Considerations

| Resource     | Free    | Pro       | Enterprise |
| ------------ | ------- | --------- | ---------- |
| CPU time     | 10ms    | 50ms      | Unlimited  |
| Requests/day | 100,000 | 10M       | Custom     |
| Memory       | 128MB   | 128MB     | 128MB      |
| KV reads/min | 100,000 | Unlimited | Unlimited  |

### Cold Starts

- Workers run in V8 isolates
- First request may have slight latency (cold start)
- Subsequent requests reuse the isolate (warm start)

### Subrequests

- Limit: 50 subrequests per invocation
- Can call external APIs, databases, other Workers
- Use for microservice orchestration

## Deployment Patterns

### Blue-Green Deployment

Use Workers to route traffic between different versions:

```typescript
export default {
  async fetch(request, env) {
    const cookie = request.headers.get("Cookie");
    const useBlue = cookie?.includes("version=blue");

    const target = useBlue ? env.BLUE_SERVICE : env.GREEN_SERVICE;
    return target.fetch(request);
  }
};
```

### A/B Testing

```typescript
export default {
  async fetch(request, env) {
    const userId = getUserId(request);
    const variant = hashUserId(userId) % 2 === 0 ? "A" : "B";

    return env[`VARIANT_${variant}`].fetch(request);
  }
};
```

## Resources

- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [Workers Examples](https://developers.cloudflare.com/workers/examples/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Community Discord](https://discord.cloudflare.com/)
