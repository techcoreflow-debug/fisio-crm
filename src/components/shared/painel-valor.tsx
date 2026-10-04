import { useMemo, useState } from "react";
import { Sparkles, Copy, Check, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdmissions, useDailyProduction, useFunctionalAssessments } from "@/data/repository";
import { calcularPainelValor, narrativaPainelValor } from "@/lib/painel-valor";
import { Input } from "@/components/ui/input";
import { notificarSucesso, notificarErro, notificarAviso } from "@/store/toast-store";
import { reescreverNarrativa, perguntarAosDados, iaIndisponivel, MENSAGEM_IA_NAO_CONFIGURADA } from "@/lib/ai";

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
  const [narrativaIa, setNarrativaIa] = useState<string | null>(null);
  const [carregandoIa, setCarregandoIa] = useState<"narrativa" | "pergunta" | null>(null);
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);

  const painel = useMemo(() => {
    const escopo = hospitalId ? internacoes.filter((i) => i.hospital_id === hospitalId) : internacoes;
    return calcularPainelValor({ de, ate, internacoes: escopo, producao, avaliacoes });
  }, [de, ate, hospitalId, internacoes, producao, avaliacoes]);

  const narrativa = narrativaPainelValor(painel, `de ${formatarData(de)} a ${formatarData(ate)}`);

  async function chamarIa<T>(tipo: "narrativa" | "pergunta", fn: () => Promise<T>): Promise<T | null> {
    setCarregandoIa(tipo);
    try {
      return await fn();
    } catch (erro) {
      if (iaIndisponivel(erro)) notificarAviso(MENSAGEM_IA_NAO_CONFIGURADA, "O restante do sistema funciona normalmente — a IA é opcional.");
      else notificarErro("Não foi possível usar a IA", erro);
      return null;
    } finally {
      setCarregandoIa(null);
    }
  }

  // A IA só enxerga números agregados do período — nunca registros de paciente.
  const dadosAgregados = { periodo: { de, ate }, indicadores: painel };

  async function reescrever() {
    const r = await chamarIa("narrativa", () => reescreverNarrativa(narrativa));
    if (r) setNarrativaIa(r);
  }

  async function perguntar() {
    if (!pergunta.trim()) return;
    const r = await chamarIa("pergunta", () => perguntarAosDados(pergunta, dadosAgregados));
    if (r) setResposta(r);
  }

  async function copiar() {
    const textoFinal = narrativaIa ?? narrativa;
    try {
      await navigator.clipboard.writeText(textoFinal);
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
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={reescrever} disabled={carregandoIa !== null}>
              {carregandoIa === "narrativa" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Reescrever com IA
            </Button>
          </div>
          {narrativaIa && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-clinical-700">Versão da IA (revise antes de usar)</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{narrativaIa}</p>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">Pergunte aos dados</p>
          <div className="flex gap-2">
            <Input
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && perguntar()}
              placeholder="Ex.: a glosa está alta neste período? o ganho funcional está bom?"
            />
            <Button size="sm" onClick={perguntar} disabled={carregandoIa !== null || !pergunta.trim()}>
              {carregandoIa === "pergunta" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {resposta && <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{resposta}</p>}
          <p className="mt-2 text-xs text-ink-soft">A IA responde só com os indicadores agregados acima — nenhum dado de paciente é enviado.</p>
        </div>
        <p className="text-xs text-ink-soft">Todos os números vêm dos registros do sistema; onde não há base suficiente aparece "sem dado". O ganho funcional é a média, entre as internações com 2+ avaliações da mesma escala, da diferença entre a primeira e a última como % da amplitude da escala.</p>
      </CardContent>
    </Card>
  );
}
