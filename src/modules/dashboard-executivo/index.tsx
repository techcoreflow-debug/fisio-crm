import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { TriangleAlert, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GoniometerGauge } from "@/components/shared/goniometer-gauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useBeds,
  useAdmissions,
  usePatients,
  useClinicalEvolutions,
  usePhysiotherapists,
  useDailyProduction,
  useContracts,
  useHealthInsurances,
  useHospitals,
} from "@/data/repository";

function numeroDaSemanaISO(data: Date) {
  const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
}

export default function DashboardExecutivo() {
  const leitos = useBeds();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const evolucoes = useClinicalEvolutions();
  const fisioterapeutas = usePhysiotherapists();
  const producao = useDailyProduction();
  const contratos = useContracts();
  const convenios = useHealthInsurances();
  const hospitais = useHospitals();

  const ocupacaoLeitos = leitos.length > 0 ? Math.round((leitos.filter((l) => l.status === "ocupado").length / leitos.length) * 100) : 0;

  const internacoesAtivas = internacoes.filter((i) => i.status === "internado");
  const internacoesSemEvolucao = internacoesAtivas.filter((i) => !evolucoes.some((e) => e.admission_id === i.id));
  const evolucoesEmDia = internacoesAtivas.length > 0
    ? Math.round(((internacoesAtivas.length - internacoesSemEvolucao.length) / internacoesAtivas.length) * 100)
    : 100;

  const metaProducaoDiaria = Math.max(fisioterapeutas.length * 3, 1);
  const produtividadeEquipe = Math.min(100, Math.round((producao.length / metaProducaoDiaria) * 100));

  const contratosAtivos = contratos.length > 0 ? Math.round((contratos.filter((c) => c.status === "ativo").length / contratos.length) * 100) : 0;

  const producaoPorSemana = useMemo(() => {
    const porSemana = new Map<number, number>();
    for (const p of producao) {
      const semana = numeroDaSemanaISO(new Date(p.production_date));
      porSemana.set(semana, (porSemana.get(semana) ?? 0) + 1);
    }
    return Array.from(porSemana.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([semana, total]) => ({ semana: `Sem. ${semana}`, atendimentos: total }));
  }, [producao]);

  const faturamentoPorConvenio = useMemo(() => {
    const porConvenio = new Map<string, number>();
    for (const c of contratos) {
      if (c.status !== "ativo" || !c.monthly_value) continue;
      const nome = convenios.find((v) => v.id === c.health_insurance_id)?.name ?? "Sem convênio";
      porConvenio.set(nome, (porConvenio.get(nome) ?? 0) + c.monthly_value);
    }
    return Array.from(porConvenio.entries()).map(([convenio, valor]) => ({ convenio, valor }));
  }, [contratos, convenios]);

  const contratosVencendo = contratos.filter((c) => {
    if (!c.end_date || c.status !== "ativo") return false;
    const dias = (new Date(c.end_date).getTime() - Date.now()) / 86400000;
    return dias >= 0 && dias <= 60;
  });

  const unidadesLotadas = useMemo(() => {
    const porUnidade = new Map<string, { total: number; ocupados: number }>();
    for (const l of leitos) {
      const atual = porUnidade.get(l.unit_id) ?? { total: 0, ocupados: 0 };
      atual.total += 1;
      if (l.status === "ocupado") atual.ocupados += 1;
      porUnidade.set(l.unit_id, atual);
    }
    return Array.from(porUnidade.entries()).filter(([, v]) => v.total > 0 && v.ocupados / v.total >= 0.9);
  }, [leitos]);

  const alertas = [
    ...internacoesSemEvolucao.map((i) => ({
      titulo: `Internação sem evolução clínica registrada`,
      detalhe: pacientes.find((p) => p.id === i.patient_id)?.full_name ?? `Internação ${i.id.slice(0, 8)}`,
      tom: "critical" as const,
    })),
    ...contratosVencendo.map((c) => ({
      titulo: "Contrato vencendo nos próximos 60 dias",
      detalhe: `${hospitais.find((h) => h.id === c.hospital_id)?.name ?? "—"} · vence em ${new Date(c.end_date!).toLocaleDateString("pt-BR")}`,
      tom: "attention" as const,
    })),
    ...unidadesLotadas.map(([, v]) => ({
      titulo: "Unidade com ocupação acima de 90%",
      detalhe: `${v.ocupados} de ${v.total} leitos ocupados`,
      tom: "attention" as const,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard Executivo"
        description="Leitura consolidada da operação — como uma amplitude de movimento, cada indicador mostra o quão perto do resultado pleno (180°) a empresa está."
      />

      {/* KPIs em arco de amplitude — assinatura visual do Fisio */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="flex justify-center pt-6">
            <GoniometerGauge
              value={produtividadeEquipe}
              label="Produtividade da equipe"
              sublabel="Estimativa: 3 atendimentos/dia por profissional"
              tone="clinical"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex justify-center pt-6">
            <GoniometerGauge value={ocupacaoLeitos} label="Ocupação de leitos" sublabel={`${leitos.length} leitos cadastrados`} tone="recovery" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex justify-center pt-6">
            <GoniometerGauge value={evolucoesEmDia} label="Evoluções em dia" sublabel="Internações ativas com evolução registrada" tone="attention" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex justify-center pt-6">
            <GoniometerGauge value={contratosAtivos} label="Contratos ativos" sublabel="Sobre o total de contratos" tone="clinical" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Atendimentos por semana</CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">Baseado nos lançamentos de produção diária</p>
          </CardHeader>
          <CardContent className="h-64">
            {producaoPorSemana.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-soft">
                Sem lançamentos de produção ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={producaoPorSemana} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="corAtendimentos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0e6b64" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0e6b64" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dfe4de" vertical={false} />
                  <XAxis dataKey="semana" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#3d4d46" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#3d4d46" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #dfe4de", fontSize: 13 }}
                    formatter={(v) => [`${v} atendimentos`, ""]}
                  />
                  <Area type="monotone" dataKey="atendimentos" stroke="#0e6b64" strokeWidth={2} fill="url(#corAtendimentos)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">Gerados a partir de condições reais dos dados</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {alertas.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-ink-soft">
                <CheckCircle2 className="h-4 w-4 text-recovery-500" /> Nenhum alerta no momento.
              </div>
            ) : (
              alertas.map((alerta, i) => (
                <div key={i} className="flex gap-2.5 rounded-md border border-line p-3">
                  <TriangleAlert
                    className={`h-4 w-4 shrink-0 mt-0.5 ${alerta.tom === "critical" ? "text-critical-400" : "text-attention-400"}`}
                  />
                  <div>
                    <p className="text-sm font-medium text-ink leading-snug">{alerta.titulo}</p>
                    <p className="text-xs text-ink-soft mt-0.5">{alerta.detalhe}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Faturamento previsto por convênio</CardTitle>
          <p className="text-sm text-ink-soft mt-0.5">Soma do valor mensal dos contratos ativos</p>
        </CardHeader>
        <CardContent className="h-64">
          {faturamentoPorConvenio.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-soft">
              Sem contratos ativos com valor mensal cadastrado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={faturamentoPorConvenio} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dfe4de" vertical={false} />
                <XAxis dataKey="convenio" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#3d4d46" }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#3d4d46" }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #dfe4de", fontSize: 13 }}
                  formatter={(v) => [`R$ ${Number(v).toLocaleString("pt-BR")}`, "Faturamento previsto"]}
                />
                <Bar dataKey="valor" fill="#5f8f59" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-ink-soft">
        <Badge variant="clinical">Multiempresa</Badge>
        Dados desta empresa, isolados das demais — o mesmo isolamento que a RLS vai garantir no Supabase.
      </div>
    </div>
  );
}
