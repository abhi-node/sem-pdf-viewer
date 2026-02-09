import { useEffect, useRef } from "react";
import type { DocumentRecord } from "./dashboard-shell";

const TERMINAL_STATUSES = new Set(["ready", "failed"]);
const POLL_INTERVAL = 3000;

export function useIngestionPolling(
  documents: DocumentRecord[],
  onStatusChange: (id: string, status: string) => void,
) {
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    const nonTerminal = documents.filter(
      (d) => !TERMINAL_STATUSES.has(d.ingestionStatus),
    );
    if (nonTerminal.length === 0) return;

    const timer = setInterval(async () => {
      for (const doc of nonTerminal) {
        try {
          const res = await fetch(`/api/documents/${doc.id}/status`);
          if (!res.ok) continue;
          const { ingestionStatus } = await res.json();
          if (ingestionStatus !== doc.ingestionStatus) {
            onStatusChangeRef.current(doc.id, ingestionStatus);
          }
        } catch {
          // Polling failure is non-critical
        }
      }
    }, POLL_INTERVAL);

    return () => clearInterval(timer);
  }, [documents]);
}
