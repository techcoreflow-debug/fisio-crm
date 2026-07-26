import { create } from "zustand";

export type ToastVariant = "error" | "success";

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

/**
 * Store de notificações visíveis. Regra do projeto: nenhum erro pode
 * falhar silenciosamente. Toda ação que grava, edita ou exclui dados
 * deve reportar sucesso ou falha aqui — nunca só um console.error.
 */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `t-${Math.random()}`;
    set({ toasts: [...get().toasts, { ...toast, id }] });
    const timeout = toast.variant === "error" ? 8000 : 4000;
    setTimeout(() => get().dismiss(id), timeout);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Extrai uma mensagem legível de qualquer erro lançado pelo repository. */
export function mensagemDeErro(erro: unknown, fallback: string): string {
  if (erro instanceof Error && erro.message) return erro.message;
  if (typeof erro === "string" && erro) return erro;
  return fallback;
}

export function notificarErro(title: string, erro: unknown) {
  useToastStore.getState().push({ variant: "error", title, description: mensagemDeErro(erro, "Tente novamente.") });
}

export function notificarSucesso(title: string, description?: string) {
  useToastStore.getState().push({ variant: "success", title, description });
}
