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
import {
  TOOL_SHAPE,
  bounds,
  elementAt,
  finishDraft,
  newShape,
  newText,
  resizeDraft,
  scaleElement,
  type DrawStyle,
} from "@/lib/elements";
import type { ImageMap } from "@/lib/images";
import { computeLayout, measureLine } from "@/lib/layout";
import { BANNER_HEIGHT, BANNER_WIDTH, PADDING, fontStack } from "@/lib/presets";
import { drawBanner, ensureFonts } from "@/lib/render";
import type {
  BannerElement,
  BannerState,
  Point,
  Selection,
  TextLayerKey,
  Tool,
} from "@/lib/types";
import Dock from "./Dock";
import Toolbar, { type ToolbarActions } from "./Toolbar";
import { Chip, Icon, cx } from "./ui";

const TEXT_LABELS: Record<TextLayerKey, string> = {
  title: "Título",
  subtitle: "Subtítulo",
  link: "Link",
};

const NEW_TEXT: Record<TextLayerKey, string> = {
  title: "Título",
  subtitle: "Subtítulo",
  link: "https://seusite.dev",
};

type Props = {
  state: BannerState;
  images: ImageMap;
  /** muda quando uma imagem termina de carregar, para forçar o redesenho */
  version: number;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  style: DrawStyle;
  actions: ToolbarActions;
  onDropFiles: (files: File[], at: Point) => void;
  onPickImage: () => void;
};

type Drag =
  | { mode: "move"; id: string; startX: number; startY: number; elX: number; elY: number }
  | { mode: "resize"; id: string; startX: number; startY: number; elW: number; elH: number }
  | { mode: "rotate"; id: string; center: Point }
  | null;

export default function BannerStage({
  state,
  images,
  version,
  selection,
  onSelect,
  tool,
  onToolChange,
  style,
  actions,
  onDropFiles,
  onPickImage,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag>(null);
  const drawingRef = useRef<{ start: Point } | null>(null);
  const textRefs = useRef<Partial<Record<TextLayerKey, HTMLTextAreaElement | null>>>({});
  const editRef = useRef<HTMLTextAreaElement>(null);
  const centerImageRef = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(0.5);
  const [dragOver, setDragOver] = useState(false);
  const [draft, setDraft] = useState<BannerElement | null>(null);
  /** id do elemento de texto em edição */
  const [editingId, setEditingId] = useState<string | null>(null);

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
      const h = stage.clientHeight - 215;
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
    state.link.font,
    ...state.elements.map((el) => (el.type === "text" ? `${el.font}${el.size}` : "")),
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
    drawBanner(ctx, state, images, pixelScale, draft);
  }, [state, images, version, scale, fontEpoch, draft]);

  /* --------- coordenadas do banner a partir do ponteiro --------- */
  const toBanner = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
    },
    [scale],
  );

  /* --------- criar elementos (ferramentas do dock) --------- */
  const onSurfaceDown = (e: React.PointerEvent) => {
    const at = toBanner(e);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    if (tool === "eraser") {
      const hit = elementAt(state.elements, at);
      if (hit) actions.removeElement(hit.id);
      drawingRef.current = { start: at };
      return;
    }

    if (tool === "text") {
      const el = newText(at, style);
      actions.addElement(el);
      onSelect({ kind: "element", id: el.id });
      setEditingId(el.id);
      onToolChange("select");
      requestAnimationFrame(() => editRef.current?.focus());
      return;
    }

    const kind = TOOL_SHAPE[tool];
    if (!kind) return;
    drawingRef.current = { start: at };
    setDraft(newShape(kind, at, style));
  };

  const onSurfaceMove = (e: React.PointerEvent) => {
    const drawing = drawingRef.current;
    if (!drawing) return;
    const at = toBanner(e);
    if (tool === "eraser") {
      const hit = elementAt(state.elements, at);
      if (hit) actions.removeElement(hit.id);
      return;
    }
    setDraft((d) => (d ? resizeDraft(d, drawing.start, at) : d));
  };

  const onSurfaceUp = () => {
    drawingRef.current = null;
    if (tool === "eraser") return;
    if (!draft) return;
    const finished = finishDraft(draft);
    setDraft(null);
    if (finished) {
      actions.addElement(finished);
      onSelect({ kind: "element", id: finished.id });
    }
    onToolChange("select");
  };

  /* --------- mover e redimensionar (ferramenta seta) --------- */
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const el = state.elements.find((c) => c.id === drag.id);
      if (!el) return;

      if (drag.mode === "rotate") {
        const p = toBanner(e);
        // a alça fica em cima, por isso o giro de 90°
        let angle = (Math.atan2(p.y - drag.center.y, p.x - drag.center.x) * 180) / Math.PI + 90;
        if (e.shiftKey) angle = Math.round(angle / 15) * 15;
        angle = Math.round(((angle + 540) % 360) - 180);
        actions.updateElement(drag.id, { rotation: angle });
        return;
      }

      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      if (drag.mode === "move") {
        actions.updateElement(drag.id, {
          x: Math.round(drag.elX + dx),
          y: Math.round(drag.elY + dy),
        });
      } else {
        const ratio = drag.elH / (drag.elW || 1);
        const width = Math.max(8, Math.round(drag.elW + dx));
        const height =
          el.type === "image" ? Math.round(width * ratio) : Math.max(8, Math.round(drag.elH + dy));
        actions.updateElement(drag.id, scaleElement(el, width, height));
      }
    },
    [actions, scale, state.elements, toBanner],
  );

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const startMove = (e: React.PointerEvent, el: BannerElement) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect({ kind: "element", id: el.id });
    dragRef.current = {
      mode: "move",
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      elX: el.x,
      elY: el.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const startResize = (e: React.PointerEvent, el: BannerElement) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode: "resize",
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      elW: el.width,
      elH: el.height,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const startRotate = (e: React.PointerEvent, el: BannerElement) => {
    e.preventDefault();
    e.stopPropagation();
    const b = bounds(el);
    dragRef.current = {
      mode: "rotate",
      id: el.id,
      center: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  /* --------- editar um texto solto --------- */
  const onEditChange = (el: BannerElement, text: string) => {
    if (el.type !== "text") return;
    const font = `${el.size}px ${fontStack(el.font)}`;
    const lines = text.split("\n");
    const width = Math.max(10, ...lines.map((line) => measureLine(line, font)));
    actions.updateElement(el.id, {
      text,
      width: Math.ceil(width),
      height: lines.length * el.size * 1.25,
    });
  };

  /* --------- soltar arquivos em cima do banner --------- */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length) onDropFiles(files, toBanner(e));
  };

  /** a imagem do meio é a fixa do banner, não um elemento solto */
  const pickCenterImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      actions.updateImage({ src: String(reader.result), enabled: true });
      onSelect({ kind: "image" });
    };
    reader.readAsDataURL(file);
  };

  /* --------- escrever num texto fixo vazio --------- */
  const addText = (key: TextLayerKey) => {
    actions.updateText(key, { text: NEW_TEXT[key] });
    onSelect({ kind: "text", key });
    requestAnimationFrame(() => {
      const el = textRefs.current[key];
      el?.focus();
      el?.select();
    });
  };

  /* --------- onde a barra de opções encosta --------- */
  const contentWidth = BANNER_WIDTH - PADDING * 2;
  let anchor: { left: number; top: number; width: number } | null = null;
  if (selection?.kind === "text") {
    const laid = layout.texts.find((t) => t.key === selection.key);
    if (laid) anchor = { left: PADDING * scale, top: laid.y * scale, width: contentWidth * scale };
  } else if (selection?.kind === "image" && layout.image) {
    anchor = {
      left: layout.image.x * scale,
      top: layout.image.y * scale,
      width: layout.image.size * scale,
    };
  } else if (selection?.kind === "element") {
    const el = state.elements.find((c) => c.id === selection.id);
    if (el) {
      const b = bounds(el);
      // 34px de folga para a barra não cobrir a alça de giro
      anchor = { left: b.x * scale, top: b.y * scale - 34, width: b.width * scale };
    }
  }

  const missingTexts = (Object.keys(TEXT_LABELS) as TextLayerKey[]).filter(
    (key) => !state[key].text.trim(),
  );
  const selecting = tool === "select";

  return (
    <div
      ref={stageRef}
      className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-14 overflow-hidden p-6"
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
      <div onPointerDown={(e) => e.stopPropagation()}>
        <Dock
          tool={tool}
          onChange={(next) => (next === "image" ? onPickImage() : onToolChange(next))}
          background={state.background}
          onBackgroundChange={(background) => actions.update({ background })}
        />
      </div>

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
            onPointerDown={() => onSelect(null)}
          />

          {mounted && (
            <>
              {/* imagem fixa do meio */}
              {layout.image && selecting && (
                <div
                  onPointerDown={() => onSelect({ kind: "image" })}
                  title="Clique para trocar a imagem"
                  className={cx(
                    "absolute cursor-pointer transition-shadow",
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

              {/* textos fixos: dá pra escrever direto em cima do banner */}
              {selecting &&
                layout.texts.map((laid) => (
                  <textarea
                    key={laid.key}
                    ref={(el) => {
                      textRefs.current[laid.key] = el;
                    }}
                    value={state[laid.key].text}
                    onChange={(e) => actions.updateText(laid.key, { text: e.target.value })}
                    onFocus={() => onSelect({ kind: "text", key: laid.key })}
                    onPointerDown={(e) => e.stopPropagation()}
                    spellCheck={false}
                    rows={1}
                    className={cx(
                      "banner-text absolute resize-none overflow-hidden border-0 bg-transparent p-0 text-transparent outline-none transition-shadow",
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

              {/* elementos desenhados */}
              {selecting &&
                state.elements.map((el) => {
                  const selected = selection?.kind === "element" && selection.id === el.id;
                  const b = bounds(el);
                  const isEditing = el.id === editingId && el.type === "text";
                  return (
                    <div
                      key={el.id}
                      onPointerDown={(e) => {
                        if (!isEditing) startMove(e, el);
                      }}
                      onDoubleClick={() => {
                        if (el.type === "text") {
                          setEditingId(el.id);
                          requestAnimationFrame(() => editRef.current?.focus());
                        }
                      }}
                      className={cx(
                        "absolute touch-none transition-shadow",
                        isEditing
                          ? "ring-2 ring-accent"
                          : selected
                            ? "cursor-grabbing ring-2 ring-accent"
                            : "cursor-grab hover:ring-2 hover:ring-accent/40",
                      )}
                      style={{
                        left: b.x * scale,
                        top: b.y * scale,
                        width: b.width * scale,
                        height: b.height * scale,
                        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      }}
                    >
                      {isEditing && el.type === "text" && (
                        <textarea
                          ref={editRef}
                          value={el.text}
                          onChange={(e) => onEditChange(el, e.target.value)}
                          onBlur={() => {
                            setEditingId(null);
                            if (!el.text.trim()) actions.removeElement(el.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          spellCheck={false}
                          rows={1}
                          className="banner-text absolute inset-0 size-full resize-none overflow-hidden whitespace-pre border-0 bg-transparent p-0 text-transparent outline-none"
                          style={{
                            font: `${el.size * scale}px ${fontStack(el.font)}`,
                            lineHeight: `${el.size * 1.25 * scale}px`,
                            caretColor: el.color,
                          }}
                        />
                      )}
                      {selected && !isEditing && (
                        <>
                          <span
                            onPointerDown={(e) => startResize(e, el)}
                            className="absolute -bottom-[7px] -right-[7px] size-3.5 cursor-nwse-resize rounded-full bg-accent"
                          />
                          {/* alça de giro, presa por um fio acima da caixa */}
                          <span className="pointer-events-none absolute -top-6 left-1/2 h-6 w-px -translate-x-1/2 bg-accent/60" />
                          <span
                            title="Arraste para girar (Shift trava em 15°)"
                            onPointerDown={(e) => startRotate(e, el)}
                            className="absolute -top-[30px] left-1/2 size-3.5 -translate-x-1/2 cursor-grab rounded-full border-2 border-accent bg-canvas"
                          />
                        </>
                      )}
                    </div>
                  );
                })}

              {/* superfície de desenho: só existe quando há ferramenta ativa */}
              {!selecting && (
                <div
                  onPointerDown={onSurfaceDown}
                  onPointerMove={onSurfaceMove}
                  onPointerUp={onSurfaceUp}
                  onPointerCancel={onSurfaceUp}
                  className={cx(
                    "absolute inset-0 touch-none",
                    tool === "eraser" ? "cursor-cell" : "cursor-crosshair",
                  )}
                />
              )}
            </>
          )}

          <Toolbar selection={selection} state={state} actions={actions} anchor={anchor} />
        </div>

        {/* barra de adicionar */}
        <div
          className="flex flex-wrap items-center justify-center gap-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {!state.image.src && (
            <>
              <Chip onClick={() => centerImageRef.current?.click()}>
                <Icon.Plus />
                Imagem do meio
              </Chip>
              <input
                ref={centerImageRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) pickCenterImage(file);
                  e.target.value = "";
                }}
              />
            </>
          )}
          {missingTexts.map((key) => (
            <Chip key={key} onClick={() => addText(key)}>
              <Icon.Plus />
              {TEXT_LABELS[key]}
            </Chip>
          ))}
        </div>
      </div>

      {dragOver && (
        <div className="pointer-events-none absolute inset-4 flex items-center justify-center rounded-xl border-2 border-dashed border-ink-faint bg-canvas/85 font-medium text-ink-dim">
          Solte para adicionar a imagem
        </div>
      )}
    </div>
  );
}
