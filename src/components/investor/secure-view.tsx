"use client";

import type { ReactNode } from "react";

/**
 * Deterrence for confidential pitch content: a tiled watermark with the viewer's identity,
 * no text selection, copy or context menu, and nothing printable. This can't stop a
 * photograph of the screen, but the watermark makes any leak traceable to the viewer.
 */
export function SecureView({ watermark, children }: { watermark: string; children: ReactNode }) {
  const tiles = Array.from({ length: 60 });
  return (
    <div
      className="relative select-none print:hidden"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      data-testid="secure-view"
    >
      {children}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        <div className="absolute -inset-[20%] flex -rotate-[24deg] flex-wrap content-start gap-x-16 gap-y-20 opacity-[0.07]">
          {tiles.map((_, i) => (
            <span key={i} className="whitespace-nowrap text-sm font-semibold text-white">
              {watermark}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
