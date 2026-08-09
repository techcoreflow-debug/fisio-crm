import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useAdmissions,
  useBeds,
  usePhysiotherapists,
  useDailyProduction,
  usePatients,
} from "@/data/repository";
import { hojeLocalIso } from "@/lib/data-local";

function dataParaIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Diagnostico() {
  const internacoes = useAdmissions();
  const leitos = useBeds();
  const fisioterapeutas = usePhysiotherapists();
  const producao = useDailyProduction();
  const pacientes = usePatients();

  const hoje = hojeLocalIso();

  // 1) Leitos "ocupados" no banco sem internação ativa de verdade — a
  // tela de Leitos já se autocorrige sozinha, mas se aparecer aqui é
  // sinal de que algo fora dela ainda está gravando esse status errado.
  const leitosOcupadosSemInternacao = useMemo(
    () => leitos.filter((l) => l.status === "ocupado" && !internacoes.some((i) => i.bed_id === l.id && i.status === "internado")),
    [leitos, internacoes]
  );

  // 2) Dois leitos "internado" apontando pro MESMO bed_id — dupla
  // ocupação, não devia existir nunca.
  const leitosComDuplaOcupacao = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const i of internacoes) {
      if (i.status === "internado" && i.bed_id) contagem.set(i.bed_id, (contagem.get(i.bed_id) ?? 0) + 1);
    }
    return [...contagem.entries()].filter(([, qtd]) => qtd > 1);
  }, [internacoes]);

  // 3) Internações ativas sem unidade ou sem hospital — quebra filtros,
  // relatórios e a lista de leitos livres em qualquer tela.
  const internacoesSemUnidadeOuHospital = useMemo(
    () => internacoes.filter((i) => i.status === "internado" && (!i.unit_id || !i.hospital_id)),
    [internacoes]
  );

  // 4) Fisioterapeutas sem login vinculado — Minha Fila e o modo tablet
  // não funcionam pra essa pessoa até isso ser corrigido.
  const fisioterapeutasSemLogin = useMemo(() => fisioterapeutas.filter((f) => !f.user_id), [fisioterapeutas]);

  // 5) Procedimentos lançados com data no futuro — quase sempre erro de
  // digitação (ou o mesmo bug de fuso horário, se algum dia voltar).
  const producaoComDataFutura = useMemo(() => producao.filter((p) => p.production_date > hoje), [producao, hoje]);

  // 6) Volume de lançamentos por dia, últimos 7 dias — pra enxergar uma
  // queda repentina que pode ser sinal de alguma tela não exibindo o que
  // já está sendo lançado (o mesmo tipo de problema já visto).
  const volumePorDia = useMemo(() => {
    const dias: { data: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = dataParaIso(d);
      const total = producao.filter((p) => p.production_date === iso).length;
      dias.push({ data: iso.slice(8, 10) + "/" + iso.slice(5, 7), total });
    }
    return dias;
  }, [producao]);

  const checagens = [
    {
      titulo: "Leitos travados como \"ocupado\" sem internação real",
      qtd: leitosOcupadosSemInternacao.length,
      detalhe: leitosOcupadosSemInternacao.map((l) => l.code).join(", "),
      dica: "Abra a tela de Leitos — ela se autocorrige sozinha ao carregar.",
    },
    {
      titulo: "Leitos com duas internações ativas ao mesmo tempo",
      qtd: leitosComDuplaOcupacao.length,
      detalhe: leitosComDuplaOcupacao.map(([bedId]) => leitos.find((l) => l.id === bedId)?.code ?? bedId).join(", "),
      dica: "Confira as internações desses leitos — uma delas provavelmente precisa de alta retroativa ou correção manual.",
    },
    {
      titulo: "Internações ativas sem unidade ou hospital definidos",
      qtd: internacoesSemUnidadeOuHospital.length,
      detalhe: internacoesSemUnidadeOuHospital
        .map((i) => pacientes.find((p) => p.id === i.patient_id)?.full_name ?? i.id)
        .join(", "),
      dica: "Edite a internação em Pacientes Internados e preencha unidade/hospital.",
    },
    {
      titulo: "Fisioterapeutas sem login vinculado",
      qtd: fisioterapeutasSemLogin.length,
      detalhe: fisioterapeutasSemLogin.map((f) => f.full_name).join(", "),
      dica: "Vincule o usuário em Fisioterapeutas — sem isso, Minha Fila não funciona pra essa pessoa.",
    },
    {
      titulo: "Procedimentos lançados com data no futuro",
      qtd: producaoComDataFutura.length,
      detalhe: `${producaoComDataFutura.length} lançamento(s)`,
      dica: "Provavelmente erro de digitação na data — confira em Produção Diária.",
    },
  ];

  const totalProblemas = checagens.reduce((acc, c) => acc + c.qtd, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Diagnóstico do Sistema"
        description="Checagens automáticas contra os dados reais — pensado pra pegar problema antes de virar reclamação."
      />

      <Card className={totalProblemas === 0 ? "border-recovery-400/40" : "border-attention-400/40"}>
        <CardContent className="flex items-center gap-3 pt-5">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${totalProblemas === 0 ? "bg-recovery-100 text-recovery-600" : "bg-attention-100 text-attention-600"}`}>
            {totalProblemas === 0 ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <div>
            <p className="font-medium text-ink">
              {totalProblemas === 0 ? "Tudo certo — nenhuma inconsistência encontrada." : `${totalProblemas} ponto(s) pra revisar.`}
            </p>
            <p className="text-sm text-ink-soft">Roda a cada vez que você abre esta tela, com os dados de agora.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {checagens.map((c) => (
          <Card key={c.titulo}>
            <CardContent className="flex items-start gap-3 pt-5">
              {c.qtd === 0 ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-recovery-500" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-attention-600" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-ink">{c.titulo}</p>
                  <Badge variant={c.qtd === 0 ? "recovery" : "attention"}>{c.qtd}</Badge>
                </div>
                {c.qtd > 0 && (
                  <>
                    <p className="mt-1 text-sm text-ink-soft">{c.detalhe}</p>
                    <p className="mt-1 text-xs text-ink-soft/80">{c.dica}</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos por dia — últimos 7 dias</CardTitle>
          <p className="text-sm text-ink-soft mt-0.5">
            Uma queda repentina sem explicação (feriado, fim de semana) pode ser sinal de alguma tela não exibindo o
            que já está sendo lançado — vale conferir se acontecer.
          </p>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumePorDia} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ea" vertical={false} />
              <XAxis dataKey="data" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#47566b" }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 13 }} />
              <Bar dataKey="total" name="Procedimentos lançados" fill="#2f80ed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
