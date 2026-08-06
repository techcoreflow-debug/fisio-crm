import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Clock, Users, ClipboardList, CalendarCheck, Building2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GoniometerGauge } from "@/components/shared/goniometer-gauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  useAdmissions,
  useDailyProduction,
  useHospitals,
  useProcedures,
} from "@/data/repository";
import { hojeLocalIso } from "@/lib/data-local";

const TODOS = "todos";

function primeiroDiaMes(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}
function inicioDaSemanaIso(dataIso: string) {
  const d = new Date(`${dataIso}T00:00:00`);
  const diaSemana = d.getDay();
  d.setDate(d.getDate() - diaSemana);
  return d.toISOString().slice(0, 10);
}

export default function ImpactoAssistencial() {
  const internacoes = useAdmissions();
  const producao = useDailyProduction();
  const hospitais = useHospitals();
  const procedimentos = useProcedures();

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
    </div>
  );
}
