"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const LIMIT = 100;

/**
 * Estado com desfazer/refazer.
 *
 * O estado visível muda na hora, mas só vira um passo do histórico depois de
 * `delay` sem alterações — assim uma frase digitada volta inteira no Ctrl+Z,
 * em vez de letra por letra.
 */
export function useHistoryState<T>(initial: T, delay = 500) {
  const [state, setState] = useState<T>(initial);
  const history = useRef<T[]>([initial]);
  const index = useRef(0);
  const [flags, setFlags] = useState({ canUndo: false, canRedo: false });
  /** estado mais recente, para os callbacks não dependerem dele */
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  const sync = useCallback(() => {
    setFlags({
      canUndo: index.current > 0,
      canRedo: index.current < history.current.length - 1,
    });
  }, []);

  /** fecha o passo atual do histórico */
  const commit = useCallback(
    (next: T) => {
      if (Object.is(next, history.current[index.current])) return;
      history.current = [...history.current.slice(0, index.current + 1), next].slice(-LIMIT);
      index.current = history.current.length - 1;
      sync();
    },
    [sync],
  );

  useEffect(() => {
    if (Object.is(state, history.current[index.current])) return;
    const timer = setTimeout(() => commit(state), delay);
    return () => clearTimeout(timer);
  }, [state, commit, delay]);

  /**
   * Fecha o passo atual na hora. Ações discretas (colar, excluir, reordenar)
   * chamam isto antes de mexer no estado, para cada uma virar um passo só seu
   * em vez de se juntarem pela espera do debounce.
   */
  const flush = useCallback(() => commit(latest.current), [commit]);

  const undo = useCallback(() => {
    // o que ainda não virou passo entra agora, para poder ser desfeito
    flush();
    if (index.current === 0) return;
    index.current -= 1;
    setState(history.current[index.current]);
    sync();
  }, [flush, sync]);

  const redo = useCallback(() => {
    if (index.current >= history.current.length - 1) return;
    index.current += 1;
    setState(history.current[index.current]);
    sync();
  }, [sync]);

  /** troca o estado sem deixar rastro (usado ao carregar o que estava salvo) */
  const replace = useCallback(
    (next: T) => {
      history.current = [next];
      index.current = 0;
      setState(next);
      sync();
    },
    [sync],
  );

  return { state, setState, undo, redo, replace, flush, ...flags };
}
