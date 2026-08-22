"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BannerStage from "@/components/BannerStage";
import type { ToolbarActions } from "@/components/Toolbar";
import { Button } from "@/components/ui";
import { fileToDataUrl, useImageStore, useNaturalSize } from "@/lib/images";
import { BANNER_HEIGHT, BANNER_WIDTH, defaultState, EXPORT_SCALE } from "@/lib/presets";
import { renderToBlob } from "@/lib/render";
import type {
  BannerState,
  CollageItem,
  MainImage,
  Selection,
  TextLayer,
  TextLayerKey,
} from "@/lib/types";

const STORAGE_KEY = "simple-banners:v1";

export default function Page() {
  const [state, setState] = useState<BannerState>(defaultState);
  const [selection, setSelection] = useState<Selection>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { images, ensure, version } = useImageStore();
  const naturalSize = useNaturalSize();
  const restored = useRef(false);

  /* ---------------- persistência local ----------------
     O servidor renderiza o padrão; o que estava salvo só pode ser lido
     depois da hidratação, por isso a leitura acontece aqui. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState({ ...defaultState(), ...(JSON.parse(raw) as BannerState) });
    } catch {
      /* ignora */
    }
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* provavelmente estourou a cota com imagens grandes */
      }
    }, 400);
    return () => clearTimeout(id);
  }, [state]);

  /* ---------------- carregamento das imagens ---------------- */
  useEffect(() => {
    ensure(state.image.src);
    state.collage.forEach((item) => ensure(item.src));
  }, [ensure, state.image.src, state.collage]);

  /* ---------------- edições ---------------- */
  const update = useCallback((patch: Partial<BannerState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const updateImage = useCallback((patch: Partial<MainImage>) => {
    setState((s) => ({ ...s, image: { ...s.image, ...patch } }));
  }, []);

  const updateText = useCallback((key: TextLayerKey, patch: Partial<TextLayer>) => {
    setState((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<CollageItem>) => {
    setState((s) => ({
      ...s,
      collage: s.collage.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }, []);

  const removeItem = useCallback((id: string) => {
    setState((s) => ({ ...s, collage: s.collage.filter((item) => item.id !== id) }));
    setSelection((cur) => (cur?.kind === "collage" && cur.id === id ? null : cur));
  }, []);

  const moveItem = useCallback((id: string, dir: "front" | "back") => {
    setState((s) => {
      const i = s.collage.findIndex((item) => item.id === id);
      if (i < 0) return s;
      const collage = [...s.collage];
      const [item] = collage.splice(i, 1);
      if (dir === "front") collage.push(item);
      else collage.unshift(item);
      return { ...s, collage };
    });
  }, []);

  const addCollage = useCallback(
    async (src: string, at?: { x: number; y: number }) => {
      let ratio = 1;
      try {
        const size = await naturalSize(src);
        ratio = size.height / size.width;
      } catch {
        setToast("Não consegui carregar essa imagem.");
        return;
      }
      const width = Math.round(BANNER_WIDTH * 0.28);
      const height = Math.round(width * ratio);
      const center = at ?? { x: BANNER_WIDTH / 2, y: BANNER_HEIGHT / 2 };
      const item: CollageItem = {
        id: crypto.randomUUID(),
        src,
        x: Math.round(center.x - width / 2),
        y: Math.round(center.y - height / 2),
        width,
        height,
        opacity: 1,
        radius: 0,
        rotation: 0,
        onTop: false,
      };
      setState((s) => ({ ...s, collage: [...s.collage, item] }));
      setSelection({ kind: "collage", id: item.id });
    },
    [naturalSize],
  );

  const addCollageFiles = useCallback(
    async (files: File[], at?: { x: number; y: number }) => {
      for (const file of files) {
        const src = await fileToDataUrl(file);
        await addCollage(src, at);
      }
    },
    [addCollage],
  );

  const actions: ToolbarActions = useMemo(
    () => ({
      update,
      updateText,
      updateImage,
      updateItem,
      removeItem,
      moveItem,
      addCollageFiles: (files) => void addCollageFiles(files),
      addCollageUrl: (url) => void addCollage(url),
    }),
    [
      update,
      updateText,
      updateImage,
      updateItem,
      removeItem,
      moveItem,
      addCollageFiles,
      addCollage,
    ],
  );

  /* ---------------- toast ---------------- */
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------------- exportação ---------------- */
  const fileName = useMemo(() => {
    const base = state.title.text.trim() || "banner";
    return `${base
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48)}-${BANNER_WIDTH}x${BANNER_HEIGHT}.png`;
  }, [state.title.text]);

  const download = async () => {
    setBusy(true);
    try {
      const blob = await renderToBlob(state, images, EXPORT_SCALE);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Falha ao exportar.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    setBusy(true);
    try {
      const blob = await renderToBlob(state, images, EXPORT_SCALE);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setToast("Banner copiado para a área de transferência.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Falha ao copiar.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setState(defaultState());
    setSelection(null);
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
        <span className="font-semibold tracking-[-0.01em]">Simple Banners</span>
        <div className="flex items-center gap-2">
          <Button variant="bare" size="sm" onClick={reset}>
            Restaurar
          </Button>
          <Button onClick={copy} disabled={busy}>
            Copiar
          </Button>
          <Button variant="primary" onClick={download} disabled={busy}>
            Baixar PNG
          </Button>
        </div>
      </header>

      <BannerStage
        state={state}
        images={images}
        version={version}
        selection={selection}
        onSelect={setSelection}
        actions={actions}
        onDropFiles={(files, at) => void addCollageFiles(files, at)}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-line-strong bg-surface-2 px-4 py-2.5 text-[13px] shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
          {toast}
        </div>
      )}
    </div>
  );
}
