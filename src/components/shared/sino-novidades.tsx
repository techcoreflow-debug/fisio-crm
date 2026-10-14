import { useEffect, useState } from "react";
import {
  Bell,
  TriangleAlert,
  CheckCircle2,
  Plus,
  BedDouble,
  ArrowRightLeft,
  CornerDownLeft,
  LogOut,
  HeartPulse,
  Undo2,
} from "lucide-react";
import { NOVIDADES, ultimaVersaoDeNovidade } from "@/lib/novidades";
import { useAlertasOperacionais } from "@/data/alertas-operacionais";
import { useMovimentacoes } from "@/data/movimentacoes";
import { tempoRelativo, type TipoMovimentacao } from "@/lib/movimentacoes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CHAVE_STORAGE = "fisio:ultima-novidade-vista";
const CHAVE_MOVIMENTOS = "fisio:movimentacoes-vistas";

const iconePorTipo: Record<TipoMovimentacao, typeof Plus> = {
  internacao: Plus,
  lote_internacoes: Plus,
  mudanca_unidade: BedDouble,
  transferencia: ArrowRightLeft,
  retorno: CornerDownLeft,
  alta: LogOut,
  obito: HeartPulse,
  alta_externa: LogOut,
  alta_desfeita: Undo2,
};

function lerMovimentosVistos(): string {
  try {
    const salvo = localStorage.getItem(CHAVE_MOVIMENTOS);
    if (salvo) return salvo;
    // Primeira vez neste aparelho: não acende o sino por todo o histórico.
    const agora = new Date().toISOString();
    localStorage.setItem(CHAVE_MOVIMENTOS, agora);
    return agora;
  } catch {
    return new Date().toISOString();
  }
}

function lerUltimaVista(): string {
  try {
    return localStorage.getItem(CHAVE_STORAGE) ?? "";
  } catch {
    return "";
  }
}

/**
 * Central de notificações — evolução do antigo "sino de novidades".
 * Duas abas: Alertas (condições reais dos dados, mesma lógica do
 * Dashboard Executivo — leitos travados, evoluções em atraso, contratos
 * vencendo) e Novidades (changelog do produto, como já era). O ponto
 * vermelho prioriza alerta crítico > alerta de atenção > novidade não
 * vista, nessa ordem.
 */
export function SinoNovidades() {
  const [ultimaVista, setUltimaVista] = useState(lerUltimaVista);
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState<"alertas" | "movimentos" | "novidades">("alertas");
  const alertas = useAlertasOperacionais();
  const movimentacoes = useMovimentacoes();
  const [movimentosVistos, setMovimentosVistos] = useState(lerMovimentosVistos);
  // Foto do "visto" no momento em que o sino abre, para destacar o que é novo mesmo depois de marcar como visto.
  const [vistoNaAbertura, setVistoNaAbertura] = useState(movimentosVistos);
  const novasMovimentacoes = movimentacoes.filter((m) => m.quando > movimentosVistos).length;

  const indiceUltimaVista = NOVIDADES.findIndex((n) => n.versao === ultimaVista);
  const temNovidade = indiceUltimaVista !== 0;
  const temAlertaCritico = alertas.some((a) => a.tom === "critical");
  const temAlerta = alertas.length > 0;

  useEffect(() => {
    if (open) {
      setVistoNaAbertura(movimentosVistos);
      setAba(
        temAlertaCritico ? "alertas" : novasMovimentacoes > 0 ? "movimentos" : temAlerta ? "alertas" : "movimentos"
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Ao ver a aba de movimentações, marca tudo até agora como visto.
  useEffect(() => {
    if (open && aba === "movimentos" && novasMovimentacoes > 0) {
      const agora = new Date().toISOString();
      try {
        localStorage.setItem(CHAVE_MOVIMENTOS, agora);
      } catch {
        // sem persistência nesse aparelho, tudo bem
      }
      setMovimentosVistos(agora);
    }
  }, [open, aba, novasMovimentacoes]);

  useEffect(() => {
    if (open && temNovidade) {
      const maisRecente = ultimaVersaoDeNovidade();
      try {
        localStorage.setItem(CHAVE_STORAGE, maisRecente);
      } catch {
        // sem persistência nesse aparelho, tudo bem
      }
      setUltimaVista(maisRecente);
    }
  }, [open, temNovidade]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Central de notificações">
          <Bell className="h-4.5 w-4.5" />
          {(temAlertaCritico || temAlerta || novasMovimentacoes > 0 || temNovidade) && (
            <span
              className={cn(
                "absolute right-1.5 top-1.5 h-2 w-2 rounded-full",
                temAlertaCritico ? "bg-critical-400" : temAlerta ? "bg-attention-400" : "bg-clinical-400"
              )}
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex border-b border-line">
          <button
            type="button"
            onClick={() => setAba("alertas")}
            className={cn(
              "flex-1 px-3 py-2.5 text-sm font-medium transition-colors",
              aba === "alertas" ? "border-b-2 border-clinical-500 text-ink" : "text-ink-soft hover:text-ink"
            )}
          >
            Alertas {alertas.length > 0 && <span className="ml-1 text-xs text-ink-soft">({alertas.length})</span>}
          </button>
          <button
            type="button"
            onClick={() => setAba("movimentos")}
            className={cn(
              "flex-1 px-3 py-2.5 text-sm font-medium transition-colors",
              aba === "movimentos" ? "border-b-2 border-clinical-500 text-ink" : "text-ink-soft hover:text-ink"
            )}
          >
            Movimentações{" "}
            {novasMovimentacoes > 0 && (
              <span className="ml-1 rounded-full bg-clinical-100 px-1.5 text-xs text-clinical-700">{novasMovimentacoes}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setAba("novidades")}
            className={cn(
              "flex-1 px-3 py-2.5 text-sm font-medium transition-colors",
              aba === "novidades" ? "border-b-2 border-clinical-500 text-ink" : "text-ink-soft hover:text-ink"
            )}
          >
            Novidades
          </button>
        </div>

        {aba === "alertas" ? (
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto p-2">
            {alertas.length === 0 ? (
              <div className="flex items-center gap-2 px-2 py-6 text-sm text-ink-soft">
                <CheckCircle2 className="h-4 w-4 text-recovery-500" /> Nenhum alerta no momento.
              </div>
            ) : (
              alertas.map((a) => (
                <div key={a.id} className="flex gap-2.5 rounded-md p-2 hover:bg-surface-sunken">
                  <TriangleAlert
                    className={cn("mt-0.5 h-4 w-4 shrink-0", a.tom === "critical" ? "text-critical-400" : "text-attention-400")}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-ink">{a.titulo}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">{a.detalhe}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : aba === "movimentos" ? (
          <div className="flex max-h-96 flex-col gap-1 overflow-y-auto p-2">
            {movimentacoes.length === 0 ? (
              <p className="px-2 py-6 text-sm text-ink-soft">Nenhuma movimentação registrada ainda.</p>
            ) : (
              movimentacoes.map((m) => {
                const Icone = iconePorTipo[m.tipo];
                const nova = m.quando > vistoNaAbertura;
                return (
                  <div key={m.id} className="flex gap-2.5 rounded-md p-2 hover:bg-surface-sunken">
                    <Icone
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        m.tom === "critical"
                          ? "text-critical-400"
                          : m.tom === "attention"
                            ? "text-attention-400"
                            : m.tom === "recovery"
                              ? "text-recovery-500"
                              : "text-ink-soft"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium leading-snug text-ink">
                          {m.titulo}
                          {nova && <span className="ml-1.5 rounded-full bg-clinical-100 px-1.5 text-[10px] font-medium text-clinical-700">novo</span>}
                        </p>
                        <span className="shrink-0 text-[10px] text-ink-soft/70" title={new Date(m.quando).toLocaleString("pt-BR")}>
                          {tempoRelativo(m.quando)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-soft" title={m.detalhe}>{m.detalhe}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="flex max-h-96 flex-col gap-3 overflow-y-auto p-3">
            {NOVIDADES.map((n) => (
              <div key={`${n.versao}-${n.titulo}`} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{n.titulo}</p>
                  <span className="shrink-0 text-[10px] text-ink-soft/70">{n.data}</span>
                </div>
                <p className="text-xs text-ink-soft">{n.descricao}</p>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
