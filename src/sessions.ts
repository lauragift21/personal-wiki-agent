/**
 * Session Management Utilities
 *
 * Manages chat conversation sessions using the Agents SDK's Session API.
 * Sessions are persisted in Durable Object SQLite storage.
 */

export interface ChatSession {
  id: string;
  name: string;
  createdAt: number;
  lastMessageAt: number;
  messageCount: number;
  preview?: string;
}

export interface ChatSessionWithMessages extends ChatSession {
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
  }>;
}

/**
 * Type for the sql tagged template function from Agent class
 * The actual type is more complex, so we use a flexible type here
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlFunction = (strings: TemplateStringsArray, ...values: any[]) => any[];

/**
 * Create the sessions table if it doesn't exist
 */
export function initializeSessionsTable(sql: SqlFunction) {
  sql`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_message_at INTEGER NOT NULL,
      message_count INTEGER DEFAULT 0,
      preview TEXT
    )
  `;

  sql`
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message 
    ON chat_sessions(last_message_at DESC)
  `;

  sql`
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_created 
    ON chat_sessions(created_at DESC)
  `;
}

/**
 * List all chat sessions, ordered by most recent message
 */
export function listSessions(
  sql: SqlFunction,
  limit: number = 50
): ChatSession[] {
  const results = sql`
    SELECT 
      id,
      name,
      created_at as createdAt,
      last_message_at as lastMessageAt,
      message_count as messageCount,
      preview
    FROM chat_sessions
    ORDER BY last_message_at DESC
    LIMIT ${limit}
  `;

  return results.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    createdAt: row.createdAt as number,
    lastMessageAt: row.lastMessageAt as number,
    messageCount: row.messageCount as number,
    preview: row.preview as string | undefined
  }));
}

/**
 * Get a single session by ID
 */
export function getSession(
  sql: SqlFunction,
  sessionId: string
): ChatSession | null {
  const results = sql`
    SELECT 
      id,
      name,
      created_at as createdAt,
      last_message_at as lastMessageAt,
      message_count as messageCount,
      preview
    FROM chat_sessions
    WHERE id = ${sessionId}
    LIMIT 1
  `;

  if (results.length === 0) return null;

  const row = results[0];
  return {
    id: row.id as string,
    name: row.name as string,
    createdAt: row.createdAt as number,
    lastMessageAt: row.lastMessageAt as number,
    messageCount: row.messageCount as number,
    preview: row.preview as string | undefined
  };
}

/**
 * Create a new chat session
 */
export function createSession(
  sql: SqlFunction,
  name: string,
  sessionId?: string
): ChatSession {
  const now = Date.now();
  const id =
    sessionId || `session-${now}-${Math.random().toString(36).slice(2, 8)}`;

  sql`
    INSERT INTO chat_sessions (id, name, created_at, last_message_at, message_count, preview)
    VALUES (${id}, ${name}, ${now}, ${now}, 0, ${null})
  `;

  return {
    id,
    name,
    createdAt: now,
    lastMessageAt: now,
    messageCount: 0
  };
}

/**
 * Update session metadata after a new message
 */
export function updateSessionAfterMessage(
  sql: SqlFunction,
  sessionId: string,
  messagePreview: string
) {
  const now = Date.now();

  // Truncate preview to 100 chars
  const preview =
    messagePreview.length > 100
      ? messagePreview.slice(0, 97) + "..."
      : messagePreview;

  sql`
    UPDATE chat_sessions
    SET 
      last_message_at = ${now},
      message_count = message_count + 1,
      preview = ${preview}
    WHERE id = ${sessionId}
  `;
}

/**
 * Rename a session
 */
export function renameSession(
  sql: SqlFunction,
  sessionId: string,
  newName: string
): boolean {
  const results = sql`
    UPDATE chat_sessions
    SET name = ${newName}
    WHERE id = ${sessionId}
    RETURNING id
  `;

  return results.length > 0;
}

/**
 * Delete a session
 */
export function deleteSession(sql: SqlFunction, sessionId: string): boolean {
  const results = sql`
    DELETE FROM chat_sessions
    WHERE id = ${sessionId}
    RETURNING id
  `;

  return results.length > 0;
}

/**
 * Search across session names and previews
 */
export function searchSessions(
  sql: SqlFunction,
  query: string,
  limit: number = 20
): ChatSession[] {
  const searchPattern = `%${query}%`;

  const results = sql`
    SELECT 
      id,
      name,
      created_at as createdAt,
      last_message_at as lastMessageAt,
      message_count as messageCount,
      preview
    FROM chat_sessions
    WHERE name LIKE ${searchPattern} OR preview LIKE ${searchPattern}
    ORDER BY last_message_at DESC
    LIMIT ${limit}
  `;

  return results.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    createdAt: row.createdAt as number,
    lastMessageAt: row.lastMessageAt as number,
    messageCount: row.messageCount as number,
    preview: row.preview as string | undefined
  }));
}

/**
 * Get total count of sessions
 */
export function getSessionCount(sql: SqlFunction): number {
  const results = sql`SELECT COUNT(*) as count FROM chat_sessions`;
  return (results[0]?.count as number) || 0;
}

/**
 * Clean up old sessions, keeping only the most recent N
 */
export function cleanupOldSessions(
  sql: SqlFunction,
  keepCount: number = 100
): number {
  const results = sql`
    DELETE FROM chat_sessions
    WHERE id NOT IN (
      SELECT id FROM chat_sessions
      ORDER BY last_message_at DESC
      LIMIT ${keepCount}
    )
    RETURNING id
  `;

  return results.length;
}

/**
 * Format relative time for display
 */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/**
 * Group sessions by time period for sidebar display
 */
export function groupSessionsByTime(
  sessions: ChatSession[]
): Array<{ label: string; sessions: ChatSession[] }> {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;

  const groups: Array<{ label: string; sessions: ChatSession[] }> = [
    { label: "Today", sessions: [] },
    { label: "Yesterday", sessions: [] },
    { label: "This Week", sessions: [] },
    { label: "This Month", sessions: [] },
    { label: "Older", sessions: [] }
  ];

  for (const session of sessions) {
    const age = now - session.lastMessageAt;
    const today = new Date().setHours(0, 0, 0, 0);
    const sessionDay = new Date(session.lastMessageAt).setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today - sessionDay) / oneDay);

    if (daysDiff === 0) {
      groups[0].sessions.push(session);
    } else if (daysDiff === 1) {
      groups[1].sessions.push(session);
    } else if (age < oneWeek) {
      groups[2].sessions.push(session);
    } else if (age < oneMonth) {
      groups[3].sessions.push(session);
    } else {
      groups[4].sessions.push(session);
    }
  }

  // Filter out empty groups
  return groups.filter((g) => g.sessions.length > 0);
}
