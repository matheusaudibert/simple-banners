import rough from "roughjs";
import type { RoughCanvas } from "roughjs/bin/canvas";
import { bounds } from "./elements";
import type { ImageMap } from "./images";
import { computeLayout } from "./layout";
import { BANNER_HEIGHT, BANNER_WIDTH, TEXT_STYLE, fontStack } from "./presets";
import type { BannerElement, BannerState, ImageElement, ShapeElement, TextElement } from "./types";

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

/** desenha preenchendo a área (equivalente ao object-fit: cover) */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const iw = img.naturalWidth || w;
  const ih = img.naturalHeight || h;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

/* ===================== Elementos ===================== */

function drawShape(rc: RoughCanvas, el: ShapeElement) {
  const options = {
    stroke: el.stroke,
    strokeWidth: el.strokeWidth,
    roughness: 1.1,
    bowing: 1,
    seed: el.seed,
    ...(el.fill ? { fill: el.fill, fillStyle: "solid" as const } : {}),
  };
  const b = bounds(el);

  switch (el.type) {
    case "rect":
      rc.rectangle(b.x, b.y, b.width, b.height, options);
      break;
    case "ellipse":
      rc.ellipse(b.x + b.width / 2, b.y + b.height / 2, b.width, b.height, options);
      break;
    case "diamond":
      rc.polygon(
        [
          [b.x + b.width / 2, b.y],
          [b.x + b.width, b.y + b.height / 2],
          [b.x + b.width / 2, b.y + b.height],
          [b.x, b.y + b.height / 2],
        ],
        options,
      );
      break;
    case "line":
      rc.line(el.x, el.y, el.x + el.width, el.y + el.height, options);
      break;
    case "arrow": {
      const x2 = el.x + el.width;
      const y2 = el.y + el.height;
      rc.line(el.x, el.y, x2, y2, options);
      const angle = Math.atan2(el.height, el.width);
      const head = Math.min(24, Math.max(10, Math.hypot(el.width, el.height) * 0.22));
      for (const side of [-1, 1]) {
        const a = angle + side * 0.45 + Math.PI;
        rc.line(x2, y2, x2 + Math.cos(a) * head, y2 + Math.sin(a) * head, options);
      }
      break;
    }
    case "draw": {
      const points = (el.points ?? []).map((p) => [el.x + p.x, el.y + p.y] as [number, number]);
      if (points.length > 1) rc.curve(points, { ...options, fill: undefined });
      break;
    }
  }
}

function drawTextElement(ctx: CanvasRenderingContext2D, el: TextElement) {
  ctx.fillStyle = el.color;
  ctx.font = `${el.size}px ${fontStack(el.font)}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const lineHeight = el.size * 1.25;
  el.text.split("\n").forEach((line, i) => {
    ctx.fillText(line, el.x, el.y + (i + 0.5) * lineHeight);
  });
}

function drawImageElement(ctx: CanvasRenderingContext2D, el: ImageElement, img: HTMLImageElement) {
  const b = bounds(el);
  ctx.save();
  const radius = (Math.min(50, Math.max(0, el.radius)) / 100) * Math.min(b.width, b.height);
  if (radius > 0) {
    roundRectPath(ctx, b.x, b.y, b.width, b.height, radius);
    ctx.clip();
  }
  ctx.drawImage(img, b.x, b.y, b.width, b.height);
  ctx.restore();
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  el: BannerElement,
  images: ImageMap,
) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, el.opacity));
  if (el.rotation) {
    const b = bounds(el);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  if (el.type === "text") {
    drawTextElement(ctx, el);
  } else if (el.type === "image") {
    const img = images.get(el.src);
    if (img) drawImageElement(ctx, el, img);
  } else {
    drawShape(rc, el);
  }
  ctx.restore();
}

/* ===================== Banner ===================== */

/** Desenha o banner inteiro em coordenadas do banner (1px = 1px do PNG final). */
export function drawBanner(
  ctx: CanvasRenderingContext2D,
  state: BannerState,
  images: ImageMap,
  scale = 1,
  extra: BannerElement | null = null,
) {
  const layout = computeLayout(state);
  const rc = rough.canvas(ctx.canvas);

  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT);

  if (layout.image && state.image.src) {
    const img = images.get(state.image.src);
    if (img) {
      ctx.save();
      roundRectPath(
        ctx,
        layout.image.x,
        layout.image.y,
        layout.image.size,
        layout.image.size,
        layout.image.radius,
      );
      ctx.clip();
      drawCover(ctx, img, layout.image.x, layout.image.y, layout.image.size, layout.image.size);
      ctx.restore();
    }
  }

  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (const text of layout.texts) {
    ctx.fillStyle = text.color;
    ctx.font = `${text.weight} ${text.size}px ${text.family}`;
    text.lines.forEach((line, i) => {
      ctx.fillText(line, text.x, text.y + (i + 0.5) * text.lineHeight);
    });
  }

  for (const el of state.elements) drawElement(ctx, rc, el, images);
  if (extra) drawElement(ctx, rc, extra, images);

  ctx.restore();
}

/** Garante que as fontes usadas estejam prontas antes de rasterizar. */
export async function ensureFonts(state: BannerState) {
  if (typeof document === "undefined" || !document.fonts) return;
  const keys = ["title", "subtitle", "link"] as const;
  const jobs = keys.map((key) => {
    const style = TEXT_STYLE[key];
    return document.fonts
      .load(`${style.weight} ${style.size}px ${fontStack(state[key].font)}`, state[key].text || "Ag")
      .catch(() => undefined);
  });
  for (const el of state.elements) {
    if (el.type === "text") {
      jobs.push(
        document.fonts
          .load(`${el.size}px ${fontStack(el.font)}`, el.text || "Ag")
          .catch(() => undefined),
      );
    }
  }
  await Promise.all(jobs);
  await document.fonts.ready;
}

export async function renderToBlob(
  state: BannerState,
  images: ImageMap,
  scale: number,
): Promise<Blob> {
  await ensureFonts(state);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(BANNER_WIDTH * scale);
  canvas.height = Math.round(BANNER_HEIGHT * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  drawBanner(ctx, state, images, scale);

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("não foi possível gerar o PNG"));
      }, "image/png");
    } catch {
      reject(
        new Error(
          "Uma imagem por URL bloqueou a exportação (CORS). Faça o upload do arquivo em vez de usar o link.",
        ),
      );
    }
  });
}
