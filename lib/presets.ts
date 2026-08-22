import type { BannerState, FontKey, TextLayerKey } from "./types";

/* ------------------------------------------------------------------
   O banner tem medidas fixas. Só o conteúdo é editável: imagem,
   textos, fontes, cores e a colagem.
------------------------------------------------------------------ */

export const BANNER_WIDTH = 1200;
export const BANNER_HEIGHT = 630;

/** margem lateral: define a largura útil do texto e onde as linhas quebram */
export const PADDING = 140;

export const IMAGE_SIZE = 180;
/** espaço entre a imagem e o título */
export const IMAGE_GAP = 36;

export const TEXT_STYLE: Record<
  TextLayerKey,
  { size: number; weight: number; lineHeight: number; gapBelow: number }
> = {
  title: { size: 64, weight: 700, lineHeight: 1.18, gapBelow: 24 },
  subtitle: { size: 30, weight: 400, lineHeight: 1.35, gapBelow: 20 },
  tagline: { size: 18, weight: 400, lineHeight: 1.45, gapBelow: 0 },
};

export const FONT_OPTIONS: { key: FontKey; label: string; stack: string }[] = [
  { key: "inter", label: "Inter", stack: "'Inter', system-ui, sans-serif" },
  { key: "anthropic", label: "Anthropic Sans", stack: "'Anthropic Sans', 'Inter', sans-serif" },
  { key: "excalifont", label: "Excalifont", stack: "'Excalifont', 'Comic Sans MS', cursive" },
  { key: "mono", label: "JetBrains Mono", stack: "'JetBrains Mono', ui-monospace, monospace" },
];

export const fontStack = (key: FontKey): string =>
  FONT_OPTIONS.find((f) => f.key === key)?.stack ?? FONT_OPTIONS[0].stack;

/** O PNG sai em 2x (2400×1260), bom para tela retina e para as redes. */
export const EXPORT_SCALE = 2;

export function defaultState(): BannerState {
  return {
    background: "#ffffff",
    image: {
      enabled: true,
      src: null,
      radius: 50,
    },
    title: {
      text: "Seu Nome Aqui",
      font: "anthropic",
      color: "#1a1a1a",
    },
    subtitle: {
      text: "Subtítulo",
      font: "anthropic",
      color: "#4a4a4a",
    },
    tagline: {
      text: "https://seusite.dev",
      font: "mono",
      color: "#8a8a8a",
    },
    collage: [],
  };
}
