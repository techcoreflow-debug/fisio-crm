import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Empty state padrão — usado quando uma lista/filtro não tem resultado.
 * Ícone com um pouco mais de presença (círculo colorido) em vez do ícone
 * cinza solto de antes, com espaço opcional pra uma ação direta (ex.:
 * "Cadastrar paciente") em vez de só instruir a pessoa a ajustar o filtro.
 */
export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clinical-50 text-clinical-500">
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-display font-medium text-ink">{title}</p>
        <p className="max-w-sm text-sm text-ink-soft">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction} className="mt-1">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
