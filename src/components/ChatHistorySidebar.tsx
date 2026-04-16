import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Badge } from "@cloudflare/kumo";
import {
  ChatTeardropTextIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XIcon,
  PencilIcon,
  TrashIcon,
  SidebarSimpleIcon,
  ClockIcon
} from "@phosphor-icons/react";

interface ChatSession {
  id: string;
  name: string;
  createdAt: number;
  lastMessageAt: number;
  messageCount: number;
  preview?: string;
  timeAgo: string;
}

interface GroupedSessions {
  label: string;
  sessions: ChatSession[];
}

interface ChatHistorySidebarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: any;
  isOpen: boolean;
  onToggle: () => void;
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  connected?: boolean;
}

export function ChatHistorySidebar({
  agent,
  isOpen,
  onToggle,
  currentSessionId,
  onSessionSelect,
  onNewChat,
  connected = false
}: ChatHistorySidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [groupedSessions, setGroupedSessions] = useState<GroupedSessions[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [_isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [totalSessions, setTotalSessions] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Fetch sessions from the server
  const fetchSessions = useCallback(async () => {
    if (!agent?.stub) return;

    setIsLoading(true);
    try {
      const result = await agent.stub.listChatSessions(50);
      setSessions(result.sessions);
      setTotalSessions(result.total);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [agent]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen, fetchSessions]);

  // Group sessions by time period
  useEffect(() => {
    const groups = groupSessionsByTime(sessions);
    setGroupedSessions(groups);
  }, [sessions]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchQuery && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchQuery]);

  // Focus edit input when editing
  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!agent?.stub || !searchQuery.trim()) {
      fetchSessions();
      return;
    }

    setIsSearching(true);
    try {
      const results = await agent.stub.searchChatSessions(searchQuery.trim());
      setSessions(results);
    } catch (error) {
      console.error("Failed to search sessions:", error);
    } finally {
      setIsSearching(false);
    }
  }, [agent, searchQuery, fetchSessions]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch();
      } else {
        fetchSessions();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch, fetchSessions]);

  // Start editing a session name
  const startEditing = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditingName(session.name);
  };

  // Save the edited name
  const saveEditing = async () => {
    if (!agent?.stub || !editingSessionId || !editingName.trim()) {
      setEditingSessionId(null);
      return;
    }

    try {
      await agent.stub.renameChatSession(editingSessionId, editingName.trim());
      // Update local state
      setSessions((prev) =>
        prev.map((s) =>
          s.id === editingSessionId ? { ...s, name: editingName.trim() } : s
        )
      );
    } catch (error) {
      console.error("Failed to rename session:", error);
    } finally {
      setEditingSessionId(null);
    }
  };

  // Delete a session
  const handleDelete = async (sessionId: string) => {
    if (!agent?.stub) return;

    if (!confirm("Are you sure you want to delete this conversation?")) {
      return;
    }

    try {
      await agent.stub.deleteChatSession(sessionId);
      // Update local state
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setTotalSessions((prev) => Math.max(0, prev - 1));

      // If we deleted the current session, clear it
      if (sessionId === currentSessionId) {
        onNewChat();
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  // Handle session click
  const handleSessionClick = (sessionId: string) => {
    onSessionSelect(sessionId);
  };

  // If sidebar is collapsed, show just a toggle button
  if (!isOpen) {
    return (
      <div className="flex flex-col items-center py-4 px-2 border-r border-[var(--border)] bg-[var(--bg-secondary)] h-full">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
          title="Open chat history"
        >
          <SidebarSimpleIcon size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 flex flex-col h-full border-r border-[var(--border)] bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <ChatTeardropTextIcon size={20} />
          <span className="font-semibold">Chats</span>
          <Badge variant="secondary">{totalSessions}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            onClick={onNewChat}
            aria-label="New chat"
            title={connected ? "New chat" : "Connect to start new chat"}
            disabled={!connected}
          >
            <PlusIcon size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            onClick={onToggle}
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <XIcon size={18} />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="relative">
          <MagnifyingGlassIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-[var(--bg-primary)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--color-warm-gray-300)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--bg-tertiary)] rounded"
            >
              <XIcon size={14} />
            </button>
          )}
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          disabled={!connected}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-left"
        >
          <PlusIcon size={18} />
          <span className="font-medium">
            {connected ? "New Chat" : "Connecting..."}
          </span>
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)]">
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            Loading...
          </div>
        ) : groupedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-[var(--text-tertiary)]">
            <ClockIcon size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedSessions.map((group) => (
              <div key={group.label}>
                <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-2 mb-2">
                  {group.label}
                </h3>
                <div className="space-y-1">
                  {group.sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`group relative rounded-lg transition-colors ${
                        session.id === currentSessionId
                          ? "bg-[var(--bg-primary)]"
                          : "hover:bg-[var(--bg-tertiary)]"
                      }`}
                    >
                      {editingSessionId === session.id ? (
                        <div className="p-2">
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEditing();
                              if (e.key === "Escape") setEditingSessionId(null);
                            }}
                            onBlur={saveEditing}
                            className="w-full px-2 py-1 bg-[var(--bg-primary)] rounded text-sm outline-none focus:ring-2 focus:ring-[var(--color-warm-gray-300)]"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSessionClick(session.id)}
                          className="w-full text-left p-2"
                        >
                          <div className="flex items-start gap-2">
                            <ChatTeardropTextIcon
                              size={18}
                              className="mt-0.5 text-[var(--text-tertiary)] flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {session.name}
                              </p>
                              {session.preview && (
                                <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">
                                  {session.preview}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-[var(--text-tertiary)]">
                                  {session.timeAgo}
                                </span>
                                {session.messageCount > 0 && (
                                  <span className="text-[10px] text-[var(--text-tertiary)]">
                                    • {session.messageCount} msgs
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      )}

                      {/* Actions - visible on hover */}
                      {editingSessionId !== session.id && (
                        <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(session);
                            }}
                            className="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                            title="Rename"
                          >
                            <PencilIcon size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(session.id);
                            }}
                            className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"
                            title="Delete"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Group sessions by time period for sidebar display
 */
function groupSessionsByTime(sessions: ChatSession[]): GroupedSessions[] {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;

  const groups: GroupedSessions[] = [
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
