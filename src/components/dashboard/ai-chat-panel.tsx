"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { PanelLeft, X, Plus, Trash2, User, Sparkles, ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolInvocationCard } from "./tool-invocation-card";
import {
  listConversations,
  createConversation,
  loadConversationMessages,
  deleteConversation,
} from "@/app/actions/conversations";

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: Date;
}

interface AiChatPanelProps {
  documentId: string;
  currentPage: number;
  attachment: string | null;
  onClearAttachment: () => void;
  onClose: () => void;
  onPageClick?: (page: number) => void;
}

export function AiChatPanel({ documentId, currentPage, attachment, onClearAttachment, onClose, onPageClick }: AiChatPanelProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [view, setView] = useState<"chat" | "list">("chat");
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeConvIdRef = useRef(activeConversationId);
  activeConvIdRef.current = activeConversationId;
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const creatingRef = useRef(false);

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/documents/${documentId}/chat`,
      body: () => ({
        conversationId: activeConvIdRef.current,
        currentPage: currentPageRef.current,
      }),
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  const activeTitle = activeConversationId
    ? conversations.find((c) => c.id === activeConversationId)?.title
    : null;

  useEffect(() => {
    listConversations(documentId).then(setConversations).catch(() => {});
  }, [documentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.3) + "px";
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [inputValue, resizeTextarea]);

  async function handleCreateConversation(): Promise<string> {
    const conv = await createConversation(documentId);
    setActiveConversationId(conv.id);
    activeConvIdRef.current = conv.id;
    setConversations((prev) => [conv, ...prev]);
    return conv.id;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading || creatingRef.current) return;

    const text = inputValue.trim();

    let convId = activeConvIdRef.current;
    if (!convId) {
      creatingRef.current = true;
      setIsCreating(true);
      try {
        convId = await handleCreateConversation();
      } finally {
        creatingRef.current = false;
        setIsCreating(false);
      }
    }

    const isFirstMessage = messages.length === 0;
    if (isFirstMessage) {
      const optimisticTitle = text.slice(0, 80);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, title: optimisticTitle } : c,
        ),
      );
    }

    const files: Array<{ type: "file"; mediaType: string; url: string }> | undefined =
      attachment
        ? [{ type: "file", mediaType: "image/png", url: attachment }]
        : undefined;

    sendMessage({ text, files });
    setInputValue("");
    if (attachment) onClearAttachment();
  }

  async function handleLoadConversation(convId: string) {
    setActiveConversationId(convId);
    activeConvIdRef.current = convId;
    setView("chat");

    try {
      const data = await loadConversationMessages(documentId, convId);
      setMessages(
        data.messages.map(
          (m: { id: string; role: string; content: string; parts?: unknown }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            parts: m.parts
              ? (typeof m.parts === "string" ? JSON.parse(m.parts) : m.parts)
              : [{ type: "text" as const, text: m.content }],
          }),
        ),
      );
    } catch {
      // Load failure — keep empty
    }
  }

  async function handleDeleteConversation(convId: string) {
    try {
      await deleteConversation(documentId, convId);
    } catch {
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeConversationId === convId) {
      setActiveConversationId(null);
      activeConvIdRef.current = null;
      setMessages([]);
    }
  }

  function startNewConversation() {
    setActiveConversationId(null);
    activeConvIdRef.current = null;
    setMessages([]);
    setView("chat");
  }

  function getMessageText(msg: (typeof messages)[number]): string {
    return (
      msg.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("") || ""
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const isBusy = isLoading || isCreating;

  return (
    <div className="flex w-96 flex-col border-l border-border bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setView(view === "list" ? "chat" : "list")}
            title="Toggle history"
          >
            <PanelLeft className="size-4" />
          </Button>
          <span className="truncate text-sm font-medium text-foreground">
            {activeTitle || "New conversation"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          title="Close"
        >
          <X className="size-4" />
        </Button>
      </div>

      {view === "list" ? (
        /* Conversation list */
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            <Button
              variant="outline"
              onClick={startNewConversation}
              className="w-full border-dashed"
            >
              <Plus className="size-4" />
              New conversation
            </Button>
          </div>
          {conversations.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No conversations yet
            </p>
          ) : (
            <ul>
              {conversations.map((conv) => (
                <li
                  key={conv.id}
                  className={`group flex cursor-pointer items-center gap-2 border-b border-border px-4 py-3 transition-colors hover:bg-muted ${
                    activeConversationId === conv.id ? "border-l-2 border-l-primary bg-muted" : ""
                  }`}
                  onClick={() => handleLoadConversation(conv.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {conv.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    title="Delete"
                    className="opacity-0 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* Chat view — notebook-style */
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && !isCreating ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Sparkles className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Ask a question about this document
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    AI will use the document content to answer
                  </p>
                </div>
              </div>
            ) : (
              <div>
                {messages.map((msg, i) => (
                  <div
                    key={msg.id}
                    className={i > 0 ? "mt-6" : ""}
                  >
                    {/* Message header */}
                    <div className="mb-1.5 flex items-center gap-1.5">
                      {msg.role === "user" ? (
                        <User className="size-3.5 text-muted-foreground" />
                      ) : (
                        <Sparkles className="size-3.5 text-primary" />
                      )}
                      <span className="text-xs font-semibold text-muted-foreground">
                        {msg.role === "user" ? "You" : "Assistant"}
                      </span>
                    </div>
                    {/* Message content */}
                    {msg.role === "assistant" ? (
                      <>
                        {msg.parts?.map((part, idx) => {
                          if (part.type === "text") {
                            const text = (part as { type: "text"; text: string }).text;
                            if (!text) return null;
                            return <MarkdownRenderer key={idx} content={text} onPageClick={onPageClick} />;
                          }
                          if (
                            part.type?.startsWith("tool-") ||
                            part.type === "dynamic-tool"
                          ) {
                            return (
                              <ToolInvocationCard
                                key={idx}
                                part={part as Parameters<typeof ToolInvocationCard>[0]["part"]}
                              />
                            );
                          }
                          return null;
                        })}
                      </>
                    ) : (
                      <>
                        {msg.parts
                          ?.filter((p) => p.type === "file")
                          .map((p, idx) => (
                            <img
                              key={`file-${idx}`}
                              src={(p as { type: "file"; url: string }).url}
                              alt="PDF selection"
                              className="mb-1 h-24 w-auto rounded-md border border-border object-contain"
                            />
                          ))}
                        <p className="text-sm leading-relaxed text-foreground">
                          {getMessageText(msg)}
                        </p>
                      </>
                    )}
                  </div>
                ))}
                {(isLoading || isCreating) &&
                  (messages.length === 0 ||
                    messages[messages.length - 1].role === "user") && (
                    <div className="mt-6">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-primary" />
                        <span className="text-xs font-semibold text-muted-foreground">
                          Assistant
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        {isCreating ? "Starting conversation..." : "Thinking..."}
                      </div>
                    </div>
                  )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-border p-3">
            {attachment && (
              <div className="mb-2">
                <div className="relative inline-block">
                  <img
                    src={attachment}
                    alt="PDF selection"
                    className="h-20 w-auto rounded-md border border-border object-contain"
                  />
                  <button
                    onClick={onClearAttachment}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-white text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this document..."
                rows={3}
                disabled={isBusy}
                className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              />
              <Button
                size="icon-sm"
                disabled={isBusy || !inputValue.trim()}
                onClick={() => handleSubmit()}
                className="shrink-0 rounded-full"
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
