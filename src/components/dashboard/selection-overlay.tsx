"use client";

import { useRef, useCallback } from "react";

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionOverlayProps {
  selection: SelectionRect | null;
  onSelectionChange: (rect: SelectionRect | null) => void;
  onSelectionComplete: (rect: SelectionRect) => void;
}

function normalize(rect: SelectionRect): SelectionRect {
  return {
    x: rect.width < 0 ? rect.x + rect.width : rect.x,
    y: rect.height < 0 ? rect.y + rect.height : rect.y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  };
}

const MIN_SELECTION_SIZE = 10;

export function SelectionOverlay({
  selection,
  onSelectionChange,
  onSelectionComplete,
}: SelectionOverlayProps) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return; // left click only
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      startRef.current = { x, y };
      draggingRef.current = true;
      onSelectionChange({ x, y, width: 0, height: 0 });
    },
    [onSelectionChange],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!draggingRef.current || !startRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      onSelectionChange({
        x: startRef.current.x,
        y: startRef.current.y,
        width: currentX - startRef.current.x,
        height: currentY - startRef.current.y,
      });
    },
    [onSelectionChange],
  );

  const handleMouseUp = useCallback(() => {
    if (!draggingRef.current || !startRef.current) return;
    draggingRef.current = false;
    startRef.current = null;
    if (selection) {
      const norm = normalize(selection);
      if (norm.width >= MIN_SELECTION_SIZE && norm.height >= MIN_SELECTION_SIZE) {
        onSelectionChange(norm);
        onSelectionComplete(norm);
      } else {
        onSelectionChange(null);
      }
    }
  }, [selection, onSelectionChange, onSelectionComplete]);

  const display = selection ? normalize(selection) : null;

  return (
    <div
      className="absolute inset-0 z-10"
      style={{ cursor: "crosshair" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {display && display.width > 0 && display.height > 0 && (
        <div
          className="pointer-events-none absolute border-2 border-red-500 bg-red-500/20"
          style={{
            left: display.x,
            top: display.y,
            width: display.width,
            height: display.height,
          }}
        />
      )}
    </div>
  );
}
