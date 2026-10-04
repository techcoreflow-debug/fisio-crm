import { useMemo, useState } from "react";
import { Route, BedDouble, ArrowRightLeft, NotebookPen, ListChecks, Activity, LogOut, Printer, Sparkles, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  useAdmissions,
  usePatients,
  useHospitals,
  useUnits,
  useAdmissionUnitHistory,
  useClinicalEvolutions,
  useDailyProduction,
  useFunctionalAssessments,
  useProcedures,
} from "@/data/repository";
import { montarJornada, diasDeInternacao, type TipoEventoJornada } from "@/lib/jornada";
import { ESCALAS, MOMENTO_LABEL } from "@/lib/escalas-funcionais";
import { gerarResumoAlta, iaIndisponivel, MENSAGEM_IA_NAO_CONFIGURADA } from "@/lib/ai";
import { preverAlta } from "@/lib/previsao-alta";
import { hojeLocalIso } from "@/lib/data-local";
import { notificarErro, notificarAviso } from "@/store/toast-store";

const VISUAL: Record<TipoEventoJornada, { icon: typeof Route; cor: string }> = {
  internacao: { icon: BedDouble, cor: "bg-clinical-50 text-clinical-600" },
  unidade: { icon: ArrowRightLeft, cor: "bg-attention-100 text-attention-600" },
  evolucao: { icon: NotebookPen, cor: "bg-surface-sunken text-ink-soft" },
  procedimento: { icon: ListChecks, cor: "bg-clinical-50 text-clinical-600" },
  avaliacao: { icon: Activity, cor: "bg-recovery-100 text-recovery-600" },
  alta: { icon: LogOut, cor: "bg-recovery-100 text-recovery-600" },
};

export default function JornadaPaciente() {
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const hospitais = useHospitals();
  const unidades = useUnits();
  const historico = useAdmissionUnitHistory();
  const evolucoes = useClinicalEvolutions();
  const producao = useDailyProduction();
  const avaliacoes = useFunctionalAssessments();
  const procedimentos = useProcedures();

  const [admissionId, setAdmissionId] = useState("");
  const [resumo, setResumo] = useState("");
  const [gerando, setGerando] = useState(false);
  const [revisado, setRevisado] = useState(false);
  const [imprimirSoResumo, setImprimirSoResumo] = useState(false);

  const opcoes = useMemo(
    () =>
      [...internacoes]
        .sort((a, b) => Number(b.status === "internado") - Number(a.status === "internado"))
        .map((i) => ({
          value: i.id,
          label: pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "—",
          sublabel: `${hospitais.find((h) => h.id === i.hospital_id)?.name ?? "—"} · ${unidades.find((u) => u.id === i.unit_id)?.name ?? "—"}${i.status === "internado" ? "" : " · " + i.status}`,
        })),
    [internacoes, pacientes, hospitais, unidades]
  );

  const internacao = internacoes.find((i) => i.id === admissionId);

  const eventos = useMemo(() => {
    if (!internacao) return [];
    const nomeLocal = (hospitalId: string | null, unitId: string | null) => {
      const h = hospitais.find((x) => x.id === hospitalId)?.name;
      const u = unidades.find((x) => x.id === unitId)?.name;
      return [h, u].filter(Boolean).join(" · ") || "—";
    };
    return montarJornada({
      internacao,
      historico: historico.filter((h) => h.admission_id === internacao.id),
      evolucoes: evolucoes.filter((e) => e.admission_id === internacao.id),
      producao: producao.filter((p) => p.admission_id === internacao.id),
      avaliacoes: avaliacoes.filter((a) => a.admission_id === internacao.id),
      procedimentos,
      nomeLocal,
    });
  }, [internacao, historico, evolucoes, producao, avaliacoes, procedimentos, hospitais, unidades]);

  // Dados clínicos agregados para o resumo de alta — SEM nome do paciente,
  // sem texto livre de evolução (pode conter identificadores).
  async function gerarResumo() {
    if (!internacao) return;
    setGerando(true);
    setRevisado(false);
    try {
      const avs = avaliacoes
        .filter((a) => a.admission_id === internacao.id)
        .sort((a, b) => a.avaliado_em.localeCompare(b.avaliado_em))
        .map((a) => ({ escala: ESCALAS[a.escala].nome, momento: MOMENTO_LABEL[a.momento], escore: a.score, maximo: ESCALAS[a.escala].max, data: a.avaliado_em }));
      const nomesProc = Array.from(
        new Set(producao.filter((p) => p.admission_id === internacao.id).map((p) => procedimentos.find((x) => x.id === p.procedure_id)?.name).filter(Boolean))
      );
      const texto = await gerarResumoAlta({
        dias_de_internacao: diasDeInternacao(internacao),
        diagnostico: internacao.diagnostico,
        unidades_percorridas: eventos.filter((e) => e.tipo === "unidade").map((e) => e.detalhe),
        procedimentos_realizados: nomesProc,
        avaliacoes_funcionais: avs,
        tipo_alta: internacao.discharge_type,
      });
      setResumo(texto);
    } catch (erro) {
      if (iaIndisponivel(erro)) notificarAviso(MENSAGEM_IA_NAO_CONFIGURADA, "O restante do sistema funciona normalmente — a IA é opcional.");
      else notificarErro("Não foi possível gerar o resumo", erro);
    } finally {
      setGerando(false);
    }
  }

  const previsao = useMemo(() => (internacao ? preverAlta(internacao, internacoes, hojeLocalIso()) : null), [internacao, internacoes]);
  const paciente = pacientes.find((p) => p.id === internacao?.patient_id);
  const totalProcedimentos = internacao ? producao.filter((p) => p.admission_id === internacao.id).length : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Jornada do paciente"
        description="Toda a história da internação numa linha do tempo só — entrada, mudanças de unidade, evoluções, procedimentos, avaliações e alta."
        actions={
          admissionId ? (
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          ) : undefined
        }
      />

      <Card className="print:hidden">
        <CardContent className="flex flex-col gap-1.5 pt-5">
          <Label>Paciente</Label>
          <Combobox
            value={admissionId}
            onValueChange={setAdmissionId}
            options={opcoes}
            placeholder="Buscar paciente…"
            searchPlaceholder="Nome do paciente ou unidade…"
            emptyText="Nenhuma internação encontrada."
          />
        </CardContent>
      </Card>

      {!internacao ? (
        <Card>
          <CardContent>
            <EmptyState icon={Route} title="Selecione um paciente" description="A jornada mostra o que aconteceu com ele desde a entrada, em ordem cronológica." />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className={imprimirSoResumo ? "print:hidden" : ""}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
              <div>
                <p className="text-lg font-semibold text-ink">{paciente?.full_name ?? "—"}</p>
                <p className="text-xs text-ink-soft">{internacao.diagnostico ?? "Sem diagnóstico registrado"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="clinical">{diasDeInternacao(internacao)} dia(s) de internação</Badge>
                <Badge variant="neutral">{totalProcedimentos} procedimento(s)</Badge>
                <Badge variant={internacao.status === "internado" ? "attention" : "recovery"}>{internacao.status}</Badge>
                {previsao && (
                  <Badge variant={previsao.diasAlemDaMediana > 0 ? "attention" : "neutral"}>
                    Alta estimada {previsao.dataEstimada.split("-").reverse().slice(0, 2).join("/")} · mediana {previsao.medianaDias}d ({previsao.casos} casos)
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <ol className={`relative flex flex-col gap-4 border-l-2 border-line pl-6 ${imprimirSoResumo ? "print:hidden" : ""}`}>
            {eventos.map((ev) => {
              const { icon: Icone, cor } = VISUAL[ev.tipo];
              return (
                <li key={ev.id} className="relative">
                  <span className={`absolute -left-[2.15rem] flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-surface ${cor}`}>
                    <Icone className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{ev.titulo}</p>
                    <span className="text-xs text-ink-soft">{new Date(ev.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: ev.tipo === "avaliacao" ? undefined : "short" })}</span>
                  </div>
                  {ev.detalhe && <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-soft">{ev.detalhe}</p>}
                </li>
              );
            })}
          </ol>

          <Card className="print:break-inside-avoid">
            <CardContent className="flex flex-col gap-3 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
                <div>
                  <p className="text-sm font-medium text-ink">Resumo de alta para paciente e família</p>
                  <p className="text-xs text-ink-soft">Rascunho gerado por IA a partir dos dados clínicos agregados (sem nome). Edite e revise antes de entregar.</p>
                </div>
                <Button size="sm" variant="secondary" onClick={gerarResumo} disabled={gerando}>
                  {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar rascunho
                </Button>
              </div>
              {resumo && (
                <>
                  <p className="hidden text-sm font-semibold text-ink print:block">Resumo de alta — {paciente?.full_name ?? ""}</p>
                  <textarea
                    rows={9}
                    value={resumo}
                    onChange={(e) => {
                      setResumo(e.target.value);
                      setRevisado(false);
                    }}
                    className="rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink print:border-0 print:p-0"
                  />
                  <label className="flex items-center gap-2 text-sm text-ink print:hidden">
                    <input type="checkbox" checked={revisado} onChange={(e) => setRevisado(e.target.checked)} />
                    Revisei o texto e assumo a responsabilidade pelo conteúdo
                  </label>
                  <Button size="sm" className="self-start print:hidden" disabled={!revisado}
                    onClick={() => {
                      setImprimirSoResumo(true);
                      setTimeout(() => {
                        window.print();
                        setImprimirSoResumo(false);
                      }, 50);
                    }}
                  >
                    <Printer className="h-4 w-4" /> Imprimir resumo
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
