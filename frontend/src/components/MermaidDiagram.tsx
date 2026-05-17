"use client";

import { useEffect, useId, useRef, useState } from "react";

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const autoId = useId().replace(/[:]/g, "");
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad:     false,
          theme:           "neutral",
          securityLevel:   "loose",
          fontFamily:      "var(--font-geist-sans), ui-sans-serif, system-ui",
        });
        const { svg } = await mermaid.render(`mermaid-${autoId}`, chart);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [chart, autoId]);

  return (
    <div className={`overflow-x-auto rounded-xl border p-6 bg-white ${className ?? ""}`}>
      {error ? (
        <pre className="text-xs text-red-700 whitespace-pre-wrap">{error}</pre>
      ) : (
        <div ref={ref} className="mermaid-container [&_svg]:max-w-full [&_svg]:h-auto" />
      )}
    </div>
  );
}
