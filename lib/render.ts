import type { ImageMap } from "./images";
import { computeLayout } from "./layout";
import { BANNER_HEIGHT, BANNER_WIDTH, TEXT_STYLE, fontStack } from "./presets";
import type { BannerState, CollageItem, TextLayerKey } from "./types";

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

function drawCollageItem(ctx: CanvasRenderingContext2D, item: CollageItem, img: HTMLImageElement) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, item.opacity));
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  ctx.translate(cx, cy);
  if (item.rotation) ctx.rotate((item.rotation * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  const radius = (Math.min(50, Math.max(0, item.radius)) / 100) * Math.min(item.width, item.height);
  if (radius > 0) {
    roundRectPath(ctx, item.x, item.y, item.width, item.height, radius);
    ctx.clip();
  }
  ctx.drawImage(img, item.x, item.y, item.width, item.height);
  ctx.restore();
}

/** Desenha o banner inteiro em coordenadas do banner (1px = 1px do PNG final). */
export function drawBanner(
  ctx: CanvasRenderingContext2D,
  state: BannerState,
  images: ImageMap,
  scale = 1,
  options: { skipText?: TextLayerKey | null } = {},
) {
  const layout = computeLayout(state);

  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT);

  const below = state.collage.filter((c) => !c.onTop);
  const above = state.collage.filter((c) => c.onTop);

  for (const item of below) {
    const img = images.get(item.src);
    if (img) drawCollageItem(ctx, item, img);
  }

  if (layout.image && state.image.src) {
    const img = images.get(state.image.src);
    if (img) {
      ctx.save();
      roundRectPath(ctx, layout.image.x, layout.image.y, layout.image.size, layout.image.size, layout.image.radius);
      ctx.clip();
      drawCover(ctx, img, layout.image.x, layout.image.y, layout.image.size, layout.image.size);
      ctx.restore();
    }
  }

  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (const text of layout.texts) {
    if (text.key === options.skipText) continue;
    ctx.fillStyle = text.color;
    ctx.font = `${text.weight} ${text.size}px ${text.family}`;
    text.lines.forEach((line, i) => {
      ctx.fillText(line, text.x, text.y + (i + 0.5) * text.lineHeight);
    });
  }

  for (const item of above) {
    const img = images.get(item.src);
    if (img) drawCollageItem(ctx, item, img);
  }

  ctx.restore();
}

/** Garante que as fontes usadas estejam prontas antes de rasterizar. */
export async function ensureFonts(state: BannerState) {
  if (typeof document === "undefined" || !document.fonts) return;
  const keys = ["title", "subtitle", "tagline"] as const;
  await Promise.all(
    keys.map((key) => {
      const style = TEXT_STYLE[key];
      return document.fonts
        .load(
          `${style.weight} ${style.size}px ${fontStack(state[key].font)}`,
          state[key].text || "Ag",
        )
        .catch(() => undefined);
    }),
  );
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
