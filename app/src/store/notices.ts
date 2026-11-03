import { create } from "zustand";

export interface Notice {
  id: number;
  kind: "error" | "info";
  text: string;
}

interface NoticesState {
  notices: Notice[];
  push(kind: Notice["kind"], text: string): void;
  dismiss(id: number): void;
}

let nextId = 1;

export const useNotices = create<NoticesState>()((set) => ({
  notices: [],
  push: (kind, text) => set((s) => ({ notices: [...s.notices, { id: nextId++, kind, text }] })),
  dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));
