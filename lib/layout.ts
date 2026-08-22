import {
  BANNER_HEIGHT,
  BANNER_WIDTH,
  IMAGE_GAP,
  IMAGE_SIZE,
  PADDING,
  TEXT_STYLE,
  fontStack,
} from "./presets";
import type { BannerState, TextLayerKey } from "./types";

export type LaidText = {
  key: TextLayerKey;
  lines: string[];
  /** centro horizontal do bloco */
  x: number;
  /** topo do bloco de texto */
  y: number;
  size: number;
  lineHeight: number;
  weight: number;
  color: string;
  family: string;
};

export type LaidImage = {
  x: number;
  y: number;
  size: number;
  /** raio em px */
  radius: number;
};

export type Layout = {
  image: LaidImage | null;
  texts: LaidText[];
};

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  return measureCtx;
}

function measure(text: string, font: string): number {
  const ctx = getMeasureCtx();
  if (!ctx) return text.length * 0.55 * parseFloat(font);
  ctx.font = font;
  return ctx.measureText(text).width;
}

/** Quebra o texto respeitando quebras manuais e a largura disponível. */
export function wrapText(text: string, font: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      out.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate, font) > maxWidth) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * Fonte única de verdade da diagramação: usada tanto pelo preview
 * quanto pela exportação, então o PNG sai idêntico ao que se vê.
 */
export function computeLayout(state: BannerState): Layout {
  const contentWidth = BANNER_WIDTH - PADDING * 2;
  const order: TextLayerKey[] = ["title", "subtitle", "tagline"];

  const blocks = order
    .filter((key) => state[key].text.trim())
    .map((key) => {
      const style = TEXT_STYLE[key];
      const lines = wrapText(
        state[key].text,
        `${style.weight} ${style.size}px ${fontStack(state[key].font)}`,
        contentWidth,
      );
      return { key, lines, height: lines.length * style.size * style.lineHeight };
    });

  const hasImage = state.image.enabled && !!state.image.src;
  let total = hasImage ? IMAGE_SIZE : 0;
  if (hasImage && blocks.length) total += IMAGE_GAP;
  blocks.forEach((block, i) => {
    total += block.height;
    if (i < blocks.length - 1) total += TEXT_STYLE[block.key].gapBelow;
  });

  let cursor = (BANNER_HEIGHT - total) / 2;
  const centerX = BANNER_WIDTH / 2;

  let image: LaidImage | null = null;
  if (hasImage) {
    image = {
      x: (BANNER_WIDTH - IMAGE_SIZE) / 2,
      y: cursor,
      size: IMAGE_SIZE,
      radius: (Math.min(50, Math.max(0, state.image.radius)) / 100) * IMAGE_SIZE,
    };
    cursor += IMAGE_SIZE;
    if (blocks.length) cursor += IMAGE_GAP;
  }

  const texts: LaidText[] = blocks.map((block, i) => {
    const style = TEXT_STYLE[block.key];
    const laid: LaidText = {
      key: block.key,
      lines: block.lines,
      x: centerX,
      y: cursor,
      size: style.size,
      lineHeight: style.size * style.lineHeight,
      weight: style.weight,
      color: state[block.key].color,
      family: fontStack(state[block.key].font),
    };
    cursor += block.height;
    if (i < blocks.length - 1) cursor += style.gapBelow;
    return laid;
  });

  return { image, texts };
}
