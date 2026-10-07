"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronUp, X } from "lucide-react";
import { usd } from "@/data/showcase";
import type { CompatStatus } from "@/data/compat";
import { StatusMark } from "./spec-sheet";

/**
 * The phone's bottom sheet: a bar fixed to the bottom edge with the total and the verdict, and a
 * native modal <dialog> that slides up with the full spec sheet. The dialog gives focus trapping,
 * Escape and an inert page behind it for free; its children mount only while it is open, so the
 * sheet in the desktop column and the one in the dialog never exist together in the accessibility tree.
 */
export function MobileSheet({ open, onOpenChange, total, status, children }: { open: boolean; onOpenChange: (open: boolean) => void; total: number; status: CompatStatus; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <div data-sheet-bar className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
        <button
          type="button"
          data-sheet-open
          aria-haspopup="dialog"
          onClick={() => onOpenChange(true)}
          className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-lg text-left"
        >
          <span className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-secondary">This build</span>
            <span className="text-lg leading-6 font-extrabold tabular-nums text-ink">{usd(total)}</span>
          </span>
          <span className="flex items-center gap-3">
            <StatusMark status={status} className="text-sm" />
            <ChevronUp aria-hidden className="size-5 text-ink-secondary" />
          </span>
        </button>
      </div>
      <dialog
        ref={ref}
        data-sheet-dialog
        aria-label="Spec sheet"
        onClose={() => onOpenChange(false)}
        // A click on the backdrop lands on the dialog element itself, not on its content.
        onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
        className="sheet-dialog fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-b-0 border-border bg-surface p-0 text-ink backdrop:bg-black/50 lg:hidden"
      >
        {open && (
          <>
            <div className="sticky top-0 z-10 flex h-12 items-center justify-end bg-surface px-2">
              <span aria-hidden className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />
              <button type="button" data-sheet-close aria-label="Close the spec sheet" onClick={() => onOpenChange(false)} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-secondary hover:bg-surface-hover hover:text-ink">
                <X aria-hidden className="size-5" />
              </button>
            </div>
            {children}
          </>
        )}
      </dialog>
    </>
  );
}
