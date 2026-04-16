# AI Search: The Search Primitive for Your Agents — Video Script

---

## Video Title

**"AI Search That Actually Finds What You Need"**

_Alt: "Hybrid Search + Built-in Storage = Game Changer"_

---

## Hook (0:00–0:10)

_[Open directly on the Search tab of your wiki agent. Type a query like "coffee brewing tips" or "fitness goals" — something relatable viewers can imagine searching in their own notes. Show results appearing instantly with the hybrid scores visible.]_

**Speaker notes:**
"What if your search understood what you _meant_, not just what you _typed_?"

_[Pause on the results showing vector_score, keyword_score, and fusion_method fields]_

**Text on screen:** "Hybrid Search is here..."

---

## Demo Part 1 — The Problem (0:10–0:30)

**On-screen:** Switch to the Chat tab. Show a conversational query like "What were my productivity goals from last quarter?"

**Speaker notes:**
"We all have this problem. You write something down — a journal entry, a note, a goal — and then you can never find it again."

"Keyword search? It only works if you remember the exact words. Vector search? Great for meaning, but misses exact matches."

_[Switch back to Search tab, show the same query typed in the search box]_

"And don't get me started on the setup — R2 buckets, Vectorize indexes, sync pipelines..."

_[Show a quick flash of complex infrastructure diagram, then cut back to clean UI]_
"Hybrid search with built-in storage fixes all of that."

---

## Demo Part 2 — The Magic (0:30–0:55)

**On-screen:** Execute the search. Zoom in on the SearchResultCard showing:

- The matched text snippet
- Overall score
- Vector score (semantic similarity)
- Keyword score (BM25 matching)
- fusion_method: "rrf"

**Speaker notes:**
"Watch what happens. The query gets two scores at once — vector for semantic meaning, keyword for exact term matches."

_[Point to the vector_score field]_
"Vector search finds documents that are conceptually related..."

_[Point to keyword_score]_
"...while keyword search catches precise terms you actually wrote."

_[Point to fusion_method: "rrf"]_
"Then RRF fusion — Reciprocal Rank Fusion — intelligently combines both. You get the best of both worlds."

_[Scroll through 2-3 results showing different score distributions — one with high vector score, one with high keyword score]_
"See how different documents rank based on what makes them relevant?"

---

## Demo Part 3 — Built-in Storage (0:55–1:20)

**On-screen:** Show document ingestion. Drag and drop a file (markdown or text) into the chat interface. Show the "indexing" state, then switch to Search and query it immediately.

**Speaker notes:**
"But here's what changes everything — built-in storage."

_[Show file uploading, status changing to "indexed"]_
"You no longer need to provision R2 buckets or Vectorize indexes to set up. With built-in storage all of this is handled for you and you can Just upload your file and it's immediately searchable."

_[Type a query related to the uploaded document content, show instant results]_
"The instance comes with its own storage and index. You can create one per agent, per customer, per project — dynamically, at runtime."

_[Show multiple instances in a namespace]_
"And you can query across all of them in a single call."

---

## Explanation — How It Works (1:20–1:35)

**On-screen:** Brief shot of code or CLI showing the simplicity: `npx wrangler ai-search create my-search`

**Speaker notes:**
"This is Cloudflare AI Search — fully managed, serverless, zero infrastructure."

_[Cut back to the Search tab showing multiple successful queries]_
"Vector + keyword indexes. Automatic RRF fusion. Built-in storage. Dynamic instances. It's all just... there."

_[Text overlay: "developers.cloudflare.com/ai-search"]_
"Check the docs and start building."

---

## Recap + CTA (1:35–1:50)

**On-screen:** End on a clean search result showing a perfect match with both scores highlighted. Add Agents Week branding.

**Speaker notes:**
"Hybrid search with built-in storage — live today as part of Agents Week."

_[Text overlay: "Cloudflare AI Search — Hybrid Retrieval + Built-in Storage"]_
"No more setup headaches. Just search that works."

_[Text overlay: `npx wrangler ai-search create my-search`]_
"One command. Instant search. Go build something."

---

## What To Cut (If Running Long)

- **Trim:** The multi-instance query section — keep it to single instance demo
- **Trim:** The infrastructure complaint — just show the upload working
- **Keep:** The dual-score demonstration — that's the visual hook
- **Keep:** The "no R2, no Vectorize" moment — that's the built-in storage payoff

---

## On-Screen Callouts

| Timestamp | What to Show               | Key Visual                                        |
| --------- | -------------------------- | ------------------------------------------------- |
| 0:00      | Search tab, query typing   | Query + instant results                           |
| 0:15      | Score breakdown            | vector_score, keyword_score, fusion_method fields |
| 0:35      | Multiple results           | Different score distributions side-by-side        |
| 0:55      | File upload                | Drag-and-drop into chat interface                 |
| 1:00      | "Indexed" status           | File ready to search immediately                  |
| 1:05      | Live search                | Query immediately finding uploaded content        |
| 1:35      | Final result with branding | "Agents Week 2026" + CLI command                  |

---

## Key Points to Hit Naturally

1. **Hybrid search** — vector + keyword, not either/or
2. **Built-in storage** — no R2, no Vectorize setup, just upload and go
3. **Dynamic instances** — create per agent/customer at runtime
4. **Zero infrastructure** — fully managed, serverless

---

## Analogy Bank

**Concept:** Hybrid search combining vector + keyword
**Analogy:** "It's like having a librarian who not only knows exactly which book you need by title, but also understands what you're looking for even when you can't remember the exact words."

**Concept:** Built-in storage
**Analogy:** "It's like the difference between buying a house that needs renovation versus one that's move-in ready. Built-in storage means you just... move in."

**Concept:** RRF Fusion
**Analogy:** "Think of it like combining two expert opinions and weighting them based on confidence. The system doesn't just average the scores — it intelligently ranks based on what each method does best."

---

## Production Notes

- **Thumbnail idea:** Split screen showing "Vector: 0.89 | Keyword: 0.95" scores with "Built-in Storage" badge and "Hybrid Search" text
- **Background music:** Upbeat tech/ambient, not distracting
- **Pacing:** Quick cuts between search results to show speed
- **Captions:** Highlight "hybrid search," "vector + keyword," "RRF fusion," "built-in storage," "no setup"
- **Platform optimization:**
  - 9:16 for TikTok/Reels
  - 1:1 for Twitter/LinkedIn
  - 16:9 for YouTube
- **Branding:** Include "Agents Week 2026" badge in final 5 seconds
- **CLI visibility:** Make the `npx wrangler ai-search create` command prominent

---

## Social Post Copy (To Accompany Video)

**Twitter/X:**

```
Your AI agents deserve better memory.

Hybrid search = vector understanding + keyword precision
Built-in storage = zero infrastructure setup

Now live in Cloudflare AI Search as part of #AgentsWeek

🎬 90 seconds to see it in action ↓
https://blog.cloudflare.com/ai-search-agent-primitive
```

**LinkedIn:**

```
The biggest problem with AI agent search? You spend more time setting up infrastructure than building your agent.

Not anymore. Today we're launching hybrid search + built-in storage in Cloudflare AI Search — part of Agents Week 2026.

What you get:
✓ Hybrid retrieval (vector + BM25 + RRF fusion)
✓ Built-in storage (no R2, no Vectorize setup)
✓ Dynamic instances (create per agent/customer)
✓ Query across instances in one call

Your agents can now find information by meaning AND exact match — with zero infrastructure to manage.

Check the demo ↓

#AI #Cloudflare #AgentsWeek #MachineLearning
```

**BlueSky:**

```
AI search that understands meaning AND matches exact terms — with built-in storage so you skip the infrastructure setup.

Hybrid search is live in Cloudflare AI Search 🚀

Part of Agents Week 2026

Demo: blog.cloudflare.com/ai-search-agent-primitive
```
