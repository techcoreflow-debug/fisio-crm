import { useMemo, useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdmissions, useDailyProduction, useFunctionalAssessments } from "@/data/repository";
import { calcularPainelValor, narrativaPainelValor } from "@/lib/painel-valor";
import { notificarSucesso } from "@/store/toast-store";

function formatarData(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
const fmt = (v: number, casas = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas });

function Indicador({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio?: string }) {
  const semDado = valor === "sem dado";
  return (
    <div className="rounded-lg border border-line px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-ink-soft">{rotulo}</p>
      <p className={`mt-1 text-xl font-semibold ${semDado ? "text-ink-soft" : "text-ink"}`}>{valor}</p>
      {apoio && <p className="mt-0.5 text-xs text-ink-soft">{apoio}</p>}
    </div>
  );
}

/** Resultado clínico + eficiência do período, com relatório narrativo copiável. */
export function PainelValor({ de, ate, hospitalId }: { de: string; ate: string; hospitalId?: string }) {
  const internacoes = useAdmissions();
  const producao = useDailyProduction();
  const avaliacoes = useFunctionalAssessments();
  const [copiado, setCopiado] = useState(false);

  const painel = useMemo(() => {
    const escopo = hospitalId ? internacoes.filter((i) => i.hospital_id === hospitalId) : internacoes;
    return calcularPainelValor({ de, ate, internacoes: escopo, producao, avaliacoes });
  }, [de, ate, hospitalId, internacoes, producao, avaliacoes]);

  const narrativa = narrativaPainelValor(painel, `de ${formatarData(de)} a ${formatarData(ate)}`);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(narrativa);
      setCopiado(true);
      notificarSucesso("Relatório copiado.");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* navegador sem permissão de área de transferência: o texto continua visível na tela */
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-clinical-600" /> Painel de valor
        </CardTitle>
        <span className="text-xs text-ink-soft">{formatarData(de)} a {formatarData(ate)}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Indicador
            rotulo="Ganho funcional"
            valor={painel.ganhoFuncionalMedioPct === null ? "sem dado" : `${painel.ganhoFuncionalMedioPct >= 0 ? "+" : ""}${fmt(painel.ganhoFuncionalMedioPct)}%`}
            apoio={painel.ganhoFuncionalMedioPct === null ? "precisa de 2+ avaliações" : `${painel.internacoesComGanho} internação(ões) medida(s)`}
          />
          <Indicador
            rotulo="Permanência média"
            valor={painel.permanenciaMediaDias === null ? "sem dado" : `${fmt(painel.permanenciaMediaDias)} dias`}
            apoio={`${painel.altas} alta(s)`}
          />
          <Indicador
            rotulo="Reinternação 30d"
            valor={painel.reinternacao30dPct === null ? "sem dado" : `${fmt(painel.reinternacao30dPct)}%`}
            apoio={`${painel.reinternacoes30d} de ${painel.internacoesNoPeriodo}`}
          />
          <Indicador
            rotulo="Glosa"
            valor={painel.glosaPct === null ? "sem dado" : `${fmt(painel.glosaPct)}%`}
            apoio={`${painel.glosados} de ${painel.procedimentos} procedimentos`}
          />
          <Indicador
            rotulo="Cobertura de avaliação"
            valor={painel.coberturaAvaliacaoPct === null ? "sem dado" : `${fmt(painel.coberturaAvaliacaoPct, 0)}%`}
            apoio="altas com ganho mensurável"
          />
        </div>
        <div className="rounded-lg bg-surface-sunken p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Relatório do período</p>
            <Button size="sm" variant="secondary" onClick={copiar}>
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copiar
            </Button>
          </div>
          <p className="text-sm leading-relaxed text-ink">{narrativa}</p>
        </div>
        <p className="text-xs text-ink-soft">Todos os números vêm dos registros do sistema; onde não há base suficiente aparece "sem dado". O ganho funcional é a média, entre as internações com 2+ avaliações da mesma escala, da diferença entre a primeira e a última como % da amplitude da escala.</p>
      </CardContent>
    </Card>
  );
}
