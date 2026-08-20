import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Clock, Users, ClipboardList, CalendarCheck, Building2, LogOut, HeartPulse, ClipboardEdit } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GoniometerGauge } from "@/components/shared/goniometer-gauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  useAdmissions,
  useDailyProduction,
  useHospitals,
  useUnits,
  useProcedures,
  usePatients,
  useHealthInsurances,
  useHospitalCensus,
  repository,
} from "@/data/repository";
import { hojeLocalIso, dataParaIsoLocal, calcularIdade } from "@/lib/data-local";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { useAppStore } from "@/store/app-store";

const TODOS = "todos";
const CORES = ["#2f80ed", "#4f8f5f", "#e0a030", "#a05fe0", "#e05f7a", "#3fb6c9"];

function primeiroDiaMes(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}
function inicioDaSemanaIso(dataIso: string) {
  const d = new Date(`${dataIso}T00:00:00`);
  const diaSemana = d.getDay();
  d.setDate(d.getDate() - diaSemana);
  return dataParaIsoLocal(d);
}
function mesIso(dataIso: string) {
  return dataIso.slice(0, 7); // YYYY-MM
}
function rotuloMes(mesIsoStr: string) {
  const [ano, mes] = mesIsoStr.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[Number(mes) - 1]}/${ano.slice(2)}`;
}

export default function ImpactoAssistencial() {
  const internacoes = useAdmissions();
  const producao = useDailyProduction();
  const hospitais = useHospitals();
  const unidades = useUnits();
  const procedimentos = useProcedures();
  const pacientes = usePatients();
  const convenios = useHealthInsurances();
  const censo = useHospitalCensus();
  const empresaId = useAppStore((s) => s.activeCompanyId);

  const hoje = hojeLocalIso();
  const [periodoDe, setPeriodoDe] = useState(primeiroDiaMes(hoje));
  const [periodoAte, setPeriodoAte] = useState(hoje);
  const [filtroHospital, setFiltroHospital] = useState(TODOS);

  const producaoPeriodo = useMemo(
    () =>
      producao.filter((p) => {
        if (p.production_date < periodoDe || p.production_date > periodoAte) return false;
        if (filtroHospital === TODOS) return true;
        const internacao = internacoes.find((i) => i.id === p.admission_id);
        return internacao?.hospital_id === filtroHospital;
      }),
    [producao, periodoDe, periodoAte, filtroHospital, internacoes]
  );

  // 1) Tempo médio até o 1º atendimento pós-internação — combina data+hora
  // de verdade (não só a data) pra dar um número de horas que faz sentido.
  const tempoMedioResposta = useMemo(() => {
    const internacoesNoPeriodo = internacoes.filter(
      (i) => i.admission_date >= periodoDe && i.admission_date <= periodoAte && (filtroHospital === TODOS || i.hospital_id === filtroHospital)
    );
    const horas: number[] = [];
    for (const i of internacoesNoPeriodo) {
      const producaoDaInternacao = producao.filter((p) => p.admission_id === i.id);
      if (producaoDaInternacao.length === 0) continue;
      const primeiro = producaoDaInternacao.reduce((min, p) => {
        const dt = `${p.production_date}T${p.production_time ?? "00:00"}`;
        return dt < min ? dt : min;
      }, `${producaoDaInternacao[0].production_date}T${producaoDaInternacao[0].production_time ?? "00:00"}`);
      const inicioInternacao = new Date(`${i.admission_date}T${i.admission_time || "00:00"}`).getTime();
      const inicioAtendimento = new Date(primeiro).getTime();
      const diffHoras = (inicioAtendimento - inicioInternacao) / 3600000;
      if (diffHoras >= 0) horas.push(diffHoras);
    }
    if (horas.length === 0) return null;
    return horas.reduce((a, b) => a + b, 0) / horas.length;
  }, [internacoes, producao, periodoDe, periodoAte, filtroHospital]);

  // 2) Cobertura diária — dos internados HOJE, quantos já foram atendidos hoje
  const coberturaHoje = useMemo(() => {
    const internadosAgora = internacoes.filter(
      (i) => i.status === "internado" && (filtroHospital === TODOS || i.hospital_id === filtroHospital)
    );
    if (internadosAgora.length === 0) return null;
    const atendidosHoje = internadosAgora.filter((i) => producao.some((p) => p.admission_id === i.id && p.production_date === hoje));
    return { taxa: Math.round((atendidosHoje.length / internadosAgora.length) * 100), total: internadosAgora.length, atendidos: atendidosHoje.length };
  }, [internacoes, producao, hoje, filtroHospital]);

  // 3) Intensidade terapêutica — procedimentos por paciente-dia atendido
  const intensidadeTerapeutica = useMemo(() => {
    const diasComAtendimento = new Set(producaoPeriodo.map((p) => `${p.admission_id}|${p.production_date}`));
    if (diasComAtendimento.size === 0) return null;
    return producaoPeriodo.length / diasComAtendimento.size;
  }, [producaoPeriodo]);

  // 4) Mix de categoria por semana
  const mixPorSemana = useMemo(() => {
    const categorias = [...new Set(procedimentos.map((p) => p.category).filter(Boolean))] as string[];
    const porSemana = new Map<string, Record<string, number>>();
    for (const p of producaoPeriodo) {
      const semana = inicioDaSemanaIso(p.production_date);
      const categoria = procedimentos.find((pr) => pr.id === p.procedure_id)?.category ?? "Outras";
      const atual = porSemana.get(semana) ?? {};
      atual[categoria] = (atual[categoria] ?? 0) + 1;
      porSemana.set(semana, atual);
    }
    return {
      categorias,
      dados: Array.from(porSemana.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([semana, valores]) => ({ semana: semana.slice(8, 10) + "/" + semana.slice(5, 7), ...valores })),
    };
  }, [producaoPeriodo, procedimentos]);

  // 5) Comparativo entre hospitais
  const comparativoHospitais = useMemo(() => {
    return hospitais.map((h) => {
      const internacoesDoHospital = internacoes.filter((i) => i.hospital_id === h.id);
      const internadosAgora = internacoesDoHospital.filter((i) => i.status === "internado");
      const atendidosHoje = internadosAgora.filter((i) => producao.some((p) => p.admission_id === i.id && p.production_date === hoje));
      const producaoDoHospital = producaoPeriodo.filter((p) => {
        const i = internacoes.find((ii) => ii.id === p.admission_id);
        return i?.hospital_id === h.id;
      });
      const confirmados = producaoDoHospital.filter((p) => p.confirmado_tasy).length;
      return {
        hospital: h.name,
        cobertura: internadosAgora.length > 0 ? Math.round((atendidosHoje.length / internadosAgora.length) * 100) : 0,
        confirmacao: producaoDoHospital.length > 0 ? Math.round((confirmados / producaoDoHospital.length) * 100) : 0,
      };
    }).filter((h) => internacoes.some((i) => i.hospital_id && hospitais.find((hh) => hh.id === i.hospital_id)?.name === h.hospital));
  }, [hospitais, internacoes, producao, producaoPeriodo, hoje]);

  // 6) Números de impacto
  const pacientesAtendidos = new Set(
    producaoPeriodo.map((p) => internacoes.find((i) => i.id === p.admission_id)?.patient_id).filter(Boolean)
  ).size;
  const diasAcompanhados = new Set(producaoPeriodo.map((p) => `${p.admission_id}|${p.production_date}`)).size;

  // 7) Efetividade Motora × Respiratória — mensal, por unidade/hospital
  const [filtroUnidadeEfetividade, setFiltroUnidadeEfetividade] = useState(TODOS);
  const efetividadeMensal = useMemo(() => {
    const producaoDaUnidade = producaoPeriodo.filter((p) => {
      if (filtroUnidadeEfetividade === TODOS) return true;
      const internacao = internacoes.find((i) => i.id === p.admission_id);
      return internacao?.unit_id === filtroUnidadeEfetividade;
    });
    const porMes = new Map<string, { motora: number; respiratoria: number }>();
    for (const p of producaoDaUnidade) {
      const mes = mesIso(p.production_date);
      const categoria = (procedimentos.find((pr) => pr.id === p.procedure_id)?.category ?? "").toLowerCase();
      const atual = porMes.get(mes) ?? { motora: 0, respiratoria: 0 };
      if (categoria.includes("motora")) atual.motora += 1;
      else if (categoria.includes("respirat")) atual.respiratoria += 1;
      porMes.set(mes, atual);
    }
    return Array.from(porMes.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, valores]) => ({ mes: rotuloMes(mes), Motora: valores.motora, Respiratória: valores.respiratoria }));
  }, [producaoPeriodo, internacoes, procedimentos, filtroUnidadeEfetividade]);

  // 8) Altas — diário (últimos 14 dias) e mensal (últimos 6 meses), com percentual sobre internações do período
  const altasPorDia = useMemo(() => {
    const dias: { data: string; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = dataParaIsoLocal(d);
      const total = internacoes.filter((int) => int.discharge_date === iso).length;
      dias.push({ data: iso.slice(8, 10) + "/" + iso.slice(5, 7), total });
    }
    return dias;
  }, [internacoes]);

  const altasPorMes = useMemo(() => {
    const porMes = new Map<string, number>();
    for (const int of internacoes) {
      if (!int.discharge_date) continue;
      const mes = mesIso(int.discharge_date);
      porMes.set(mes, (porMes.get(mes) ?? 0) + 1);
    }
    return Array.from(porMes.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([mes, total]) => ({ mes: rotuloMes(mes), total }));
  }, [internacoes]);

  const taxaAltaNoPeriodo = useMemo(() => {
    const internacoesNoPeriodo = internacoes.filter((int) => int.admission_date >= periodoDe && int.admission_date <= periodoAte);
    if (internacoesNoPeriodo.length === 0) return null;
    const comAlta = internacoesNoPeriodo.filter((int) => int.status === "alta").length;
    return { taxa: Math.round((comAlta / internacoesNoPeriodo.length) * 100), total: internacoesNoPeriodo.length, comAlta };
  }, [internacoes, periodoDe, periodoAte]);

  // 9) Distribuição por convênio no período
  const distribuicaoConvenio = useMemo(() => {
    const porConvenio = new Map<string, number>();
    const idsVistos = new Set<string>();
    for (const p of producaoPeriodo) {
      if (!p.admission_id || idsVistos.has(p.admission_id)) continue;
      idsVistos.add(p.admission_id);
      const internacao = internacoes.find((i) => i.id === p.admission_id);
      const nome = convenios.find((c) => c.id === internacao?.health_insurance_id)?.name ?? "Sem convênio";
      porConvenio.set(nome, (porConvenio.get(nome) ?? 0) + 1);
    }
    return Array.from(porConvenio.entries()).map(([name, value]) => ({ name, value }));
  }, [producaoPeriodo, internacoes, convenios]);

  // 10) Perfil por sexo no período
  const distribuicaoSexo = useMemo(() => {
    const idsVistos = new Set<string>();
    let masculino = 0;
    let feminino = 0;
    for (const p of producaoPeriodo) {
      const internacao = internacoes.find((i) => i.id === p.admission_id);
      if (!internacao || idsVistos.has(internacao.patient_id)) continue;
      idsVistos.add(internacao.patient_id);
      const sexo = pacientes.find((pa) => pa.id === internacao.patient_id)?.sexo;
      if (sexo === "M") masculino += 1;
      else if (sexo === "F") feminino += 1;
    }
    return [
      { name: "Masculino", value: masculino },
      { name: "Feminino", value: feminino },
    ].filter((d) => d.value > 0);
  }, [producaoPeriodo, internacoes, pacientes]);

  // 11) Cobertura sobre o total do hospital — depende do censo lançado
  // manualmente (o sistema só sabe quantos pacientes A EQUIPE atende,
  // não quantos o hospital tem internados no total).
  const [filtroHospitalCenso, setFiltroHospitalCenso] = useState(hospitais[0]?.id ?? "");
  useEffect(() => {
    if (!filtroHospitalCenso && hospitais.length > 0) setFiltroHospitalCenso(hospitais[0].id);
  }, [hospitais, filtroHospitalCenso]);
  const censoHospitalHoje = censo.find((c) => c.hospital_id === filtroHospitalCenso && c.census_date === hoje);
  const internadosComFisioHoje = internacoes.filter(
    (i) => i.status === "internado" && i.hospital_id === filtroHospitalCenso
  ).length;
  const coberturaHospitalar = censoHospitalHoje
    ? Math.round((internadosComFisioHoje / censoHospitalHoje.total_internados) * 100)
    : null;

  // 12) Quantitativo de procedimentos por faixa etária
  const FAIXAS_ETARIAS = [
    { rotulo: "0–17", min: 0, max: 17 },
    { rotulo: "18–39", min: 18, max: 39 },
    { rotulo: "40–59", min: 40, max: 59 },
    { rotulo: "60–79", min: 60, max: 79 },
    { rotulo: "80+", min: 80, max: 200 },
  ];
  const procedimentosPorIdade = useMemo(() => {
    const contagem = new Map(FAIXAS_ETARIAS.map((f) => [f.rotulo, 0]));
    let semIdade = 0;
    for (const p of producaoPeriodo) {
      const internacao = internacoes.find((i) => i.id === p.admission_id);
      const paciente = pacientes.find((pa) => pa.id === internacao?.patient_id);
      const idade = calcularIdade(paciente?.birth_date ?? null);
      if (idade === null) {
        semIdade += 1;
        continue;
      }
      const faixa = FAIXAS_ETARIAS.find((f) => idade >= f.min && idade <= f.max);
      if (faixa) contagem.set(faixa.rotulo, (contagem.get(faixa.rotulo) ?? 0) + 1);
    }
    return {
      dados: FAIXAS_ETARIAS.map((f) => ({ faixa: f.rotulo, procedimentos: contagem.get(f.rotulo) ?? 0 })),
      semIdade,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producaoPeriodo, internacoes, pacientes]);

  const [openLancarCenso, setOpenLancarCenso] = useState(false);
  const [salvandoCenso, setSalvandoCenso] = useState(false);

  async function handleLancarCenso(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!empresaId || !filtroHospitalCenso) return;
    const form = new FormData(e.currentTarget);
    const total = Number(form.get("total_internados"));
    if (!total || total < 0) {
      notificarErro("Valor inválido", "Informe o total de internados do hospital hoje.");
      return;
    }
    setSalvandoCenso(true);
    try {
      await repository.hospitalCensus.salvar(empresaId, filtroHospitalCenso, hoje, total);
      notificarSucesso("Total de internados do hospital registrado.");
      setOpenLancarCenso(false);
    } catch (erro) {
      notificarErro("Não foi possível salvar", erro);
    } finally {
      setSalvandoCenso(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Impacto Assistencial"
        description="O que a equipe está entregando de cuidado — indicadores clínicos, não só operacionais."
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-5">
          <span className="text-sm text-ink-soft">Período</span>
          <input type="date" value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} className="h-9 rounded-md border border-line-strong bg-surface-raised px-2 text-sm text-ink" />
          <span className="text-xs text-ink-soft">até</span>
          <input type="date" value={periodoAte} onChange={(e) => setPeriodoAte(e.target.value)} className="h-9 rounded-md border border-line-strong bg-surface-raised px-2 text-sm text-ink" />
          <Select value={filtroHospital} onValueChange={setFiltroHospital}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Todos os hospitais" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os hospitais</SelectItem>
              {hospitais.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-1 pt-6">
            <GoniometerGauge
              value={tempoMedioResposta === null ? 0 : Math.max(0, 100 - tempoMedioResposta * 4)}
              displayValue={tempoMedioResposta === null ? "—" : `${tempoMedioResposta.toFixed(1)}h`}
              label="Tempo até o 1º atendimento"
              sublabel="da internação ao primeiro procedimento"
              tone="clinical"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-1 pt-6">
            <GoniometerGauge
              value={coberturaHoje?.taxa ?? 0}
              displayValue={`${coberturaHoje?.taxa ?? 0}%`}
              label="Cobertura hoje"
              sublabel={coberturaHoje ? `${coberturaHoje.atendidos} de ${coberturaHoje.total} internados` : "sem internados"}
              tone="recovery"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-1 pt-6">
            <GoniometerGauge
              value={intensidadeTerapeutica === null ? 0 : Math.min(100, intensidadeTerapeutica * 40)}
              displayValue={intensidadeTerapeutica === null ? "—" : intensidadeTerapeutica.toFixed(1)}
              label="Intensidade terapêutica"
              sublabel="procedimentos por paciente-dia"
              tone="attention"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-4.5 w-4.5" /> Cobertura sobre o total do hospital</CardTitle>
          <p className="text-sm text-ink-soft mt-0.5">
            "Hoje temos X internados no hospital... Y com fisioterapia, o que representa Z% dos internados com
            fisio." Depende de lançar o total geral do hospital (dado que só o hospital tem, não vem do nosso
            sistema).
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Select value={filtroHospitalCenso} onValueChange={setFiltroHospitalCenso}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Selecione o hospital" /></SelectTrigger>
            <SelectContent>
              {hospitais.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-1 flex-col items-center gap-1">
            <GoniometerGauge
              value={coberturaHospitalar ?? 0}
              displayValue={coberturaHospitalar === null ? "—" : `${coberturaHospitalar}%`}
              label="Internados com fisio, sobre o total"
              sublabel={
                censoHospitalHoje
                  ? `${internadosComFisioHoje} de ${censoHospitalHoje.total_internados} internados no hospital`
                  : "total geral de hoje ainda não foi lançado"
              }
              tone="clinical"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={() => setOpenLancarCenso(true)} disabled={!filtroHospitalCenso}>
            <ClipboardEdit className="h-3.5 w-3.5" /> {censoHospitalHoje ? "Atualizar total de hoje" : "Lançar total de hoje"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clinical-50 text-clinical-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Pacientes atendidos no período</p>
              <p className="font-display text-2xl font-semibold text-ink">{pacientesAtendidos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-recovery-100 text-recovery-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Procedimentos realizados</p>
              <p className="font-display text-2xl font-semibold text-recovery-600">{producaoPeriodo.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-attention-100 text-attention-600">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Dias de internação acompanhados</p>
              <p className="font-display text-2xl font-semibold text-attention-600">{diasAcompanhados}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-4.5 w-4.5" /> Mix de categoria ao longo do tempo</CardTitle>
          <p className="text-sm text-ink-soft mt-0.5">Como a complexidade dos casos atendidos evolui semana a semana.</p>
        </CardHeader>
        <CardContent className="h-72">
          {mixPorSemana.dados.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-soft">Sem produção no período.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mixPorSemana.dados} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ea" vertical={false} />
                <XAxis dataKey="semana" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
                <Legend />
                {mixPorSemana.categorias.map((cat, idx) => (
                  <Area
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    stackId="1"
                    stroke={["#2f80ed", "#4f8f5f", "#e0a030", "#a05fe0", "#e05f7a"][idx % 5]}
                    fill={["#2f80ed", "#4f8f5f", "#e0a030", "#a05fe0", "#e05f7a"][idx % 5]}
                    fillOpacity={0.5}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-4.5 w-4.5" /> Quantitativo de procedimentos por idade</CardTitle>
          <p className="text-sm text-ink-soft mt-0.5">
            Procedimentos realizados no período, por faixa etária do paciente.
            {procedimentosPorIdade.semIdade > 0 && ` ${procedimentosPorIdade.semIdade} sem data de nascimento cadastrada, não entram aqui.`}
          </p>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={procedimentosPorIdade.dados} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ea" vertical={false} />
              <XAxis dataKey="faixa" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
              <Bar dataKey="procedimentos" name="Procedimentos" fill="#a05fe0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {comparativoHospitais.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-4.5 w-4.5" /> Comparativo entre hospitais</CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">Cobertura de hoje e taxa de confirmação no período, lado a lado.</p>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativoHospitais} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ea" vertical={false} />
                <XAxis dataKey="hospital" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
                <Legend />
                <Bar dataKey="cobertura" name="Cobertura hoje" fill="#4f8f5f" radius={[4, 4, 0, 0]} />
                <Bar dataKey="confirmacao" name="Confirmação (Tasy)" fill="#2f80ed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HeartPulse className="h-4.5 w-4.5" /> Efetividade Motora × Respiratória — mensal</CardTitle>
          <p className="text-sm text-ink-soft mt-0.5">Volume de cada tipo de atendimento por mês, dá pra olhar por unidade.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Select value={filtroUnidadeEfetividade} onValueChange={setFiltroUnidadeEfetividade}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as unidades</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="h-64">
            {efetividadeMensal.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-soft">Sem produção no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={efetividadeMensal} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ea" vertical={false} />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
                  <Legend />
                  <Bar dataKey="Motora" fill="#2f80ed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Respiratória" fill="#4f8f5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center justify-center gap-1 pt-6">
            <GoniometerGauge
              value={taxaAltaNoPeriodo?.taxa ?? 0}
              displayValue={`${taxaAltaNoPeriodo?.taxa ?? 0}%`}
              label="Altas no período"
              sublabel={taxaAltaNoPeriodo ? `${taxaAltaNoPeriodo.comAlta} de ${taxaAltaNoPeriodo.total} internações` : "sem internações no período"}
              tone="attention"
            />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LogOut className="h-4.5 w-4.5" /> Altas por dia — últimos 14 dias</CardTitle>
          </CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={altasPorDia} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ea" vertical={false} />
                <XAxis dataKey="data" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#47566b" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
                <Bar dataKey="total" name="Altas" fill="#e0a030" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Altas por mês — últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={altasPorMes} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ea" vertical={false} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
              <Bar dataKey="total" name="Altas" fill="#e0a030" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por convênio</CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">Pacientes atendidos no período, por convênio.</p>
          </CardHeader>
          <CardContent className="h-64">
            {distribuicaoConvenio.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-soft">Sem produção no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribuicaoConvenio} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {distribuicaoConvenio.map((_, idx) => (
                      <Cell key={idx} fill={CORES[idx % CORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perfil por sexo</CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">Pacientes atendidos no período — totais Masculino e Feminino.</p>
          </CardHeader>
          <CardContent className="h-64">
            {distribuicaoSexo.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-soft">
                Sem dado de sexo preenchido no cadastro dos pacientes atendidos.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribuicaoSexo} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    <Cell fill="#2f80ed" />
                    <Cell fill="#e05f7a" />
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={openLancarCenso} onOpenChange={setOpenLancarCenso}>
        <DialogContent>
          <form onSubmit={handleLancarCenso}>
            <DialogHeader>
              <DialogTitle>Total de internados hoje</DialogTitle>
              <DialogDescription>
                {hospitais.find((h) => h.id === filtroHospitalCenso)?.name} — quantos pacientes estão internados no
                hospital como um todo, hoje. É um número que só o hospital sabe, não vem do nosso sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5 py-2">
              <Label htmlFor="total_internados">Total de internados</Label>
              <Input
                id="total_internados"
                name="total_internados"
                type="number"
                min={0}
                required
                defaultValue={censoHospitalHoje?.total_internados}
                placeholder="Ex.: 81"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpenLancarCenso(false)}>Cancelar</Button>
              <Button type="submit" disabled={salvandoCenso}>{salvandoCenso ? "Salvando…" : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
