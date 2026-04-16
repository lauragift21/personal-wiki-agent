# Hybrid Search is Here — Video Script

## Video Title

**"AI Search That Actually Finds What You Need"**

## Hook (0:00–0:10)

_[Open directly on the Search tab of your wiki agent. Type a query like "coffee brewing tips" or "fitness goals" — something relatable viewers can imagine searching in their own notes. Show results appearing instantly with the hybrid scores visible.]_

**Speaker notes:**
"What if your search understood what you _meant_, not just what you _typed_?"

_[Pause on the results showing vector_score, keyword_score, and fusion_method fields]_

**Key line:** "This is hybrid search — and it's launching today."

---

## Demo Part 1 — The Problem (0:10–0:30)

**On-screen:** Switch to the Chat tab. Show a conversational query like "What were my productivity goals from last quarter?"

**Speaker notes:**
"We all have this problem. You write something down — a journal entry, a note, a goal — and then you can never find it again."

"Keyword search? It only works if you remember the exact words. Vector search? Great for meaning, but misses exact matches."

_[Switch back to Search tab, show the same query typed in the search box]_

"Hybrid search does both."

---

## Demo Part 2 — The Magic (0:30–1:00)

**On-screen:** Execute the search. Zoom in on the SearchResultCard showing:

- The matched text snippet
- Overall score
- Vector score (semantic similarity)
- Keyword score (BM25 matching)

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

## Demo Part 3 — Real World Use (1:00–1:30)

**On-screen:** Show document ingestion. Drag and drop a file (markdown or text) into the chat interface. Show the "ingesting" state, then switch to Search and query it immediately.

**Speaker notes:**
"And the best part? It's fully automated. Drop in any document..."

_[Show file uploading]_
"...and it's instantly indexed with hybrid search. No configuration, no tuning — it just works."

_[Type a query related to the uploaded document content]_
"Your personal knowledge base, searchable by meaning AND exact match."

---

## Explanation — How It Works (1:30–1:50)

**On-screen:** Brief shot of code showing the queryWiki function with retrievalType: "hybrid", or the AI Search configuration.

**Speaker notes:**
"This is built on Cloudflare AI Search — fully managed, serverless, and zero infrastructure to maintain."

_[Cut back to the Search tab showing multiple successful queries]_
"Vector index for semantics. Keyword index with BM25. Automatic RRF fusion. It's all built-in — check the docs at developers.cloudflare.com/ai-search"

---

## Recap + CTA (1:50–2:00)

**On-screen:** End on a clean search result showing a perfect match with both scores highlighted.

**Speaker notes:**
"Hybrid search is live today. Build smarter search into your apps without the complexity."

_[Text overlay: "Cloudflare AI Search — Hybrid Retrieval"]_
"Check the docs, start building, and never lose a note again."

---

## What To Cut (If Running Long)

- **Trim:** The document ingestion section (0:15 seconds)
- **Trim:** Code explanation — just show the UI working (0:10 seconds)
- **Keep:** The dual-score demonstration — that's the visual hook

---

## On-Screen Callouts

| Timestamp | What to Show             | Key Visual                                        |
| --------- | ------------------------ | ------------------------------------------------- |
| 0:00      | Search tab, query typing | Query + instant results                           |
| 0:15      | Score breakdown          | vector_score, keyword_score, fusion_method fields |
| 0:35      | Multiple results         | Different score distributions side-by-side        |
| 0:55      | File upload              | Drag-and-drop into chat interface                 |
| 1:10      | Live search              | Query immediately finding uploaded content        |
| 1:50      | Final result             | Clean hybrid search result with scores            |

---

## Analogy Bank

**Concept:** Hybrid search combining vector + keyword
**Analogy:** "It's like having a librarian who not only knows exactly which book you need by title, but also understands what you're looking for even when you can't remember the exact words."

**Concept:** RRF Fusion
**Analogy:** "Think of it like combining two expert opinions and weighting them based on confidence. The system doesn't just average the scores — it intelligently ranks based on what each method does best."

---

## Production Notes

- **Thumbnail idea:** Split screen showing "Vector: 0.89 | Keyword: 0.95" scores with "Hybrid Search" text overlay
- **Background music:** Upbeat tech/ambient, not distracting
- **Pacing:** Quick cuts between search results to show speed
- **Captions:** Highlight "hybrid search", "vector + keyword", "RRF fusion"
- **Platform optimization:** 9:16 aspect ratio for TikTok/Reels, 1:1 for Twitter/LinkedIn
