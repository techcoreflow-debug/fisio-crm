import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePatientQueue, usePhysiotherapists, useDailyProduction } from "@/data/repository";
import { hojeLocalIso } from "@/lib/data-local";

export default function DesempenhoFila() {
  const fila = usePatientQueue();
  const fisioterapeutas = usePhysiotherapists();
  const producao = useDailyProduction();

  const hoje = hojeLocalIso();
  const [periodoDe, setPeriodoDe] = useState(hoje);
  const [periodoAte, setPeriodoAte] = useState(hoje);

  const filaPeriodo = useMemo(
    () => fila.filter((f) => f.data >= periodoDe && f.data <= periodoAte),
    [fila, periodoDe, periodoAte]
  );

  // Um item "concluído" só conta como trabalho de verdade se existir um
  // lançamento de produção pra aquela internação, naquele mesmo dia —
  // "Concluir" na fila é uma ação manual e independente de lançar de
  // verdade, então sem esse cruzamento não dá pra saber se a pessoa
  // clicou "concluir" sem fazer o atendimento.
  function temLancamentoNoDia(admissionId: string, data: string) {
    return producao.some((p) => p.admission_id === admissionId && p.production_date === data);
  }

  const porFisio = useMemo(() => {
    const mapa = new Map<
      string,
      { distribuido: number; concluido: number; concluidoSemLancamento: number; pendente: number }
    >();
    for (const item of filaPeriodo) {
      const atual = mapa.get(item.physiotherapist_id) ?? { distribuido: 0, concluido: 0, concluidoSemLancamento: 0, pendente: 0 };
      atual.distribuido += 1;
      if (item.status === "concluido") {
        atual.concluido += 1;
        if (!temLancamentoNoDia(item.admission_id, item.data)) atual.concluidoSemLancamento += 1;
      } else {
        atual.pendente += 1;
      }
      mapa.set(item.physiotherapist_id, atual);
    }
    return Array.from(mapa.entries())
      .map(([fisioId, dados]) => ({
        fisioId,
        nome: fisioterapeutas.find((f) => f.id === fisioId)?.full_name ?? "—",
        ...dados,
        taxaConclusaoReal: dados.distribuido > 0 ? Math.round(((dados.concluido - dados.concluidoSemLancamento) / dados.distribuido) * 100) : 0,
      }))
      .sort((a, b) => b.distribuido - a.distribuido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filaPeriodo, fisioterapeutas, producao]);

  const totais = porFisio.reduce(
    (acc, f) => ({
      distribuido: acc.distribuido + f.distribuido,
      concluido: acc.concluido + f.concluido,
      concluidoSemLancamento: acc.concluidoSemLancamento + f.concluidoSemLancamento,
      pendente: acc.pendente + f.pendente,
    }),
    { distribuido: 0, concluido: 0, concluidoSemLancamento: 0, pendente: 0 }
  );

  const pendentesAtrasados = filaPeriodo.filter((f) => f.status === "pendente" && f.data < hoje);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Desempenho da Fila de Distribuição"
        description="Acompanha se a distribuição de pacientes virou atendimento de verdade — não só quem marcou 'concluído'."
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-5">
          <span className="text-sm text-ink-soft">Período</span>
          <input type="date" value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} className="h-9 rounded-md border border-line-strong bg-surface-raised px-2 text-sm text-ink" />
          <span className="text-xs text-ink-soft">até</span>
          <input type="date" value={periodoAte} onChange={(e) => setPeriodoAte(e.target.value)} className="h-9 rounded-md border border-line-strong bg-surface-raised px-2 text-sm text-ink" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clinical-50 text-clinical-600"><Users className="h-5 w-5" /></div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Distribuídos</p>
              <p className="font-display text-2xl font-semibold text-ink">{totais.distribuido}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-recovery-100 text-recovery-600"><CheckCircle2 className="h-5 w-5" /></div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Concluídos com lançamento</p>
              <p className="font-display text-2xl font-semibold text-recovery-600">{totais.concluido - totais.concluidoSemLancamento}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={totais.concluidoSemLancamento > 0 ? "border-critical-400/40" : undefined}>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-critical-50 text-critical-600"><AlertTriangle className="h-5 w-5" /></div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Concluídos sem lançamento</p>
              <p className="font-display text-2xl font-semibold text-critical-600">{totais.concluidoSemLancamento}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-attention-100 text-attention-600"><Clock className="h-5 w-5" /></div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Pendentes (não atendidos)</p>
              <p className="font-display text-2xl font-semibold text-attention-600">{totais.pendente}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {pendentesAtrasados.length > 0 && (
        <Card className="border-critical-400/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-critical-700"><AlertTriangle className="h-4.5 w-4.5" /> {pendentesAtrasados.length} item(ns) de dias passados, ainda pendente(s)</CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">Foram distribuídos, o dia já passou, e ninguém marcou como concluído nem lançou procedimento.</p>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Desempenho por fisioterapeuta</CardTitle>
          <p className="text-sm text-ink-soft mt-0.5">"Concluído sem lançamento" é o número que mais importa — indica alguém marcando como feito sem ter atendido.</p>
        </CardHeader>
        <CardContent className="h-72">
          {porFisio.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-soft">Sem distribuições no período.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porFisio} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ea" vertical={false} />
                <XAxis dataKey="nome" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#47566b" }} angle={-30} textAnchor="end" interval={0} height={60} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
                <Legend />
                <Bar dataKey="distribuido" name="Distribuído" fill="#2f80ed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="concluidoSemLancamento" name="Concluído sem lançamento" fill="#e05f7a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pendente" name="Pendente" fill="#e0a030" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto pt-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-2 font-medium">Fisioterapeuta</th>
                <th className="px-4 py-2 text-center font-medium">Distribuído</th>
                <th className="px-4 py-2 text-center font-medium">Concluído</th>
                <th className="px-4 py-2 text-center font-medium">Sem lançamento</th>
                <th className="px-4 py-2 text-center font-medium">Pendente</th>
                <th className="px-4 py-2 text-center font-medium">% real</th>
              </tr>
            </thead>
            <tbody>
              {porFisio.map((f) => (
                <tr key={f.fisioId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{f.nome}</td>
                  <td className="px-4 py-2.5 text-center text-ink-soft">{f.distribuido}</td>
                  <td className="px-4 py-2.5 text-center text-ink-soft">{f.concluido}</td>
                  <td className="px-4 py-2.5 text-center">
                    {f.concluidoSemLancamento > 0 ? <Badge variant="critical">{f.concluidoSemLancamento}</Badge> : <span className="text-ink-soft">0</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center text-ink-soft">{f.pendente}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge variant={f.taxaConclusaoReal >= 80 ? "recovery" : f.taxaConclusaoReal >= 50 ? "attention" : "critical"}>{f.taxaConclusaoReal}%</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
