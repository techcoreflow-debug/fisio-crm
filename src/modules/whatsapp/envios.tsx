import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { executarLote, useWhatsappBatches, useWhatsappMessages, whatsapp } from "@/data/whatsapp";
import { formatarTelefone } from "@/lib/whatsapp";
import { notificarErro, notificarSucesso, notificarAviso } from "@/store/toast-store";
import type { StatusWhatsappLote, StatusWhatsappMensagem } from "@/types/domain";

const COR_MSG: Record<StatusWhatsappMensagem, "neutral" | "clinical" | "recovery" | "attention" | "critical"> = {
  pendente: "neutral",
  enviando: "clinical",
  enviada: "recovery",
  falha: "critical",
  cancelada: "attention",
};
const ROTULO_MSG: Record<StatusWhatsappMensagem, string> = {
  pendente: "Na fila",
  enviando: "Enviando",
  enviada: "Enviada",
  falha: "Falhou",
  cancelada: "Cancelada",
};
const ROTULO_LOTE: Record<StatusWhatsappLote, string> = {
  enviando: "Em andamento",
  pausado: "Pausado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function quando(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function EnviosWhatsapp({ empresaId }: { empresaId: string }) {
  const lotes = useWhatsappBatches();
  const mensagens = useWhatsappMessages();
  const [processando, setProcessando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<StatusWhatsappMensagem | "todas">("todas");
  const parar = useRef(false);

  useEffect(() => () => {
    parar.current = true; // sair da tela interrompe o laço; o lote continua "enviando" e pode ser retomado
  }, []);

  /** Chama a função em rodadas curtas (ela respeita pausa e limite diário) até acabar, falhar ou ser pausado. */
  async function processar(batchId: string) {
    parar.current = false;
    setProcessando(batchId);
    try {
      const r = await executarLote(empresaId, batchId, () => undefined, () => !parar.current);
      if (r.status === "concluido") notificarSucesso("Lote concluído", `${r.sent} enviadas, ${r.failed} com falha.`);
    } catch (erro) {
      notificarErro("O lote parou", erro);
    } finally {
      setProcessando(null);
    }
  }

  async function pausar(batchId: string) {
    parar.current = true;
    try {
      await whatsapp.atualizarLote(batchId, { status: "pausado" });
      notificarAviso("Lote pausado", "Retome quando quiser.");
    } catch (erro) {
      notificarErro("Não foi possível pausar", erro);
    }
  }

  async function retomar(batchId: string) {
    try {
      await whatsapp.atualizarLote(batchId, { status: "enviando" });
      void processar(batchId);
    } catch (erro) {
      notificarErro("Não foi possível retomar", erro);
    }
  }

  async function cancelar(batchId: string) {
    if (!window.confirm("Cancelar este lote? As mensagens que ainda não saíram não serão enviadas.")) return;
    parar.current = true;
    try {
      await whatsapp.atualizarLote(batchId, { status: "cancelado" });
    } catch (erro) {
      notificarErro("Não foi possível cancelar", erro);
    }
  }

  const visiveis = mensagens.filter((m) => filtro === "todas" || m.status === filtro).slice(0, 100);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">Lotes</h2>
        {lotes.length === 0 && <p className="text-sm text-ink-soft">Nenhum lote ainda. Crie um em Pesquisa de Satisfação → "Enviar para altas sem pesquisa".</p>}
        {lotes.slice(0, 10).map((l) => {
          const feitas = l.sent + l.failed;
          const pct = l.total ? Math.round((feitas / l.total) * 100) : 0;
          const ativo = processando === l.id;
          return (
            <Card key={l.id}>
              <CardContent className="flex flex-col gap-2 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-display font-semibold text-ink">{l.name}</p>
                    <p className="text-xs text-ink-soft">
                      {quando(l.created_at)} · {l.audience ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={l.status === "concluido" ? "recovery" : l.status === "cancelado" ? "critical" : l.status === "pausado" ? "attention" : "clinical"}>
                      {ROTULO_LOTE[l.status]}
                    </Badge>
                    {l.status === "enviando" && !ativo && (
                      <Button size="sm" onClick={() => void processar(l.id)}><Play /> Continuar</Button>
                    )}
                    {ativo && <Loader2 className="h-4 w-4 animate-spin text-clinical-500" />}
                    {(l.status === "enviando" || ativo) && (
                      <Button size="sm" variant="secondary" onClick={() => void pausar(l.id)}><Pause /> Pausar</Button>
                    )}
                    {l.status === "pausado" && (
                      <Button size="sm" onClick={() => void retomar(l.id)}><Play /> Retomar</Button>
                    )}
                    {(l.status === "enviando" || l.status === "pausado") && (
                      <Button size="sm" variant="ghost" onClick={() => void cancelar(l.id)} aria-label="Cancelar lote"><XCircle /></Button>
                    )}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full bg-clinical-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-ink-soft">
                  {l.sent} enviadas · {l.failed} com falha · {Math.max(l.total - feitas, 0)} restantes de {l.total}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">Últimas mensagens</h2>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as StatusWhatsappMensagem | "todas")}
            className="h-8 rounded-md border border-line-strong bg-surface-raised px-2 text-xs"
            aria-label="Filtrar por situação"
          >
            <option value="todas">Todas</option>
            {(Object.keys(ROTULO_MSG) as StatusWhatsappMensagem[]).map((s) => (
              <option key={s} value={s}>{ROTULO_MSG[s]}</option>
            ))}
          </select>
        </div>
        {visiveis.length === 0 && <p className="text-sm text-ink-soft">Nenhuma mensagem.</p>}
        <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-soft">
              <tr>
                <th className="px-3 py-2">Quando</th>
                <th className="px-3 py-2">Para</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-3 py-2">{quando(m.sent_at ?? m.created_at)}</td>
                  <td className="px-3 py-2">
                    {m.recipient_name ?? "—"}
                    <span className="block text-xs text-ink-soft">{formatarTelefone(m.to_number.replace(/^55/, ""))}</span>
                  </td>
                  <td className="px-3 py-2"><Badge variant={COR_MSG[m.status]}>{ROTULO_MSG[m.status]}</Badge></td>
                  <td className="max-w-md px-3 py-2 text-xs text-ink-soft">{m.error ?? m.body.slice(0, 90)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
