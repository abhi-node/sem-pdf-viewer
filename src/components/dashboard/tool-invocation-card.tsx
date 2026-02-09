"use client";

import { Search, Check, X, Loader2 } from "lucide-react";

interface ToolInvocationPart {
  type: string;
  toolCallId: string;
  toolName?: string;
  state: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}

export function ToolInvocationCard({ part }: { part: ToolInvocationPart }) {
  const toolName = part.toolName || part.type.replace("tool-", "");
  const state = part.state;

  // Derive display label from tool name + input
  let label = "Searching...";
  if (toolName === "pageSearch" && part.input?.page != null) {
    label = `Searching page ${part.input.page}`;
  } else if (toolName === "semanticSearch" && part.input?.query) {
    label = `Searching for "${part.input.query}"`;
  }

  const isLoading = state === "input-streaming" || state === "input-available";
  const isDone = state === "output-available";
  const isError = state === "output-error";

  return (
    <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
      <Search className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {isLoading && <Loader2 className="size-3.5 shrink-0 animate-spin" />}
      {isDone && <Check className="size-3.5 shrink-0 text-primary" />}
      {isError && <X className="size-3.5 shrink-0 text-destructive" />}
    </div>
  );
}
