import { Suspense, useCallback, useState, useEffect, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useVoiceInput } from "@cloudflare/voice/react";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { ChatAgent } from "./server";
import { Badge, Button } from "@cloudflare/kumo";
import { Toasty, useKumoToastManager } from "@cloudflare/kumo/components/toast";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import {
  PaperPlaneRightIcon,
  StopIcon,
  ChatCircleDotsIcon,
  MoonIcon,
  SunIcon,
  CheckCircleIcon,
  XCircleIcon,
  BrainIcon,
  XIcon,
  PaperclipIcon,
  ImageIcon,
  MagnifyingGlassIcon,
  BooksIcon,
  MicrophoneIcon
} from "@phosphor-icons/react";
import { SearchResultCard } from "./components/SearchResultCard";
import { SearchSkeleton } from "./components/SearchSkeleton";
import { ChatHistorySidebar } from "./components/ChatHistorySidebar";

// ── Types ─────────────────────────────────────────────────────────────

interface Attachment {
  id: string;
  file: File;
  preview: string;
  mediaType: string;
  fileType?: "image" | "document";
  content?: string;
}

interface SearchResult {
  id: string;
  text: string;
  source: string;
  overallScore: number;
  vectorScore: number;
  keywordScore: number;
}

// ── Helpers ───────────────────────────────────────────────────────────

interface DocumentAttachment extends Attachment {
  content?: string;
  fileType: "image" | "document";
}

function isDocumentFile(file: File): boolean {
  const documentTypes = [
    "text/markdown",
    "text/plain",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text"
  ];
  const documentExtensions = [".md", ".txt", ".pdf", ".doc", ".docx", ".odt"];
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  return (
    documentTypes.includes(file.type) || documentExtensions.includes(extension)
  );
}

function getDocumentType(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    md: "markdown",
    txt: "text",
    pdf: "pdf",
    doc: "word",
    docx: "word",
    odt: "odt"
  };
  return typeMap[extension || ""] || "document";
}

function createAttachment(file: File): DocumentAttachment {
  const isImage = file.type.startsWith("image/");
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    preview: isImage ? URL.createObjectURL(file) : "",
    mediaType: file.type || "application/octet-stream",
    fileType: isImage ? "image" : "document"
  };
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Components ────────────────────────────────────────────────────────

function ThemeToggle() {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute("data-mode") === "dark"
  );

  const toggle = useCallback(() => {
    const next = !dark;
    setDark(next);
    const mode = next ? "dark" : "light";
    document.documentElement.setAttribute("data-mode", mode);
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem("theme", mode);
  }, [dark]);

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg hover:bg-[var(--color-warm-gray-100)] transition-colors"
      aria-label="Toggle theme"
    >
      {dark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}

function _ConnectionIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--color-warm-gray-500)]">
      <span className={`connection-status ${connected ? "" : "offline"}`} />
      <span>{connected ? "Connected" : "Offline"}</span>
    </div>
  );
}

function ToolPartView({
  part,
  addToolApprovalResponse
}: {
  part: UIMessage["parts"][number];
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
  if (!isToolUIPart(part)) return null;
  const toolName = getToolName(part);

  if (part.state === "output-available") {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="max-w-[85%] px-4 py-3 tool-card">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-[var(--color-warm-gray-700)]">
              {toolName}
            </span>
            <Badge variant="secondary">Done</Badge>
          </div>
          <pre className="text-xs text-[var(--color-warm-gray-600)] font-mono overflow-auto max-h-32">
            {JSON.stringify(part.output, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  if ("approval" in part && part.state === "approval-requested") {
    const approvalId = (part.approval as { id?: string })?.id;
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="max-w-[85%] px-5 py-4 calmpaper border-amber-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium">Approve: {toolName}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                approvalId &&
                addToolApprovalResponse({ id: approvalId, approved: true })
              }
            >
              <CheckCircleIcon size={14} className="mr-1" /> Approve
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                approvalId &&
                addToolApprovalResponse({ id: approvalId, approved: false })
              }
            >
              <XCircleIcon size={14} className="mr-1" /> Reject
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (part.state === "input-available" || part.state === "input-streaming") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-4 py-2.5 bg-[var(--color-warm-gray-50)] rounded-lg">
          <div className="flex items-center gap-2 text-sm text-[var(--color-warm-gray-500)]">
            <div className="w-4 h-4 border-2 border-[var(--color-warm-gray-300)] border-t-transparent rounded-full animate-spin" />
            <span>Running {toolName}...</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── Main Application ──────────────────────────────────────────────────

function Chat() {
  // State
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [showDebug, _setShowDebug] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "search">("chat");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Sidebar and session state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toasts = useKumoToastManager();

  // Agent setup with reconnection
  const [_reconnectAttempt, setReconnectAttempt] = useState(0);

  const agent = useAgent<ChatAgent>({
    agent: "ChatAgent",
    onOpen: useCallback(() => {
      console.log("[WebSocket] Connected");
      setConnected(true);
      setReconnectAttempt(0);
    }, []),
    onClose: useCallback((event: CloseEvent) => {
      console.log("[WebSocket] Closed:", event.code, event.reason);
      setConnected(false);
    }, []),
    onError: useCallback((error: Event) => {
      console.error("[WebSocket] Error:", error);
      setReconnectAttempt((prev) => prev + 1);
    }, []),
    onMcpUpdate: useCallback(() => {}, []),
    onMessage: useCallback(
      (message: MessageEvent) => {
        try {
          const data = JSON.parse(String(message.data));
          if (data.type === "scheduled-task") {
            toasts.add({
              title: "Task completed",
              description: data.description,
              timeout: 5000
            });
          }
        } catch {}
      },
      [toasts]
    )
  });

  // Chat hook
  const {
    messages,
    sendMessage,
    clearHistory,
    setMessages,
    addToolApprovalResponse,
    stop,
    status
  } = useAgentChat({
    agent,
    onToolCall: async (event) => {
      if (
        "addToolOutput" in event &&
        event.toolCall.toolName === "getUserTimezone"
      ) {
        event.addToolOutput({
          toolCallId: event.toolCall.toolCallId,
          output: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            localTime: new Date().toLocaleTimeString()
          }
        });
      }
    }
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Voice input hook (speech-to-text only, no modal, no call)
  const {
    transcript: voiceTranscript,
    interimTranscript: voiceInterimTranscript,
    isListening,
    audioLevel,
    error: voiceError,
    start: startVoiceInput,
    stop: stopVoiceInput
  } = useVoiceInput({
    agent: "VoiceChatAgent"
  });

  // Update input when voice transcript changes
  useEffect(() => {
    if (voiceTranscript) {
      setInput((prev) => {
        const newValue = prev ? `${prev} ${voiceTranscript}` : voiceTranscript;
        return newValue.trim();
      });
    }
  }, [voiceTranscript]);

  // Show voice error toast
  useEffect(() => {
    if (voiceError) {
      toasts.add({
        title: "Voice input error",
        description: voiceError,
        timeout: 5000
      });
    }
  }, [voiceError, toasts]);

  // Effects
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  // Initialize session when agent connects - restore existing or create new
  useEffect(() => {
    if (connected && agent.stub && !currentSessionId) {
      const initSession = async () => {
        try {
          console.log("[Init] Checking for existing sessions...");

          // First, try to get the current session from the server
          const currentSession = await agent.stub.getCurrentSession();

          if (currentSession) {
            console.log("[Init] Restored current session:", currentSession);
            setCurrentSessionId(currentSession.id);
            return;
          }

          // If no current session, check if there are any existing sessions
          const sessionsResult = await agent.stub.listChatSessions(1);

          if (sessionsResult.sessions.length > 0) {
            // Use the most recent session
            const mostRecentSession = sessionsResult.sessions[0];
            console.log(
              "[Init] Restoring most recent session:",
              mostRecentSession
            );
            await agent.stub.setCurrentSession(mostRecentSession.id);
            setCurrentSessionId(mostRecentSession.id);
          } else {
            // No existing sessions, create a new one
            console.log("[Init] No existing sessions, creating new...");
            const session = await agent.stub.createChatSession("New Chat");
            console.log("[Init] New session created:", session);
            setCurrentSessionId(session.id);
          }
        } catch (error) {
          console.error("[Init] Failed to initialize session:", error);
        }
      };
      initSession();
    }
  }, [connected, agent.stub, currentSessionId]);

  // Listen for session changes and load messages
  useEffect(() => {
    if (!agent) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "session-changed" && data.messages) {
          console.log("[Client] Loading messages for session:", data.messages);
          // Convert loaded messages to UIMessage format
          const loadedMessages = data.messages.map(
            (msg: { role: string; content: string }) => ({
              role: msg.role,
              content: [{ type: "text", text: msg.content }],
              parts: [{ type: "text", text: msg.content }]
            })
          );
          setMessages(loadedMessages);
        }
      } catch (error) {
        console.error("[Client] Failed to parse message:", error);
      }
    };

    // The agent connection has a websocket, listen for messages
    const ws = (agent as unknown as { connection?: WebSocket })?.connection;
    if (ws) {
      ws.addEventListener("message", handleMessage);
      return () => ws.removeEventListener("message", handleMessage);
    }
  }, [agent, setMessages]);

  // Fetch search suggestions when search tab is opened
  useEffect(() => {
    if (activeTab === "search" && connected && agent.stub) {
      const fetchSuggestions = async () => {
        setIsLoadingSuggestions(true);
        try {
          const suggestions = await agent.stub.getSearchSuggestions();
          setSearchSuggestions(suggestions);
        } catch (error) {
          console.error("[Search] Failed to fetch suggestions:", error);
          setSearchSuggestions([]);
        } finally {
          setIsLoadingSuggestions(false);
        }
      };
      fetchSuggestions();
    }
  }, [activeTab, connected, agent]);

  // Handlers
  const readFileAsText = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }, []);

  // Session management handlers
  const handleNewChat = useCallback(async () => {
    if (!connected || !agent.stub) {
      console.error("[handleNewChat] Agent not connected", {
        connected,
        hasStub: !!agent.stub
      });
      toasts.add({
        title: "Not connected",
        description: "Please wait for connection...",
        timeout: 3000
      });
      return;
    }

    try {
      console.log("[handleNewChat] Creating new session...");
      // Create a new session
      const session = await agent.stub.createChatSession();
      console.log("[handleNewChat] Session created:", session);
      setCurrentSessionId(session.id);

      // Clear current chat history
      clearHistory();

      // Switch to chat tab
      setActiveTab("chat");

      toasts.add({
        title: "New chat started",
        description: session.name,
        timeout: 3000
      });
    } catch (error) {
      console.error("[handleNewChat] Failed to create new session:", error);
      toasts.add({
        title: "Failed to start new chat",
        description:
          error instanceof Error ? error.message : "Please try again",
        timeout: 3000
      });
    }
  }, [agent, clearHistory, setActiveTab, toasts, connected]);

  const handleSessionSelect = useCallback(
    async (sessionId: string) => {
      if (!connected || !agent.stub || sessionId === currentSessionId) {
        console.error("[handleSessionSelect] Cannot switch", {
          connected,
          hasStub: !!agent.stub,
          sessionId,
          currentSessionId
        });
        return;
      }

      try {
        console.log("[handleSessionSelect] Switching to session:", sessionId);
        // Set the current session on the server
        const session = await agent.stub.setCurrentSession(sessionId);
        if (session) {
          setCurrentSessionId(sessionId);
          clearHistory();
          setActiveTab("chat");

          toasts.add({
            title: "Switched to chat",
            description: session.name,
            timeout: 2000
          });
        }
      } catch (error) {
        console.error("[handleSessionSelect] Failed to switch session:", error);
        toasts.add({
          title: "Failed to switch chat",
          description:
            error instanceof Error ? error.message : "Please try again",
          timeout: 3000
        });
      }
    },
    [agent, currentSessionId, clearHistory, setActiveTab, toasts, connected]
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const validFiles = Array.from(files).filter(
        (f) => f.type.startsWith("image/") || isDocumentFile(f)
      );
      if (validFiles.length === 0) {
        toasts.add({
          title: "Invalid file type",
          description:
            "Please upload images (.jpg, .png, etc.) or documents (.md, .pdf, .doc, .docx, .txt)",
          timeout: 5000
        });
        return;
      }

      const newAttachments: Attachment[] = [];

      for (const file of validFiles) {
        const attachment = createAttachment(file);

        // For documents, read the content
        if (
          attachment.fileType === "document" &&
          file.type.startsWith("text/")
        ) {
          try {
            attachment.content = await readFileAsText(file);
          } catch (error) {
            console.error("Failed to read document:", error);
          }
        }

        newAttachments.push(attachment);
      }

      setAttachments((prev) => [...prev, ...newAttachments]);

      if (validFiles.length > 0) {
        toasts.add({
          title: "Files added",
          description: `Added ${validFiles.length} file${validFiles.length > 1 ? "s" : ""}`,
          timeout: 3000
        });
      }
    },
    [readFileAsText, toasts]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att) URL.revokeObjectURL(att.preview);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isStreaming) return;
    setInput("");

    // Build the message content
    let messageText = text;

    // Process attachments
    const imageParts: Array<{ type: "file"; mediaType: string; url: string }> =
      [];

    for (const att of attachments) {
      if (att.fileType === "image") {
        // Handle images as before
        const dataUri = await fileToDataUri(att.file);
        imageParts.push({
          type: "file",
          mediaType: att.mediaType,
          url: dataUri
        });
      } else if (att.fileType === "document") {
        // For text-based documents, include content in message for AI to ingest
        if (att.content) {
          const docType = getDocumentType(att.file);
          messageText += messageText ? "\n\n" : "";
          messageText += `---\n**Document: ${att.file.name}** (Type: ${docType})\n\n${att.content}\n---`;
        } else {
          // Binary documents - just mention them in the message
          const docType = getDocumentType(att.file);
          messageText += messageText ? "\n\n" : "";
          messageText += `---\n**Document: ${att.file.name}** (Type: ${docType})\n\nNote: Binary document uploaded for indexing.\n---`;
        }
      }
    }

    // Note: Text documents are ingested by the AI via the ingestDocument tool
    // when it sees the document content in the message above

    const parts: Array<
      | { type: "text"; text: string }
      | { type: "file"; mediaType: string; url: string }
    > = [];

    if (messageText) parts.push({ type: "text", text: messageText });
    parts.push(...imageParts);

    for (const att of attachments) {
      if (att.preview) URL.revokeObjectURL(att.preview);
    }
    setAttachments([]);

    sendMessage({ role: "user", parts });
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, attachments, isStreaming, sendMessage, agent]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !connected) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const result = await agent.stub.queryWiki(
        searchQuery.trim(),
        "hybrid",
        10
      );
      setSearchResults(result.results || []);

      // Refresh suggestions after search to include this query
      try {
        const newSuggestions = await agent.stub.getSearchSuggestions();
        setSearchSuggestions(newSuggestions);
      } catch {
        // Silently fail - suggestions are nice-to-have
      }
    } catch (error) {
      console.error("[Search] Failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, connected, agent]);

  return (
    <div
      className="flex h-screen"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Chat History Sidebar */}
      <ChatHistorySidebar
        agent={agent}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
        connected={connected}
      />
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Drag Overlay */}
        {isDragging && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-warm-gray-800)]/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-12 shadow-2xl flex flex-col items-center gap-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <ImageIcon
                  size={48}
                  className="text-[var(--color-warm-gray-400)]"
                />
                <span className="text-3xl text-[var(--color-warm-gray-400)]">
                  +
                </span>
                <PaperclipIcon
                  size={48}
                  className="text-[var(--color-warm-gray-400)]"
                />
              </div>
              <span className="text-xl font-medium">Drop files here</span>
              <p className="text-sm text-[var(--color-warm-gray-500)]">
                Images (.jpg, .png, .gif) or Documents (.md, .pdf, .doc, .docx,
                .txt)
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="calm-header px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            {/* Logo - Fixed width */}
            <div className="flex items-center gap-3 w-[120px]">
              <h1 className="text-xl font-semibold tracking-tight">
                wiki-agent
              </h1>
            </div>

            {/* Tabs - Prominent - Centered */}
            <div className="flex items-center justify-center bg-[var(--bg-tertiary)] rounded-lg p-1">
              <button
                onClick={() => setActiveTab("chat")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-md font-medium text-sm transition-all duration-200 ${
                  activeTab === "chat"
                    ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <ChatCircleDotsIcon
                  size={18}
                  weight={activeTab === "chat" ? "fill" : "regular"}
                />
                Chat
              </button>
              <button
                onClick={() => setActiveTab("search")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-md font-medium text-sm transition-all duration-200 ${
                  activeTab === "search"
                    ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <MagnifyingGlassIcon
                  size={18}
                  weight={activeTab === "search" ? "fill" : "regular"}
                />
                Search
              </button>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* <ConnectionIndicator connected={connected} /> */}
              {/* <div className="flex items-center gap-2">
              <BugIcon
                size={14}
                className="text-[var(--color-warm-gray-400)]"
              />
              <Switch
                checked={showDebug}
                onCheckedChange={setShowDebug}
                size="sm"
              />
            </div> */}
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {activeTab === "chat" ? (
            <div className="h-full flex flex-col max-w-3xl mx-auto px-6">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto scrollbar-hide py-6 space-y-6">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center max-w-md empty-calm">
                      <BooksIcon
                        size={48}
                        className="mx-auto mb-4 opacity-50"
                      />
                      <h2 className="text-2xl font-medium mb-2">
                        Start a conversation
                      </h2>
                      <p className="mb-6">
                        Ask questions about your wiki or add new knowledge.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {[
                          {
                            text: "Search my wiki",
                            description: "Find anything in your knowledge base"
                          },
                          {
                            text: "Save a journal entry",
                            description:
                              "Record thoughts, reflections, or daily notes"
                          },
                          {
                            text: "Upload and index a document",
                            description: "Add files to make them searchable"
                          }
                        ].map((prompt) => (
                          <button
                            key={prompt.text}
                            onClick={() =>
                              sendMessage({
                                role: "user",
                                parts: [{ type: "text", text: prompt.text }]
                              })
                            }
                            disabled={isStreaming}
                            className="suggestion-pill px-4 py-2"
                            title={prompt.description}
                          >
                            {prompt.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((message: UIMessage, index: number) => {
                      const isUser = message.role === "user";
                      const isLastAssistant =
                        message.role === "assistant" &&
                        index === messages.length - 1;

                      return (
                        <div
                          key={message.id}
                          className="animate-fade-in"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          {showDebug && (
                            <pre className="text-[10px] text-[var(--color-warm-gray-400)] bg-[var(--color-warm-gray-50)] rounded-lg p-3 mb-2 overflow-auto max-h-40 font-mono">
                              {JSON.stringify(message, null, 2)}
                            </pre>
                          )}

                          {message.parts.filter(isToolUIPart).map((part) => (
                            <ToolPartView
                              key={part.toolCallId}
                              part={part}
                              addToolApprovalResponse={addToolApprovalResponse}
                            />
                          ))}

                          {message.parts
                            .filter(
                              (part) =>
                                part.type === "reasoning" &&
                                (part as { text?: string }).text?.trim()
                            )
                            .map((part, i) => {
                              const reasoning = part as {
                                type: "reasoning";
                                text: string;
                                state?: "streaming" | "done";
                              };
                              const isDone =
                                reasoning.state === "done" || !isStreaming;
                              return (
                                <div
                                  key={i}
                                  className="flex justify-start mb-4"
                                >
                                  <details
                                    className="max-w-[85%] w-full"
                                    open={!isDone}
                                  >
                                    <summary className="flex items-center gap-2 cursor-pointer px-4 py-3 reasoning-box">
                                      <BrainIcon size={16} />
                                      <span className="font-medium">
                                        Thinking
                                      </span>
                                      <Badge
                                        variant={
                                          isDone ? "secondary" : "primary"
                                        }
                                        className="text-xs ml-auto"
                                      >
                                        {isDone ? "Complete" : "In progress"}
                                      </Badge>
                                    </summary>
                                    <pre className="mt-2 px-4 py-3 bg-[var(--color-warm-gray-50)] text-xs text-[var(--color-warm-gray-600)] whitespace-pre-wrap font-mono">
                                      {reasoning.text}
                                    </pre>
                                  </details>
                                </div>
                              );
                            })}

                          {message.parts
                            .filter(
                              (
                                part
                              ): part is Extract<
                                typeof part,
                                { type: "file" }
                              > =>
                                part.type === "file" &&
                                (
                                  part as { mediaType?: string }
                                ).mediaType?.startsWith("image/") === true
                            )
                            .map((part, i) => (
                              <div
                                key={i}
                                className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
                              >
                                <img
                                  src={part.url}
                                  alt="Attachment"
                                  className="max-h-64 rounded-lg shadow-sm"
                                />
                              </div>
                            ))}

                          {message.parts
                            .filter((part) => part.type === "text")
                            .map((part, i) => {
                              const text = (
                                part as { type: "text"; text: string }
                              ).text;
                              if (!text) return null;

                              if (isUser) {
                                return (
                                  <div
                                    key={i}
                                    className="flex justify-end mb-4"
                                  >
                                    <div className="max-w-[80%] message-user px-5 py-3 text-[15px] leading-relaxed">
                                      {text}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={i}
                                  className="flex justify-start mb-4"
                                >
                                  <div className="max-w-[80%] message-assistant">
                                    <Streamdown
                                      className="sd-theme rounded-lg p-5"
                                      plugins={{ code }}
                                      controls={false}
                                      isAnimating={
                                        isLastAssistant && isStreaming
                                      }
                                    >
                                      {text}
                                    </Streamdown>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="py-4">
                <div className="calm-input p-2">
                  {attachments.length > 0 && (
                    <div className="flex gap-2 px-3 pt-2 pb-3 overflow-x-auto">
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className="relative group flex-shrink-0"
                        >
                          {att.fileType === "image" ? (
                            <img
                              src={att.preview}
                              alt={att.file.name}
                              className="h-14 w-14 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="h-14 w-14 flex flex-col items-center justify-center bg-[var(--color-warm-gray-100)] rounded-lg border border-[var(--color-warm-gray-200)]">
                              <PaperclipIcon
                                size={20}
                                className="text-[var(--color-warm-gray-500)]"
                              />
                              <span className="text-[8px] text-[var(--color-warm-gray-500)] mt-1 uppercase font-medium">
                                {getDocumentType(att.file)}
                              </span>
                            </div>
                          )}
                          <span className="absolute -bottom-4 left-0 right-0 text-[10px] text-center text-[var(--color-warm-gray-500)] truncate max-w-[56px]">
                            {att.file.name.length > 8
                              ? att.file.name.slice(0, 6) + ".."
                              : att.file.name}
                          </span>
                          <button
                            onClick={() => removeAttachment(att.id)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[var(--color-warm-gray-800)] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <XIcon size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 p-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!connected || isStreaming}
                      className="p-3 rounded-lg hover:bg-[var(--color-warm-gray-100)] text-[var(--color-warm-gray-500)] transition-colors flex items-center justify-center"
                    >
                      <PaperclipIcon size={20} />
                    </button>

                    {/* Voice input button - Cloudflare voice */}
                    <button
                      onClick={isListening ? stopVoiceInput : startVoiceInput}
                      disabled={!connected || isStreaming}
                      className={`p-3 rounded-lg transition-colors flex items-center justify-center relative ${
                        isListening
                          ? "bg-red-100 text-red-600"
                          : "hover:bg-[var(--color-warm-gray-100)] text-[var(--color-warm-gray-500)]"
                      }`}
                      title={
                        isListening ? "Stop recording" : "Start voice input"
                      }
                    >
                      <MicrophoneIcon size={20} />
                      {/* Audio level indicator when listening */}
                      {isListening && audioLevel > 0.1 && (
                        <span
                          className="absolute inset-0 rounded-lg border-2 border-red-400 animate-pulse"
                          style={{ opacity: Math.min(1, audioLevel * 2) }}
                        />
                      )}
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.md,.txt,.pdf,.doc,.docx,.odt"
                      className="hidden"
                      onChange={(e) =>
                        e.target.files && addFiles(e.target.files)
                      }
                    />

                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                        placeholder={
                          isListening ? "Listening..." : "Send a message..."
                        }
                        disabled={!connected || isStreaming}
                        rows={1}
                        className="w-full px-4 py-3 bg-transparent resize-none outline-none scrollbar-hide text-[var(--color-warm-gray-800)] placeholder:text-[var(--color-warm-gray-400)]"
                        style={{ minHeight: "48px", maxHeight: "120px" }}
                      />
                      {/* Interim transcription overlay */}
                      {isListening && voiceInterimTranscript && (
                        <div className="absolute inset-0 px-4 py-3 pointer-events-none bg-[var(--color-cream)] text-[var(--color-warm-gray-800)] flex items-center rounded-lg">
                          <span className="truncate">
                            {voiceInterimTranscript}
                          </span>
                          <span className="inline-block w-0.5 h-5 bg-[var(--color-warm-gray-800)] ml-1 animate-pulse" />
                        </div>
                      )}
                    </div>

                    {isStreaming ? (
                      <button
                        onClick={stop}
                        className="p-3 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                      >
                        <StopIcon size={20} />
                      </button>
                    ) : (
                      <button
                        onClick={send}
                        disabled={
                          (!input.trim() && attachments.length === 0) ||
                          !connected
                        }
                        className="p-3 rounded-lg btn-calm disabled:opacity-50"
                      >
                        <PaperPlaneRightIcon size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Search Tab */
            <div className="h-full flex flex-col max-w-3xl mx-auto px-6">
              {!hasSearched ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="text-center max-w-xl">
                    <BooksIcon
                      size={48}
                      className="mx-auto mb-6 text-[var(--color-warm-gray-300)]"
                    />
                    <h2 className="text-2xl font-medium mb-3">
                      Search your wiki
                    </h2>
                    <p className="text-[var(--color-warm-gray-500)] mb-8">
                      Find anything in your knowledge base
                    </p>

                    <div className="calm-input p-2 flex gap-2 max-w-2xl mx-auto">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="What are you looking for?"
                        disabled={!connected || isSearching}
                        className="flex-1 px-4 py-3  outline-none text-lg placeholder:text-[var(--color-warm-gray-400)]"
                      />
                      <button
                        onClick={handleSearch}
                        disabled={
                          !connected || isSearching || !searchQuery.trim()
                        }
                        className="px-6 py-3 rounded-lg btn-calm disabled:opacity-50 flex items-center gap-2"
                      >
                        <MagnifyingGlassIcon size={20} />
                        <span>{isSearching ? "Searching..." : "Search"}</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap justify-center gap-2 mt-8">
                      {isLoadingSuggestions ? (
                        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                          <div className="w-4 h-4 border-2 border-[var(--text-tertiary)] border-t-transparent rounded-full animate-spin" />
                          Loading suggestions...
                        </div>
                      ) : searchSuggestions.length > 0 ? (
                        searchSuggestions.slice(0, 4).map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => {
                              setSearchQuery(suggestion);
                              setTimeout(handleSearch, 100);
                            }}
                            className="suggestion-pill px-4 py-2"
                          >
                            {suggestion}
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-[var(--text-tertiary)]">
                          No suggestions yet. Start indexing documents to get
                          personalized suggestions.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col py-6">
                  {/* Search Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 calm-input p-2 flex gap-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Search..."
                        className="flex-1 px-4 py-2 bg-transparent outline-none"
                      />
                      <button
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="px-4 py-2 rounded-lg btn-calm disabled:opacity-50"
                      >
                        <MagnifyingGlassIcon size={18} />
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setHasSearched(false);
                        setSearchResults([]);
                        setSearchQuery("");
                      }}
                      className="px-4 py-2 rounded-lg btn-secondary"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Results */}
                  <div className="mb-4">
                    <span className="text-sm text-[var(--color-warm-gray-600)]">
                      {searchResults.length} result
                      {searchResults.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3">
                    {isSearching ? (
                      <SearchSkeleton count={3} />
                    ) : searchResults.length === 0 ? (
                      <div className="text-center py-12 text-[var(--color-warm-gray-400)]">
                        <MagnifyingGlassIcon
                          size={48}
                          className="mx-auto mb-4 opacity-50"
                        />
                        <p>No results found. Try a different query.</p>
                      </div>
                    ) : (
                      searchResults.map((result, index) => (
                        <SearchResultCard
                          key={result.id}
                          result={result}
                          index={index}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>{" "}
      {/* End of Main Content */}
    </div> /* End of flex container */
  );
}

// ── App Wrapper ───────────────────────────────────────────────────────

export default function App() {
  return (
    <Toasty>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen bg-[var(--color-cream)]">
            <div className="text-center text-[var(--color-warm-gray-500)]">
              <p>Loading...</p>
            </div>
          </div>
        }
      >
        <Chat />
      </Suspense>
    </Toasty>
  );
}
