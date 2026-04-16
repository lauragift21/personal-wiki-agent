# AI Search: The Search Primitive for Your Agents — Video Script

**Blog:** BLOG-3240 — Search for your agents (hybrid search)  
**Release Date:** Thursday, April 16th (Agents Week Day 4)  
**Target:** Developers building AI agents  
**Duration:** 60–90 seconds (optimized for Twitter/LinkedIn short)

---

## Video Title

**"The Search Primitive Your AI Agents Need"**

_Alt: "Hybrid Search: Vector + Keyword = Agent Memory That Works"_

---

## Hook (0:00–0:12)

_[Open on a coding agent or chat interface failing to find context. Show text: "I don't have access to that information" or a generic response]_

**Speaker notes:**
"Every agent needs search. Coding agents search repos. Support agents search tickets. Even an agent's memory is fundamentally search."

_[Show messy architecture diagram: vector index + keyword index + fusion logic + per-agent setup]_
"But building it yourself? Vector indexes, keyword indexes, fusion logic, per-agent setup..."

_[Cut to clean AI Search interface with instant results showing hybrid scores]_
**Key line:** "AI Search is the plug-and-play primitive — now with hybrid retrieval."

---

## Demo Part 1 — The Problem Hybrid Solves (0:12–0:30)

**On-screen:** Split screen showing two search failures:

- Left: Vector search for "ERR_CONNECTION_REFUSED" returns generic networking docs
- Right: Keyword search for "troubleshooting network connections" misses the concept

**Speaker notes:**
"Here's the problem. Vector search understands intent but loses specifics."

_[Show vector result missing the exact error code]_
"Search for an error code? You get general networking docs, not the page with that exact string."

_[Show keyword result missing conceptual matches]_
"Keyword search? Finds exact terms but misses related concepts."

_[Both screens show partial/missing results]_
"Your agents need both."

---

## Demo Part 2 — Hybrid Search in Action (0:30–0:58)

**On-screen:** Execute hybrid search on your wiki agent. Show SearchResultCard with:

- Matched text snippet
- overall_score
- vector_score (semantic similarity)
- keyword_score (BM25 matching)
- fusion_method: "rrf"

**Speaker notes:**
"Hybrid search runs vector and BM25 in parallel, then fuses results."

_[Point to vector_score: ~0.85]_
"Vector finds conceptually related content..."

_[Point to keyword_score: ~0.92]_
"...BM25 catches exact error codes and specific terms..."

_[Point to fusion_method: "rrf"]_
"...and RRF — Reciprocal Rank Fusion — intelligently combines them by rank, not just averaging scores."

_[Scroll through 2-3 results showing different distributions]_
"See this? High vector score found the troubleshooting guide. High keyword score found the exact error page. Both surface when relevant."

---

## Demo Part 3 — Built for Agents (0:58–1:20)

**On-screen:** Show dynamic instance creation concept (text overlay or code snippet), then demonstrate:

- Per-customer search instances
- Cross-instance search
- Built-in storage (no R2 setup)

**Speaker notes:**
"And it's built for multi-agent architectures."

_[Show namespace with multiple instances: product-knowledge, customer-abc123, customer-def456]_
"Create instances dynamically — one per agent, per customer, per tenant."

_[Show cross-instance search query]_
"Query across multiple instances in one call. Product docs AND customer history, fused together."

_[Upload a document, immediate search]_
"Built-in storage and indexing. Upload files directly — no R2 buckets to configure."

---

## Explanation — The Tech (1:20–1:35)

**On-screen:** Brief shot of Wrangler CLI command: `npx wrangler ai-search create my-search`

**Speaker notes:**
"Vector + keyword indexes. Porter stemmer for natural language. Trigram for code. Configurable fusion and reranking."

_[Back to UI showing fast search]_
"Metadata boosting, cross-instance search, and it's all serverless."

_[Text overlay: "developers.cloudflare.com/ai-search"]_
"Zero infrastructure. Just create, upload, and search."

---

## Recap + CTA (1:35–1:50)

**On-screen:** End on hybrid search results showing both scores. Add Agents Week branding.

**Speaker notes:**
"AI Search with hybrid retrieval — launching today for Agents Week."

_[Text overlay: "AI Search | Hybrid Retrieval | Agents Week 2026"]_
"Give your agents memory that actually works."

_[Text overlay: `npx wrangler ai-search create my-search`]_
"One command to get started. Check the docs and build something."

---

## What To Cut (If Running Long)

- **Trim:** Tokenizer explanation (porter vs trigram) — save for blog
- **Trim:** Multi-tenant architecture details — 10 seconds
- **Keep:** Dual-score demonstration — this is the visual proof of hybrid search
- **Keep:** Dynamic instance creation — shows it's built for agents

---

## On-Screen Callouts

| Timestamp | What to Show             | Key Visual                                        |
| --------- | ------------------------ | ------------------------------------------------- |
| 0:00      | Failed agent response    | "I don't have that information"                   |
| 0:08      | Complex DIY architecture | Multiple boxes: vector + keyword + fusion         |
| 0:15      | Split screen failures    | Vector misses exact term / Keyword misses concept |
| 0:32      | Hybrid search results    | vector_score + keyword_score + fusion_method: rrf |
| 0:50      | Namespace with instances | product-knowledge, customer-abc123, etc.          |
| 1:00      | Cross-instance search    | Query spanning multiple instances                 |
| 1:35      | Final result + branding  | "Agents Week 2026" overlay                        |
| 1:45      | CLI command              | `npx wrangler ai-search create my-search`         |

---

## Key Messaging (From BLOG-3240)

**Headline:** AI Search: the search primitive for your agents

**Core Value Props:**

1. **Hybrid search** — vector + BM25 in parallel, fused with RRF
2. **Built-in storage** — no R2 setup, upload directly to instances
3. **Dynamic instances** — create per agent/customer at runtime via namespace binding
4. **Cross-instance search** — query multiple instances in one call
5. **Metadata boosting** — surface recent docs, prioritize by custom fields
6. **Zero infrastructure** — fully managed, serverless

**Technical Highlights:**

- Porter stemmer for natural language
- Trigram tokenizer for code
- RRF (Reciprocal Rank Fusion) not simple averaging
- Optional reranking with cross-encoders
- `ai_search_namespaces` binding for dynamic creation

**Target Use Cases:**

- Coding agents searching repos
- Support agents with product docs + customer history
- Multi-tenant RAG applications
- Agent memory and conversation context

---

## Analogy Bank

**Concept:** Hybrid search combining vector + keyword
**Analogy:** "Vector search is like asking someone about a movie and they describe the plot. Keyword search is like quoting a specific line. Hybrid search gives you both — the context AND the exact quote."

**Concept:** RRF Fusion
**Analogy:** "RRF is like a judge in a competition who ranks competitors by position rather than raw scores. It doesn't matter if one judge scored 95 and another 85 — what matters is who ranked first, second, third."

**Concept:** Dynamic instances per agent
**Analogy:** "Think of each AI Search instance like a filing cabinet. Old approach: everyone shares one giant cabinet. New approach: each agent gets their own cabinet, but you can still search across all of them at once when needed."

---

## Production Notes

- **Thumbnail idea:** Split screen showing "Vector: 0.85 | Keyword: 0.92" with "RRF Fusion" in the middle, AI Search logo
- **Background music:** Upbeat, modern tech (consistent with Agents Week)
- **Pacing:** Quick cuts showing before/after (failed search → hybrid search success)
- **Captions:** Highlight "hybrid search," "BM25," "RRF fusion," "vector + keyword," "per-agent instances"
- **Platform optimization:**
  - 9:16 for TikTok/Reels/Shorts
  - 1:1 for Twitter/LinkedIn
  - 16:9 for YouTube
- **Branding:** Include "Agents Week 2026" badge in final 5 seconds
- **CLI visibility:** Make the `npx wrangler ai-search create` command prominent in CTA

---

## Social Post Copy (To Accompany Video)

**Twitter/X:**

```
Your AI agents need search that understands intent AND matches exact terms.

AI Search now supports hybrid retrieval:
• Vector search for semantic meaning
• BM25 for exact keyword matching
• RRF fusion for intelligent ranking
• Dynamic instances per agent/customer

Launching today for #AgentsWeek

🎬 90 seconds to see it ↓
https://blog.cloudflare.com/ai-search-agent-primitive
```

**LinkedIn:**

```
The hardest part of building AI agents isn't the LLM — it's giving them reliable memory.

Today we're launching hybrid search in Cloudflare AI Search as part of Agents Week 2026.

What makes it different:

✓ Dual retrieval: Vector + BM25 run in parallel
✓ Intelligent fusion: RRF ranking, not averaging
✓ Dynamic instances: Create per-agent, per-customer at runtime
✓ Cross-instance search: Query multiple knowledge bases at once
✓ Built-in storage: Upload directly, no R2 configuration

The support agent example in the blog searches both product documentation AND customer history in a single call — then saves resolutions for future context.

That's the power of treating search as a primitive, not a project.

Check the demo video ↓

#AI #Cloudflare #AgentsWeek #MachineLearning #RAG
```

**BlueSky:**

```
AI agents need search that gets both the big picture AND the details.

New in AI Search: hybrid retrieval with vector + BM25 + RRF fusion.

Create instances dynamically. Query across them. Built-in storage.

Part of Agents Week 🚀

Demo + code: blog.cloudflare.com/ai-search-agent-primitive
```

---

## Blog Alignment Checklist

- [x] Headline matches blog title
- [x] Hook references agent search problem from blog intro
- [x] Hybrid search explanation matches technical section
- [x] BM25 + vector + RRF mentioned correctly
- [x] Dynamic instances via namespace binding shown
- [x] Cross-instance search demonstrated
- [x] Built-in storage (no R2) emphasized
- [x] CLI command matches blog CTA
- [x] Docs link matches blog
- [x] Agents Week branding included
- [x] Support agent example referenced
