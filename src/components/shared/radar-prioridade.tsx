import { useMemo, useState } from "react";
import { Radar, ChevronDown, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdmissions, usePatients, useDailyProduction, useClinicalEvolutions, useFunctionalAssessments, useUnits } from "@/data/repository";
import { calcularRadar, REGRAS_RADAR, type NivelRadar } from "@/lib/radar-prioridade";
import { hojeLocalIso } from "@/lib/data-local";

const ROTULO: Record<NivelRadar, { texto: string; variant: "critical" | "attention" | "neutral" }> = {
  alta: { texto: "Prioridade alta", variant: "critical" },
  atencao: { texto: "Atenção", variant: "attention" },
  acompanhar: { texto: "Acompanhar", variant: "neutral" },
};

/** Radar explicável. `apenasIds` restringe a pacientes (ex.: a fila do fisioterapeuta). */
export function RadarPrioridade({ apenasIds, limite = 8, titulo = "Radar de prioridade" }: { apenasIds?: string[]; limite?: number; titulo?: string }) {
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const unidades = useUnits();
  const producao = useDailyProduction();
  const evolucoes = useClinicalEvolutions();
  const avaliacoes = useFunctionalAssessments();
  const [regrasAbertas, setRegrasAbertas] = useState(false);

  const itens = useMemo(() => {
    const escopo = apenasIds ? internacoes.filter((i) => apenasIds.includes(i.id)) : internacoes;
    return calcularRadar({ hoje: hojeLocalIso(), internacoes: escopo, producao, evolucoes, avaliacoes });
  }, [apenasIds, internacoes, producao, evolucoes, avaliacoes]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-clinical-600" /> {titulo}
        </CardTitle>
        <button type="button" onClick={() => setRegrasAbertas((v) => !v)} className="flex items-center gap-1 text-xs text-ink-soft hover:text-ink">
          <Info className="h-3.5 w-3.5" /> Como é calculado
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${regrasAbertas ? "" : "-rotate-90"}`} />
        </button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {regrasAbertas && (
          <ul className="mb-2 flex flex-col gap-1 rounded-lg bg-surface-sunken p-3 text-xs text-ink-soft">
            {REGRAS_RADAR.map((r) => (
              <li key={r.regra}>
                <strong className="text-ink">+{r.pontos}</strong> {r.regra}
              </li>
            ))}
            <li className="pt-1">5 pontos ou mais: prioridade alta · 3 a 4: atenção · 1 a 2: acompanhar. O radar apoia a decisão — a prioridade clínica final é do profissional.</li>
          </ul>
        )}
        {itens.length === 0 ? (
          <p className="text-sm text-ink-soft">Nenhum paciente com sinal de atenção pelas regras acima.</p>
        ) : (
          itens.slice(0, limite).map((item) => {
            const internacao = internacoes.find((i) => i.id === item.admissionId);
            const nome = pacientes.find((p) => p.id === internacao?.patient_id)?.full_name ?? "—";
            const unidade = unidades.find((u) => u.id === internacao?.unit_id)?.name;
            return (
              <div key={item.admissionId} className="rounded-lg border border-line px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">
                    {nome} {unidade && <span className="font-normal text-ink-soft">· {unidade}</span>}
                  </p>
                  <Badge variant={ROTULO[item.nivel].variant}>{ROTULO[item.nivel].texto} · {item.pontos} pt</Badge>
                </div>
                <ul className="mt-1 list-disc pl-5 text-xs text-ink-soft">
                  {item.motivos.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
        {itens.length > limite && <p className="text-xs text-ink-soft">+ {itens.length - limite} paciente(s) com sinal de atenção.</p>}
      </CardContent>
    </Card>
  );
}
