import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useDailyProduction,
  useClinicalEvolutions,
  useAdmissions,
  useHospitals,
  useHealthInsurances,
  usePhysiotherapists,
} from "@/data/repository";

type Dimensao = "hospital" | "convenio" | "fisioterapeuta";
type Metrica = "producao" | "evolucoes";

const dimensoes: { id: Dimensao; label: string }[] = [
  { id: "hospital", label: "Hospital" },
  { id: "convenio", label: "Convênio" },
  { id: "fisioterapeuta", label: "Fisioterapeuta" },
];

const metricas: { id: Metrica; label: string }[] = [
  { id: "producao", label: "Produção (lançamentos)" },
  { id: "evolucoes", label: "Evoluções registradas" },
];

export default function Bi() {
  const producao = useDailyProduction();
  const evolucoes = useClinicalEvolutions();
  const internacoes = useAdmissions();
  const hospitais = useHospitals();
  const convenios = useHealthInsurances();
  const fisioterapeutas = usePhysiotherapists();

  const [dimensao, setDimensao] = useState<Dimensao>("convenio");
  const [metrica, setMetrica] = useState<Metrica>("producao");

  function rotuloPorDimensao(admissionId: string | null, physiotherapistId: string | null): string | null {
    if (dimensao === "fisioterapeuta") {
      return fisioterapeutas.find((f) => f.id === physiotherapistId)?.full_name ?? null;
    }
    const internacao = internacoes.find((i) => i.id === admissionId);
    if (!internacao) return null;
    if (dimensao === "hospital") {
      return hospitais.find((h) => h.id === internacao.hospital_id)?.name ?? null;
    }
    return convenios.find((v) => v.id === internacao.health_insurance_id)?.name ?? null;
  }

  const dados = useMemo(() => {
    const contagem = new Map<string, number>();
    const fonte = metrica === "producao" ? producao : evolucoes;
    for (const item of fonte) {
      const rotulo = rotuloPorDimensao(item.admission_id, item.physiotherapist_id);
      if (!rotulo) continue;
      contagem.set(rotulo, (contagem.get(rotulo) ?? 0) + 1);
    }
    return Array.from(contagem.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrica, dimensao, producao, evolucoes, internacoes, hospitais, convenios, fisioterapeutas]);

  const metricaDef = metricas.find((m) => m.id === metrica)!;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Business Intelligence"
        description="Cruze produção e evoluções registradas por hospital, convênio ou fisioterapeuta — dados reais da empresa ativa."
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Cruzar por</span>
            <div className="flex gap-1.5">
              {dimensoes.map((d) => (
                <Button
                  key={d.id}
                  size="sm"
                  variant={dimensao === d.id ? "primary" : "secondary"}
                  onClick={() => setDimensao(d.id)}
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Métrica</span>
            <div className="flex flex-wrap gap-1.5">
              {metricas.map((m) => (
                <Button
                  key={m.id}
                  size="sm"
                  variant={metrica === m.id ? "primary" : "secondary"}
                  onClick={() => setMetrica(m.id)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {metricaDef.label} por {dimensoes.find((d) => d.id === dimensao)?.label.toLowerCase()}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {dados.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-soft">
              Sem dados suficientes ainda para este cruzamento.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dfe4de" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#3d4d46" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#3d4d46" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #dfe4de", fontSize: 13 }}
                  formatter={(v) => [`${v}`, metricaDef.label]}
                />
                <Bar dataKey="value" fill="#0e6b64" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
