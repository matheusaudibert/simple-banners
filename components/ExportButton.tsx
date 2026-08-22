"use client";

import { useEffect, useRef, useState } from "react";
import { BANNER_HEIGHT, BANNER_WIDTH, EXPORT_SCALES } from "@/lib/presets";
import { cx } from "./ui";

type Props = {
  scale: number;
  onScaleChange: (scale: number) => void;
  onDownload: () => void;
  disabled?: boolean;
};

/**
 * Botão dividido: o lado grande baixa na escala atual (um clique só),
 * o lado da setinha abre a lista de tamanhos.
 */
export default function ExportButton({ scale, onScaleChange, onDownload, disabled }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div className="flex h-9 items-stretch overflow-hidden rounded-lg border border-line-strong bg-accent text-ink">
        <button
          type="button"
          disabled={disabled}
          onClick={onDownload}
          className="px-3.5 text-[13px] font-semibold transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Baixar PNG
        </button>
        <span className="my-1.5 w-px bg-line-strong" />
        <button
          type="button"
          disabled={disabled}
          aria-label="Escolher o tamanho"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 pl-2 pr-2.5 text-[12.5px] text-ink-dim transition hover:bg-accent-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {scale}x
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M3 4.5 6 7.5 9 4.5" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-xl border border-line-strong bg-surface-2 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
          {EXPORT_SCALES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onScaleChange(s);
                setOpen(false);
              }}
              className={cx(
                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition hover:bg-[#2b2b2b]",
                s === scale ? "text-ink" : "text-ink-dim",
              )}
            >
              <span>
                {s}x
                <span className="ml-2 tabular-nums text-ink-faint">
                  {BANNER_WIDTH * s}×{BANNER_HEIGHT * s}
                </span>
              </span>
              {s === scale && (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3.5 8.5 6.5 11.5 12.5 5" />
                </svg>
              )}
            </button>
          ))}
          <p className="px-2.5 pb-1 pt-2 text-[11.5px] leading-snug text-ink-faint">
            2x é o padrão: fica nítido em telas retina e as redes aceitam sem problema.
          </p>
        </div>
      )}
    </div>
  );
}
