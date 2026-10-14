import { useMemo, useRef, useState, useEffect } from "react";
import { Loader2, Send, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  useAdmissions, usePatients, useSatisfactionSurveyTemplates, useSatisfactionSurveys, useCompanies, useHospitals,
} from "@/data/repository";
import {
  criarPesquisasEmLote, envioAutomaticoDisponivel, executarLote, useWhatsappSettings, useWhatsappTemplates, whatsapp,
} from "@/data/whatsapp";
import { selecionarDestinatariosPesquisa } from "@/lib/lote-pesquisa";
import { estimarDuracaoLote, limparVariaveisPendentes, renderizarTemplate } from "@/lib/whatsapp";
import { hojeLocalIso } from "@/lib/data-local";
import { useAppStore } from "@/store/app-store";
import { notificarErro, notificarSucesso } from "@/store/toast-store";

const PERIODOS = [7, 15, 30];

export function EnviarLotePesquisa({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const pesquisas = useSatisfactionSurveys();
  const modelosPesquisa = useSatisfactionSurveyTemplates();
  const modelosMsg = useWhatsappTemplates();
  const empresas = useCompanies();
  const hospitais = useHospitals();
  const { config } = useWhatsappSettings();

  const [dias, setDias] = useState(7);
  const [modeloId, setModeloId] = useState("");
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const continuar = useRef(true);

  useEffect(() => {
    if (!modeloId) setModeloId(modelosPesquisa.find((m) => m.ativo)?.id ?? "");
  }, [modelosPesquisa, modeloId]);
  useEffect(() => () => { continuar.current = false; }, []);

  const selecao = useMemo(
    () => selecionarDestinatariosPesquisa({ internacoes, pacientes, pesquisas, hoje: hojeLocalIso(), dias }),
    [internacoes, pacientes, pesquisas, dias]
  );
  const pronto = envioAutomaticoDisponivel(config);
  const total = selecao.elegiveis.length;
  const ex = selecao.excluidos;

  async function handleEnviar() {
    if (!modeloId || total === 0) return;
    if (!window.confirm(`Enviar a pesquisa para ${total} paciente(s) pelo WhatsApp da empresa?`)) return;
    setRodando(true);
    continuar.current = true;
    try {
      const criadas = await criarPesquisasEmLote(
        empresaId, modeloId, selecao.elegiveis.map((d) => ({ admissionId: d.admission.id, destino: d.numero }))
      );
      const tokenPorAdmissao = new Map(criadas.map((c) => [c.admission_id, c]));
      const corpo = modelosMsg.find((m) => m.active && m.category === "pesquisa_satisfacao")?.body
        ?? "Olá, {{primeiro_nome}}! Gostaríamos de saber como foi sua experiência com a fisioterapia. Responda nossa pesquisa rapidinha: {{link}}";
      const nomeEmpresa = empresas.find((c) => c.id === empresaId)?.name ?? "";

      const mensagens = selecao.elegiveis.flatMap((d) => {
        const pesq = tokenPorAdmissao.get(d.admission.id);
        if (!pesq) return [];
        const texto = limparVariaveisPendentes(renderizarTemplate(corpo, {
          primeiro_nome: d.paciente.full_name.split(" ")[0],
          nome: d.paciente.full_name,
          empresa: nomeEmpresa,
          hospital: hospitais.find((h) => h.id === d.admission.hospital_id)?.name ?? "",
          data_alta: d.admission.discharge_date ? d.admission.discharge_date.split("-").reverse().join("/") : "",
          link: `${window.location.origin}/pesquisa/${pesq.token}`,
        }));
        return [{ patientId: d.paciente.id, admissionId: d.admission.id, nome: d.paciente.full_name, numero: d.numero, texto, contextId: pesq.id }];
      });

      const lote = await whatsapp.criarLote(empresaId, {
        nome: `Pesquisa pós-alta — ${new Date().toLocaleDateString("pt-BR")}`,
        audiencia: `Altas dos últimos ${dias} dias`,
        templateId: modelosMsg.find((m) => m.category === "pesquisa_satisfacao")?.id ?? null,
        mensagens,
      });
      setProgresso({ sent: 0, failed: 0, total: mensagens.length });
      const r = await executarLote(
        empresaId, lote.id,
        (p) => setProgresso({ sent: p.sent, failed: p.failed, total: mensagens.length }),
        () => continuar.current
      );
      if (r.status === "concluido") notificarSucesso("Lote concluído", `${r.sent} enviadas, ${r.failed} com falha.`);
      else notificarSucesso("Lote criado", "Continue ou acompanhe em WhatsApp → Envios.");
    } catch (erro) {
      notificarErro("O envio em lote parou", erro);
    } finally {
      setRodando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v && !rodando) aoFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar pesquisa para altas sem pesquisa</DialogTitle>
          <DialogDescription>Pelo WhatsApp da empresa, com pausa entre mensagens e limite diário.</DialogDescription>
        </DialogHeader>

        {!pronto ? (
          <div className="flex items-start gap-2 rounded-md border border-attention-100 bg-attention-100/40 p-3 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-attention-600" />
            <p>
              O WhatsApp automático ainda não está ligado e conectado. Configure em{" "}
              <Link to="/whatsapp" className="font-medium text-clinical-600 underline" onClick={aoFechar}>WhatsApp</Link>.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-1.5">
              <Label>Altas dos últimos</Label>
              <div className="flex gap-2">
                {PERIODOS.map((p) => (
                  <Button key={p} type="button" size="sm" variant={dias === p ? "primary" : "secondary"} onClick={() => setDias(p)} disabled={rodando}>
                    {p} dias
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lote-modelo">Modelo da pesquisa</Label>
              <select id="lote-modelo" value={modeloId} onChange={(e) => setModeloId(e.target.value)} disabled={rodando}
                className="h-9 rounded-md border border-line-strong bg-surface-raised px-2 text-sm">
                {modelosPesquisa.filter((m) => m.ativo).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="rounded-md bg-surface-sunken p-3 text-sm">
              <p className="font-medium text-ink">{total} paciente(s) receberão a pesquisa</p>
              {total > 0 && <p className="text-ink-soft">Duração estimada: {estimarDuracaoLote(total, config?.delay_min_s ?? 5, config?.delay_max_s ?? 12)}</p>}
              <p className="mt-2 text-xs text-ink-soft">
                Ficam de fora: {ex.obito} óbito(s), {ex.utiExterna} alta(s) na UTI externa, {ex.semTelefone} sem telefone válido,
                {" "}{ex.optout} que pediram para não receber, {ex.jaTemPesquisa} que já têm pesquisa e {ex.repetido} repetido(s) do mesmo paciente.
              </p>
            </div>
            {progresso && (
              <div className="flex flex-col gap-1">
                <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full bg-clinical-500 transition-all"
                    style={{ width: `${Math.round(((progresso.sent + progresso.failed) / Math.max(progresso.total, 1)) * 100)}%` }} />
                </div>
                <p className="text-xs text-ink-soft">{progresso.sent} enviadas · {progresso.failed} com falha · de {progresso.total}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={aoFechar} disabled={rodando}>Fechar</Button>
          {pronto && (
            <Button onClick={handleEnviar} disabled={rodando || total === 0 || !modeloId}>
              {rodando ? <Loader2 className="animate-spin" /> : <Send />} Enviar para {total}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
