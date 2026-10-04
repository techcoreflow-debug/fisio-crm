import { useMemo, useState } from "react";
import { Activity, Plus, Trash2, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { useAuth } from "@/auth/auth-provider";
import {
  useFunctionalAssessments,
  useAdmissions,
  usePatients,
  usePhysiotherapists,
  useHospitals,
  useUnits,
  repository,
} from "@/data/repository";
import {
  ESCALAS,
  LISTA_ESCALAS,
  MOMENTO_LABEL,
  calcularScore,
  ganhoPorInternacao,
  mediaOuNull,
  type EscalaId,
  type MomentoAvaliacao,
} from "@/lib/escalas-funcionais";
import { hojeLocalIso } from "@/lib/data-local";
import { notificarErro, notificarSucesso } from "@/store/toast-store";

function formatarData(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function formatarGanho(v: number) {
  const arred = Math.round(v * 10) / 10;
  return `${arred > 0 ? "+" : ""}${arred}`;
}

export default function AvaliacaoFuncional() {
  const { profile } = useAuth();
  const avaliacoes = useFunctionalAssessments();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const fisioterapeutas = usePhysiotherapists();
  const hospitais = useHospitals();
  const unidades = useUnits();

  const meuFisioId = fisioterapeutas.find((f) => f.user_id === profile?.id)?.id ?? "";

  const [admissionId, setAdmissionId] = useState("");
  const [escalaGrafico, setEscalaGrafico] = useState<EscalaId>("barthel");
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Formulário
  const [escalaForm, setEscalaForm] = useState<EscalaId>("barthel");
  const [momento, setMomento] = useState<MomentoAvaliacao>("admissao");
  const [dataAvaliacao, setDataAvaliacao] = useState(hojeLocalIso());
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [observacao, setObservacao] = useState("");

  function nomePaciente(id: string) {
    const internacao = internacoes.find((i) => i.id === id);
    return pacientes.find((p) => p.id === internacao?.patient_id)?.full_name ?? "—";
  }

  const opcoesInternacao = useMemo(() => {
    return [...internacoes]
      .sort((a, b) => Number(b.status === "internado") - Number(a.status === "internado"))
      .map((i) => {
        const unidade = unidades.find((u) => u.id === i.unit_id)?.name ?? "—";
        const hospital = hospitais.find((h) => h.id === i.hospital_id)?.name ?? "—";
        const paciente = pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "—";
        return { value: i.id, label: paciente, sublabel: `${hospital} · ${unidade}${i.status === "internado" ? "" : " · " + i.status}` };
      });
  }, [internacoes, unidades, hospitais, pacientes]);

  const doPaciente = useMemo(
    () => avaliacoes.filter((a) => a.admission_id === admissionId).sort((a, b) => a.avaliado_em.localeCompare(b.avaliado_em)),
    [avaliacoes, admissionId]
  );

  const pontosGrafico = useMemo(
    () =>
      doPaciente
        .filter((a) => a.escala === escalaGrafico)
        .map((a) => ({ data: formatarData(a.avaliado_em), escore: a.score, momento: MOMENTO_LABEL[a.momento] })),
    [doPaciente, escalaGrafico]
  );

  const defGrafico = ESCALAS[escalaGrafico];
  const resumoPaciente = useMemo(() => {
    const ganhos = ganhoPorInternacao(doPaciente.map((a) => ({ admission_id: a.admission_id, escala: a.escala, score: a.score, avaliado_em: a.avaliado_em })));
    return ganhos.find((g) => g.escala === escalaGrafico) ?? null;
  }, [doPaciente, escalaGrafico]);

  // Ganho por unidade (unidade ATUAL da internação) — média dos ganhos
  // percentuais de quem tem ≥ 2 avaliações da mesma escala.
  const ganhoPorUnidade = useMemo(() => {
    const ganhos = ganhoPorInternacao(avaliacoes.map((a) => ({ admission_id: a.admission_id, escala: a.escala, score: a.score, avaliado_em: a.avaliado_em })));
    const mapa = new Map<string, { unidade: string; valores: number[]; pacientes: Set<string> }>();
    for (const g of ganhos) {
      const internacao = internacoes.find((i) => i.id === g.admission_id);
      const unidade = unidades.find((u) => u.id === internacao?.unit_id)?.name ?? "Sem unidade";
      const item = mapa.get(unidade) ?? { unidade, valores: [], pacientes: new Set<string>() };
      item.valores.push(g.ganhoPercentual);
      item.pacientes.add(g.admission_id);
      mapa.set(unidade, item);
    }
    return Array.from(mapa.values())
      .map((u) => ({ unidade: u.unidade, ganhoMedio: mediaOuNull(u.valores) ?? 0, pacientes: u.pacientes.size, medicoes: u.valores.length }))
      .sort((a, b) => b.ganhoMedio - a.ganhoMedio);
  }, [avaliacoes, internacoes, unidades]);

  const def = ESCALAS[escalaForm];
  const scoreForm = calcularScore(def, respostas);
  const classificacao = scoreForm === null ? null : def.classificar(scoreForm);

  function abrirNova() {
    setEscalaForm(escalaGrafico);
    setMomento(doPaciente.some((a) => a.escala === escalaGrafico) ? "reavaliacao" : "admissao");
    setDataAvaliacao(hojeLocalIso());
    setRespostas({});
    setObservacao("");
    setOpen(true);
  }

  async function salvar() {
    const internacao = internacoes.find((i) => i.id === admissionId);
    if (!internacao || scoreForm === null) return;
    setSalvando(true);
    try {
      await repository.functionalAssessments.create({
        company_id: internacao.company_id,
        admission_id: admissionId,
        physiotherapist_id: meuFisioId || null,
        escala: escalaForm,
        momento,
        score: scoreForm,
        itens: respostas,
        observacao: observacao.trim() || null,
        avaliado_em: dataAvaliacao,
      });
      notificarSucesso(`${def.sigla} registrado: ${scoreForm} pontos.`);
      setEscalaGrafico(escalaForm);
      setOpen(false);
    } catch (erro) {
      notificarErro("Não foi possível registrar a avaliação", erro);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    if (!window.confirm("Excluir esta avaliação? A curva do paciente será recalculada.")) return;
    try {
      await repository.functionalAssessments.remove(id);
      notificarSucesso("Avaliação excluída.");
    } catch (erro) {
      notificarErro("Não foi possível excluir", erro);
    }
  }

  const GanhoIcone = resumoPaciente && resumoPaciente.ganho > 0 ? TrendingUp : resumoPaciente && resumoPaciente.ganho < 0 ? TrendingDown : Minus;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Avaliação funcional"
        description="Escalas padronizadas na admissão, reavaliação e alta — a prova de que o paciente saiu melhor."
        actions={
          <Button size="sm" onClick={abrirNova} disabled={!admissionId}>
            <Plus className="h-4 w-4" /> Nova avaliação
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-1.5 pt-5">
          <Label>Paciente</Label>
          <Combobox
            value={admissionId}
            onValueChange={setAdmissionId}
            options={opcoesInternacao}
            placeholder="Buscar paciente…"
            searchPlaceholder="Nome do paciente ou unidade…"
            emptyText="Nenhuma internação encontrada."
          />
        </CardContent>
      </Card>

      {!admissionId ? (
        <Card>
          <CardContent>
            <EmptyState icon={Activity} title="Selecione um paciente" description="Escolha uma internação para ver a curva de ganho funcional e registrar uma nova avaliação." />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle>Curva de ganho — {nomePaciente(admissionId)}</CardTitle>
              <div className="flex flex-wrap gap-1.5">
                {LISTA_ESCALAS.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEscalaGrafico(e.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      escalaGrafico === e.id ? "bg-clinical-600 text-white" : "bg-surface-sunken text-ink-soft hover:text-ink"
                    }`}
                  >
                    {e.sigla}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-xs text-ink-soft">{defGrafico.descricao}</p>
              {pontosGrafico.length === 0 ? (
                <EmptyState icon={Activity} title={`Sem avaliação de ${defGrafico.sigla}`} description="Registre a primeira avaliação para começar a curva." />
              ) : (
                <>
                  {resumoPaciente ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant={resumoPaciente.ganho > 0 ? "recovery" : resumoPaciente.ganho < 0 ? "critical" : "neutral"}>
                        <GanhoIcone className="h-3.5 w-3.5" /> {formatarGanho(resumoPaciente.ganho)} pontos
                      </Badge>
                      <span className="text-sm text-ink-soft">
                        de {resumoPaciente.primeiro} para {resumoPaciente.ultimo} em {resumoPaciente.avaliacoes} avaliações
                        {defGrafico.melhorQuando === "menor" ? " (menor é melhor)" : ""}
                      </span>
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-ink-soft">
                      <Info className="h-4 w-4" /> Só há uma avaliação — o ganho aparece a partir da segunda.
                    </p>
                  )}
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={pontosGrafico} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                        <YAxis domain={[defGrafico.min, defGrafico.max]} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [`${v} pontos`, defGrafico.sigla]} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.momento ?? ""}`} />
                        <Line type="monotone" dataKey="escore" stroke="#0e7490" strokeWidth={2.5} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Avaliações deste paciente</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {doPaciente.length === 0 ? (
                <p className="text-sm text-ink-soft">Nenhuma avaliação registrada ainda.</p>
              ) : (
                [...doPaciente].reverse().map((a) => {
                  const d = ESCALAS[a.escala];
                  const c = d.classificar(a.score);
                  return (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{d.sigla}</span>
                        <Badge variant="neutral">{MOMENTO_LABEL[a.momento]}</Badge>
                        <span className="text-sm text-ink">{a.score} pts</span>
                        <Badge variant={c.tom === "critical" ? "critical" : c.tom === "attention" ? "attention" : c.tom === "recovery" ? "recovery" : c.tom === "clinical" ? "clinical" : "neutral"}>{c.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-ink-soft">
                          {formatarData(a.avaliado_em)} · {fisioterapeutas.find((f) => f.id === a.physiotherapist_id)?.full_name ?? "—"}
                        </span>
                        <button type="button" onClick={() => remover(a.id)} className="text-ink-soft hover:text-critical-600" aria-label="Excluir avaliação">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {a.observacao && <p className="w-full text-xs text-ink-soft">{a.observacao}</p>}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ganho funcional por unidade</CardTitle>
        </CardHeader>
        <CardContent>
          {ganhoPorUnidade.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Sem dado suficiente: é preciso ao menos 2 avaliações da mesma escala na mesma internação. Quanto mais reavaliações, mais confiável fica este quadro.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {ganhoPorUnidade.map((u) => (
                <div key={u.unidade} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-ink">{u.unidade}</p>
                    <p className="text-xs text-ink-soft">{u.pacientes} internação(ões) · {u.medicoes} medição(ões)</p>
                  </div>
                  <Badge variant={u.ganhoMedio > 0 ? "recovery" : u.ganhoMedio < 0 ? "critical" : "neutral"}>
                    {formatarGanho(u.ganhoMedio)}% da escala
                  </Badge>
                </div>
              ))}
              <p className="text-xs text-ink-soft">Média do ganho (primeira → última avaliação) como % da amplitude da escala, pela unidade atual da internação.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <div className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>Nova avaliação — {nomePaciente(admissionId)}</SheetTitle>
              <SheetDescription>{def.descricao}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-1.5">
                {LISTA_ESCALAS.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setEscalaForm(e.id);
                      setRespostas({});
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${escalaForm === e.id ? "bg-clinical-600 text-white" : "bg-surface-sunken text-ink-soft"}`}
                  >
                    {e.sigla}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Momento</Label>
                  <select
                    value={momento}
                    onChange={(e) => setMomento(e.target.value as MomentoAvaliacao)}
                    className="h-9 rounded-md border border-line-strong bg-surface-raised px-2 text-sm text-ink"
                  >
                    {(Object.keys(MOMENTO_LABEL) as MomentoAvaliacao[]).map((m) => (
                      <option key={m} value={m}>{MOMENTO_LABEL[m]}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Data</Label>
                  <Input type="date" value={dataAvaliacao} max={hojeLocalIso()} onChange={(e) => setDataAvaliacao(e.target.value)} />
                </div>
              </div>

              {def.itens.map((item) => (
                <div key={item.id} className="flex flex-col gap-1.5">
                  <Label>{item.label}</Label>
                  <select
                    value={respostas[item.id] ?? ""}
                    onChange={(e) => setRespostas((r) => ({ ...r, [item.id]: Number(e.target.value) }))}
                    className="h-9 rounded-md border border-line-strong bg-surface-raised px-2 text-sm text-ink"
                  >
                    <option value="" disabled>Selecione…</option>
                    {item.opcoes.map((o) => (
                      <option key={o.valor} value={o.valor}>{def.itens.length > 1 ? `${o.valor} — ${o.label}` : o.label}</option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="flex flex-col gap-1.5">
                <Label>Observação (opcional)</Label>
                <textarea
                  rows={2}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink"
                />
              </div>

              <div className="rounded-lg bg-surface-sunken p-3">
                {scoreForm === null ? (
                  <p className="text-sm text-ink-soft">Responda todos os itens para calcular o escore.</p>
                ) : (
                  <p className="text-sm text-ink">
                    Escore: <strong>{scoreForm}</strong> / {def.max} · {classificacao?.label}
                  </p>
                )}
              </div>
              <p className="text-xs text-ink-soft">O sistema calcula e classifica; a interpretação clínica é sempre do fisioterapeuta.</p>
            </div>
            <SheetFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="button" disabled={salvando || scoreForm === null} onClick={salvar}>
                {salvando ? "Salvando…" : "Registrar avaliação"}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
