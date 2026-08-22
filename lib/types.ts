export type FontKey = "excalifont" | "inter" | "anthropic" | "mono";

export type TextLayerKey = "title" | "subtitle" | "link";

/** Tamanho, peso e espaçamento dos textos fixos são fixos (ver TEXT_STYLE). */
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

/* ===================== Elementos desenháveis ===================== */

export type Point = { x: number; y: number };

/** Ferramentas do dock. "select" é o cursor. */
export type Tool =
  | "select"
  | "rect"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "draw"
  | "text"
  | "image"
  | "eraser";

export type ShapeKind = "rect" | "diamond" | "ellipse" | "arrow" | "line" | "draw";

type BaseElement = {
  id: string;
  /** canto superior esquerdo da caixa, em px do banner */
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  /** graus, girando em torno do centro da caixa */
  rotation: number;
  /** mantém o traço à mão livre estável entre um desenho e outro */
  seed: number;
};

export type ShapeElement = BaseElement & {
  type: ShapeKind;
  stroke: string;
  strokeWidth: number;
  /** null = sem preenchimento */
  fill: string | null;
  /** só para "draw": pontos relativos ao canto da caixa */
  points?: Point[];
};

export type TextElement = BaseElement & {
  type: "text";
  text: string;
  color: string;
  font: FontKey;
  size: number;
};

export type ImageElement = BaseElement & {
  type: "image";
  src: string;
  /** border radius em % do menor lado */
  radius: number;
};

export type BannerElement = ShapeElement | TextElement | ImageElement;

export const isShape = (el: BannerElement): el is ShapeElement =>
  el.type === "rect" ||
  el.type === "diamond" ||
  el.type === "ellipse" ||
  el.type === "arrow" ||
  el.type === "line" ||
  el.type === "draw";

/* ===================== Banner ===================== */

export type BannerState = {
  background: string;
  image: MainImage;
  title: TextLayer;
  subtitle: TextLayer;
  link: TextLayer;
  /** tudo que foi desenhado ou colado, do fundo para a frente */
  elements: BannerElement[];
};

/** O que está selecionado — a barra de opções segue isto. */
export type Selection =
  | { kind: "text"; key: TextLayerKey }
  | { kind: "image" }
  | { kind: "element"; id: string }
  | null;
