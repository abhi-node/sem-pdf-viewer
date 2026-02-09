"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { FileText } from "lucide-react";
import { DocumentSidebar } from "./document-sidebar";
import { AiChatPanel } from "./ai-chat-panel";
import { useIngestionPolling } from "./use-ingestion-polling";

const PdfViewer = dynamic(
  () => import("./pdf-viewer").then((mod) => mod.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading viewer...</p>
      </div>
    ),
  },
);

export interface DocumentRecord {
  id: string;
  userId: string;
  title: string;
  filename: string;
  fileSize: number;
  lastPage: number;
  ingestionStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DashboardShellProps {
  user: { name: string; email: string };
  initialDocuments: DocumentRecord[];
}

export function DashboardShell({ user, initialDocuments }: DashboardShellProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>(initialDocuments);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectionImage, setSelectionImage] = useState<string | null>(null);
  const [goToPage, setGoToPage] = useState<number | undefined>();

  const selectedDocument = documents.find((d) => d.id === selectedId) ?? null;

  useIngestionPolling(documents, (id, status) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ingestionStatus: status } : d)),
    );
  });

  async function handleUpload(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/documents", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Upload failed");
    }

    const created: DocumentRecord = await res.json();
    created.createdAt = new Date(created.createdAt);
    created.updatedAt = new Date(created.updatedAt);
    setDocuments((prev) => [created, ...prev]);
    setSelectedId(created.id);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/documents/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Delete failed");
    }

    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setShowAiPanel(false);
    }
  }

  async function handleRename(id: string, title: string) {
    const res = await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Rename failed");
    }

    const updated: DocumentRecord = await res.json();
    updated.createdAt = new Date(updated.createdAt);
    updated.updatedAt = new Date(updated.updatedAt);
    setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
  }

  async function handlePageChange(page: number) {
    if (!selectedId) return;
    setCurrentPage(page);
    setDocuments((prev) =>
      prev.map((d) => (d.id === selectedId ? { ...d, lastPage: page } : d)),
    );
    try {
      await fetch(`/api/documents/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastPage: page }),
      });
    } catch {
      // Page position is non-critical
    }
  }

  function handleCitationClick(page: number) {
    setCurrentPage(page);
    setGoToPage(page);
  }

  return (
    <>
      <DocumentSidebar
        user={user}
        documents={documents}
        selectedId={selectedId}
        onSelect={(id) => {
          if (id !== selectedId) {
            setShowAiPanel(false);
            setSelectionImage(null);
          }
          const doc = documents.find((d) => d.id === id);
          if (doc) setCurrentPage(doc.lastPage);
          setSelectedId(id);
        }}
        onUpload={handleUpload}
        onDelete={handleDelete}
        onRename={handleRename}
      />
      <main className="flex-1 overflow-hidden bg-white">
        {selectedDocument ? (
          <PdfViewer
            key={selectedDocument.id}
            documentId={selectedDocument.id}
            title={selectedDocument.title}
            initialPage={selectedDocument.lastPage}
            onPageChange={handlePageChange}
            ingestionStatus={selectedDocument.ingestionStatus}
            onToggleAi={() => setShowAiPanel((v) => !v)}
            showAiToggle={selectedDocument.ingestionStatus === "ready"}
            onSelectionCapture={(base64) => setSelectionImage(base64)}
            onClearSelection={() => setSelectionImage(null)}
            selectionActive={selectionImage !== null}
            goToPage={goToPage}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <FileText className="mx-auto size-16 text-muted-foreground/30" />
              <p className="mt-4 text-lg font-medium tracking-tight text-foreground">
                No document selected
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload a PDF or select one from the sidebar
              </p>
            </div>
          </div>
        )}
      </main>
      {showAiPanel && selectedDocument && (
        <AiChatPanel
          key={selectedDocument.id}
          documentId={selectedDocument.id}
          currentPage={currentPage}
          attachment={selectionImage}
          onClearAttachment={() => setSelectionImage(null)}
          onPageClick={handleCitationClick}
          onClose={() => setShowAiPanel(false)}
        />
      )}
    </>
  );
}
