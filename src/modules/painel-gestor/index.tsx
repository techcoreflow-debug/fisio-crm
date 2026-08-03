import { useMemo } from "react";
import { hojeLocalIso } from "@/lib/data-local";
import { Link } from "react-router-dom";
import {
  Users,
  ClipboardList,
  ClipboardCheck,
  AlertTriangle,
  Wallet,
  Receipt,
  SlidersHorizontal,
  ArrowRight,
  Circle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GoniometerGauge } from "@/components/shared/goniometer-gauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  usePatientQueue,
  useAdmissions,
  usePatients,
  useHospitals,
  useUnits,
  usePhysiotherapists,
  useDailyProduction,
  useBillingEntries,
} from "@/data/repository";

function hojeIso() {
  return hojeLocalIso();
}

export default function PainelGestor() {
  const fila = usePatientQueue();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const hospitais = useHospitals();
  const unidades = useUnits();
  const fisioterapeutas = usePhysiotherapists();
  const producao = useDailyProduction();
  const faturamento = useBillingEntries();

  const hoje = hojeIso();
  const internacoesAtivas = internacoes.filter((i) => i.status === "internado");
  const producaoHoje = producao.filter((p) => p.production_date === hoje);
  const filaHoje = fila.filter((f) => f.data === hoje);

  const confirmadosHoje = producaoHoje.filter((p) => p.confirmado_tasy).length;
  const taxaConfirmacaoHoje = producaoHoje.length > 0 ? Math.round((confirmadosHoje / producaoHoje.length) * 100) : 0;

  function nomePaciente(admissionId: string) {
    const internacao = internacoes.find((i) => i.id === admissionId);
    return pacientes.find((p) => p.id === internacao?.patient_id)?.full_name ?? "—";
  }

  // Equipe hoje: agrupa a fila por fisioterapeuta, com progresso.
  const equipeHoje = useMemo(() => {
    const porFisio = new Map<string, typeof filaHoje>();
    for (const item of filaHoje) {
      const lista = porFisio.get(item.physiotherapist_id) ?? [];
      lista.push(item);
      porFisio.set(item.physiotherapist_id, lista);
    }
    return Array.from(porFisio.entries())
      .map(([fisioId, itens]) => {
        const concluidos = itens.filter((i) => i.status === "concluido").length;
        return {
          fisioId,
          nome: fisioterapeutas.find((f) => f.id === fisioId)?.full_name ?? "—",
          total: itens.length,
          concluidos,
          pendentes: itens
            .filter((i) => i.status === "pendente")
            .sort((a, b) => a.sequencia - b.sequencia),
        };
      })
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filaHoje, fisioterapeutas]);

  // Internações ativas que ninguém distribuiu ainda hoje.
  const idsNaFilaHoje = new Set(filaHoje.map((f) => f.admission_id));
  const naoDistribuidos = internacoesAtivas.filter((i) => !idsNaFilaHoje.has(i.id));

  const competenciaAtual = `${hoje.slice(0, 7)}-01`;
  const repasseDoMes = faturamento
    .filter((f) => f.competencia === competenciaAtual)
    .reduce((acc, f) => acc + f.valor_repasse, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Painel do Gestor"
        description={`Acompanhamento em tempo real de ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}.`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center justify-center gap-1 pt-6">
            <GoniometerGauge value={taxaConfirmacaoHoje} label="Confirmado hoje" tone="clinical" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3">
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clinical-50 text-clinical-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-soft">Internados agora</p>
                <p className="font-display text-2xl font-semibold text-ink">{internacoesAtivas.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-recovery-100 text-recovery-600">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-soft">Procedimentos hoje</p>
                <p className="font-display text-2xl font-semibold text-recovery-600">{producaoHoje.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-attention-100 text-attention-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-soft">Sem distribuição hoje</p>
                <p className="font-display text-2xl font-semibold text-attention-600">{naoDistribuidos.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4.5 w-4.5" /> Equipe hoje</CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">Progresso de cada fisioterapeuta na fila distribuída pra hoje.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {equipeHoje.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">Ninguém tem fila distribuída hoje ainda.</p>
            ) : (
              equipeHoje.map((f) => (
                <div key={f.fisioId} className="flex flex-col gap-2 rounded-md border border-line p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">{f.nome}</p>
                    <Badge variant={f.concluidos === f.total ? "recovery" : "neutral"}>
                      {f.concluidos} de {f.total}
                    </Badge>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full bg-recovery-500 transition-all"
                      style={{ width: `${f.total > 0 ? (f.concluidos / f.total) * 100 : 0}%` }}
                    />
                  </div>
                  {f.pendentes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {f.pendentes.slice(0, 4).map((p) => (
                        <span key={p.id} className="flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-ink-soft">
                          <Circle className="h-2.5 w-2.5" /> {nomePaciente(p.admission_id)}
                        </span>
                      ))}
                      {f.pendentes.length > 4 && (
                        <span className="text-xs text-ink-soft">+{f.pendentes.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4.5 w-4.5 text-attention-600" /> Ainda sem distribuição ({naoDistribuidos.length})</CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">Internados ativos que ninguém colocou na fila de hoje.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {naoDistribuidos.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">Todo mundo já foi distribuído hoje.</p>
            ) : (
              <>
                {naoDistribuidos.slice(0, 8).map((i) => (
                  <div key={i.id} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-ink">{nomePaciente(i.id)}</p>
                      <p className="text-xs text-ink-soft">
                        {hospitais.find((h) => h.id === i.hospital_id)?.name ?? "—"} ·{" "}
                        {unidades.find((u) => u.id === i.unit_id)?.name ?? "—"}
                      </p>
                    </div>
                  </div>
                ))}
                {naoDistribuidos.length > 8 && (
                  <p className="text-center text-xs text-ink-soft">+{naoDistribuidos.length - 8} outro(s)</p>
                )}
                <Link
                  to="/internacoes"
                  className="mt-1 flex items-center justify-center gap-1.5 rounded-md bg-clinical-50 py-2 text-sm font-medium text-clinical-700 hover:bg-clinical-100"
                >
                  Ir distribuir <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financeiro e fechamento</CardTitle>
          <p className="text-sm text-ink-soft mt-0.5">Atalhos pros painéis de gestão financeira e operacional.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/fechamento", icone: ClipboardCheck, titulo: "Fechamento", detalhe: `${taxaConfirmacaoHoje}% confirmado hoje` },
            { to: "/faturamento", icone: Receipt, titulo: "Faturamento", detalhe: `R$ ${repasseDoMes.toLocaleString("pt-BR")} no mês` },
            { to: "/financeiro", icone: Wallet, titulo: "Financeiro", detalhe: "Contas a receber" },
            { to: "/painel-procedimentos", icone: SlidersHorizontal, titulo: "Painel de Procedimentos", detalhe: "Glosa e produção" },
          ].map((atalho) => (
            <Link
              key={atalho.to}
              to={atalho.to}
              className="flex flex-col gap-2 rounded-md border border-line p-4 transition-colors hover:border-clinical-300 hover:bg-clinical-50"
            >
              <atalho.icone className="h-5 w-5 text-clinical-600" />
              <p className="text-sm font-medium text-ink">{atalho.titulo}</p>
              <p className="text-xs text-ink-soft">{atalho.detalhe}</p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
