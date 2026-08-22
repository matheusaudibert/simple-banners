export type FontKey = "excalifont" | "inter" | "anthropic" | "mono";

export type TextLayerKey = "title" | "subtitle" | "tagline";

/** Tamanho, peso e espaçamento são fixos (ver TEXT_STYLE em lib/presets.ts). */
export type TextLayer = {
  text: string;
  font: FontKey;
  color: string;
};

export type MainImage = {
  enabled: boolean;
  src: string | null;
  /** border radius em % do lado (50 = círculo) */
  radius: number;
};

export type CollageItem = {
  id: string;
  src: string;
  /** canto superior esquerdo, em px do banner */
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  /** border radius em % do menor lado */
  radius: number;
  /** graus */
  rotation: number;
  /** desenhar acima do conteúdo (imagem + textos) */
  onTop: boolean;
};

export type BannerState = {
  background: string;
  image: MainImage;
  title: TextLayer;
  subtitle: TextLayer;
  tagline: TextLayer;
  collage: CollageItem[];
};

/** O que está selecionado no banner — a barra de opções segue isso. */
export type Selection =
  | { kind: "text"; key: TextLayerKey }
  | { kind: "image" }
  | { kind: "collage"; id: string }
  | { kind: "background" }
  | null;
