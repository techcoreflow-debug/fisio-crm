import { useMemo, useState } from "react";
import { ShieldCheck, ShieldAlert, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDailyProduction, useAdmissions, usePatients, useBillingEntries } from "@/data/repository";
import { verificarGlosa, projetarMes, REGRAS_GLOSA, type RegraGlosa } from "@/lib/glosa";
import { hojeLocalIso } from "@/lib/data-local";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Checagens antes do faturamento (regras universais, ver src/lib/glosa.ts). */
export function PrevencaoGlosa({ de, ate, hospitalId, convenioId }: { de: string; ate: string; hospitalId?: string; convenioId?: string }) {
  const producao = useDailyProduction();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const [filtro, setFiltro] = useState<RegraGlosa | null>(null);

  const alertas = useMemo(() => {
    const escopoInternacoes = internacoes.filter(
      (i) => (!hospitalId || i.hospital_id === hospitalId) && (!convenioId || i.health_insurance_id === convenioId)
    );
    const ids = new Set(escopoInternacoes.map((i) => i.id));
    const filtrarEscopo = hospitalId || convenioId;
    const producaoEscopo = filtrarEscopo ? producao.filter((p) => p.admission_id && ids.has(p.admission_id)) : producao;
    return verificarGlosa({ de, ate, producao: producaoEscopo, internacoes });
  }, [de, ate, hospitalId, convenioId, producao, internacoes]);

  const porRegra = useMemo(() => {
    const m = new Map<RegraGlosa, number>();
    for (const a of alertas) m.set(a.regra, (m.get(a.regra) ?? 0) + 1);
    return m;
  }, [alertas]);

  const visiveis = filtro ? alertas.filter((a) => a.regra === filtro) : alertas;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          {alertas.length === 0 ? <ShieldCheck className="h-4 w-4 text-recovery-600" /> : <ShieldAlert className="h-4 w-4 text-attention-600" />}
          Prevenção de glosa
        </CardTitle>
        <Badge variant={alertas.length === 0 ? "recovery" : "attention"}>{alertas.length} alerta(s)</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {alertas.length === 0 ? (
          <p className="text-sm text-ink-soft">Nenhuma inconsistência encontrada no período pelas regras abaixo.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setFiltro(null)} className={`rounded-full px-3 py-1 text-xs font-medium ${filtro === null ? "bg-clinical-600 text-white" : "bg-surface-sunken text-ink-soft"}`}>
                Todos ({alertas.length})
              </button>
              {Array.from(porRegra.entries()).map(([regra, n]) => (
                <button
                  key={regra}
                  type="button"
                  onClick={() => setFiltro(filtro === regra ? null : regra)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${filtro === regra ? "bg-clinical-600 text-white" : "bg-surface-sunken text-ink-soft"}`}
                >
                  {REGRAS_GLOSA[regra].titulo} ({n})
                </button>
              ))}
            </div>
            <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {visiveis.slice(0, 40).map((a, idx) => {
                const regra = REGRAS_GLOSA[a.regra];
                const nome = pacientes.find((p) => p.id === internacoes.find((i) => i.id === a.admissionId)?.patient_id)?.full_name;
                return (
                  <div key={`${a.regra}-${a.producaoIds[0]}-${idx}`} className="rounded-lg border border-line px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink">{nome ?? "Sem paciente"}</p>
                      <Badge variant={regra.gravidade === "alta" ? "critical" : "attention"}>{regra.titulo}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-soft">{a.detalhe}</p>
                  </div>
                );
              })}
              {visiveis.length > 40 && <p className="text-xs text-ink-soft">+ {visiveis.length - 40} alerta(s) — refine o período ou o filtro.</p>}
            </div>
          </>
        )}
        <details className="text-xs text-ink-soft">
          <summary className="cursor-pointer">Quais regras são checadas</summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {Object.values(REGRAS_GLOSA).map((r) => (
              <li key={r.titulo}>
                <strong className="text-ink">{r.titulo}:</strong> {r.explicacao}
              </li>
            ))}
            <li>Regras específicas de cada convênio ainda não são checadas — dependem de cadastro das regras reais.</li>
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}

/** Projeção linear do mês corrente — sempre como ESTIMATIVA, com a premissa explícita. */
export function ProjecaoMes() {
  const producao = useDailyProduction();
  const billing = useBillingEntries();
  const projecao = useMemo(() => projetarMes(hojeLocalIso(), producao, billing), [producao, billing]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-clinical-600" /> Projeção do mês <span className="text-xs font-normal text-ink-soft">(estimativa)</span>
        </CardTitle>
        <Badge variant="neutral">dia {projecao.diasDecorridos} de {projecao.diasNoMes}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Lançado até hoje</p>
            <p className="mt-1 text-xl font-semibold text-ink">{projecao.lancadoAteHoje}</p>
          </div>
          <div className="rounded-lg border border-line px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Procedimentos no mês</p>
            <p className={`mt-1 text-xl font-semibold ${projecao.projecaoProcedimentos === null ? "text-ink-soft" : "text-ink"}`}>
              {projecao.projecaoProcedimentos === null ? "sem dado" : `≈ ${projecao.projecaoProcedimentos}`}
            </p>
            {projecao.projecaoProcedimentos === null && <p className="text-xs text-ink-soft">precisa de 3+ dias com lançamento</p>}
          </div>
          <div className="rounded-lg border border-line px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Repasse estimado</p>
            <p className={`mt-1 text-xl font-semibold ${projecao.projecaoValor === null ? "text-ink-soft" : "text-ink"}`}>
              {projecao.projecaoValor === null ? "sem dado" : `≈ ${brl(projecao.projecaoValor)}`}
            </p>
            {projecao.projecaoValor === null && <p className="text-xs text-ink-soft">precisa de repasse do mês anterior lançado</p>}
          </div>
        </div>
        <p className="text-xs text-ink-soft">
          Como é calculado: média diária de procedimentos lançados no mês × dias do mês.
          {projecao.valorPorProcedimentoMesAnterior !== null && ` O valor usa a média do mês anterior (${brl(projecao.valorPorProcedimentoMesAnterior)} de repasse por procedimento lançado).`}{" "}
          É uma projeção linear — não considera feriados, fins de semana, glosas futuras nem o atraso do repasse do hospital.
        </p>
      </CardContent>
    </Card>
  );
}
