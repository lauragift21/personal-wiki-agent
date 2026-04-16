/**
 * AI Search helper functions for the Personal Wiki Agent
 *
 * These functions wrap the Cloudflare AI Search binding operations
 * for document storage, retrieval, and hybrid search.
 */

/**
 * Search the wiki using AI Search with hybrid retrieval
 *
 * @param instance - The AI Search instance to search
 * @param query - The search query string
 * @param options - Optional search configuration
 * @returns Search results with chunks and metadata
 */
export async function searchWiki(
  instance: AiSearchInstance,
  query: string,
  options: {
    retrievalType?: "vector" | "keyword" | "hybrid";
    maxResults?: number;
  } = {}
) {
  console.log("[searchWiki] Searching for:", query);
  console.log("[searchWiki] Options:", options);

  try {
    const result = await instance.search({
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

    console.log(
      "[searchWiki] Search successful, found",
      result.chunks?.length || 0,
      "chunks"
    );
    return result;
  } catch (error) {
    console.error("[searchWiki] Search failed:", error);
    throw error;
  }
}

/**
 * Upload a document to AI Search
 *
 * @param instance - The AI Search instance
 * @param key - Unique identifier for the document
 * @param content - Document content as string
 * @param metadata - Optional metadata (all values converted to strings)
 * @returns Upload result with status
 */
export async function uploadDocument(
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

  console.log("[uploadDocument] Starting upload for:", key);
  console.log("[uploadDocument] Content length:", content.length);

  try {
    // Use regular upload (uploadAndPoll has issues with gzip responses in local dev)
    const result = await instance.items.upload(key, content, {
      metadata: stringMetadata
    });
    console.log("[uploadDocument] Upload SUCCESS:", key);
    // Wait a bit for indexing to start
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { ...result, status: "queued" };
  } catch (uploadError) {
    console.error("[uploadDocument] Upload failed:", uploadError);
    throw uploadError;
  }
}

/**
 * List all documents in the AI Search instance
 *
 * @param instance - The AI Search instance
 * @returns Array of document metadata
 */
export async function listDocuments(instance: AiSearchInstance) {
  const result = await instance.items.list();
  return result.result || [];
}

/**
 * Retrieve a specific document by key
 *
 * @param instance - The AI Search instance
 * @param key - Document identifier
 * @returns Document content as string, or null if not found
 */
export async function getDocument(
  instance: AiSearchInstance,
  key: string
): Promise<string | null> {
  try {
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
  } catch (error) {
    // Document doesn't exist - return null
    return null;
  }
}
