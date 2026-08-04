import { useMemo, useState, type FormEvent } from "react";
import { hojeLocalIso } from "@/lib/data-local";
import { Search, Plus, Pencil, BedDouble, LogOut, AlertTriangle, ClipboardPlus, Printer, Users, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  useAdmissions,
  usePatients,
  useHospitals,
  useUnits,
  useRooms,
  useBeds,
  useHealthInsurances,
  usePhysiotherapists,
  useProcedures,
  useDailyProduction,
  repository,
} from "@/data/repository";
import { Combobox } from "@/components/ui/combobox";
import { Paginacao, usarPaginacao } from "@/components/shared/paginacao";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { useDraftState } from "@/lib/use-draft-state";
import { useAuth } from "@/auth/auth-provider";
import { useAppStore } from "@/store/app-store";
import type { Admission } from "@/types/domain";

type StatusInternacao = "internado" | "alta";

const statusConfig: Record<StatusInternacao, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  internado: { label: "Internado", variant: "clinical" },
  alta: { label: "Alta", variant: "neutral" },
};

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function agoraParaInputDatetime() {
  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  return agora.toISOString().slice(0, 16);
}

export default function Internacoes() {
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const hospitais = useHospitals();
  const unidades = useUnits();
  const leitos = useBeds();
  const convenios = useHealthInsurances();
  const fisioterapeutas = usePhysiotherapists();
  const procedimentos = useProcedures();
  const producao = useDailyProduction();
  const { profile } = useAuth();
  const quartos = useRooms();
  const empresaId = useAppStore((s) => s.activeCompanyId);

  // Seleção de linhas — base pra "gerar lista" (imprimir) e "distribuir".
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  function toggleSelecionado(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const COLUNAS_LISTA = [
    { chave: "nrAtendimento", rotulo: "Nr. Atendimento" },
    { chave: "paciente", rotulo: "Paciente" },
    { chave: "procedimento", rotulo: "Procedimento (hoje)" },
    { chave: "quarto", rotulo: "Quarto" },
    { chave: "leito", rotulo: "Leito" },
    { chave: "hospital", rotulo: "Hospital" },
    { chave: "convenio", rotulo: "Convênio" },
  ] as const;
  const [colunasLista, setColunasLista] = useState<Set<string>>(new Set(COLUNAS_LISTA.map((c) => c.chave)));
  const [dialogListaAberto, setDialogListaAberto] = useState(false);

  const [dialogDistribuirAberto, setDialogDistribuirAberto] = useState(false);
  const [fisioDistribuirId, setFisioDistribuirId] = useState("");
  const [procedimentoDistribuirId, setProcedimentoDistribuirId] = useState("");
  const [dataDistribuir, setDataDistribuir] = useState(hojeLocalIso());
  const [distribuindo, setDistribuindo] = useState(false);
  // Fisioterapeuta lançador: só lança procedimento e cadastra paciente —
  // não administra internação (criar/editar/dar alta continua restrito).
  const podeAdministrarInternacao = !(profile?.role === "fisioterapeuta" && !profile.is_platform_admin);

  const hojeIso = hojeLocalIso();
  const internacoesComAtendimentoHoje = useMemo(
    () => new Set(producao.filter((p) => p.production_date === hojeIso).map((p) => p.admission_id)),
    [producao, hojeIso]
  );

  const [busca, setBusca] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState<string>("todas");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "internado" | "alta">("internado");
  const [filtroEntradaDe, setFiltroEntradaDe] = useState("");
  const [filtroEntradaAte, setFiltroEntradaAte] = useState("");
  const [apenasPendentes, setApenasPendentes] = useState(false);
  const [quartoInlineId, setQuartoInlineId] = useState("");
  const [ordenarPor, setOrdenarPor] = useState<"unidade" | "paciente" | "entrada" | "nrAtendimento">("unidade");
  const [pagina, setPagina] = useState(1);
  const [salvando, setSalvando] = useState(false);

  // Rascunho do formulário "Nova/Editar internação" — sobrevive a um
  // reload de aba (tablet descartando aba em 2º plano). Ver use-draft-state.ts.
  const [rascunho, setRascunho, limparRascunho] = useDraftState("internacao-form", {
    open: false,
    editandoId: null as string | null,
    pacienteId: "",
    unidadeId: "",
    leitoId: "",
    convenioId: "",
    nrAtendimento: "",
  });
  const open = rascunho.open;
  const editando = rascunho.editandoId ? internacoes.find((i) => i.id === rascunho.editandoId) ?? null : null;
  const pacienteId = rascunho.pacienteId;
  const unidadeId = rascunho.unidadeId;
  const leitoId = rascunho.leitoId;
  const convenioId = rascunho.convenioId;
  const nrAtendimento = rascunho.nrAtendimento;
  const setOpen = (v: boolean) => setRascunho({ ...rascunho, open: v });
  const setPacienteId = (v: string) => setRascunho({ ...rascunho, pacienteId: v });
  const setUnidadeId = (v: string) => setRascunho({ ...rascunho, unidadeId: v });
  const setLeitoId = (v: string) => setRascunho({ ...rascunho, leitoId: v });
  const setConvenioId = (v: string) => setRascunho({ ...rascunho, convenioId: v });
  const setNrAtendimento = (v: string) => setRascunho({ ...rascunho, nrAtendimento: v });

  const leitosDaUnidade = leitos.filter(
    (l) => l.unit_id === unidadeId && (l.status === "livre" || l.id === editando?.bed_id)
  );

  // Fluxo de alta — precisa de mais de uma etapa quando não há atendimento
  // lançado no dia, por isso vive num Sheet separado com seu próprio estado.
  const [internacaoParaAlta, setInternacaoParaAlta] = useState<Admission | null>(null);
  const [etapaAlta, setEtapaAlta] = useState<"data" | "sem-atendimento" | "lancar">("data");
  const [dataHoraAlta, setDataHoraAlta] = useState(agoraParaInputDatetime());
  const [salvandoAlta, setSalvandoAlta] = useState(false);
  const [fisioAltaId, setFisioAltaId] = useState("");
  const [procedimentoAltaId, setProcedimentoAltaId] = useState("");

  // Lançar procedimento direto da lista — não precisa sair daqui e ir
  // procurar o paciente de novo em Produção Diária.
  const [internacaoParaLancar, setInternacaoParaLancar] = useState<Admission | null>(null);
  const [fisioLancarId, setFisioLancarId] = useState("");
  const [procedimentoLancarId, setProcedimentoLancarId] = useState("");
  const [dataLancar, setDataLancar] = useState(hojeIso);
  const [horaLancar, setHoraLancar] = useState(new Date().toTimeString().slice(0, 5));
  const [salvandoLancamento, setSalvandoLancamento] = useState(false);

  function abrirLancarProcedimento(internacao: Admission) {
    setInternacaoParaLancar(internacao);
    setFisioLancarId("");
    setProcedimentoLancarId("");
    setDataLancar(hojeIso);
    setHoraLancar(new Date().toTimeString().slice(0, 5));
  }

  function nomeProcedimentoHoje(admissionId: string) {
    const hoje = hojeLocalIso();
    const lancamentos = producao.filter((p) => p.admission_id === admissionId && p.production_date === hoje);
    if (lancamentos.length === 0) return "—";
    return lancamentos
      .map((p) => procedimentos.find((pr) => pr.id === p.procedure_id)?.name ?? "—")
      .join(", ");
  }

  function handleImprimirLista() {
    const linhas = selecionados.size > 0 ? filtradas.filter((i) => selecionados.has(i.id)) : filtradas;
    if (linhas.length === 0) {
      notificarErro("Nada para imprimir", "Não há internações no filtro/seleção atual.");
      return;
    }
    const colunasAtivas = COLUNAS_LISTA.filter((c) => colunasLista.has(c.chave));
    const linhasHtml = linhas
      .map((i, idx) => {
        const celulas = colunasAtivas.map((c) => {
          switch (c.chave) {
            case "nrAtendimento": return i.external_reference ?? "—";
            case "paciente": return pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "—";
            case "procedimento": return nomeProcedimentoHoje(i.id);
            case "quarto": {
              const leito = leitos.find((l) => l.id === i.bed_id);
              return quartos.find((q) => q.id === leito?.room_id)?.code ?? "—";
            }
            case "leito": return leitos.find((l) => l.id === i.bed_id)?.code ?? "—";
            case "hospital": return hospitais.find((h) => h.id === i.hospital_id)?.name ?? "—";
            case "convenio": return convenios.find((c) => c.id === i.health_insurance_id)?.name ?? "—";
            default: return "—";
          }
        });
        return `<tr><td>${idx + 1}</td>${celulas.map((v) => `<td>${v}</td>`).join("")}</tr>`;
      })
      .join("");
    const cabecalho = `<tr><th>#</th>${colunasAtivas.map((c) => `<th>${c.rotulo}</th>`).join("")}</tr>`;
    const janela = window.open("", "_blank");
    if (!janela) {
      notificarErro("Não foi possível abrir a janela de impressão", "O navegador pode ter bloqueado o pop-up.");
      return;
    }
    janela.document.write(`
      <html>
        <head>
          <title>Lista de atendimento — ${new Date().toLocaleDateString("pt-BR")}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #16202b; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            p { font-size: 12px; color: #47566b; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #dbe2ea; padding: 6px 10px; font-size: 12px; text-align: left; }
            th { background: #f4f6fa; text-transform: uppercase; letter-spacing: 0.04em; font-size: 10px; }
          </style>
        </head>
        <body>
          <h1>Lista de atendimento</h1>
          <p>${new Date().toLocaleDateString("pt-BR")} · ${linhas.length} paciente(s)</p>
          <table>${cabecalho}${linhasHtml}</table>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    janela.document.close();
    setDialogListaAberto(false);
  }

  async function handleDistribuir() {
    if (!empresaId || !fisioDistribuirId || selecionados.size === 0) return;
    setDistribuindo(true);
    try {
      await repository.patientQueue.distribuir(
        empresaId,
        fisioDistribuirId,
        dataDistribuir,
        [...selecionados],
        profile?.id ?? null,
        procedimentoDistribuirId || null
      );
      notificarSucesso(`${selecionados.size} paciente(s) distribuído(s).`);
      setDialogDistribuirAberto(false);
      setSelecionados(new Set());
    } catch (erro) {
      notificarErro("Não foi possível distribuir", erro);
    } finally {
      setDistribuindo(false);
    }
  }

  async function handleLancarProcedimento(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!internacaoParaLancar) return;
    setSalvandoLancamento(true);
    try {
      await repository.dailyProduction.create({
        admission_id: internacaoParaLancar.id,
        physiotherapist_id: fisioLancarId,
        procedure_id: procedimentoLancarId,
        production_date: dataLancar,
        production_time: horaLancar,
        source: "manual",
        company_id: internacaoParaLancar.company_id,
      });
      notificarSucesso("Procedimento lançado.");
      setInternacaoParaLancar(null);
    } catch (erro) {
      notificarErro("Não foi possível lançar o procedimento", erro);
    } finally {
      setSalvandoLancamento(false);
    }
  }

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const resultado = internacoes.filter((i) => {
      if (filtroUnidade !== "todas" && i.unit_id !== filtroUnidade) return false;
      if (filtroStatus !== "todos" && i.status !== filtroStatus) return false;
      if (filtroEntradaDe && i.admission_date < filtroEntradaDe) return false;
      if (filtroEntradaAte && i.admission_date > filtroEntradaAte) return false;
      if (apenasPendentes && (i.status !== "internado" || internacoesComAtendimentoHoje.has(i.id))) return false;
      if (!termo) return true;
      const paciente = pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "";
      return (
        paciente.toLowerCase().includes(termo) ||
        String(i.admission_number).includes(termo) ||
        (i.external_reference ?? "").toLowerCase().includes(termo)
      );
    });

    const nomeUnidade = (unitId: string | null) => unidades.find((u) => u.id === unitId)?.name ?? "";
    const nomePacienteDe = (i: (typeof internacoes)[number]) => pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "";

    return [...resultado].sort((a, b) => {
      switch (ordenarPor) {
        case "paciente":
          return nomePacienteDe(a).localeCompare(nomePacienteDe(b));
        case "entrada":
          return b.admission_date.localeCompare(a.admission_date);
        case "nrAtendimento":
          return (a.external_reference ?? "").localeCompare(b.external_reference ?? "");
        case "unidade":
        default: {
          const cmp = nomeUnidade(a.unit_id).localeCompare(nomeUnidade(b.unit_id));
          return cmp !== 0 ? cmp : nomePacienteDe(a).localeCompare(nomePacienteDe(b));
        }
      }
    });
  }, [busca, filtroUnidade, filtroStatus, filtroEntradaDe, filtroEntradaAte, apenasPendentes, internacoes, pacientes, internacoesComAtendimentoHoje, ordenarPor, unidades]);

  const { pagina: paginaAtual, totalPaginas, paginaValida } = usarPaginacao(filtradas, 25, pagina);

  function abrirNova() {
    setQuartoInlineId("");
    setRascunho({
      open: true,
      editandoId: null,
      pacienteId: "",
      unidadeId: "",
      leitoId: "",
      convenioId: "",
      nrAtendimento: "",
    });
  }

  function abrirEdicao(internacao: Admission) {
    setQuartoInlineId("");
    setRascunho({
      open: true,
      editandoId: internacao.id,
      pacienteId: internacao.patient_id,
      unidadeId: internacao.unit_id ?? "",
      leitoId: internacao.bed_id ?? "",
      convenioId: internacao.health_insurance_id ?? "",
      nrAtendimento: internacao.external_reference ?? "",
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const paciente = pacientes.find((p) => p.id === pacienteId);
    const unidade = unidades.find((u) => u.id === unidadeId);
    if (!paciente || !unidade) return;
    setSalvando(true);
    try {
      if (leitoId && quartoInlineId) {
        const leitoAtual = leitos.find((l) => l.id === leitoId);
        if (leitoAtual) {
          await repository.beds.update(leitoId, { room_id: quartoInlineId });
        }
      }
      const dados = {
        patient_id: pacienteId,
        hospital_id: unidade.hospital_id,
        unit_id: unidadeId,
        bed_id: leitoId || null,
        health_insurance_id: convenioId || null,
        admission_date: String(form.get("admission_date") ?? ""),
        admission_time: String(form.get("admission_time") ?? "") || "08:00",
        external_reference: nrAtendimento.trim() || null,
        company_id: paciente.company_id,
      };
      if (editando) {
        await repository.admissions.update(editando.id, dados);
        notificarSucesso("Internação atualizada.");
      } else {
        await repository.admissions.create(dados);
        notificarSucesso("Internação registrada.");
      }
      limparRascunho();
    } catch (erro) {
      notificarErro(editando ? "Não foi possível salvar as alterações" : "Não foi possível registrar a internação", erro);
    } finally {
      setSalvando(false);
    }
  }

  function abrirFluxoAlta(internacao: Admission) {
    setInternacaoParaAlta(internacao);
    setEtapaAlta("data");
    setDataHoraAlta(agoraParaInputDatetime());
  }

  async function handleConfirmarData(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!internacaoParaAlta) return;
    setSalvandoAlta(true);
    try {
      await tentarAlta(false);
    } finally {
      setSalvandoAlta(false);
    }
  }

  async function tentarAlta(semAtendimento: boolean) {
    if (!internacaoParaAlta) return;
    try {
      const iso = new Date(dataHoraAlta).toISOString();
      await repository.admissions.discharge(internacaoParaAlta.id, iso, semAtendimento);
      notificarSucesso("Alta registrada. O leito foi liberado para higienização.");
      setInternacaoParaAlta(null);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "SEM_ATENDIMENTO_NA_ALTA") {
        setEtapaAlta("sem-atendimento");
        return;
      }
      notificarErro("Não foi possível registrar a alta", erro);
    }
  }

  async function handleLancarELiberar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!internacaoParaAlta) return;
    setSalvandoAlta(true);
    try {
      await repository.dailyProduction.create({
        admission_id: internacaoParaAlta.id,
        physiotherapist_id: fisioAltaId,
        procedure_id: procedimentoAltaId,
        production_date: dataHoraAlta.slice(0, 10),
        production_time: dataHoraAlta.slice(11, 16),
        source: "manual",
        company_id: internacaoParaAlta.company_id,
      });
      await tentarAlta(false);
    } catch (erro) {
      notificarErro("Não foi possível lançar o atendimento", erro);
    } finally {
      setSalvandoAlta(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pacientes Internados"
        description="Pacientes internados acompanhados pela equipe, com leito, hospital, convênio e status de atendimento do dia."
        actions={
          podeAdministrarInternacao ? (
            <Sheet open={open} onOpenChange={(v) => (v ? setOpen(true) : limparRascunho())}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNova}>
                <Plus className="h-4 w-4" /> Nova internação
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "nova"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar internação" : "Nova internação"}</SheetTitle>
                  <SheetDescription>Ao escolher um leito livre, ele passa automaticamente para ocupado.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Paciente</Label>
                    <Select value={pacienteId} onValueChange={setPacienteId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                      <SelectContent>
                        {pacientes.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Unidade</Label>
                    <Select value={unidadeId} onValueChange={(v) => { setUnidadeId(v); setLeitoId(""); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                      <SelectContent>
                        {unidades.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Leito (opcional)</Label>
                    <Select value={leitoId} onValueChange={(v) => { setLeitoId(v); setQuartoInlineId(""); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione um leito livre" /></SelectTrigger>
                      <SelectContent>
                        {leitosDaUnidade.length === 0 ? (
                          <SelectItem value="none" disabled>Nenhum leito livre nesta unidade</SelectItem>
                        ) : (
                          leitosDaUnidade.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.code}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {leitoId && leitos.find((l) => l.id === leitoId)?.room_id === null && (
                    <div className="flex flex-col gap-1.5 rounded-md border border-attention-400/40 bg-attention-100 p-3">
                      <Label>Quarto deste leito (opcional)</Label>
                      <Select value={quartoInlineId} onValueChange={setQuartoInlineId}>
                        <SelectTrigger><SelectValue placeholder="Sem quarto vinculado ainda" /></SelectTrigger>
                        <SelectContent>
                          {quartos.filter((q) => q.unit_id === unidadeId).map((q) => (
                            <SelectItem key={q.id} value={q.id}>{q.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-attention-700">
                        Esse leito ainda não tem quarto — definindo aqui, já grava direto nele, e passa a aparecer
                        nas listas/relatórios pra sempre, sem precisar mexer em Leitos depois.
                      </p>
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Label>Convênio</Label>
                    <Select value={convenioId} onValueChange={setConvenioId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o convênio" /></SelectTrigger>
                      <SelectContent>
                        {convenios.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5 rounded-md border border-clinical-300 bg-clinical-50 p-3">
                    <Label htmlFor="nr_atendimento">Nr. Atendimento (Tasy)</Label>
                    <Input
                      id="nr_atendimento"
                      value={nrAtendimento}
                      onChange={(e) => setNrAtendimento(e.target.value)}
                      placeholder="Ex.: 706065"
                    />
                    <p className="text-xs text-ink-soft">
                      É o ID da internação no Tasy — usado pra confrontar automaticamente com a importação da
                      produção. Sem ele, essa internação não concilia sozinha.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="admission_date">Data de entrada</Label>
                      <Input id="admission_date" name="admission_date" type="date" required defaultValue={editando?.admission_date ?? hojeLocalIso()} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="admission_time">Horário</Label>
                      <Input id="admission_time" name="admission_time" type="time" required defaultValue={editando?.admission_time?.slice(0, 5) ?? new Date().toTimeString().slice(0, 5)} />
                    </div>
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => limparRascunho()}>Cancelar</Button>
                  <Button type="submit" disabled={salvando || !pacienteId || !unidadeId}>
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Registrar internação"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
          ) : null
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                <Input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar por paciente, código ou Nr. Atendimento…" className="pl-9" />
              </div>
              <Select value={filtroUnidade} onValueChange={(v) => { setFiltroUnidade(v); setPagina(1); }}>
                <SelectTrigger className="sm:w-56"><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as unidades</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v as typeof filtroStatus); setPagina(1); }}>
                <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="internado">Só internados</SelectItem>
                  <SelectItem value="alta">Só com alta</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={apenasPendentes ? "primary" : "secondary"}
                size="sm"
                onClick={() => { setApenasPendentes((v) => !v); setPagina(1); }}
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Só pendentes de hoje
              </Button>
            </div>
            <p className="whitespace-nowrap text-sm text-ink-soft">{filtradas.length} de {internacoes.length} internações</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-soft">Entrada entre</span>
            <Input
              type="date"
              value={filtroEntradaDe}
              onChange={(e) => { setFiltroEntradaDe(e.target.value); setPagina(1); }}
              className="w-40"
            />
            <span className="text-xs text-ink-soft">e</span>
            <Input
              type="date"
              value={filtroEntradaAte}
              onChange={(e) => { setFiltroEntradaAte(e.target.value); setPagina(1); }}
              className="w-40"
            />
            {(filtroEntradaDe || filtroEntradaAte) && (
              <Button variant="ghost" size="sm" onClick={() => { setFiltroEntradaDe(""); setFiltroEntradaAte(""); setPagina(1); }}>
                Limpar período
              </Button>
            )}
            <span className="ml-2 text-xs text-ink-soft">Ordenar por</span>
            <Select value={ordenarPor} onValueChange={(v) => setOrdenarPor(v as typeof ordenarPor)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unidade">Unidade</SelectItem>
                <SelectItem value="paciente">Paciente (A-Z)</SelectItem>
                <SelectItem value="entrada">Entrada (mais recente)</SelectItem>
                <SelectItem value="nrAtendimento">Nr. Atendimento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="text-xs text-ink-soft">
            {selecionados.size > 0 ? `${selecionados.size} selecionado(s)` : "Nenhuma seleção — a lista/distribuição usa todos os filtrados"}
          </span>
          <div className="ml-auto flex gap-2">
            {selecionados.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelecionados(new Set())}>
                <X className="h-3.5 w-3.5" /> Limpar seleção
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setDialogListaAberto(true)}>
              <Printer className="h-3.5 w-3.5" /> Gerar/imprimir lista
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={selecionados.size === 0}
              onClick={() => { setProcedimentoDistribuirId(""); setDialogDistribuirAberto(true); }}
            >
              <Users className="h-3.5 w-3.5" /> Distribuir
            </Button>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <BedDouble className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum paciente internado encontrado</p>
            <p className="text-sm text-ink-soft">Ajuste os filtros ou registre uma nova internação.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="w-8 px-4 py-3" />
                  <th className="px-4 py-3 font-medium">Nr. Atendimento</th>
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">{podeAdministrarInternacao ? "Hospital / Unidade" : "Unidade"}</th>
                  <th className="px-4 py-3 font-medium">Leito</th>
                  <th className="px-4 py-3 font-medium">Convênio</th>
                  <th className="px-4 py-3 font-medium">Entrada</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Hoje</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {paginaAtual.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selecionados.has(i.id)}
                        onChange={() => toggleSelecionado(i.id)}
                        className="h-4 w-4 rounded border-line-strong accent-clinical-500"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{i.external_reference ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {podeAdministrarInternacao && (
                        <>
                          {hospitais.find((h) => h.id === i.hospital_id)?.name ?? "—"}
                          <span className="block text-xs">{unidades.find((u) => u.id === i.unit_id)?.name ?? "—"}</span>
                        </>
                      )}
                      {!podeAdministrarInternacao && (unidades.find((u) => u.id === i.unit_id)?.name ?? "—")}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-soft">{leitos.find((l) => l.id === i.bed_id)?.code ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{convenios.find((c) => c.id === i.health_insurance_id)?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{formatarData(i.admission_date)} {i.admission_time?.slice(0, 5)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusConfig[i.status as StatusInternacao]?.variant ?? "neutral"}>
                        {statusConfig[i.status as StatusInternacao]?.label ?? i.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {i.status === "internado" ? (
                        internacoesComAtendimentoHoje.has(i.id) ? (
                          <Badge variant="recovery">Em atendimento</Badge>
                        ) : (
                          <Badge variant="attention">
                            <AlertTriangle className="h-3 w-3" /> Pendente
                          </Badge>
                        )
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {podeAdministrarInternacao && (
                          <Button variant="ghost" size="icon" aria-label="Editar internação" onClick={() => abrirEdicao(i)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {i.status === "internado" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => abrirLancarProcedimento(i)}>
                              <ClipboardPlus className="h-3.5 w-3.5" /> Lançar procedimento
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => abrirFluxoAlta(i)}>
                              <LogOut className="h-3.5 w-3.5" /> Dar alta
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacao
          paginaAtual={paginaValida}
          totalPaginas={totalPaginas}
          onChange={setPagina}
          totalItens={filtradas.length}
          itensPorPagina={25}
        />
      </Card>

      <Sheet open={internacaoParaAlta !== null} onOpenChange={(open) => !open && setInternacaoParaAlta(null)}>
        <SheetContent>
          {etapaAlta === "data" && (
            <form className="flex h-full flex-col" onSubmit={handleConfirmarData}>
              <SheetHeader>
                <SheetTitle>Tem certeza que quer dar alta?</SheetTitle>
                <SheetDescription>
                  {internacaoParaAlta && (pacientes.find((p) => p.id === internacaoParaAlta.patient_id)?.full_name ?? "—")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-4">
                <div
                  className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-sm ${
                    internacaoParaAlta && internacoesComAtendimentoHoje.has(internacaoParaAlta.id)
                      ? "bg-recovery-100 text-recovery-700"
                      : "bg-attention-100 text-attention-700"
                  }`}
                >
                  {internacaoParaAlta && internacoesComAtendimentoHoje.has(internacaoParaAlta.id) ? (
                    <>Este paciente já tem procedimento lançado hoje.</>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 shrink-0" /> Nenhum procedimento lançado hoje para este paciente ainda.
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="discharge_at">Data e hora da alta</Label>
                  <Input
                    id="discharge_at"
                    type="datetime-local"
                    required
                    value={dataHoraAlta}
                    onChange={(e) => setDataHoraAlta(e.target.value)}
                  />
                </div>
              </div>
              <SheetFooter>
                <Button type="button" variant="secondary" onClick={() => setInternacaoParaAlta(null)}>Cancelar</Button>
                <Button type="submit" disabled={salvandoAlta}>{salvandoAlta ? "Verificando…" : "Sim, confirmar alta"}</Button>
              </SheetFooter>
            </form>
          )}

          {etapaAlta === "sem-atendimento" && (
            <div className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle>Nenhum atendimento lançado hoje</SheetTitle>
                <SheetDescription>
                  Não há procedimento lançado para este paciente na data da alta ({dataHoraAlta.slice(0, 10).split("-").reverse().join("/")}).
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex items-start gap-2.5 rounded-md bg-attention-100 p-3 text-sm text-attention-600">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Recebeu atendimento antes da alta? Lance agora, ou confirme que não houve atendimento.
                </div>
              </div>
              <SheetFooter className="flex-col gap-2 sm:flex-col">
                <Button type="button" onClick={() => setEtapaAlta("lancar")} disabled={salvandoAlta}>
                  Lançar atendimento agora
                </Button>
                <Button type="button" variant="secondary" onClick={() => tentarAlta(true)} disabled={salvandoAlta}>
                  {salvandoAlta ? "Salvando…" : "Confirmar que não houve atendimento"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEtapaAlta("data")}>Voltar</Button>
              </SheetFooter>
            </div>
          )}

          {etapaAlta === "lancar" && (
            <form className="flex h-full flex-col" onSubmit={handleLancarELiberar}>
              <SheetHeader>
                <SheetTitle>Lançar atendimento antes da alta</SheetTitle>
                <SheetDescription>Registra o procedimento e, em seguida, confirma a alta automaticamente.</SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Fisioterapeuta</Label>
                  <Select value={fisioAltaId} onValueChange={setFisioAltaId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o fisioterapeuta" /></SelectTrigger>
                    <SelectContent>
                      {fisioterapeutas.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Procedimento</Label>
                  <Select value={procedimentoAltaId} onValueChange={setProcedimentoAltaId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o procedimento" /></SelectTrigger>
                    <SelectContent>
                      {procedimentos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <SheetFooter>
                <Button type="button" variant="secondary" onClick={() => setEtapaAlta("sem-atendimento")}>Voltar</Button>
                <Button type="submit" disabled={salvandoAlta || !fisioAltaId || !procedimentoAltaId}>
                  {salvandoAlta ? "Salvando…" : "Lançar e confirmar alta"}
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={internacaoParaLancar !== null} onOpenChange={(open) => !open && setInternacaoParaLancar(null)}>
        <SheetContent>
          <form className="flex h-full flex-col" onSubmit={handleLancarProcedimento}>
            <SheetHeader>
              <SheetTitle>Lançar procedimento</SheetTitle>
              <SheetDescription>
                {internacaoParaLancar && (pacientes.find((p) => p.id === internacaoParaLancar.patient_id)?.full_name ?? "—")}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Fisioterapeuta</Label>
                <Combobox
                  value={fisioLancarId}
                  onValueChange={setFisioLancarId}
                  options={fisioterapeutas.map((f) => ({ value: f.id, label: f.full_name }))}
                  placeholder="Buscar fisioterapeuta…"
                  searchPlaceholder="Nome do fisioterapeuta…"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Procedimento</Label>
                <Combobox
                  value={procedimentoLancarId}
                  onValueChange={setProcedimentoLancarId}
                  options={procedimentos.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, sublabel: p.category ?? undefined }))}
                  placeholder="Buscar procedimento…"
                  searchPlaceholder="Nome ou categoria…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="data_lancar">Data</Label>
                  <Input id="data_lancar" type="date" required value={dataLancar} onChange={(e) => setDataLancar(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="hora_lancar">Horário</Label>
                  <Input id="hora_lancar" type="time" required value={horaLancar} onChange={(e) => setHoraLancar(e.target.value)} />
                </div>
              </div>
            </div>
            <SheetFooter>
              <Button type="button" variant="secondary" onClick={() => setInternacaoParaLancar(null)}>Cancelar</Button>
              <Button type="submit" disabled={salvandoLancamento || !fisioLancarId || !procedimentoLancarId}>
                {salvandoLancamento ? "Salvando…" : "Lançar procedimento"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={dialogListaAberto} onOpenChange={setDialogListaAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar lista de atendimento</DialogTitle>
            <DialogDescription>
              {selecionados.size > 0
                ? `${selecionados.size} paciente(s) selecionado(s).`
                : `Todos os ${filtradas.length} pacientes do filtro atual (nenhuma seleção específica).`}
              {" "}Escolha quais informações aparecem na lista.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2.5">
            {COLUNAS_LISTA.map((c) => (
              <label key={c.chave} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={colunasLista.has(c.chave)}
                  onChange={(e) =>
                    setColunasLista((atual) => {
                      const novo = new Set(atual);
                      if (e.target.checked) novo.add(c.chave);
                      else novo.delete(c.chave);
                      return novo;
                    })
                  }
                  className="h-4 w-4 rounded border-line-strong accent-clinical-500"
                />
                {c.rotulo}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogListaAberto(false)}>Cancelar</Button>
            <Button onClick={handleImprimirLista}>
              <Printer className="h-4 w-4" /> Gerar e imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogDistribuirAberto} onOpenChange={setDialogDistribuirAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Distribuir para fisioterapeuta</DialogTitle>
            <DialogDescription>
              {selecionados.size} paciente(s) vão entrar na fila do dia desse fisioterapeuta, na ordem em que
              aparecem na lista.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Fisioterapeuta</Label>
              <Combobox
                value={fisioDistribuirId}
                onValueChange={setFisioDistribuirId}
                options={fisioterapeutas.map((f) => ({ value: f.id, label: f.full_name }))}
                placeholder="Buscar fisioterapeuta…"
                searchPlaceholder="Nome do fisioterapeuta…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data_distribuir">Data</Label>
              <Input id="data_distribuir" type="date" value={dataDistribuir} onChange={(e) => setDataDistribuir(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Procedimento sugerido (opcional)</Label>
              <Combobox
                value={procedimentoDistribuirId}
                onValueChange={setProcedimentoDistribuirId}
                options={procedimentos.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, sublabel: p.category ?? undefined }))}
                placeholder="Sem sugestão — o fisio escolhe ao lançar"
                searchPlaceholder="Nome, código ou categoria…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogDistribuirAberto(false)}>Cancelar</Button>
            <Button onClick={handleDistribuir} disabled={distribuindo || !fisioDistribuirId}>
              {distribuindo ? "Distribuindo…" : "Distribuir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
