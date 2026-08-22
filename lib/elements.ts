import type {
  BannerElement,
  FontKey,
  Point,
  ShapeElement,
  ShapeKind,
  TextElement,
  Tool,
} from "./types";
import { isShape } from "./types";

/** Estilo com que os próximos elementos nascem. */
export type DrawStyle = {
  stroke: string;
  strokeWidth: number;
  fill: string | null;
  opacity: number;
  font: FontKey;
  fontSize: number;
  color: string;
};

export const DEFAULT_STYLE: DrawStyle = {
  stroke: "#1a1a1a",
  strokeWidth: 2,
  fill: null,
  opacity: 1,
  font: "excalifont",
  fontSize: 28,
  color: "#1a1a1a",
};

export const STROKE_WIDTHS = [1, 2, 4];

/** paleta curta, à la Excalidraw, para traço e preenchimento */
export const STROKE_COLORS = ["#1a1a1a", "#e03131", "#2f9e44", "#1971c2", "#f08c00"];
export const FILL_COLORS = [null, "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99"];

const id = () => crypto.randomUUID();
const seed = () => Math.floor(Math.random() * 2 ** 31);

export function newShape(kind: ShapeKind, start: Point, style: DrawStyle): ShapeElement {
  return {
    id: id(),
    type: kind,
    x: start.x,
    y: start.y,
    width: 0,
    height: 0,
    opacity: style.opacity,
    rotation: 0,
    seed: seed(),
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    fill: kind === "line" || kind === "arrow" || kind === "draw" ? null : style.fill,
    ...(kind === "draw" ? { points: [{ x: 0, y: 0 }] } : {}),
  };
}

export function newText(at: Point, style: DrawStyle): TextElement {
  return {
    id: id(),
    type: "text",
    x: at.x,
    y: at.y,
    width: 10,
    height: style.fontSize * 1.25,
    opacity: style.opacity,
    rotation: 0,
    seed: seed(),
    text: "",
    color: style.color,
    font: style.font,
    size: style.fontSize,
  };
}

export function newImage(
  src: string,
  center: Point,
  width: number,
  height: number,
): BannerElement {
  return {
    id: id(),
    type: "image",
    x: Math.round(center.x - width / 2),
    y: Math.round(center.y - height / 2),
    width,
    height,
    opacity: 1,
    rotation: 0,
    seed: seed(),
    src,
    radius: 0,
  };
}

/**
 * Enquanto se arrasta, o elemento acompanha o ponteiro. Linhas, setas e o
 * lápis guardam a direção; as formas fechadas viram uma caixa normalizada.
 */
export function resizeDraft(draft: BannerElement, start: Point, current: Point): BannerElement {
  if (draft.type === "draw") {
    const points = [...(draft.points ?? []), { x: current.x - draft.x, y: current.y - draft.y }];
    return { ...draft, points };
  }
  if (draft.type === "line" || draft.type === "arrow") {
    return { ...draft, x: start.x, y: start.y, width: current.x - start.x, height: current.y - start.y };
  }
  return {
    ...draft,
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

/** Fecha o desenho: normaliza a caixa do lápis e descarta cliques sem arrasto. */
export function finishDraft(draft: BannerElement): BannerElement | null {
  if (draft.type === "draw") {
    const points = draft.points ?? [];
    if (points.length < 2) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      ...draft,
      x: draft.x + minX,
      y: draft.y + minY,
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
      points: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
    };
  }
  if (draft.type === "line" || draft.type === "arrow") {
    return Math.hypot(draft.width, draft.height) < 8 ? null : draft;
  }
  return draft.width < 6 || draft.height < 6 ? null : draft;
}

/** Caixa sempre com largura e altura positivas (linhas podem ser negativas). */
export function bounds(el: BannerElement) {
  return {
    x: Math.min(el.x, el.x + el.width),
    y: Math.min(el.y, el.y + el.height),
    width: Math.abs(el.width),
    height: Math.abs(el.height),
  };
}

export function hitTest(el: BannerElement, p: Point, slack = 6): boolean {
  const b = bounds(el);
  return (
    p.x >= b.x - slack &&
    p.x <= b.x + b.width + slack &&
    p.y >= b.y - slack &&
    p.y <= b.y + b.height + slack
  );
}

/** O elemento mais à frente sob o ponto. */
export function elementAt(elements: BannerElement[], p: Point): BannerElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    if (hitTest(elements[i], p)) return elements[i];
  }
  return null;
}

export function scaleElement(el: BannerElement, width: number, height: number): BannerElement {
  if (el.type === "draw" && el.points) {
    const kx = Math.abs(el.width) > 0 ? width / el.width : 1;
    const ky = Math.abs(el.height) > 0 ? height / el.height : 1;
    return { ...el, width, height, points: el.points.map((p) => ({ x: p.x * kx, y: p.y * ky })) };
  }
  return { ...el, width, height };
}

export const TOOL_SHAPE: Partial<Record<Tool, ShapeKind>> = {
  rect: "rect",
  diamond: "diamond",
  ellipse: "ellipse",
  arrow: "arrow",
  line: "line",
  draw: "draw",
};

/** Estilos que fazem sentido editar para o elemento selecionado. */
export function styleOf(el: BannerElement): Partial<DrawStyle> {
  if (isShape(el)) {
    return {
      stroke: el.stroke,
      strokeWidth: el.strokeWidth,
      fill: el.fill,
      opacity: el.opacity,
    };
  }
  if (el.type === "text") {
    return { color: el.color, font: el.font, fontSize: el.size, opacity: el.opacity };
  }
  return { opacity: el.opacity };
}
