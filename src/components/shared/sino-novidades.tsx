import { useEffect, useState } from "react";
import { Bell, TriangleAlert, CheckCircle2 } from "lucide-react";
import { NOVIDADES, ultimaVersaoDeNovidade } from "@/lib/novidades";
import { useAlertasOperacionais } from "@/data/alertas-operacionais";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CHAVE_STORAGE = "fisio:ultima-novidade-vista";

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
  const [aba, setAba] = useState<"alertas" | "novidades">("alertas");
  const alertas = useAlertasOperacionais();

  const indiceUltimaVista = NOVIDADES.findIndex((n) => n.versao === ultimaVista);
  const temNovidade = indiceUltimaVista !== 0;
  const temAlertaCritico = alertas.some((a) => a.tom === "critical");
  const temAlerta = alertas.length > 0;

  useEffect(() => {
    if (open) setAba(temAlertaCritico || temAlerta ? "alertas" : "novidades");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
          {(temAlertaCritico || temAlerta || temNovidade) && (
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
