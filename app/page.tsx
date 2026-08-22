"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BannerStage from "@/components/BannerStage";
import ExportButton from "@/components/ExportButton";
import type { ToolbarActions } from "@/components/Toolbar";
import { Button, Icon, IconButton } from "@/components/ui";
import { DEFAULT_STYLE, newImage, type DrawStyle } from "@/lib/elements";
import { useHistoryState } from "@/lib/history";
import { fileToDataUrl, useImageStore, useNaturalSize } from "@/lib/images";
import {
  BANNER_HEIGHT,
  BANNER_WIDTH,
  DEFAULT_EXPORT_SCALE,
  defaultState,
  fontStack,
} from "@/lib/presets";
import { renderToBlob } from "@/lib/render";
import type {
  BannerElement,
  BannerState,
  MainImage,
  Point,
  Selection,
  TextLayer,
  TextLayerKey,
  Tool,
} from "@/lib/types";

const STORAGE_KEY = "simple-banners:v2";

export default function Page() {
  const initialState = useMemo(() => defaultState(), []);
  const { state, setState, undo, redo, replace, flush, canUndo, canRedo } =
    useHistoryState<BannerState>(initialState);
  const [selection, setSelection] = useState<Selection>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [style, setStyleState] = useState<DrawStyle>(DEFAULT_STYLE);
  const [exportScale, setExportScale] = useState(DEFAULT_EXPORT_SCALE);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { images, ensure, version } = useImageStore();
  const naturalSize = useNaturalSize();
  const restored = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  /** cópia interna de um elemento (Ctrl+C / Ctrl+V) */
  const clipboard = useRef<BannerElement | null>(null);

  /* ---------------- persistência local ----------------
     O servidor renderiza o padrão; o que estava salvo só pode ser lido
     depois da hidratação, por isso a leitura acontece aqui. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as BannerState & { tagline?: TextLayer };
        // "tagline" virou "link"; o texto salvo antes disso continua valendo
        const { tagline, ...rest } = saved;
        replace({ ...defaultState(), ...rest, ...(tagline && !saved.link ? { link: tagline } : {}) });
      }
    } catch {
      /* ignora */
    }
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    state.elements.forEach((el) => {
      if (el.type === "image") ensure(el.src);
    });
  }, [ensure, state.image.src, state.elements]);

  /* ---------------- edições ---------------- */
  const update = useCallback(
    (patch: Partial<BannerState>) => {
      setState((s) => ({ ...s, ...patch }));
    },
    [setState],
  );

  const updateImage = useCallback(
    (patch: Partial<MainImage>) => {
      setState((s) => ({ ...s, image: { ...s.image, ...patch } }));
    },
    [setState],
  );

  const updateText = useCallback(
    (key: TextLayerKey, patch: Partial<TextLayer>) => {
      setState((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
    },
    [setState],
  );

  const addElement = useCallback(
    (element: BannerElement) => {
      flush();
      setState((s) => ({ ...s, elements: [...s.elements, element] }));
    },
    [flush, setState],
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<BannerElement>) => {
      setState((s) => ({
        ...s,
        elements: s.elements.map((el) =>
          el.id === id ? ({ ...el, ...patch } as BannerElement) : el,
        ),
      }));
    },
    [setState],
  );

  const removeElement = useCallback(
    (id: string) => {
      flush();
      setState((s) => ({ ...s, elements: s.elements.filter((el) => el.id !== id) }));
      setSelection((cur) => (cur?.kind === "element" && cur.id === id ? null : cur));
    },
    [flush, setState],
  );

  const moveElement = useCallback(
    (id: string, dir: "front" | "back") => {
      flush();
      setState((s) => {
        const i = s.elements.findIndex((el) => el.id === id);
        if (i < 0) return s;
        const elements = [...s.elements];
        const [el] = elements.splice(i, 1);
        if (dir === "front") elements.push(el);
        else elements.unshift(el);
        return { ...s, elements };
      });
    },
    [flush, setState],
  );

  const setStyle = useCallback((patch: Partial<DrawStyle>) => {
    setStyleState((s) => ({ ...s, ...patch }));
  }, []);

  /** trocar de ferramenta larga o que estava selecionado */
  const chooseTool = useCallback((next: Tool) => {
    setTool(next);
    if (next !== "select") setSelection(null);
  }, []);

  /* ---------------- imagens soltas ---------------- */
  const addImage = useCallback(
    async (src: string, at?: Point) => {
      let ratio = 1;
      try {
        const size = await naturalSize(src);
        ratio = size.height / size.width;
      } catch {
        setToast("Não consegui carregar essa imagem.");
        return;
      }
      const width = Math.round(BANNER_WIDTH * 0.28);
      const el = newImage(
        src,
        at ?? { x: BANNER_WIDTH / 2, y: BANNER_HEIGHT / 2 },
        width,
        Math.round(width * ratio),
      );
      addElement(el);
      setSelection({ kind: "element", id: el.id });
    },
    [addElement, naturalSize],
  );

  const addImageFiles = useCallback(
    async (files: File[], at?: Point) => {
      for (const file of files) {
        const src = await fileToDataUrl(file);
        await addImage(src, at);
      }
    },
    [addImage],
  );

  /** duplica um elemento, deslocado para não ficar exatamente por cima */
  const pasteElement = useCallback(
    (el: BannerElement) => {
      const copy = { ...el, id: crypto.randomUUID(), x: el.x + 24, y: el.y + 24 };
      addElement(copy);
      setSelection({ kind: "element", id: copy.id });
    },
    [addElement],
  );

  const actions: ToolbarActions = useMemo(
    () => ({
      update,
      updateText,
      updateImage,
      addElement,
      updateElement,
      removeElement,
      moveElement,
      addImageFiles: (files) => void addImageFiles(files),
      addImageUrl: (url) => void addImage(url),
      setStyle,
    }),
    [
      update,
      updateText,
      updateImage,
      addElement,
      updateElement,
      removeElement,
      moveElement,
      addImageFiles,
      addImage,
      setStyle,
    ],
  );

  /* ---------------- atalhos ----------------
     Ctrl/Cmd + Z / Y desfazem e refazem; Ctrl/Cmd + C / X / V copiam,
     recortam e colam o elemento selecionado; 1-9 e 0 trocam de ferramenta. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
          return;
        }
        if (key === "y" || (key === "z" && e.shiftKey)) {
          e.preventDefault();
          redo();
          return;
        }
        if (typing) return;

        const el =
          selection?.kind === "element"
            ? (state.elements.find((c) => c.id === selection.id) ?? null)
            : null;

        if ((key === "c" || key === "x") && el) {
          e.preventDefault();
          clipboard.current = el;
          if (key === "x") removeElement(el.id);
          setToast(key === "x" ? "Elemento recortado." : "Elemento copiado.");
          return;
        }
        if (key === "v" && clipboard.current) {
          e.preventDefault();
          pasteElement(clipboard.current);
        }
        return;
      }

      if (typing) return;

      if (e.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur?.();
        setSelection(null);
        setTool("select");
        return;
      }

      if (e.key === "9") {
        e.preventDefault();
        imageInputRef.current?.click();
        return;
      }
      const byKey: Record<string, Tool> = {
        "1": "select",
        "2": "rect",
        "3": "diamond",
        "4": "ellipse",
        "5": "arrow",
        "6": "line",
        "7": "draw",
        "8": "text",
        "0": "eraser",
      };
      const next = byKey[e.key];
      if (next) {
        e.preventDefault();
        chooseTool(next);
        return;
      }

      if (selection?.kind !== "element") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeElement(selection.id);
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const delta = moves[e.key];
      if (!delta) return;
      e.preventDefault();
      const el = state.elements.find((c) => c.id === selection.id);
      if (el) updateElement(el.id, { x: el.x + delta[0], y: el.y + delta[1] });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selection, state.elements, removeElement, pasteElement, updateElement, chooseTool]);

  /* ---------------- colar imagem do sistema ---------------- */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (!files.length) return;
      e.preventDefault();
      void addImageFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addImageFiles]);

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
      .slice(0, 48)}-${BANNER_WIDTH * exportScale}x${BANNER_HEIGHT * exportScale}.png`;
  }, [state.title.text, exportScale]);

  const download = async () => {
    setBusy(true);
    try {
      const blob = await renderToBlob(state, images, exportScale);
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
      const blob = await renderToBlob(state, images, exportScale);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setToast("Banner copiado para a área de transferência.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Falha ao copiar.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    flush();
    setState(defaultState());
    setSelection(null);
    setTool("select");
  };

  return (
    <div className="checkerboard flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-end gap-2 px-4">
        <IconButton label="Desfazer (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Icon.Undo />
        </IconButton>
        <IconButton label="Refazer (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
          <Icon.Redo />
        </IconButton>
        <Button onClick={reset}>Restaurar</Button>
        <Button onClick={copy} disabled={busy}>
          Copiar
        </Button>
        <ExportButton
          scale={exportScale}
          onScaleChange={setExportScale}
          onDownload={download}
          disabled={busy}
        />
      </header>

      <BannerStage
        state={state}
        images={images}
        version={version}
        selection={selection}
        onSelect={setSelection}
        tool={tool}
        onToolChange={chooseTool}
        style={style}
        actions={actions}
        onDropFiles={(files, at) => void addImageFiles(files, at)}
        onPickImage={() => imageInputRef.current?.click()}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void addImageFiles(files);
          e.target.value = "";
        }}
      />

      <footer
        className="shrink-0 pb-5 pt-1 text-center text-[15px] text-ink-faint"
        style={{ fontFamily: fontStack("excalifont") }}
      >
        Simple Banners
      </footer>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-line-strong bg-surface-2 px-4 py-2.5 text-[13px] shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
          {toast}
        </div>
      )}
    </div>
  );
}
