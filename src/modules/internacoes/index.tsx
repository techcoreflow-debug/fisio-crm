import { useMemo, useState, type FormEvent } from "react";
import { hojeLocalIso } from "@/lib/data-local";
import { supabase } from "@/lib/supabase";
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
import { DeleteButton } from "@/components/shared/delete-button";
import { Paginacao, usarPaginacao } from "@/components/shared/paginacao";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { useDraftState } from "@/lib/use-draft-state";
import { useAuth } from "@/auth/auth-provider";
import { useAppStore } from "@/store/app-store";
import type { Admission, Bed, DailyProduction } from "@/types/domain";

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
    { chave: "diagnostico", rotulo: "Diagnóstico" },
    { chave: "preLancamento", rotulo: "Pré-lançamento" },
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
  // Fisio lançador precisa poder EDITAR (trocar quarto, por exemplo — é
  // rotina, o paciente muda de quarto com frequência), mas nunca criar
  // internação nova nem excluir — só esses dois continuam restritos.
  const podeEditarInternacao = podeAdministrarInternacao || profile?.role === "fisioterapeuta";
  // Só admin e supervisor podem MEXER no código sugerido — é justamente
  // pra ninguém confuso na codificação alterar o código que deveria
  // orientar (a razão de existir o pré-lançamento).
  const podeAlterarPreLancamento = profile?.role === "admin" || profile?.role === "supervisor" || profile?.is_platform_admin;
  const podeExcluirInternacao = profile?.role === "admin" || profile?.role === "supervisor" || profile?.is_platform_admin;

  const hojeIso = hojeLocalIso();
  const internacoesComAtendimentoHoje = useMemo(
    () => new Set(producao.filter((p) => p.production_date === hojeIso).map((p) => p.admission_id)),
    [producao, hojeIso]
  );

  const [busca, setBusca] = useState("");
  const [filtroHospital, setFiltroHospital] = useState<string>("todos");
  const [filtroUnidade, setFiltroUnidade] = useState<string>("todas");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "internado" | "alta">("internado");
  const [filtroEntradaDe, setFiltroEntradaDe] = useState("");
  const [filtroEntradaAte, setFiltroEntradaAte] = useState("");
  const [apenasPendentes, setApenasPendentes] = useState(false);
  const [quartoInlineId, setQuartoInlineId] = useState("");
  const [ordenarPor, setOrdenarPor] = useState<"unidade" | "paciente" | "entrada" | "nrAtendimento" | "leito">("unidade");
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
    diagnostico: "",
    preLancamentoMotoraId: "",
    preLancamentoRespiratoriaId: "",
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
  const setLeitoId = (v: string) => setRascunho({ ...rascunho, leitoId: v });
  const setConvenioId = (v: string) => setRascunho({ ...rascunho, convenioId: v });
  const setNrAtendimento = (v: string) => setRascunho({ ...rascunho, nrAtendimento: v });
  const diagnostico = rascunho.diagnostico;
  const setDiagnostico = (v: string) => setRascunho({ ...rascunho, diagnostico: v });
  const preLancamentoMotoraId = rascunho.preLancamentoMotoraId;
  const setPreLancamentoMotoraId = (v: string) => setRascunho({ ...rascunho, preLancamentoMotoraId: v });
  const preLancamentoRespiratoriaId = rascunho.preLancamentoRespiratoriaId;
  const setPreLancamentoRespiratoriaId = (v: string) => setRascunho({ ...rascunho, preLancamentoRespiratoriaId: v });

  // Não confia no campo `status` do leito puro — o mesmo tipo de
  // dessincronia que já corrigimos em Leitos pode deixar um leito preso
  // como "ocupado" no banco sem internação real, e aí ele nunca
  // apareceria aqui pra selecionar. Calcula ao vivo, igual lá.
  function leitoEstaLivre(leito: Bed) {
    if (leito.id === editando?.bed_id) return true; // o leito que a internação já usa sempre aparece
    return !internacoes.some((i) => i.bed_id === leito.id && i.status === "internado");
  }
  const leitosDaUnidade = leitos.filter((l) => l.unit_id === unidadeId && leitoEstaLivre(l));

  // Fluxo de alta — precisa de mais de uma etapa quando não há atendimento
  // lançado no dia, por isso vive num Sheet separado com seu próprio estado.
  const [internacaoParaAlta, setInternacaoParaAlta] = useState<Admission | null>(null);
  const [etapaAlta, setEtapaAlta] = useState<"data" | "lancar">("data");
  const [dataHoraAlta, setDataHoraAlta] = useState(agoraParaInputDatetime());
  const [salvandoAlta, setSalvandoAlta] = useState(false);
  const [fisioAltaId, setFisioAltaId] = useState("");
  const [procedimentoAltaId, setProcedimentoAltaId] = useState("");
  const [dataLancarAlta, setDataLancarAlta] = useState(hojeIso);
  const [horaLancarAlta, setHoraLancarAlta] = useState(new Date().toTimeString().slice(0, 5));

  // Lançar procedimento direto da lista — não precisa sair daqui e ir
  // procurar o paciente de novo em Produção Diária.
  const [internacaoParaLancar, setInternacaoParaLancar] = useState<Admission | null>(null);
  const [fisioLancarId, setFisioLancarId] = useState("");
  const [procedimentoLancarId, setProcedimentoLancarId] = useState("");
  const [dataLancar, setDataLancar] = useState(hojeIso);
  const [horaLancar, setHoraLancar] = useState(new Date().toTimeString().slice(0, 5));
  const [salvandoLancamento, setSalvandoLancamento] = useState(false);

  async function abrirLancarProcedimento(internacao: Admission) {
    setInternacaoParaLancar(internacao);
    setFisioLancarId("");
    setProcedimentoLancarId("");
    setDataLancar(hojeIso);
    setHoraLancar(new Date().toTimeString().slice(0, 5));
    setProcedimentosDeHojeConferidos(null);
    await conferirProcedimentosDeHoje(internacao.id);
  }

  function nomeProcedimentoHoje(admissionId: string) {
    const hoje = hojeLocalIso();
    const lancamentos = producao.filter((p) => p.admission_id === admissionId && p.production_date === hoje);
    if (lancamentos.length === 0) return "—";
    return lancamentos
      .map((p) => {
        const proc = procedimentos.find((pr) => pr.id === p.procedure_id);
        return proc ? `${proc.code} - ${proc.name}` : "—";
      })
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
        // "Novo" = ainda não tem NENHUM procedimento lançado nessa
        // internação (não só hoje) — é o critério que a equipe usa pra
        // saber quem acabou de entrar na triagem. Assim que lança o
        // primeiro procedimento, deixa de aparecer em negrito.
        const ehNovo = !producao.some((p) => p.admission_id === i.id);
        const celulas = colunasAtivas.map((c) => {
          switch (c.chave) {
            case "nrAtendimento": return i.external_reference ?? "—";
            case "paciente": return pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "—";
            case "diagnostico": return i.diagnostico || "—";
            case "preLancamento": {
              const motora = procedimentos.find((p) => p.id === i.pre_lancamento_motora_id)?.code;
              const respiratoria = procedimentos.find((p) => p.id === i.pre_lancamento_respiratoria_id)?.code;
              return motora || respiratoria ? `${motora ?? "—"} · ${respiratoria ?? "—"}` : "—";
            }
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
        return `<tr class="${ehNovo ? "novo" : ""}"><td>${idx + 1}</td>${celulas.map((v) => `<td>${v}</td>`).join("")}</tr>`;
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
            tr.novo td { font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>Lista de atendimento</h1>
          <p>${new Date().toLocaleDateString("pt-BR")} · ${linhas.length} paciente(s) · <strong>negrito</strong> = paciente novo, ainda sem procedimento lançado</p>
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
      // Não fecha sozinho — limpa só o procedimento (mantém o
      // fisioterapeuta, já que costuma ser a mesma pessoa lançando vários
      // seguidos) e deixa a tela aberta, com a lista de "já lançados"
      // atualizada, pra continuar lançando sem precisar reabrir.
      setProcedimentoLancarId("");
      setHoraLancar(new Date().toTimeString().slice(0, 5));
      await conferirProcedimentosDeHoje(internacaoParaLancar.id);
    } catch (erro) {
      notificarErro("Não foi possível lançar o procedimento", erro);
    } finally {
      setSalvandoLancamento(false);
    }
  }

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const resultado = internacoes.filter((i) => {
      if (filtroHospital !== "todos" && i.hospital_id !== filtroHospital) return false;
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
    const codigoLeito = (bedId: string | null) => leitos.find((l) => l.id === bedId)?.code ?? "";
    const nomePacienteDe = (i: (typeof internacoes)[number]) => pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "";

    return [...resultado].sort((a, b) => {
      switch (ordenarPor) {
        case "paciente":
          return nomePacienteDe(a).localeCompare(nomePacienteDe(b));
        case "entrada":
          return b.admission_date.localeCompare(a.admission_date);
        case "nrAtendimento":
          return (a.external_reference ?? "").localeCompare(b.external_reference ?? "");
        case "leito":
          return codigoLeito(a.bed_id).localeCompare(codigoLeito(b.bed_id), undefined, { numeric: true });
        case "unidade":
        default: {
          const cmp = nomeUnidade(a.unit_id).localeCompare(nomeUnidade(b.unit_id));
          return cmp !== 0 ? cmp : codigoLeito(a.bed_id).localeCompare(codigoLeito(b.bed_id), undefined, { numeric: true });
        }
      }
    });
  }, [busca, filtroHospital, filtroUnidade, filtroStatus, filtroEntradaDe, filtroEntradaAte, apenasPendentes, internacoes, pacientes, internacoesComAtendimentoHoje, ordenarPor, unidades, leitos]);

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
      diagnostico: "",
    preLancamentoMotoraId: "",
    preLancamentoRespiratoriaId: "",
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
      diagnostico: internacao.diagnostico ?? "",
      preLancamentoMotoraId: internacao.pre_lancamento_motora_id ?? "",
      preLancamentoRespiratoriaId: internacao.pre_lancamento_respiratoria_id ?? "",
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const paciente = pacientes.find((p) => p.id === pacienteId);
    const unidade = unidades.find((u) => u.id === unidadeId);
    if (!paciente || !unidade) return;
    if (!leitoId) {
      notificarErro("Leito obrigatório", "Selecione um leito antes de salvar.");
      return;
    }
    const leitoEscolhido = leitos.find((l) => l.id === leitoId);
    if (leitoEscolhido && !leitoEscolhido.room_id && !quartoInlineId) {
      notificarErro("Quarto obrigatório", "Esse leito ainda não tem quarto vinculado — preencha o campo de quarto que apareceu logo abaixo do leito.");
      return;
    }
    if (!!preLancamentoMotoraId !== !!preLancamentoRespiratoriaId) {
      notificarErro(
        "Pré-lançamento incompleto",
        "Se for preencher o pré-lançamento, precisa dos dois: Motora e Respiratória — não faz sentido só um."
      );
      return;
    }
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
        diagnostico: diagnostico.trim() || null,
        pre_lancamento_motora_id: preLancamentoMotoraId || null,
        pre_lancamento_respiratoria_id: preLancamentoRespiratoriaId || null,
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

  // Confiar só no `producao` reativo (Realtime) é arriscado justamente
  // aqui: se a conexão em tempo real da pessoa cair silenciosamente (comum
  // em wifi de hospital) sem reconectar, a lista fica desatualizada sem
  // nenhum aviso — e é exatamente na hora da alta que isso não pode
  // acontecer. Por isso, ao abrir a tela, busca direto no banco.
  const [procedimentosDeHojeConferidos, setProcedimentosDeHojeConferidos] = useState<DailyProduction[] | null>(null);
  const [conferindoProcedimentos, setConferindoProcedimentos] = useState(false);

  async function conferirProcedimentosDeHoje(admissionId: string) {
    setConferindoProcedimentos(true);
    try {
      const { data, error } = await supabase
        .from("daily_production")
        .select("*")
        .eq("admission_id", admissionId)
        .eq("production_date", hojeLocalIso())
        .order("production_time", { ascending: true });
      if (error) throw error;
      setProcedimentosDeHojeConferidos((data ?? []) as DailyProduction[]);
    } catch {
      // Se a busca direta falhar (ex.: sem internet momentaneamente), cai
      // pro dado reativo em vez de travar a tela — melhor mostrar algo
      // possivelmente desatualizado do que nada.
      setProcedimentosDeHojeConferidos(null);
    } finally {
      setConferindoProcedimentos(false);
    }
  }

  async function abrirFluxoAlta(internacao: Admission) {
    setInternacaoParaAlta(internacao);
    setEtapaAlta("data");
    setDataHoraAlta(agoraParaInputDatetime());
    setFisioAltaId("");
    setProcedimentoAltaId("");
    setDataLancarAlta(hojeIso);
    setHoraLancarAlta(new Date().toTimeString().slice(0, 5));
    setProcedimentosDeHojeConferidos(null);
    await conferirProcedimentosDeHoje(internacao.id);
  }

  const procedimentosDeHojeNaAlta =
    procedimentosDeHojeConferidos !== null
      ? procedimentosDeHojeConferidos
      : internacaoParaAlta
        ? producao.filter((p) => p.admission_id === internacaoParaAlta.id && p.production_date === hojeIso)
        : [];

  async function handleConfirmarAlta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!internacaoParaAlta) return;
    setSalvandoAlta(true);
    try {
      const iso = new Date(dataHoraAlta).toISOString();
      // Reflete a realidade de verdade — só marca "sem atendimento
      // confirmado" quando genuinamente não tem nenhum procedimento hoje.
      // O aviso já fica sempre visível nesta tela (nunca escondido atrás
      // de uma etapa separada), então quem confirma já viu a informação.
      const semAtendimento = procedimentosDeHojeNaAlta.length === 0;
      await repository.admissions.discharge(internacaoParaAlta.id, iso, semAtendimento);
      notificarSucesso("Alta registrada. O leito foi liberado para higienização.");
      setInternacaoParaAlta(null);
    } catch (erro) {
      notificarErro("Não foi possível registrar a alta", erro);
    } finally {
      setSalvandoAlta(false);
    }
  }

  async function handleLancarDuranteAlta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!internacaoParaAlta) return;
    setSalvandoAlta(true);
    try {
      await repository.dailyProduction.create({
        admission_id: internacaoParaAlta.id,
        physiotherapist_id: fisioAltaId,
        procedure_id: procedimentoAltaId,
        production_date: dataLancarAlta,
        production_time: horaLancarAlta,
        source: "manual",
        company_id: internacaoParaAlta.company_id,
      });
      notificarSucesso("Procedimento lançado.");
      // Volta pra tela principal da alta — não confirma sozinho, deixa a
      // pessoa decidir se lança mais um ou já confirma a alta.
      setEtapaAlta("data");
      setFisioAltaId("");
      setProcedimentoAltaId("");
      setDataLancarAlta(hojeIso);
      setHoraLancarAlta(new Date().toTimeString().slice(0, 5));
      await conferirProcedimentosDeHoje(internacaoParaAlta.id);
    } catch (erro) {
      notificarErro("Não foi possível lançar o procedimento", erro);
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
            <Button size="sm" onClick={abrirNova}>
              <Plus className="h-4 w-4" /> Nova internação
            </Button>
          ) : null
        }
      />

      {/* O Sheet fica SEMPRE montado, independente de quem pode criar — senão
          quem só tem permissão de EDITAR (fisioterapeuta) clica no lápis da
          linha, o estado muda, mas não existe nada na tela pra abrir. Já foi
          bug real, relatado várias vezes antes de ser encontrado. */}
      <Sheet open={open} onOpenChange={(v) => (v ? setOpen(true) : limparRascunho())}>
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
                <Select value={unidadeId} onValueChange={(v) => setRascunho({ ...rascunho, unidadeId: v, leitoId: "" })}>
                      <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                      <SelectContent>
                        {unidades.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Leito</Label>
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
                      required
                      value={nrAtendimento}
                      onChange={(e) => setNrAtendimento(e.target.value)}
                      placeholder="Ex.: 706065"
                    />
                    <p className="text-xs text-ink-soft">
                      É o ID da internação no Tasy — usado pra confrontar automaticamente com a importação da
                      produção. Sem ele, essa internação não concilia sozinha.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="diagnostico">Diagnóstico</Label>
                    <textarea
                      id="diagnostico"
                      value={diagnostico}
                      onChange={(e) => setDiagnostico(e.target.value)}
                      rows={2}
                      placeholder="Ex.: Pós-operatório de artroplastia de quadril"
                      className="rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/40"
                    />
                  </div>
                  <div className="flex flex-col gap-2 rounded-md border border-recovery-400/40 bg-recovery-100 p-3">
                    <Label>Pré-lançamento (opcional — Motora e Respiratória juntas)</Label>
                    {podeAlterarPreLancamento ? (
                      <>
                        <Combobox
                          value={preLancamentoMotoraId}
                          onValueChange={setPreLancamentoMotoraId}
                          options={procedimentos
                            .filter((p) => !p.category || p.category.toLowerCase().includes("motora"))
                            .map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
                          placeholder="Código sugerido — Motora"
                          searchPlaceholder="Nome ou código…"
                        />
                        <Combobox
                          value={preLancamentoRespiratoriaId}
                          onValueChange={setPreLancamentoRespiratoriaId}
                          options={procedimentos
                            .filter((p) => !p.category || p.category.toLowerCase().includes("respirat"))
                            .map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
                          placeholder="Código sugerido — Respiratória"
                          searchPlaceholder="Nome ou código…"
                        />
                        <p className="text-xs text-recovery-700">
                          O código certo pra usar depois, na hora de lançar de verdade — evita confusão de
                          codificação. Preenche os dois juntos, ou nenhum. Não lança nada sozinho.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-recovery-700">
                        {preLancamentoMotoraId || preLancamentoRespiratoriaId ? (
                          <>
                            Motora: <span className="font-mono">{procedimentos.find((p) => p.id === preLancamentoMotoraId)?.code ?? "—"}</span>
                            {" · "}
                            Respiratória: <span className="font-mono">{procedimentos.find((p) => p.id === preLancamentoRespiratoriaId)?.code ?? "—"}</span>
                          </>
                        ) : (
                          "Nenhum código sugerido ainda."
                        )}
                        <span className="mt-1 block text-xs text-recovery-700/80">Só admin e supervisor podem alterar.</span>
                      </p>
                    )}
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
                  <Button type="submit" disabled={salvando || !pacienteId || !unidadeId || !leitoId}>
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Registrar internação"}
                  </Button>
                </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                <Input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar por paciente, código ou Nr. Atendimento…" className="pl-9" />
              </div>
              <Select value={filtroHospital} onValueChange={(v) => { setFiltroHospital(v); setFiltroUnidade("todas"); setPagina(1); }}>
                <SelectTrigger className="sm:w-48"><SelectValue placeholder="Todos os hospitais" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os hospitais</SelectItem>
                  {hospitais.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroUnidade} onValueChange={(v) => { setFiltroUnidade(v); setPagina(1); }}>
                <SelectTrigger className="sm:w-56"><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as unidades</SelectItem>
                  {unidades
                    .filter((u) => filtroHospital === "todos" || u.hospital_id === filtroHospital)
                    .map((u) => (
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
                <SelectItem value="unidade">Unidade (e leito, em sequência)</SelectItem>
                <SelectItem value="paciente">Paciente (A-Z)</SelectItem>
                <SelectItem value="entrada">Entrada (mais recente)</SelectItem>
                <SelectItem value="nrAtendimento">Nr. Atendimento</SelectItem>
                <SelectItem value="leito">Leito</SelectItem>
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
          <div className="divide-y divide-line">
            {paginaAtual.map((i) => {
              const paciente = pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "—";
              const leito = leitos.find((l) => l.id === i.bed_id);
              const quarto = quartos.find((q) => q.id === leito?.room_id);
              const unidade = unidades.find((u) => u.id === i.unit_id)?.name ?? "—";
              const hospital = hospitais.find((h) => h.id === i.hospital_id)?.name ?? "—";
              const convenio = convenios.find((c) => c.id === i.health_insurance_id)?.name ?? "—";
              return (
                <div key={i.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-sunken/60">
                  <input
                    type="checkbox"
                    checked={selecionados.has(i.id)}
                    onChange={() => toggleSelecionado(i.id)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-line-strong accent-clinical-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-medium text-ink">{paciente}</p>
                      <Badge variant={statusConfig[i.status as StatusInternacao]?.variant ?? "neutral"}>
                        {statusConfig[i.status as StatusInternacao]?.label ?? i.status}
                      </Badge>
                      {i.status === "internado" &&
                        (internacoesComAtendimentoHoje.has(i.id) ? (
                          <Badge variant="recovery">Em atendimento</Badge>
                        ) : (
                          <Badge variant="attention">
                            <AlertTriangle className="h-3 w-3" /> Pendente
                          </Badge>
                        ))}
                    </div>
                    {/* Linha 2: tudo que era coluna separada, compactado — o nome nunca mais disputa espaço com isso */}
                    <p className="mt-1 truncate text-xs text-ink-soft" title={`${hospital} · ${unidade}`}>
                      <span className="font-mono">{i.external_reference ?? "—"}</span>
                      {" · "}
                      {podeAdministrarInternacao ? `${hospital} · ${unidade}` : unidade}
                      {quarto && <> · Quarto {quarto.code}</>}
                      {leito && <> · Leito {leito.code}</>}
                      {" · "}{convenio}
                      {" · Entrada "}{formatarData(i.admission_date)} {i.admission_time?.slice(0, 5)}
                    </p>
                    {i.diagnostico && (
                      <p className="mt-0.5 truncate text-xs italic text-ink-soft/80" title={i.diagnostico}>
                        Dx: {i.diagnostico}
                      </p>
                    )}
                    {(i.pre_lancamento_motora_id || i.pre_lancamento_respiratoria_id) && (
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-recovery-100 px-2 py-0.5 font-mono text-[10px] font-medium text-recovery-700">
                        Pré-lançamento: {procedimentos.find((p) => p.id === i.pre_lancamento_motora_id)?.code ?? "—"} ·{" "}
                        {procedimentos.find((p) => p.id === i.pre_lancamento_respiratoria_id)?.code ?? "—"}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {podeEditarInternacao && (
                      <Button variant="ghost" size="icon" aria-label="Editar internação" title="Editar internação" onClick={() => abrirEdicao(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {i.status === "internado" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => abrirLancarProcedimento(i)} title="Lançar procedimento">
                          <ClipboardPlus className="h-3.5 w-3.5" /> + Procedimento
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => abrirFluxoAlta(i)} title="Dar alta">
                          <LogOut className="h-3.5 w-3.5" /> Alta
                        </Button>
                      </>
                    )}
                    {podeExcluirInternacao && (
                      <DeleteButton itemLabel={`internação de ${paciente}`} onConfirm={() => repository.admissions.remove(i.id)} moduleSlug="internacoes" />
                    )}
                  </div>
                </div>
              );
            })}
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
            <form className="flex h-full flex-col" onSubmit={handleConfirmarAlta}>
              <SheetHeader>
                <SheetTitle>Tem certeza que quer dar alta?</SheetTitle>
                <SheetDescription>
                  {internacaoParaAlta && (pacientes.find((p) => p.id === internacaoParaAlta.patient_id)?.full_name ?? "—")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-4">
                {conferindoProcedimentos ? (
                  <div className="flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-2.5 text-sm text-ink-soft">
                    Conferindo o que já foi lançado hoje…
                  </div>
                ) : (
                <div
                  className={`flex flex-col gap-2 rounded-md px-3 py-2.5 text-sm ${
                    procedimentosDeHojeNaAlta.length > 0 ? "bg-recovery-100 text-recovery-700" : "bg-attention-100 text-attention-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {procedimentosDeHojeNaAlta.length > 0 ? (
                      <>{procedimentosDeHojeNaAlta.length} procedimento(s) lançado(s) hoje pra este paciente.</>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 shrink-0" /> Nenhum procedimento lançado hoje para este paciente ainda.
                      </>
                    )}
                  </div>
                  {procedimentosDeHojeNaAlta.length > 0 && (
                    <ul className="flex flex-col gap-1 pl-1 text-xs">
                      {procedimentosDeHojeNaAlta.map((p) => (
                        <li key={p.id} className="flex items-center gap-1.5">
                          <span className="font-mono">{p.production_time?.slice(0, 5)}</span>
                          {(() => {
                            const proc = procedimentos.find((pr) => pr.id === p.procedure_id);
                            return proc ? <><span className="font-mono">{proc.code}</span> {proc.name}</> : "—";
                          })()}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                )}
                <Button type="button" variant="secondary" size="sm" onClick={() => setEtapaAlta("lancar")}>
                  <ClipboardPlus className="h-3.5 w-3.5" /> Lançar mais um procedimento
                </Button>
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
                <Button type="submit" disabled={salvandoAlta}>{salvandoAlta ? "Salvando…" : "Sim, confirmar alta"}</Button>
              </SheetFooter>
            </form>
          )}

          {etapaAlta === "lancar" && (
            <form className="flex h-full flex-col" onSubmit={handleLancarDuranteAlta}>
              <SheetHeader>
                <SheetTitle>Lançar procedimento</SheetTitle>
                <SheetDescription>
                  {internacaoParaAlta && (pacientes.find((p) => p.id === internacaoParaAlta.patient_id)?.full_name ?? "—")} — volta
                  pra tela de alta em seguida, sem confirmar sozinho.
                </SheetDescription>
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
                  <Combobox
                    value={procedimentoAltaId}
                    onValueChange={setProcedimentoAltaId}
                    options={procedimentos.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, sublabel: p.category ?? undefined }))}
                    placeholder="Buscar procedimento…"
                    searchPlaceholder="Código, nome ou categoria…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="data_lancar_alta">Data</Label>
                    <Input id="data_lancar_alta" type="date" required value={dataLancarAlta} onChange={(e) => setDataLancarAlta(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="hora_lancar_alta">Horário</Label>
                    <Input id="hora_lancar_alta" type="time" required value={horaLancarAlta} onChange={(e) => setHoraLancarAlta(e.target.value)} />
                  </div>
                </div>
              </div>
              <SheetFooter>
                <Button type="button" variant="secondary" onClick={() => setEtapaAlta("data")}>Voltar</Button>
                <Button type="submit" disabled={salvandoAlta || !fisioAltaId || !procedimentoAltaId}>
                  {salvandoAlta ? "Salvando…" : "Lançar procedimento"}
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
              {conferindoProcedimentos ? (
                <div className="flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-2.5 text-sm text-ink-soft">
                  Conferindo o que já foi lançado hoje…
                </div>
              ) : internacaoParaLancar && (() => {
                const jaLancados =
                  procedimentosDeHojeConferidos !== null
                    ? procedimentosDeHojeConferidos
                    : producao.filter((p) => p.admission_id === internacaoParaLancar.id && p.production_date === hojeIso);
                if (jaLancados.length === 0) return null;
                return (
                  <div className="flex flex-col gap-2 rounded-md bg-clinical-50 px-3 py-2.5 text-sm text-clinical-700">
                    <span>{jaLancados.length} procedimento(s) já lançado(s) hoje pra este paciente:</span>
                    <ul className="flex flex-col gap-1 pl-1 text-xs">
                      {jaLancados.map((p) => (
                        <li key={p.id} className="flex items-center gap-1.5">
                          <span className="font-mono">{p.production_time?.slice(0, 5)}</span>
                          {(() => {
                            const proc = procedimentos.find((pr) => pr.id === p.procedure_id);
                            return proc ? <><span className="font-mono">{proc.code}</span> {proc.name}</> : "—";
                          })()}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
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
              <Button type="button" variant="secondary" onClick={() => setInternacaoParaLancar(null)}>Fechar</Button>
              <Button type="submit" disabled={salvandoLancamento || !fisioLancarId || !procedimentoLancarId}>
                {salvandoLancamento ? "Salvando…" : "Lançar (e continuar lançando)"}
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
