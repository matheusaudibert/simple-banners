"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ImageMap } from "@/lib/images";
import { computeLayout } from "@/lib/layout";
import { BANNER_HEIGHT, BANNER_WIDTH, PADDING } from "@/lib/presets";
import { drawBanner, ensureFonts } from "@/lib/render";
import type {
  BannerState,
  CollageItem,
  Selection,
  TextLayerKey,
} from "@/lib/types";
import Toolbar, { type ToolbarActions } from "./Toolbar";
import { Chip, Icon, cx } from "./ui";

const TEXT_LABELS: Record<TextLayerKey, string> = {
  title: "Título",
  subtitle: "Subtítulo",
  tagline: "Sub-subtítulo",
};

const NEW_TEXT: Record<TextLayerKey, string> = {
  title: "Título",
  subtitle: "Subtítulo",
  tagline: "sub-subtítulo",
};

type Props = {
  state: BannerState;
  images: ImageMap;
  /** muda quando uma imagem termina de carregar, para forçar o redesenho */
  version: number;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  actions: ToolbarActions;
  onDropFiles: (files: File[], at: { x: number; y: number }) => void;
};

type Drag =
  | {
      mode: "move";
      id: string;
      startX: number;
      startY: number;
      itemX: number;
      itemY: number;
    }
  | {
      mode: "resize";
      id: string;
      startX: number;
      startY: number;
      itemW: number;
      itemH: number;
    }
  | null;

export default function BannerStage({
  state,
  images,
  version,
  selection,
  onSelect,
  actions,
  onDropFiles,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag>(null);
  const textRefs = useRef<
    Partial<Record<TextLayerKey, HTMLTextAreaElement | null>>
  >({});
  const imageFileRef = useRef<HTMLInputElement>(null);
  const collageFileRef = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(0.5);
  const [dragOver, setDragOver] = useState(false);
  /* A diagramação depende de medir texto no canvas, o que só existe no
     navegador — a camada interativa entra depois da hidratação. */
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  /* --------- zoom para caber na área, com folga para as barras --------- */
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      const w = stage.clientWidth - 96;
      const h = stage.clientHeight - 170;
      if (w <= 0 || h <= 0) return;
      setScale(Math.min(w / BANNER_WIDTH, h / BANNER_HEIGHT, 1));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  /* --------- garante as fontes e redesenha quando elas chegam --------- */
  const [fontEpoch, setFontEpoch] = useState(0);
  const fontSignature = [
    state.title.font,
    state.subtitle.font,
    state.tagline.font,
  ].join("|");

  useEffect(() => {
    let cancelled = false;
    ensureFonts(state).then(() => {
      if (!cancelled) setFontEpoch((e) => e + 1);
    });
    return () => {
      cancelled = true;
    };
    // o estado inteiro muda a cada tecla; só as fontes importam aqui
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSignature]);

  /* --------- a mesma diagramação do canvas guia as áreas clicáveis --------- */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => computeLayout(state), [state, fontEpoch]);

  /* --------- desenha --------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelScale = scale * dpr;
    canvas.width = Math.round(BANNER_WIDTH * pixelScale);
    canvas.height = Math.round(BANNER_HEIGHT * pixelScale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBanner(ctx, state, images, pixelScale);
  }, [state, images, version, scale, fontEpoch]);

  /* --------- arrastar / redimensionar a colagem --------- */
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      if (drag.mode === "move") {
        actions.updateItem(drag.id, {
          x: Math.round(drag.itemX + dx),
          y: Math.round(drag.itemY + dy),
        });
      } else {
        const ratio = drag.itemH / drag.itemW;
        const width = Math.max(16, Math.round(drag.itemW + (dx + dy) / 2));
        actions.updateItem(drag.id, {
          width,
          height: Math.round(width * ratio),
        });
      }
    },
    [actions, scale],
  );

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const startMove = (e: React.PointerEvent, item: CollageItem) => {
    e.preventDefault();
    onSelect({ kind: "collage", id: item.id });
    dragRef.current = {
      mode: "move",
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      itemX: item.x,
      itemY: item.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const startResize = (e: React.PointerEvent, item: CollageItem) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode: "resize",
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      itemW: item.width,
      itemH: item.height,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  /* --------- soltar arquivos em cima do banner --------- */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (!files.length) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    const at = rect
      ? {
          x: (e.clientX - rect.left) / scale,
          y: (e.clientY - rect.top) / scale,
        }
      : { x: BANNER_WIDTH / 2, y: BANNER_HEIGHT / 2 };
    onDropFiles(files, at);
  };

  /* --------- escrever num texto vazio --------- */
  const addText = (key: TextLayerKey) => {
    actions.updateText(key, { text: NEW_TEXT[key] });
    onSelect({ kind: "text", key });
    requestAnimationFrame(() => {
      const el = textRefs.current[key];
      el?.focus();
      el?.select();
    });
  };

  /* --------- teclado --------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur?.();
        onSelect(null);
        return;
      }
      if (typing || selection?.kind !== "collage") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        actions.removeItem(selection.id);
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const delta = moves[e.key];
      if (!delta) return;
      e.preventDefault();
      const item = state.collage.find((c) => c.id === selection.id);
      if (item)
        actions.updateItem(item.id, {
          x: item.x + delta[0],
          y: item.y + delta[1],
        });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, onSelect, selection, state.collage]);

  /* --------- onde a barra de opções encosta --------- */
  const contentWidth = BANNER_WIDTH - PADDING * 2;
  let anchor: { left: number; top: number; width: number } | null = null;
  if (selection?.kind === "text") {
    const laid = layout.texts.find((t) => t.key === selection.key);
    if (laid)
      anchor = {
        left: PADDING * scale,
        top: laid.y * scale,
        width: contentWidth * scale,
      };
  } else if (selection?.kind === "image" && layout.image) {
    anchor = {
      left: layout.image.x * scale,
      top: layout.image.y * scale,
      width: layout.image.size * scale,
    };
  } else if (selection?.kind === "collage") {
    const item = state.collage.find((c) => c.id === selection.id);
    if (item)
      anchor = {
        left: item.x * scale,
        top: item.y * scale,
        width: item.width * scale,
      };
  } else if (selection?.kind === "background") {
    anchor = { left: 0, top: 0, width: BANNER_WIDTH * scale };
  }

  const missingTexts = (Object.keys(TEXT_LABELS) as TextLayerKey[]).filter(
    (key) => !state[key].text.trim(),
  );

  return (
    <div
      ref={stageRef}
      className="checkerboard relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6"
      onPointerDown={() => onSelect(null)}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="relative shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
          style={{ width: BANNER_WIDTH * scale, height: BANNER_HEIGHT * scale }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <canvas
            ref={canvasRef}
            className="block size-full"
            onPointerDown={() => onSelect({ kind: "background" })}
          />

          {/* imagem principal */}
          {mounted && layout.image && (
            <div
              onPointerDown={() => onSelect({ kind: "image" })}
              title="Clique para trocar a imagem"
              className={cx(
                "absolute cursor-pointer transition",
                selection?.kind === "image"
                  ? "ring-2 ring-accent"
                  : "hover:ring-2 hover:ring-accent/40",
              )}
              style={{
                left: layout.image.x * scale,
                top: layout.image.y * scale,
                width: layout.image.size * scale,
                height: layout.image.size * scale,
                borderRadius: layout.image.radius * scale,
              }}
            />
          )}

          {/* textos: dá pra escrever direto em cima do banner */}
          {mounted &&
            layout.texts.map((laid) => (
              <textarea
                key={laid.key}
                ref={(el) => {
                  textRefs.current[laid.key] = el;
                }}
                value={state[laid.key].text}
                onChange={(e) =>
                  actions.updateText(laid.key, { text: e.target.value })
                }
                onFocus={() => onSelect({ kind: "text", key: laid.key })}
                onPointerDown={(e) => e.stopPropagation()}
                spellCheck={false}
                rows={1}
                className={cx(
                  "banner-text absolute resize-none overflow-hidden border-0 bg-transparent p-0 text-transparent outline-none transition",
                  selection?.kind === "text" && selection.key === laid.key
                    ? "ring-2 ring-accent"
                    : "hover:ring-2 hover:ring-accent/40",
                )}
                style={{
                  left: PADDING * scale,
                  top: laid.y * scale,
                  width: contentWidth * scale,
                  height: laid.lines.length * laid.lineHeight * scale,
                  font: `${laid.weight} ${laid.size * scale}px ${laid.family}`,
                  lineHeight: `${laid.lineHeight * scale}px`,
                  textAlign: "center",
                  caretColor: laid.color,
                }}
              />
            ))}

          {/* colagem */}
          {state.collage.map((item) => {
            const selected =
              selection?.kind === "collage" && selection.id === item.id;
            return (
              <div
                key={item.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  startMove(e, item);
                }}
                className={cx(
                  "absolute touch-none transition",
                  selected
                    ? "cursor-grabbing ring-2 ring-accent"
                    : "cursor-grab hover:ring-2 hover:ring-accent/40",
                )}
                style={{
                  left: item.x * scale,
                  top: item.y * scale,
                  width: item.width * scale,
                  height: item.height * scale,
                  transform: `rotate(${item.rotation}deg)`,
                }}
              >
                {selected && (
                  <span
                    onPointerDown={(e) => startResize(e, item)}
                    className="absolute -bottom-[7px] -right-[7px] size-3.5 cursor-nwse-resize rounded-full bg-accent"
                  />
                )}
              </div>
            );
          })}

          <Toolbar
            selection={selection}
            state={state}
            actions={actions}
            anchor={anchor}
          />
        </div>

        {/* barra de adicionar */}
        <div
          className="flex flex-wrap items-center justify-center gap-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="text-[12px] tabular-nums text-ink-faint">
            {BANNER_WIDTH} × {BANNER_HEIGHT} · {Math.round(scale * 100)}%
          </span>
          <span className="mx-1 h-4 w-px bg-line" />

          {!state.image.src && (
            <Chip onClick={() => imageFileRef.current?.click()}>
              <Icon.Plus />
              Imagem
            </Chip>
          )}
          {missingTexts.map((key) => (
            <Chip key={key} onClick={() => addText(key)}>
              <Icon.Plus />
              {TEXT_LABELS[key]}
            </Chip>
          ))}
          <Chip onClick={() => collageFileRef.current?.click()}>
            <Icon.Plus />
            Colagem
          </Chip>

          <input
            ref={imageFileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                  actions.updateImage({
                    src: String(reader.result),
                    enabled: true,
                  });
                  onSelect({ kind: "image" });
                };
                reader.readAsDataURL(file);
              }
              e.target.value = "";
            }}
          />
          <input
            ref={collageFileRef}
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
        </div>
      </div>

      {dragOver && (
        <div className="pointer-events-none absolute inset-4 flex items-center justify-center rounded-xl border-2 border-dashed border-ink-faint bg-canvas/85 font-medium text-ink-dim">
          Solte para adicionar à colagem
        </div>
      )}
    </div>
  );
}
