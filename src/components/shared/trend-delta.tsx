import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface TrendDeltaProps {
  atual: number;
  anterior: number;
  /** true (padrão): subir é bom (ex. atendimentos). false: subir é ruim (ex. tempo médio de internação). */
  subirEhBom?: boolean;
  sufixo?: string;
  className?: string;
}

/**
 * Variação real vs. o período anterior de mesma duração — nunca um
 * número inventado. Sem dado no período anterior, mostra "sem
 * comparação" em vez de forçar uma % sem sentido (divisão por zero).
 */
export function TrendDelta({ atual, anterior, subirEhBom = true, sufixo = "vs. período anterior", className }: TrendDeltaProps) {
  if (anterior === 0) {
    if (atual === 0) return null;
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium text-ink-soft ${className ?? ""}`}>
        <Minus className="h-3 w-3" /> sem dado no período anterior
      </span>
    );
  }

  const variacao = ((atual - anterior) / anterior) * 100;
  const subiu = variacao > 0.5;
  const desceu = variacao < -0.5;
  const bom = subiu ? subirEhBom : desceu ? !subirEhBom : null;
  const cor = bom === null ? "text-ink-soft" : bom ? "text-recovery-600" : "text-critical-600";
  const Icone = subiu ? ArrowUp : desceu ? ArrowDown : Minus;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${cor} ${className ?? ""}`}>
      <Icone className="h-3 w-3" />
      {variacao > 0 ? "+" : ""}
      {variacao.toFixed(1)}% {sufixo}
    </span>
  );
}
