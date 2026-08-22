"use client";

import { useEffect, useRef, useState } from "react";
import type { DrawStyle } from "@/lib/elements";
import { STROKE_WIDTHS } from "@/lib/elements";
import { FONT_OPTIONS } from "@/lib/presets";
import type {
  BannerElement,
  BannerState,
  MainImage,
  Selection,
  TextLayer,
  TextLayerKey,
} from "@/lib/types";
import { isShape } from "@/lib/types";
import { Button, Divider, Icon, IconButton, MiniSelect, MiniSlider, Swatch, cx } from "./ui";

export type ToolbarActions = {
  update: (patch: Partial<BannerState>) => void;
  updateText: (key: TextLayerKey, patch: Partial<TextLayer>) => void;
  updateImage: (patch: Partial<MainImage>) => void;
  addElement: (element: BannerElement) => void;
  updateElement: (id: string, patch: Partial<BannerElement>) => void;
  removeElement: (id: string) => void;
  moveElement: (id: string, dir: "front" | "back") => void;
  addImageFiles: (files: File[]) => void;
  addImageUrl: (url: string) => void;
  setStyle: (patch: Partial<DrawStyle>) => void;
};

type Props = {
  selection: Selection;
  state: BannerState;
  actions: ToolbarActions;
  /** posição, em px do preview, do que está selecionado */
  anchor: { left: number; top: number; width: number } | null;
};

/** Barra de opções que flutua junto do que está selecionado no banner. */
export default function Toolbar({ selection, state, actions, anchor }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 40 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ width: el.offsetWidth, height: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selection?.kind]);

  if (!selection || !anchor) return null;

  // sempre acima do que está selecionado: descer por cima do conteúdo
  // atrapalha mais do que passar do topo do banner
  const gap = 12;
  const top = anchor.top - size.height - gap;
  const left = anchor.left + anchor.width / 2 - size.width / 2;

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-30 flex items-center gap-1 rounded-xl border border-line-strong bg-surface-2 p-1 shadow-[0_10px_30px_rgba(0,0,0,0.55)]"
      style={{ left, top }}
    >
      {selection.kind === "text" && (
        <TextTools selection={selection} state={state} actions={actions} />
      )}
      {selection.kind === "image" && <ImageTools state={state} actions={actions} />}
      {selection.kind === "element" && (
        <ElementTools id={selection.id} state={state} actions={actions} />
      )}
    </div>
  );
}

/* ---------------- Textos fixos ---------------- */

function TextTools({
  selection,
  state,
  actions,
}: {
  selection: Extract<Selection, { kind: "text" }>;
  state: BannerState;
  actions: ToolbarActions;
}) {
  const layer = state[selection.key];
  return (
    <>
      <MiniSelect
        value={layer.font}
        onChange={(e) =>
          actions.updateText(selection.key, { font: e.target.value as TextLayer["font"] })
        }
        options={FONT_OPTIONS.map((f) => ({
          value: f.key,
          label: f.label,
          style: { fontFamily: f.stack },
        }))}
      />
      <Swatch
        value={layer.color}
        label="Cor do texto"
        onChange={(color) => actions.updateText(selection.key, { color })}
      />
      <Divider />
      <IconButton
        label="Apagar este texto"
        danger
        onClick={() => actions.updateText(selection.key, { text: "" })}
      >
        <Icon.Trash />
      </IconButton>
    </>
  );
}

/* ---------------- Imagem fixa do meio ---------------- */

function ImageTools({ state, actions }: { state: BannerState; actions: ToolbarActions }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => actions.updateImage({ src: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
          e.target.value = "";
        }}
      />
      <IconButton label="Enviar arquivo" onClick={() => fileRef.current?.click()}>
        <Icon.Upload />
      </IconButton>
      <IconButton label="Usar um link" active={urlOpen} onClick={() => setUrlOpen((v) => !v)}>
        <Icon.Link />
      </IconButton>

      {urlOpen && (
        <UrlField
          value={url}
          onChange={setUrl}
          onSubmit={() => {
            if (url.trim()) {
              actions.updateImage({ src: url.trim() });
              setUrl("");
              setUrlOpen(false);
            }
          }}
        />
      )}

      {state.image.src && (
        <>
          <Divider />
          <MiniSlider
            label="Cantos"
            suffix="%"
            min={0}
            max={50}
            value={state.image.radius}
            onChange={(radius) => actions.updateImage({ radius })}
          />
          <Divider />
          <IconButton
            label="Remover imagem"
            danger
            onClick={() => actions.updateImage({ src: null, enabled: false })}
          >
            <Icon.Trash />
          </IconButton>
        </>
      )}
    </>
  );
}

/* ---------------- Elementos desenhados ---------------- */

function ElementTools({
  id,
  state,
  actions,
}: {
  id: string;
  state: BannerState;
  actions: ToolbarActions;
}) {
  const el = state.elements.find((c) => c.id === id);
  if (!el) return null;

  const patch = (p: Partial<BannerElement>) => actions.updateElement(id, p);

  return (
    <>
      {isShape(el) && (
        <>
          <Swatch
            value={el.stroke}
            label="Cor do traço"
            onChange={(stroke) => {
              patch({ stroke });
              actions.setStyle({ stroke });
            }}
          />
          <div className="flex items-center gap-0.5">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                title={`Traço ${w}`}
                onClick={() => {
                  patch({ strokeWidth: w });
                  actions.setStyle({ strokeWidth: w });
                }}
                className={cx(
                  "inline-flex size-8 items-center justify-center rounded-lg transition",
                  el.strokeWidth === w ? "bg-[#2b2b2b]" : "hover:bg-[#2b2b2b]",
                )}
              >
                <span
                  className="block w-4 rounded-full bg-ink-dim"
                  style={{ height: Math.max(1, w) }}
                />
              </button>
            ))}
          </div>
          {el.type !== "line" && el.type !== "arrow" && el.type !== "draw" && (
            <>
              <Divider />
              <Swatch
                value={el.fill ?? "#ffc9c9"}
                label="Cor de preenchimento"
                onChange={(fill) => {
                  patch({ fill });
                  actions.setStyle({ fill });
                }}
              />
              <IconButton
                label={el.fill ? "Tirar preenchimento" : "Sem preenchimento"}
                active={!el.fill}
                onClick={() => {
                  patch({ fill: el.fill ? null : "#ffc9c9" });
                  actions.setStyle({ fill: el.fill ? null : "#ffc9c9" });
                }}
              >
                <Icon.NoFill />
              </IconButton>
            </>
          )}
        </>
      )}

      {el.type === "text" && (
        <>
          <MiniSelect
            value={el.font}
            onChange={(e) => patch({ font: e.target.value as TextLayer["font"] })}
            options={FONT_OPTIONS.map((f) => ({
              value: f.key,
              label: f.label,
              style: { fontFamily: f.stack },
            }))}
          />
          <Swatch value={el.color} label="Cor do texto" onChange={(color) => patch({ color })} />
          <Divider />
          <MiniSlider
            label="Tamanho"
            suffix="px"
            min={10}
            max={120}
            width={80}
            value={el.size}
            onChange={(size) => patch({ size, height: el.text.split("\n").length * size * 1.25 })}
          />
        </>
      )}

      {el.type === "image" && (
        <MiniSlider
          label="Cantos"
          suffix="%"
          width={64}
          min={0}
          max={50}
          value={el.radius}
          onChange={(radius) => patch({ radius })}
        />
      )}

      <Divider />
      <MiniSlider
        label="Opacidade"
        suffix="%"
        width={72}
        min={10}
        max={100}
        value={Math.round(el.opacity * 100)}
        onChange={(v) => patch({ opacity: v / 100 })}
      />
      <Divider />
      <IconButton label="Trazer para frente" onClick={() => actions.moveElement(id, "front")}>
        <Icon.Front />
      </IconButton>
      <IconButton label="Enviar para trás" onClick={() => actions.moveElement(id, "back")}>
        <Icon.Back />
      </IconButton>
      <IconButton label="Excluir" danger onClick={() => actions.removeElement(id)}>
        <Icon.Trash />
      </IconButton>
    </>
  );
}

/* ---------------- Campo de link ---------------- */

function UrlField({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="flex items-center gap-1">
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
        placeholder="https://..."
        spellCheck={false}
        className={cx(
          "h-8 w-56 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] outline-none",
          "placeholder:text-ink-faint focus:border-line-strong",
        )}
      />
      <Button variant="bare" size="sm" onClick={onSubmit}>
        Usar
      </Button>
    </div>
  );
}
