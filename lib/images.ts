"use client";

import { useCallback, useEffect, useState } from "react";

export type ImageMap = Map<string, HTMLImageElement>;

/**
 * URLs externas passam pelo proxy do próprio app: assim a imagem chega
 * como same-origin e o canvas continua exportável.
 */
export function resolveSrc(src: string): string {
  return /^https?:/i.test(src) ? `/api/proxy?url=${encodeURIComponent(src)}` : src;
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("falha ao carregar imagem"));
    img.src = resolveSrc(src);
  });
}

/**
 * Cache de imagens já carregadas. O Map é mutável de propósito (as imagens
 * não são renderizadas pelo React, e sim desenhadas no canvas); `version`
 * é quem avisa a UI de que chegou algo novo para redesenhar.
 */
export function useImageStore() {
  const [images] = useState<ImageMap>(() => new Map());
  const [pending] = useState<Set<string>>(() => new Set());
  const [version, setVersion] = useState(0);

  const ensure = useCallback(
    (src: string | null | undefined) => {
      if (!src || images.has(src) || pending.has(src)) return;
      pending.add(src);
      load(src)
        .then((img) => {
          images.set(src, img);
          setVersion((v) => v + 1);
        })
        .catch(() => {
          /* a imagem simplesmente não aparece */
        })
        .finally(() => pending.delete(src));
    },
    [images, pending],
  );

  return { images, ensure, version };
}

/** Lê um File como data URL (assim a imagem nunca sai da máquina). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

/** Dimensões naturais, para manter a proporção ao adicionar na colagem. */
export function useNaturalSize() {
  const [cache] = useState(() => new Map<string, { width: number; height: number }>());
  return useCallback(
    async (src: string) => {
      const hit = cache.get(src);
      if (hit) return hit;
      const img = await load(src);
      const size = { width: img.naturalWidth || 1, height: img.naturalHeight || 1 };
      cache.set(src, size);
      return size;
    },
    [cache],
  );
}

export function useDebouncedEffect(effect: () => void, deps: unknown[], delay: number) {
  useEffect(() => {
    const t = setTimeout(effect, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}
