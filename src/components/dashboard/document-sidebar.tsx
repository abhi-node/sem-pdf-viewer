"use client";

import { useRef, useState } from "react";
import { signOut } from "@/lib/auth-client";
import { Upload, Pencil, Trash2, FileText, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DocumentRecord } from "./dashboard-shell";
import { ProgressRing } from "./progress-ring";

interface DocumentSidebarProps {
  user: { name: string; email: string };
  documents: DocumentRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, title: string) => Promise<void>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentSidebar({
  user,
  documents,
  selectedId,
  onSelect,
  onUpload,
  onDelete,
  onRename,
}: DocumentSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function startRename(doc: DocumentRecord) {
    setRenamingId(doc.id);
    setRenameValue(doc.title);
  }

  async function submitRename(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    try {
      await onRename(id, trimmed);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Rename failed");
    }
    setRenamingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await onDelete(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <aside className="flex w-72 flex-col border-r border-border bg-white">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/login"; } } })}
            title="Sign out"
          >
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Upload */}
      <div className="border-b border-border p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        {uploading ? (
          <div className="w-full rounded-md border border-primary/30 bg-primary/5 px-4 py-2">
            <p className="mb-1.5 text-center text-sm font-medium text-primary">
              Uploading...
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-primary/20">
              <div className="h-full w-1/3 animate-indeterminate rounded-full bg-primary" />
            </div>
          </div>
        ) : (
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="w-full"
          >
            <Upload className="size-4" />
            Upload PDF
          </Button>
        )}
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <FileText className="mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No documents yet</p>
          </div>
        ) : (
          <ul>
            {documents.map((doc) => (
              <li key={doc.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(doc.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSelect(doc.id);
                    if (e.key === " ") {
                      e.preventDefault();
                      onSelect(doc.id);
                    }
                  }}
                  className={`group flex w-full cursor-pointer items-start gap-2 border-b border-border px-4 py-3 text-left transition-colors ${
                    selectedId === doc.id
                      ? "border-l-2 border-l-primary bg-muted"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    {renamingId === doc.id ? (
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRename(doc.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        onBlur={() => submitRename(doc.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 text-sm"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        {doc.ingestionStatus !== "ready" && (
                          <ProgressRing
                            status={doc.ingestionStatus}
                            size={18}
                            strokeWidth={2}
                          />
                        )}
                        <p className="truncate text-sm font-medium text-foreground">
                          {doc.title}
                        </p>
                      </div>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatFileSize(doc.fileSize)}
                      {doc.ingestionStatus !== "ready" && (
                        <span className={doc.ingestionStatus === "failed" ? " text-destructive" : ""}>
                          {" · "}
                          {doc.ingestionStatus === "failed"
                            ? "Failed"
                            : { pending: "Preparing", extracting: "Reading pages", embedding: "Almost ready" }[doc.ingestionStatus] ?? doc.ingestionStatus}
                          {doc.ingestionStatus !== "failed" && "..."}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(doc);
                      }}
                      title="Rename"
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.id);
                      }}
                      title="Delete"
                      className="hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
