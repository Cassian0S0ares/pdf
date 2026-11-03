import { create } from "zustand";

interface PasswordPromptState {
  open: boolean;
  incorrect: boolean;
  fileName: string;
  resolve: ((value: string | null) => void) | null;
  ask(fileName: string, incorrect: boolean): Promise<string | null>;
  answer(value: string | null): void;
}

export const usePasswordPrompt = create<PasswordPromptState>()((set, get) => ({
  open: false,
  incorrect: false,
  fileName: "",
  resolve: null,
  ask: (fileName, incorrect) =>
    new Promise((resolve) => set({ open: true, incorrect, fileName, resolve })),
  answer: (value) => {
    get().resolve?.(value);
    set({ open: false, resolve: null });
  },
}));
