"use client";
/* Tooltip + Toast — the two ambient overlays that float above
 * everything else. Kept together because they share the bottom-right
 * stacking and both subscribe to ambient state.
 *
 * Tooltip: single element that follows the cursor with a small offset.
 *          Cream-card chip with mono header + sentence body + key hints.
 *
 * Toasts: bottom-right vertical stack, auto-dismiss after 2.4s with a
 *         220ms slide-up + fade exit. Up to ~6 visible at once. */

import { useAtlasV3 } from "@/lib/atlas-v3/state";

export function TooltipLayer() {
  const tip = useAtlasV3((s) => s.tooltip);
  if (!tip) return null;
  // place 14px down + 14px right of cursor; flip if would overflow
  const w = 280;
  const willFlipX = tip.x + 14 + w > (typeof window !== "undefined" ? window.innerWidth : 1600);
  const left = willFlipX ? tip.x - 14 - w : tip.x + 14;
  const top = tip.y + 14;
  return (
    <div
      className="fixed z-[200] pointer-events-none border border-ink/12 backdrop-blur px-3 py-2 select-none"
      style={{
        left,
        top,
        width: w,
        background: "rgba(250, 246, 232, 0.96)",
      }}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/94">{tip.label}</div>
      {tip.body && <div className="mt-1 font-sans text-[12px] leading-snug text-ink/66">{tip.body}</div>}
      {tip.keys && tip.keys.length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink/46 border-t border-ink/12 pt-1.5">
          {tip.keys.map(([k, v], i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className="text-ink/94">{k}</span>
              <span className="text-ink/22">·</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ToastStack() {
  const toasts = useAtlasV3((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-7 right-7 flex flex-col gap-2 z-[150] pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="border border-ink/22 backdrop-blur px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/94 flex items-center gap-2"
          style={{
            background: "rgba(253, 250, 238, 0.96)",
            opacity: t.out ? 0 : 1,
            transform: t.out ? "translateY(8px)" : "translateY(0)",
            transition: "opacity 220ms ease-out, transform 220ms ease-out",
          }}
        >
          {t.glyph && <span className="text-peacock">{t.glyph}</span>}
          <span>{t.label}</span>
          {t.em && (
            <em className="not-italic font-display italic text-[12px] tracking-normal normal-case text-persimmon">
              {t.em}
            </em>
          )}
        </div>
      ))}
    </div>
  );
}
