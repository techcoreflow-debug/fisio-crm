import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { GoniometerGauge } from "@/components/shared/goniometer-gauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useBeds,
  useUnits,
  useShifts,
  usePhysiotherapists,
  useDailyProduction,
  useAdmissions,
  useClinicalEvolutions,
} from "@/data/repository";
import { hojeLocalIso } from "@/lib/data-local";

export default function DashboardOperacional() {
  const leitos = useBeds();
  const unidades = useUnits();
  const turnos = useShifts();
  const fisioterapeutas = usePhysiotherapists();
  const producao = useDailyProduction();
  const internacoes = useAdmissions();
  const evolucoes = useClinicalEvolutions();

  const ocupacaoGeral = leitos.length > 0 ? Math.round((leitos.filter((l) => l.status === "ocupado").length / leitos.length) * 100) : 0;

  const hojeIso = hojeLocalIso();
  const turnosHoje = turnos.filter((t) => t.shift_date === hojeIso);
  const coberturaEscala = fisioterapeutas.length > 0 ? Math.round((turnosHoje.length / fisioterapeutas.length) * 100) : 0;

  const producaoHoje = producao.filter((p) => p.production_date === hojeIso).length;
  const metaDiaria = Math.max(fisioterapeutas.length * 3, 1);
  const producaoDoDia = Math.min(100, Math.round((producaoHoje / metaDiaria) * 100));

  const internacoesAtivas = internacoes.filter((i) => i.status === "internado");
  const semEvolucao = internacoesAtivas.filter((i) => !evolucoes.some((e) => e.admission_id === i.id));
  const evolucoesEmDia = internacoesAtivas.length > 0
    ? Math.round(((internacoesAtivas.length - semEvolucao.length) / internacoesAtivas.length) * 100)
    : 100;

  const ocupacaoPorUnidade = useMemo(() => {
    return unidades
      .map((u) => {
        const leitosDaUnidade = leitos.filter((l) => l.unit_id === u.id);
        if (leitosDaUnidade.length === 0) return null;
        const ocupacao = Math.round((leitosDaUnidade.filter((l) => l.status === "ocupado").length / leitosDaUnidade.length) * 100);
        return { unidade: u.name, ocupacao };
      })
      .filter((v): v is { unidade: string; ocupacao: number } => v !== null);
  }, [unidades, leitos]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard Operacional"
        description="Ocupação de leitos, escalas do dia e produção diária consolidada, em tempo real."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="flex justify-center pt-6">
            <GoniometerGauge value={ocupacaoGeral} label="Ocupação de leitos" tone="clinical" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex justify-center pt-6">
            <GoniometerGauge value={coberturaEscala} label="Cobertura de escala hoje" tone="recovery" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex justify-center pt-6">
            <GoniometerGauge value={producaoDoDia} label="Produção do dia" sublabel="vs. meta diária estimada" tone="clinical" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex justify-center pt-6">
            <GoniometerGauge value={evolucoesEmDia} label="Evoluções em dia" tone="attention" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ocupação por unidade</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {ocupacaoPorUnidade.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-soft">
                Nenhuma unidade com leitos cadastrados ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ocupacaoPorUnidade} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dfe4de" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#3d4d46" }} />
                  <YAxis dataKey="unidade" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#3d4d46" }} width={110} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #dfe4de", fontSize: 13 }}
                    formatter={(v) => [`${v}%`, "Ocupação"]}
                  />
                  <Bar dataKey="ocupacao" fill="#0e6b64" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Escala de hoje</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {turnosHoje.length === 0 ? (
              <p className="text-sm text-ink-soft">Nenhum turno escalado para hoje.</p>
            ) : (
              turnosHoje.map((t) => {
                const fisio = fisioterapeutas.find((f) => f.id === t.physiotherapist_id);
                const unidade = unidades.find((u) => u.id === t.unit_id);
                return (
                  <div key={t.id} className="flex items-center justify-between rounded-md border border-line p-3 text-sm">
                    <div>
                      <p className="font-medium text-ink">{fisio?.full_name ?? "—"}</p>
                      <p className="text-xs text-ink-soft">{unidade?.name ?? "—"}</p>
                    </div>
                    <Badge variant="clinical">{t.period === "manha" ? "Manhã" : t.period === "tarde" ? "Tarde" : "Noite"}</Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
