import { Suspense, useCallback, useState, useEffect, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { MCPServersState } from "agents";
import type { ChatAgent } from "./server";
import { Badge, Button, Switch } from "@cloudflare/kumo";
import { Toasty, useKumoToastManager } from "@cloudflare/kumo/components/toast";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import {
  PaperPlaneRightIcon,
  StopIcon,
  TrashIcon,
  ChatCircleDotsIcon,
  MoonIcon,
  SunIcon,
  CheckCircleIcon,
  XCircleIcon,
  BrainIcon,
  BugIcon,
  XIcon,
  PaperclipIcon,
  ImageIcon,
  MagnifyingGlassIcon,
  BooksIcon
} from "@phosphor-icons/react";

// ── Types ─────────────────────────────────────────────────────────────

interface Attachment {
  id: string;
  file: File;
  preview: string;
  mediaType: string;
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

function createAttachment(file: File): Attachment {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    preview: URL.createObjectURL(file),
    mediaType: file.type || "application/octet-stream"
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

function ConnectionIndicator({ connected }: { connected: boolean }) {
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
  const [showDebug, setShowDebug] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "search">("chat");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchDebug, setSearchDebug] = useState<string[]>([]);
  const [showSearchDebug, setShowSearchDebug] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toasts = useKumoToastManager();

  // Agent setup
  const agent = useAgent<ChatAgent>({
    agent: "ChatAgent",
    onOpen: useCallback(() => setConnected(true), []),
    onClose: useCallback(() => setConnected(false), []),
    onError: useCallback(
      (error: Event) => console.error("WebSocket error:", error),
      []
    ),
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

  // Effects
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  // Handlers
  const addFiles = useCallback((files: FileList | File[]) => {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setAttachments((prev) => [...prev, ...images.map(createAttachment)]);
  }, []);

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

    const parts: Array<
      | { type: "text"; text: string }
      | { type: "file"; mediaType: string; url: string }
    > = [];
    if (text) parts.push({ type: "text", text });

    for (const att of attachments) {
      const dataUri = await fileToDataUri(att.file);
      parts.push({ type: "file", mediaType: att.mediaType, url: dataUri });
    }

    for (const att of attachments) URL.revokeObjectURL(att.preview);
    setAttachments([]);

    sendMessage({ role: "user", parts });
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, attachments, isStreaming, sendMessage]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !connected) return;
    setIsSearching(true);
    setHasSearched(true);
    const debug: string[] = [];
    debug.push(`[Search] Query: "${searchQuery.trim()}"`);
    debug.push(`[Search] Connected: ${connected}`);
    debug.push(`[Search] Agent stub: ${!!agent.stub}`);
    try {
      debug.push("[Search] Calling agent.stub.queryWiki...");
      const result = await agent.stub.queryWiki(
        searchQuery.trim(),
        "hybrid",
        10
      );
      debug.push(
        `[Search] Response received: ${JSON.stringify(result, null, 2)}`
      );
      debug.push(`[Search] Total results: ${result.totalResults}`);
      debug.push(`[Search] Results count: ${result.results?.length || 0}`);
      if (result.error) {
        debug.push(`[Search] ERROR: ${result.error}`);
      }
      setSearchResults(result.results || []);
    } catch (error) {
      debug.push(`[Search] EXCEPTION: ${error}`);
      console.error("[Search] Failed:", error);
      setSearchResults([]);
    } finally {
      setSearchDebug(debug);
      setIsSearching(false);
    }
  }, [searchQuery, connected, agent]);

  return (
    <div
      className="flex flex-col h-screen"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-warm-gray-800)]/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-12 shadow-2xl flex flex-col items-center gap-4 animate-fade-in">
            <ImageIcon
              size={48}
              className="text-[var(--color-warm-gray-400)]"
            />
            <span className="text-xl font-medium">Drop images here</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="calm-header px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">wiki-agent</h1>
          </div>

          {/* Tabs - Prominent */}
          <div className="flex items-center bg-[var(--bg-tertiary)] rounded-lg p-1">
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
            <ConnectionIndicator connected={connected} />
            <div className="flex items-center gap-2">
              <BugIcon
                size={14}
                className="text-[var(--color-warm-gray-400)]"
              />
              <Switch
                checked={showDebug}
                onCheckedChange={setShowDebug}
                size="sm"
              />
            </div>
            <ThemeToggle />
            <button
              onClick={clearHistory}
              className="p-2 rounded-lg hover:bg-[var(--color-warm-gray-100)] transition-colors"
              title="Clear conversation"
            >
              <TrashIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "chat" ? (
          <div className="h-full flex flex-col max-w-3xl mx-auto px-6">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-6 space-y-6">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-md empty-calm">
                    <BooksIcon size={48} className="mx-auto mb-4 opacity-50" />
                    <h2 className="text-lg font-medium mb-2">
                      Start a conversation
                    </h2>
                    <p className="text-sm mb-6">
                      Ask questions about your wiki or add new knowledge.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {[
                        "Journal today's insights",
                        "Find my notes on ML",
                        "Ingest an article",
                        "What did I learn last week?"
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() =>
                            sendMessage({
                              role: "user",
                              parts: [{ type: "text", text: prompt }]
                            })
                          }
                          disabled={isStreaming}
                          className="suggestion-pill px-4 py-2"
                        >
                          {prompt}
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
                              <div key={i} className="flex justify-start mb-4">
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
                                      variant={isDone ? "secondary" : "primary"}
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
                            ): part is Extract<typeof part, { type: "file" }> =>
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
                                <div key={i} className="flex justify-end mb-4">
                                  <div className="max-w-[80%] message-user px-5 py-3 text-[15px] leading-relaxed">
                                    {text}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={i} className="flex justify-start mb-4">
                                <div className="max-w-[80%] message-assistant">
                                  <Streamdown
                                    className="sd-theme rounded-lg p-5"
                                    plugins={{ code }}
                                    controls={false}
                                    isAnimating={isLastAssistant && isStreaming}
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
                        <img
                          src={att.preview}
                          alt={att.file.name}
                          className="h-14 w-14 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removeAttachment(att.id)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[var(--color-warm-gray-800)] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XIcon size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 p-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!connected || isStreaming}
                    className="p-3 rounded-lg hover:bg-[var(--color-warm-gray-100)] text-[var(--color-warm-gray-500)] transition-colors"
                  >
                    <PaperclipIcon size={20} />
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                  />

                  <div className="flex-1">
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
                      placeholder="Send a message..."
                      disabled={!connected || isStreaming}
                      rows={1}
                      className="w-full px-4 py-3 bg-transparent resize-none outline-none text-[var(--color-warm-gray-800)] placeholder:text-[var(--color-warm-gray-400)]"
                      style={{ minHeight: "48px", maxHeight: "120px" }}
                    />
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
                    {[
                      "machine learning",
                      "journal entries",
                      "project notes",
                      "meeting summaries"
                    ].map((suggestion) => (
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
                    ))}
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
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm text-[var(--color-warm-gray-600)]">
                    {searchResults.length} result
                    {searchResults.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => setShowSearchDebug(!showSearchDebug)}
                    className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] opacity-30 hover:opacity-100 transition-opacity"
                    title="Toggle debug info"
                  >
                    [debug]
                  </button>
                </div>

                {/* Debug Panel */}
                {showSearchDebug && searchDebug.length > 0 && (
                  <div className="mb-4 p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]">
                    <div className="text-xs font-medium mb-2 text-[var(--text-secondary)]">
                      Debug Info:
                    </div>
                    <pre className="text-[10px] text-[var(--text-tertiary)] overflow-auto max-h-32 font-mono whitespace-pre-wrap">
                      {searchDebug.join("\n")}
                    </pre>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-3">
                  {searchResults.length === 0 ? (
                    <div className="text-center py-12 text-[var(--color-warm-gray-400)]">
                      <MagnifyingGlassIcon
                        size={48}
                        className="mx-auto mb-4 opacity-50"
                      />
                      <p>No results found. Try a different query.</p>
                    </div>
                  ) : (
                    searchResults.map((result, index) => (
                      <div
                        key={result.id}
                        className="result-item p-5 animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-sm text-[var(--color-warm-gray-500)] font-mono">
                            {result.source}
                          </span>
                          <span className="score-badge">
                            {(result.overallScore * 100).toFixed(0)}% match
                          </span>
                        </div>
                        <p className="text-[var(--color-warm-gray-700)] leading-relaxed whitespace-pre-wrap">
                          {result.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
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
