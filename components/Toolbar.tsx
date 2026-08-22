"use client";

import { useEffect, useRef, useState } from "react";
import { FONT_OPTIONS } from "@/lib/presets";
import type { BannerState, CollageItem, MainImage, Selection, TextLayer } from "@/lib/types";
import {
  Button,
  Divider,
  Icon,
  IconButton,
  MiniSelect,
  MiniSlider,
  Swatch,
  cx,
} from "./ui";

export type ToolbarActions = {
  update: (patch: Partial<BannerState>) => void;
  updateText: (key: "title" | "subtitle" | "tagline", patch: Partial<TextLayer>) => void;
  updateImage: (patch: Partial<MainImage>) => void;
  updateItem: (id: string, patch: Partial<CollageItem>) => void;
  removeItem: (id: string) => void;
  moveItem: (id: string, dir: "front" | "back") => void;
  addCollageFiles: (files: File[]) => void;
  addCollageUrl: (url: string) => void;
};

type Props = {
  selection: Selection;
  state: BannerState;
  actions: ToolbarActions;
  /** posição, em px do preview, do elemento selecionado */
  anchor: { left: number; top: number; width: number } | null;
};

/** Barra de opções que flutua junto do que está selecionado no banner. */
export default function Toolbar({ selection, state, actions, anchor }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 40 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setSize({ width: el.offsetWidth, height: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selection?.kind]);

  if (!selection || !anchor) return null;

  const gap = 12;
  const above = anchor.top - size.height - gap;
  const top = above >= 8 ? above : anchor.top + gap;
  const left = anchor.left + anchor.width / 2 - size.width / 2;

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-30 flex items-center gap-1 rounded-xl border border-line-strong bg-surface-2 p-1 shadow-[0_10px_30px_rgba(0,0,0,0.55)]"
      style={{ left, top }}
    >
      {selection.kind === "text" && <TextTools selection={selection} state={state} actions={actions} />}
      {selection.kind === "image" && <ImageTools state={state} actions={actions} />}
      {selection.kind === "collage" && (
        <CollageTools id={selection.id} state={state} actions={actions} />
      )}
      {selection.kind === "background" && <BackgroundTools state={state} actions={actions} />}
    </div>
  );
}

/* ---------------- Texto ---------------- */

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

/* ---------------- Imagem principal ---------------- */

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

/* ---------------- Colagem ---------------- */

function CollageTools({
  id,
  state,
  actions,
}: {
  id: string;
  state: BannerState;
  actions: ToolbarActions;
}) {
  const item = state.collage.find((c) => c.id === id);
  if (!item) return null;
  return (
    <>
      <MiniSlider
        label="Opacidade"
        suffix="%"
        min={0}
        max={100}
        value={Math.round(item.opacity * 100)}
        onChange={(v) => actions.updateItem(id, { opacity: v / 100 })}
      />
      <Divider />
      <MiniSlider
        label="Giro"
        suffix="°"
        width={72}
        min={-180}
        max={180}
        value={item.rotation}
        onChange={(rotation) => actions.updateItem(id, { rotation })}
      />
      <Divider />
      <MiniSlider
        label="Cantos"
        suffix="%"
        width={64}
        min={0}
        max={50}
        value={item.radius}
        onChange={(radius) => actions.updateItem(id, { radius })}
      />
      <Divider />
      <IconButton label="Trazer para frente" onClick={() => actions.moveItem(id, "front")}>
        <Icon.Front />
      </IconButton>
      <IconButton label="Enviar para trás" onClick={() => actions.moveItem(id, "back")}>
        <Icon.Back />
      </IconButton>
      <IconButton
        label="Acima do texto"
        active={item.onTop}
        onClick={() => actions.updateItem(id, { onTop: !item.onTop })}
      >
        <Icon.Layers />
      </IconButton>
      <Divider />
      <IconButton label="Excluir" danger onClick={() => actions.removeItem(id)}>
        <Icon.Trash />
      </IconButton>
    </>
  );
}

/* ---------------- Fundo ---------------- */

function BackgroundTools({ state, actions }: { state: BannerState; actions: ToolbarActions }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <span className="pl-2 pr-1 text-[11.5px] text-ink-faint">Fundo</span>
      <Swatch
        value={state.background}
        label="Cor de fundo"
        onChange={(background) => actions.update({ background })}
      />
      <Divider />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) actions.addCollageFiles(files);
          e.target.value = "";
        }}
      />
      <Button variant="bare" size="sm" onClick={() => fileRef.current?.click()}>
        <Icon.Plus />
        Imagem na colagem
      </Button>
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
