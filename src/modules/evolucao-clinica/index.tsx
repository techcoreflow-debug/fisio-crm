import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NotebookPen, Plus, Search, AlertTriangle, BedDouble, ChevronDown, Sparkles, Loader2, Mic, Square } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useClinicalEvolutions,
  useFunctionalAssessments,
  useAdmissions,
  usePatients,
  usePhysiotherapists,
  useHospitals,
  useUnits,
  repository,
} from "@/data/repository";
import { notificarErro, notificarSucesso, notificarAviso } from "@/store/toast-store";
import { estruturarEvolucao, iaIndisponivel, MENSAGEM_IA_NAO_CONFIGURADA, type EvolucaoEstruturada } from "@/lib/ai";
import { ESCALAS } from "@/lib/escalas-funcionais";
import { hojeLocalIso } from "@/lib/data-local";
import { useDitado, ditadoSuportado } from "@/lib/ditado";

interface EstruturaEditavel {
  resumo: string;
  intercorrencias: string;
  condutas: string;
  metas: string;
  sugeridoPorIa: boolean;
}
const linhas = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);

export default function EvolucaoClinica() {
  const evolucoes = useClinicalEvolutions();
  const avaliacoes = useFunctionalAssessments();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const fisioterapeutas = usePhysiotherapists();
  const hospitais = useHospitals();
  const unidades = useUnits();

  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [gruposFechados, setGruposFechados] = useState<Set<string>>(new Set());
  const internacoesAtivas = internacoes.filter((i) => i.status === "internado");
  const [internacaoId, setInternacaoId] = useState(internacoesAtivas[0]?.id ?? "");
  const [fisioId, setFisioId] = useState("");
  const [texto, setTexto] = useState("");
  const [estrutura, setEstrutura] = useState<EstruturaEditavel | null>(null);
  const [estruturando, setEstruturando] = useState(false);
  const [escalasCitadas, setEscalasCitadas] = useState<EvolucaoEstruturada["escalas_citadas"]>([]);
  const ditado = useDitado(
    (trecho) => setTexto((atual) => (atual && !atual.endsWith(" ") && !atual.endsWith("\n") ? `${atual} ${trecho}` : `${atual}${trecho}`)),
    (mensagem) => notificarAviso(mensagem)
  );

  // Fechou o painel: para o ditado (não deixa o microfone aberto por trás).
  useEffect(() => {
    if (!open) ditado.parar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function nomePaciente(admissionId: string) {
    const internacao = internacoes.find((i) => i.id === admissionId);
    return pacientes.find((p) => p.id === internacao?.patient_id)?.full_name ?? "—";
  }

  function localAtendimento(admissionId: string) {
    const internacao = internacoes.find((i) => i.id === admissionId);
    const hospital = hospitais.find((h) => h.id === internacao?.hospital_id)?.name ?? "—";
    const unidade = unidades.find((u) => u.id === internacao?.unit_id)?.name ?? "—";
    return `${hospital} · ${unidade}`;
  }

  const opcoesInternacao = useMemo(
    () =>
      internacoesAtivas.map((i) => {
        const unidade = unidades.find((u) => u.id === i.unit_id);
        const hospital = hospitais.find((h) => h.id === i.hospital_id);
        return { value: i.id, label: nomePaciente(i.id), sublabel: `${hospital?.name ?? "—"} · ${unidade?.name ?? "—"}` };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [internacoesAtivas, unidades, hospitais, pacientes]
  );
  const opcoesFisioterapeuta = useMemo(() => fisioterapeutas.map((f) => ({ value: f.id, label: f.full_name })), [fisioterapeutas]);

  const semEvolucao = internacoesAtivas.filter((i) => !evolucoes.some((e) => e.admission_id === i.id));

  // O conceito: em vez de uma lista solta de notas, é um prontuário por
  // paciente — cada internação com evolução vira um grupo próprio, com as
  // notas dela em ordem cronológica dentro.
  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const porInternacao = new Map<string, typeof evolucoes>();
    for (const e of evolucoes) {
      const lista = porInternacao.get(e.admission_id) ?? [];
      lista.push(e);
      porInternacao.set(e.admission_id, lista);
    }
    const lista = Array.from(porInternacao.entries())
      .map(([admissionId, notas]) => ({
        admissionId,
        paciente: nomePaciente(admissionId),
        local: localAtendimento(admissionId),
        notas: [...notas].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        ultima: notas.reduce((max, n) => (n.created_at > max ? n.created_at : max), notas[0].created_at),
      }))
      .sort((a, b) => b.ultima.localeCompare(a.ultima));
    if (!termo) return lista;
    return lista.filter((g) => g.paciente.toLowerCase().includes(termo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, evolucoes, internacoes, pacientes]);

  function toggleGrupo(id: string) {
    setGruposFechados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function abrirNova() {
    setInternacaoId(internacoesAtivas[0]?.id ?? "");
    setFisioId("");
    setTexto("");
    setEstrutura(null);
    setEscalasCitadas([]);
    setOpen(true);
  }

  async function estruturarComIa() {
    if (texto.trim().length < 10) {
      notificarAviso("Escreva a evolução antes de estruturar.");
      return;
    }
    setEstruturando(true);
    try {
      const r = await estruturarEvolucao(texto);
      setEstrutura({
        resumo: r.resumo,
        intercorrencias: r.intercorrencias.join("\n"),
        condutas: r.condutas.join("\n"),
        metas: r.metas.join("\n"),
        sugeridoPorIa: true,
      });
      setEscalasCitadas(r.escalas_citadas);
    } catch (erro) {
      if (iaIndisponivel(erro)) {
        notificarAviso(MENSAGEM_IA_NAO_CONFIGURADA, "O restante do sistema funciona normalmente — a IA é opcional.");
      } else {
        notificarErro("Não foi possível estruturar com IA", erro);
      }
    } finally {
      setEstruturando(false);
    }
  }

  // Só escalas de item único (IMS, Borg) podem ser gravadas direto a partir do
  // texto: o escore É a resposta do item. Barthel/MRC/FSS-ICU exigem os itens.
  async function registrarEscalaCitada(c: EvolucaoEstruturada["escalas_citadas"][number]) {
    const internacao = internacoes.find((i) => i.id === internacaoId);
    const def = ESCALAS[c.escala];
    if (!internacao || def.itens.length !== 1) return;
    const item = def.itens[0];
    if (!item.opcoes.some((o) => o.valor === c.score)) {
      notificarAviso(`Escore ${c.score} inválido para ${def.sigla}.`);
      return;
    }
    const jaTem = avaliacoes.some((a) => a.admission_id === internacaoId && a.escala === c.escala);
    try {
      await repository.functionalAssessments.create({
        company_id: internacao.company_id,
        admission_id: internacaoId,
        physiotherapist_id: fisioId || null,
        escala: c.escala,
        momento: jaTem ? "reavaliacao" : "admissao",
        score: c.score,
        itens: { [item.id]: c.score },
        observacao: "Registrado a partir da evolução clínica",
        avaliado_em: hojeLocalIso(),
      });
      setEscalasCitadas((atual) => atual.filter((x) => x !== c));
      notificarSucesso(`${def.sigla} ${c.score} registrado na avaliação funcional.`);
    } catch (erro) {
      notificarErro("Não foi possível registrar a escala", erro);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const internacao = internacoes.find((i) => i.id === internacaoId);
    if (!internacao) return;
    setSalvando(true);
    try {
      await repository.clinicalEvolutions.create({
        admission_id: internacaoId,
        physiotherapist_id: fisioId,
        content: texto,
        company_id: internacao.company_id,
        estruturado: estrutura
          ? {
              resumo: estrutura.resumo.trim(),
              intercorrencias: linhas(estrutura.intercorrencias),
              condutas: linhas(estrutura.condutas),
              metas: linhas(estrutura.metas),
              sugerido_por_ia: estrutura.sugeridoPorIa,
            }
          : null,
      });
      notificarSucesso("Evolução registrada.");
      setOpen(false);
    } catch (erro) {
      notificarErro("Não foi possível registrar a evolução", erro);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Evolução Clínica"
        description="Prontuário de evolução por paciente internado — cada internação reúne suas próprias notas, em ordem cronológica."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNova}>
                <Plus className="h-4 w-4" /> Nova evolução
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>Nova evolução</SheetTitle>
                  <SheetDescription>Registre a evolução clínica de uma internação ativa.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Paciente internado</Label>
                    <Combobox
                      value={internacaoId}
                      onValueChange={setInternacaoId}
                      options={opcoesInternacao}
                      placeholder="Buscar paciente internado…"
                      searchPlaceholder="Nome do paciente ou unidade…"
                      emptyText="Nenhuma internação ativa encontrada."
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Fisioterapeuta</Label>
                    <Combobox
                      value={fisioId}
                      onValueChange={setFisioId}
                      options={opcoesFisioterapeuta}
                      placeholder="Buscar fisioterapeuta…"
                      searchPlaceholder="Nome do fisioterapeuta…"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="content">Evolução</Label>
                    <textarea
                      id="content"
                      name="content"
                      required
                      rows={5}
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      className="rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/40"
                      placeholder="Descreva a evolução do paciente…"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={estruturarComIa} disabled={estruturando || texto.trim().length < 10}>
                        {estruturando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Estruturar com IA
                      </Button>
                      {!estrutura && (
                        <button type="button" className="text-xs text-clinical-700 underline" onClick={() => setEstrutura({ resumo: "", intercorrencias: "", condutas: "", metas: "", sugeridoPorIa: false })}>
                          Preencher manualmente
                        </button>
                      )}
                      {ditadoSuportado() && (
                        <Button type="button" size="sm" variant={ditado.ouvindo ? "primary" : "secondary"} onClick={ditado.ouvindo ? ditado.parar : ditado.iniciar} title="O áudio é processado pelo reconhecimento de voz do navegador">
                          {ditado.ouvindo ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {ditado.ouvindo ? "Parar ditado" : "Ditar"}
                        </Button>
                      )}
                      <span className="text-xs text-ink-soft">Opcional — o texto acima é o registro oficial.</span>
                    </div>
                  </div>
                  {estrutura && (
                    <div className="flex flex-col gap-3 rounded-lg border border-clinical-100 bg-clinical-50/40 p-3">
                      <p className="text-xs font-medium text-clinical-700">
                        {estrutura.sugeridoPorIa ? "Sugestão da IA — revise e corrija antes de salvar" : "Resumo estruturado"}
                      </p>
                      <div className="flex flex-col gap-1">
                        <Label>Resumo</Label>
                        <Input value={estrutura.resumo} onChange={(e) => setEstrutura({ ...estrutura, resumo: e.target.value })} />
                      </div>
                      {([["intercorrencias", "Intercorrências"], ["condutas", "Condutas"], ["metas", "Metas"]] as const).map(([campo, rotulo]) => (
                        <div key={campo} className="flex flex-col gap-1">
                          <Label>{rotulo} <span className="font-normal text-ink-soft">(uma por linha)</span></Label>
                          <textarea
                            rows={2}
                            value={estrutura[campo]}
                            onChange={(e) => setEstrutura({ ...estrutura, [campo]: e.target.value })}
                            className="rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink"
                          />
                        </div>
                      ))}
                      {escalasCitadas.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <Label>Escalas citadas no texto</Label>
                          {escalasCitadas.map((c) => {
                            const def = ESCALAS[c.escala];
                            const unico = def.itens.length === 1;
                            return (
                              <div key={`${c.escala}-${c.score}-${c.trecho}`} className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
                                <span>{def.sigla}: {c.score} — “{c.trecho}”</span>
                                {unico ? (
                                  <Button type="button" size="sm" variant="secondary" onClick={() => registrarEscalaCitada(c)}>Registrar {def.sigla}</Button>
                                ) : (
                                  <span>lance os itens em Avaliação funcional</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="hidden">
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={salvando || !internacaoId || !fisioId}>
                    {salvando ? "Salvando…" : "Registrar evolução"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      {semEvolucao.length > 0 && (
        <Card className="border-attention-400/40">
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-attention-600" />
            <div>
              <p className="text-sm font-medium text-ink">
                {semEvolucao.length} paciente(s) internado(s) ainda sem nenhuma evolução registrada
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {semEvolucao.map((i) => (
                  <Badge key={i.id} variant="attention">{nomePaciente(i.id)}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar paciente…" className="pl-9" />
      </div>

      {grupos.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={NotebookPen}
              title="Nenhuma evolução encontrada"
              description="Ajuste a busca ou registre a primeira evolução de um paciente."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {grupos.map((g) => {
            const fechado = gruposFechados.has(g.admissionId);
            return (
              <Card key={g.admissionId}>
                <button
                  type="button"
                  onClick={() => toggleGrupo(g.admissionId)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clinical-50 text-clinical-600">
                      <BedDouble className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="font-medium text-ink">{g.paciente}</p>
                      <p className="text-xs text-ink-soft">{g.local}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Badge variant="clinical">{g.notas.length} evolução(ões)</Badge>
                    <span className="text-xs text-ink-soft">{new Date(g.ultima).toLocaleDateString("pt-BR")}</span>
                    <ChevronDown className={`h-4 w-4 text-ink-soft transition-transform ${fechado ? "-rotate-90" : ""}`} />
                  </div>
                </button>
                {!fechado && (
                  <div className="flex flex-col gap-3 border-t border-line px-5 pb-5 pt-4">
                    {g.notas.map((e) => (
                      <div key={e.id} className="flex gap-3 border-l-2 border-clinical-100 pl-3">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-medium text-ink-soft">
                              {fisioterapeutas.find((f) => f.id === e.physiotherapist_id)?.full_name ?? "—"}
                            </span>
                            <Badge variant="neutral">{new Date(e.created_at).toLocaleString("pt-BR")}</Badge>
                          </div>
                          <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">{e.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
