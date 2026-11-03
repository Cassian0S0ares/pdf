import { create } from "zustand";

interface PasswordPromptState {
  open: boolean;
  incorrect: boolean;
  fileName: string;
  resolve: ((value: string | null) => void) | null;
  ask(fileName: string, incorrect: boolean): Promise<string | null>;
  answer(value: string | null): void;
}

interface PendingAsk {
  fileName: string;
  incorrect: boolean;
  resolve: (value: string | null) => void;
}

/** Pedidos que chegaram enquanto o diálogo estava aberto; atendidos em ordem (um por vez). */
const queue: PendingAsk[] = [];

export const usePasswordPrompt = create<PasswordPromptState>()((set, get) => {
  const showNext = () => {
    const next = queue.shift();
    if (next) set({ open: true, incorrect: next.incorrect, fileName: next.fileName, resolve: next.resolve });
    else set({ open: false, resolve: null });
  };
  return {
    open: false,
    incorrect: false,
    fileName: "",
    resolve: null,
    ask: (fileName, incorrect) =>
      new Promise((resolve) => {
        queue.push({ fileName, incorrect, resolve });
        if (!get().open) showNext();
      }),
    answer: (value) => {
      const current = get().resolve;
      if (!current) return;
      current(value);
      showNext();
    },
  };
});
