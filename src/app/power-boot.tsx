"use client";

/**
 * The boot screen: the lines of `renderBootScreen` (src/data/assembly.ts) filled in from the shipped
 * build's parts, printed one after another over the stage. Once the last line has shown it holds for a
 * moment and then goes (a fade, or under reduced motion a plain hide), so it never sits over the machine
 * for as long as Power stays on. Under reduced motion it is one static frame, every line at once. Power off
 * and on again plays it again. A dynamic chunk: it (and the assembly data it reads) loads on the first Power on.
 */
import { useEffect, useMemo, useState } from "react";
import { renderBootScreen } from "@/data/assembly";
import { bootVarsFor } from "@/data/boot-vars";
import { defaultPickIds } from "@/data/showcase";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const LINE_MS = 220;
/** How long the finished log stays up before it goes. */
const HOLD_MS = 1600;
/** Under reduced motion there is no fade, so the one static frame is held a little longer to be read. */
const HOLD_REDUCED_MS = 3000;
const FADE_MS = 400;

export default function PowerBoot() {
  const lines = useMemo(() => renderBootScreen(bootVarsFor(defaultPickIds)), []);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [shown, setShown] = useState(1);
  const [phase, setPhase] = useState<"on" | "fading" | "gone">("on");

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setShown((n) => (n >= lines.length ? n : n + 1)), LINE_MS);
    return () => window.clearInterval(id);
  }, [reduced, lines.length]);

  const count = reduced ? lines.length : shown;
  const printed = count >= lines.length;

  useEffect(() => {
    if (!printed) return;
    const id = window.setTimeout(() => setPhase(reduced ? "gone" : "fading"), reduced ? HOLD_REDUCED_MS : HOLD_MS);
    return () => window.clearTimeout(id);
  }, [printed, reduced]);

  useEffect(() => {
    if (phase !== "fading") return;
    const id = window.setTimeout(() => setPhase("gone"), FADE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === "gone") return null;
  return (
    <section
      data-power-boot
      data-lines={count}
      data-phase={phase}
      aria-label="Boot screen"
      style={{ transitionDuration: `${FADE_MS}ms` }}
      className={cn(
        "pointer-events-none absolute top-14 left-3 z-10 w-[min(17.5rem,calc(100%-1.5rem))] rounded-lg border border-border bg-black p-3 font-mono text-[11px] leading-relaxed text-[#8ef0a6] shadow-sm transition-opacity max-sm:p-2 max-sm:text-[10px] max-sm:leading-snug md:top-3 md:w-[min(17.5rem,calc(100%-15rem))]",
        phase === "fading" && "opacity-0",
      )}
    >
      {lines.slice(0, count).map((line) => (
        <p key={line}>{line}</p>
      ))}
    </section>
  );
}
