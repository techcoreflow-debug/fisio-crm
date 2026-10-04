import { useMemo } from "react";
import { CalendarCheck, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdmissions, usePatients, useUnits } from "@/data/repository";
import { preverAltas, MIN_CASOS_PREVISAO } from "@/lib/previsao-alta";
import { hojeLocalIso } from "@/lib/data-local";

function fmt(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Altas estimadas para os próximos dias (ou já acima da mediana) — estimativa por histórico, não prognóstico. */
export function PrevisaoAltaCard() {
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const unidades = useUnits();
  const hoje = hojeLocalIso();

  const previsoes = useMemo(() => {
    const limite = new Date(`${hoje}T00:00:00`);
    limite.setDate(limite.getDate() + 3);
    const limiteIso = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}-${String(limite.getDate()).padStart(2, "0")}`;
    return preverAltas(internacoes, hoje).filter((p) => p.dataEstimada <= limiteIso);
  }, [internacoes, hoje]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-clinical-600" /> Altas prováveis (próx. 3 dias) <span className="text-xs font-normal text-ink-soft">estimativa</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {previsoes.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Nenhuma alta provável nos próximos dias — ou ainda não há histórico suficiente (são necessárias {MIN_CASOS_PREVISAO}+ altas anteriores do mesmo diagnóstico ou unidade).
          </p>
        ) : (
          previsoes.slice(0, 8).map((p) => {
            const i = internacoes.find((x) => x.id === p.admissionId);
            const nome = pacientes.find((x) => x.id === i?.patient_id)?.full_name ?? "—";
            const unidade = unidades.find((u) => u.id === i?.unit_id)?.name;
            return (
              <div key={p.admissionId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {nome} {unidade && <span className="font-normal text-ink-soft">· {unidade}</span>}
                  </p>
                  <p className="text-xs text-ink-soft">
                    Mediana de {p.medianaDias} dias ({p.casos} casos do mesmo {p.base}) · {p.diasInternado} dias internado
                  </p>
                </div>
                <Badge variant={p.diasAlemDaMediana > 0 ? "attention" : "clinical"}>
                  {p.diasAlemDaMediana > 0 ? `+${p.diasAlemDaMediana} dia(s) além da mediana` : `estimada ${fmt(p.dataEstimada)}`}
                </Badge>
              </div>
            );
          })
        )}
        <p className="flex items-start gap-1.5 text-xs text-ink-soft">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Baseada só no histórico de permanência (mediana). Não considera a gravidade do paciente — a decisão de alta é clínica.
        </p>
      </CardContent>
    </Card>
  );
}
