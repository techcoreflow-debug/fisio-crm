import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { GoniometerGauge } from "@/components/shared/goniometer-gauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContracts, useReceivables, useHospitals, useHealthInsurances } from "@/data/repository";

const cores = ["#0e6b64", "#5f8f59", "#d98d3d", "#6fa39c", "#a8c4bd"];

function formatarMesCurto(competencia: string) {
  const [, mes] = competencia.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return nomes[Number(mes) - 1];
}

export default function DashboardFinanceiro() {
  const contratos = useContracts();
  const recebiveis = useReceivables();
  const hospitais = useHospitals();
  const convenios = useHealthInsurances();

  const contratosAtivos = contratos.filter((c) => c.status === "ativo" && c.monthly_value);
  const totalContratado = contratosAtivos.reduce((acc, c) => acc + (c.monthly_value ?? 0), 0);

  const participacaoPorContrato = useMemo(() => {
    return contratosAtivos.map((c) => {
      const hospital = hospitais.find((h) => h.id === c.hospital_id)?.name ?? "—";
      const convenio = convenios.find((v) => v.id === c.health_insurance_id)?.name ?? "—";
      return { name: `${hospital} · ${convenio}`, value: c.monthly_value ?? 0 };
    });
  }, [contratosAtivos, hospitais, convenios]);

  const inadimplenciaPorMes = useMemo(() => {
    const porCompetencia = new Map<string, { total: number; atrasado: number }>();
    for (const r of recebiveis) {
      const atual = porCompetencia.get(r.competencia) ?? { total: 0, atrasado: 0 };
      atual.total += r.amount;
      if (r.status === "atrasado") atual.atrasado += r.amount;
      porCompetencia.set(r.competencia, atual);
    }
    return Array.from(porCompetencia.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([competencia, v]) => ({
        mes: formatarMesCurto(competencia),
        valor: v.total > 0 ? Math.round((v.atrasado / v.total) * 1000) / 10 : 0,
      }));
  }, [recebiveis]);

  const competenciaAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  const recebiveisMesAtual = recebiveis.filter((r) => r.competencia === competenciaAtual);
  const recebidoNoMes = recebiveisMesAtual.length > 0
    ? Math.round((recebiveisMesAtual.filter((r) => r.status === "pago").reduce((a, r) => a + r.amount, 0) / recebiveisMesAtual.reduce((a, r) => a + r.amount, 0)) * 100)
    : 0;

  const totalHistorico = recebiveis.reduce((acc, r) => acc + r.amount, 0);
  const totalAtrasadoHistorico = recebiveis.filter((r) => r.status === "atrasado").reduce((acc, r) => acc + r.amount, 0);
  const inadimplenciaGeral = totalHistorico > 0 ? Math.round((totalAtrasadoHistorico / totalHistorico) * 100) : 0;

  const contratosComAtraso = new Set(recebiveis.filter((r) => r.status === "atrasado").map((r) => r.contract_id));
  const contratosEmDia = contratosAtivos.length > 0
    ? Math.round(((contratosAtivos.length - contratosComAtraso.size) / contratosAtivos.length) * 100)
    : 100;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard Financeiro"
        description="Faturamento contratado, inadimplência e contas a receber — tudo a partir dos contratos e lançamentos reais."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="flex justify-center pt-6">
            <GoniometerGauge value={recebidoNoMes} label="Recebido na competência atual" tone="clinical" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex justify-center pt-6">
            <GoniometerGauge value={inadimplenciaGeral} label="Inadimplência histórica" sublabel="Quanto menor, melhor" tone="critical" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex justify-center pt-6">
            <GoniometerGauge value={contratosEmDia} label="Contratos em dia" sublabel="Sem nenhum atraso registrado" tone="recovery" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex justify-center pt-6">
            <GoniometerGauge value={100} label="Faturamento contratado" displayValue={`R$ ${(totalContratado / 1000).toFixed(0)}k`} tone="clinical" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Participação por contrato</CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">Sobre o valor mensal contratado</p>
          </CardHeader>
          <CardContent className="h-64">
            {participacaoPorContrato.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-soft">Sem contratos ativos.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={participacaoPorContrato} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {participacaoPorContrato.map((_, i) => (
                      <Cell key={i} fill={cores[i % cores.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #dfe4de", fontSize: 13 }}
                    formatter={(v) => [`R$ ${Number(v).toLocaleString("pt-BR")}`, "Valor mensal"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="mt-2 flex flex-col gap-1.5">
              {participacaoPorContrato.map((m, i) => (
                <div key={m.name} className="flex items-center gap-2 text-xs text-ink-soft">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cores[i % cores.length] }} />
                  {m.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Inadimplência por competência</CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">% do valor previsto marcado como atrasado</p>
          </CardHeader>
          <CardContent className="h-64">
            {inadimplenciaPorMes.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-soft">Sem lançamentos ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={inadimplenciaPorMes} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dfe4de" vertical={false} />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#3d4d46" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#3d4d46" }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #dfe4de", fontSize: 13 }}
                    formatter={(v) => [`${v}%`, "Inadimplência"]}
                  />
                  <Line type="monotone" dataKey="valor" stroke="#bd4238" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
