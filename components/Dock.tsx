"use client";

import type { Tool } from "@/lib/types";
import { Swatch, cx } from "./ui";

const s = {
  width: 18,
  height: 18,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TOOLS: { tool: Tool; label: string; key: string; icon: React.ReactNode }[] = [
  {
    tool: "select",
    label: "Selecionar",
    key: "1",
    icon: (
      <svg {...s}>
        <path d="M5 3.5 15 9.5l-4.2 1.2L8.6 15 5 3.5Z" />
      </svg>
    ),
  },
  {
    tool: "rect",
    label: "Quadrado",
    key: "2",
    icon: (
      <svg {...s}>
        <rect x="3.5" y="4.5" width="13" height="11" rx="1.5" />
      </svg>
    ),
  },
  {
    tool: "diamond",
    label: "Losango",
    key: "3",
    icon: (
      <svg {...s}>
        <path d="M10 3.2 16.8 10 10 16.8 3.2 10 10 3.2Z" />
      </svg>
    ),
  },
  {
    tool: "ellipse",
    label: "Bola",
    key: "4",
    icon: (
      <svg {...s}>
        <circle cx="10" cy="10" r="6.5" />
      </svg>
    ),
  },
  {
    tool: "arrow",
    label: "Seta",
    key: "5",
    icon: (
      <svg {...s}>
        <path d="M3.5 14.5 15 4.5M15 4.5H9.5M15 4.5V10" />
      </svg>
    ),
  },
  {
    tool: "line",
    label: "Reta",
    key: "6",
    icon: (
      <svg {...s}>
        <path d="M3.5 14.5 16 4.5" />
      </svg>
    ),
  },
  {
    tool: "draw",
    label: "Lápis",
    key: "7",
    icon: (
      <svg {...s}>
        <path d="M3.5 16.5l1-3.2 8.4-8.4a1.6 1.6 0 0 1 2.3 2.3l-8.4 8.4-3.3 .9Z" />
      </svg>
    ),
  },
  {
    tool: "text",
    label: "Texto",
    key: "8",
    icon: (
      <svg {...s}>
        <path d="M4.5 5.5V4h11v1.5M10 4v12M7.5 16h5" />
      </svg>
    ),
  },
  {
    tool: "image",
    label: "Imagem",
    key: "9",
    icon: (
      <svg {...s}>
        <rect x="3.5" y="4.5" width="13" height="11" rx="1.5" />
        <circle cx="7.5" cy="8.5" r="1.2" />
        <path d="M4 13.5 8 10l3 2.5 2.2-1.8L16.5 14" />
      </svg>
    ),
  },
  {
    tool: "eraser",
    label: "Borracha",
    key: "0",
    icon: (
      <svg {...s}>
        <path d="M7.8 16.5h8M4.2 12.6l4.6-4.6 5 5-3 3H7.2l-3-3.4Z" />
        <path d="M8.8 8 12 4.8a1.6 1.6 0 0 1 2.3 0l2.9 2.9a1.6 1.6 0 0 1 0 2.3L13.8 13" />
      </svg>
    ),
  },
];

export default function Dock({
  tool,
  onChange,
  background,
  onBackgroundChange,
}: {
  tool: Tool;
  onChange: (tool: Tool) => void;
  background: string;
  onBackgroundChange: (color: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-line-strong bg-surface-2 p-1 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
      {TOOLS.map((t, i) => (
        <button
          key={t.tool}
          type="button"
          title={`${t.label} — ${t.key}`}
          aria-label={t.label}
          aria-pressed={tool === t.tool}
          onClick={() => onChange(t.tool)}
          className={cx(
            "relative inline-flex size-9 items-center justify-center rounded-lg transition",
            tool === t.tool ? "bg-[#3d3d3d] text-ink" : "text-ink-dim hover:bg-[#2b2b2b] hover:text-ink",
            i === 1 && "ml-1",
          )}
        >
          {t.icon}
          <span className="absolute bottom-0.5 right-1 text-[8.5px] leading-none text-ink-faint">
            {t.key}
          </span>
        </button>
      ))}

      <span className="mx-1 h-6 w-px shrink-0 bg-line" />
      <Swatch value={background} label="Cor do fundo" onChange={onBackgroundChange} />
    </div>
  );
}

export { TOOLS };
