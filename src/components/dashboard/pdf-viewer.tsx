"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, Minus, Plus, Sparkles, Crosshair, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressRing } from "./progress-ring";
import { SelectionOverlay, type SelectionRect } from "./selection-overlay";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  documentId: string;
  title: string;
  initialPage: number;
  onPageChange: (page: number) => void;
  ingestionStatus: string;
  onToggleAi: () => void;
  showAiToggle: boolean;
  onSelectionCapture: (base64: string) => void;
  onClearSelection: () => void;
  selectionActive: boolean;
  goToPage?: number;
}

export function PdfViewer({
  documentId,
  title,
  initialPage,
  onPageChange,
  ingestionStatus,
  onToggleAi,
  showAiToggle,
  onSelectionCapture,
  onClearSelection,
  selectionActive,
  goToPage,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.2);
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [pageInputValue, setPageInputValue] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  const onSelectionCaptureRef = useRef(onSelectionCapture);
  onSelectionCaptureRef.current = onSelectionCapture;

  // Clear selection when parent clears the attachment
  useEffect(() => {
    if (!selectionActive) {
      setSelection(null);
    }
  }, [selectionActive]);

  // Clear selection on page change
  useEffect(() => {
    setSelection(null);
  }, [pageNumber]);

  useEffect(() => {
    if (pageNumber === initialPage) return;
    const timer = setTimeout(() => {
      onPageChangeRef.current(pageNumber);
    }, 500);
    return () => clearTimeout(timer);
  }, [pageNumber, initialPage]);

  // Sync from external goToPage prop (e.g. AI citation click)
  useEffect(() => {
    if (goToPage != null && goToPage !== pageNumber) {
      setPageNumber(goToPage);
    }
  }, [goToPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const file = useMemo(
    () => `/api/documents/${documentId}/file`,
    [documentId],
  );

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(Math.min(initialPage, numPages));
  }

  const handleSelectionComplete = useCallback((rect: SelectionRect) => {
    const canvas = pageContainerRef.current?.querySelector(
      "canvas.react-pdf__Page__canvas",
    ) as HTMLCanvasElement | null;
    if (!canvas) return;

    // Account for canvas resolution vs CSS size (devicePixelRatio)
    const scaleX = canvas.width / canvas.clientWidth;
    const scaleY = canvas.height / canvas.clientHeight;

    const sx = rect.x * scaleX;
    const sy = rect.y * scaleY;
    const sw = rect.width * scaleX;
    const sh = rect.height * scaleY;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = sw;
    tempCanvas.height = sh;
    const ctx = tempCanvas.getContext("2d")!;
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    const dataUrl = tempCanvas.toDataURL("image/png");
    onSelectionCaptureRef.current(dataUrl);
    setSelectionMode(false);
  }, []);

  return (
    <div key={documentId} className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-white px-4 py-2">
        <h2 className="truncate text-sm font-medium tracking-tight text-foreground">{title}</h2>

        <div className="flex items-center gap-3">
          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              title="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            {isEditingPage ? (
              <span className="flex items-center text-sm text-muted-foreground">
                <Input
                  autoFocus
                  type="text"
                  value={pageInputValue}
                  onChange={(e) => setPageInputValue(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const parsed = parseInt(pageInputValue, 10);
                      if (!isNaN(parsed)) {
                        setPageNumber(Math.max(1, Math.min(numPages, parsed)));
                      }
                      setIsEditingPage(false);
                    }
                    if (e.key === "Escape") {
                      setIsEditingPage(false);
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseInt(pageInputValue, 10);
                    if (!isNaN(parsed)) {
                      setPageNumber(Math.max(1, Math.min(numPages, parsed)));
                    }
                    setIsEditingPage(false);
                  }}
                  className="h-6 w-12 text-center text-sm"
                />
                <span className="ml-1">/ {numPages || "\u2013"}</span>
              </span>
            ) : (
              <button
                className="rounded-sm px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => {
                  setPageInputValue(String(pageNumber));
                  setIsEditingPage(true);
                }}
                title="Click to jump to page"
              >
                {pageNumber} / {numPages || "\u2013"}
              </button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              title="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
              disabled={scale <= 0.5}
              title="Zoom out"
            >
              <Minus className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setScale(1.2)}
              title="Reset zoom"
            >
              {Math.round(scale * 100)}%
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setScale((s) => Math.min(3, s + 0.2))}
              disabled={scale >= 3}
              title="Zoom in"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          {/* Ingestion status / AI toggle */}
          {ingestionStatus === "failed" && (
            <div className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-3.5" />
              <span>Processing failed</span>
            </div>
          )}
          {ingestionStatus !== "ready" && ingestionStatus !== "failed" && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ProgressRing
                status={ingestionStatus}
                size={16}
                strokeWidth={2}
              />
              <span>
                {{ pending: "Preparing", extracting: "Reading pages", embedding: "Almost ready" }[ingestionStatus] ?? ingestionStatus}...
              </span>
            </div>
          )}
          {showAiToggle && (
            <>
              <Button
                variant={selectionMode ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectionMode((v) => !v)}
                className={selectionMode ? "gap-1.5" : "gap-1.5 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"}
                title="Select region"
              >
                <Crosshair className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleAi}
                className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
              >
                <Sparkles className="size-3.5" />
                AI
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Reading progress bar */}
      {numPages > 0 && (
        <div className="h-0.5 w-full bg-border">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(pageNumber / numPages) * 100}%` }}
          />
        </div>
      )}

      {/* PDF content */}
      <div className="flex-1 overflow-auto bg-muted p-4">
        <div className="flex justify-center">
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex h-96 items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading PDF...</p>
              </div>
            }
            error={
              <div className="flex h-96 items-center justify-center">
                <p className="text-sm text-destructive">Failed to load PDF.</p>
              </div>
            }
          >
            <div ref={pageContainerRef} className="relative inline-block">
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                loading={
                  <div className="flex h-96 items-center justify-center">
                    <p className="text-sm text-muted-foreground">Loading page...</p>
                  </div>
                }
              />
              {selectionMode && (
                <SelectionOverlay
                  selection={selection}
                  onSelectionChange={setSelection}
                  onSelectionComplete={handleSelectionComplete}
                />
              )}
              {!selectionMode && selection && (
                <div
                  className="absolute z-20 border-2 border-red-500 bg-red-500/20"
                  style={{
                    left: selection.x,
                    top: selection.y,
                    width: selection.width,
                    height: selection.height,
                  }}
                >
                  <button
                    onClick={() => {
                      setSelection(null);
                      onClearSelection();
                    }}
                    className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full border border-border bg-white text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}
            </div>
          </Document>
        </div>
      </div>
    </div>
  );
}
