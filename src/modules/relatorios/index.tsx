import { useMemo, useState } from "react";
import { hojeLocalIso } from "@/lib/data-local";
import { BarChart3, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportarCsv, type LinhaRelatorio } from "@/lib/csv";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import {
  useDailyProduction,
  useAdmissions,
  usePatients,
  usePhysiotherapists,
  useProcedures,
  useUnits,
  useHospitals,
  useBeds,
  useClinicalEvolutions,
  useContracts,
  useHealthInsurances,
  useReceivables,
} from "@/data/repository";

type Categoria = "Operacional" | "Assistencial" | "Financeiro";

const categoriaVariant: Record<Categoria, "clinical" | "recovery" | "attention"> = {
  Operacional: "clinical",
  Assistencial: "recovery",
  Financeiro: "attention",
};

function formatarData(iso: string | null) {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function Relatorios() {
  const producao = useDailyProduction();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const fisioterapeutas = usePhysiotherapists();
  const procedimentos = useProcedures();
  const unidades = useUnits();
  const hospitais = useHospitals();
  const leitos = useBeds();
  const evolucoes = useClinicalEvolutions();
  const contratos = useContracts();
  const convenios = useHealthInsurances();
  const recebiveis = useReceivables();

  function nomePaciente(admissionId: string | null) {
    const internacao = internacoes.find((i) => i.id === admissionId);
    return pacientes.find((p) => p.id === internacao?.patient_id)?.full_name ?? "—";
  }

  const hoje = hojeLocalIso();
  const primeiroDiaMes = `${hoje.slice(0, 7)}-01`;
  const [periodoDe, setPeriodoDe] = useState(primeiroDiaMes);
  const [periodoAte, setPeriodoAte] = useState(hoje);

  const producaoNoPeriodo = useMemo(
    () => producao.filter((p) => p.production_date >= periodoDe && p.production_date <= periodoAte),
    [producao, periodoDe, periodoAte]
  );

  const contabilizadosPorCategoria = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const p of producaoNoPeriodo) {
      const categoria = procedimentos.find((pr) => pr.id === p.procedure_id)?.category ?? "Sem categoria";
      contagem.set(categoria, (contagem.get(categoria) ?? 0) + 1);
    }
    return Array.from(contagem.entries()).sort((a, b) => b[1] - a[1]);
  }, [producaoNoPeriodo, procedimentos]);

  function exportarContabilizados() {
    try {
      const linhas: LinhaRelatorio[] = producaoNoPeriodo.map((p) => ({
        Data: formatarData(p.production_date),
        Hora: p.production_time?.slice(0, 5) ?? "—",
        Paciente: nomePaciente(p.admission_id),
        Categoria: procedimentos.find((pr) => pr.id === p.procedure_id)?.category ?? "Sem categoria",
        "Código do procedimento": procedimentos.find((pr) => pr.id === p.procedure_id)?.code ?? "—",
        Procedimento: procedimentos.find((pr) => pr.id === p.procedure_id)?.name ?? "—",
        Fisioterapeuta: fisioterapeutas.find((f) => f.id === p.physiotherapist_id)?.full_name ?? "—",
        Conciliação: p.confirmado_tasy ? "Confirmado" : "Não confirmado",
      }));
      exportarCsv("producao-contabilizada", linhas);
      notificarSucesso(`Relatório exportado (${linhas.length} linha(s)).`);
    } catch (erro) {
      notificarErro('Não foi possível exportar "Produção contabilizada"', erro);
    }
  }

  const relatorios: { nome: string; categoria: Categoria; descricao: string; arquivo: string; gerar: () => LinhaRelatorio[] }[] = [
    {
      nome: "Produção diária consolidada",
      categoria: "Operacional",
      descricao: "Todos os lançamentos de produção, com paciente, procedimento, profissional e origem.",
      arquivo: "producao-diaria",
      gerar: () =>
        producao.map((p) => ({
          Data: formatarData(p.production_date),
          Hora: p.production_time?.slice(0, 5) ?? "—",
          Paciente: nomePaciente(p.admission_id),
          "Código do procedimento": procedimentos.find((pr) => pr.id === p.procedure_id)?.code ?? "—",
          Procedimento: procedimentos.find((pr) => pr.id === p.procedure_id)?.name ?? "—",
          Fisioterapeuta: fisioterapeutas.find((f) => f.id === p.physiotherapist_id)?.full_name ?? "—",
          Conciliação: p.confirmado_tasy ? "Confirmado" : "Não confirmado",
        })),
    },
    {
      nome: "Ocupação de leitos",
      categoria: "Operacional",
      descricao: "Situação atual de cada leito, por hospital e ala.",
      arquivo: "ocupacao-leitos",
      gerar: () =>
        leitos.map((l) => {
          const unidade = unidades.find((u) => u.id === l.unit_id);
          return {
            Leito: l.code,
            Ala: unidade?.name ?? "—",
            Hospital: hospitais.find((h) => h.id === unidade?.hospital_id)?.name ?? "—",
            Status: l.status === "ocupado" ? "Ocupado" : l.status === "livre" ? "Livre" : "Em higienização",
          };
        }),
    },
    {
      nome: "Internações sem evolução",
      categoria: "Assistencial",
      descricao: "Internações ativas que ainda não têm nenhuma evolução clínica registrada.",
      arquivo: "internacoes-sem-evolucao",
      gerar: () =>
        internacoes
          .filter((i) => i.status === "internado" && !evolucoes.some((e) => e.admission_id === i.id))
          .map((i) => {
            const unidade = unidades.find((u) => u.id === i.unit_id);
            return {
              Paciente: pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "—",
              Hospital: hospitais.find((h) => h.id === i.hospital_id)?.name ?? "—",
              Ala: unidade?.name ?? "—",
              Leito: leitos.find((l) => l.id === i.bed_id)?.code ?? "—",
              "Data de entrada": formatarData(i.admission_date),
            };
          }),
    },
    {
      nome: "Evoluções clínicas registradas",
      categoria: "Assistencial",
      descricao: "Histórico completo de evoluções, com paciente, profissional e data.",
      arquivo: "evolucoes-clinicas",
      gerar: () =>
        evolucoes.map((e) => ({
          Data: new Date(e.created_at).toLocaleString("pt-BR"),
          Paciente: nomePaciente(e.admission_id),
          Fisioterapeuta: fisioterapeutas.find((f) => f.id === e.physiotherapist_id)?.full_name ?? "—",
          Evolução: e.content,
        })),
    },
    {
      nome: "Contas a receber",
      categoria: "Financeiro",
      descricao: "Todos os lançamentos por competência, com status de pagamento.",
      arquivo: "contas-a-receber",
      gerar: () =>
        recebiveis.map((r) => {
          const contrato = contratos.find((c) => c.id === r.contract_id);
          return {
            Competência: r.competencia.slice(0, 7).split("-").reverse().join("/"),
            Hospital: hospitais.find((h) => h.id === contrato?.hospital_id)?.name ?? "—",
            Convênio: convenios.find((v) => v.id === contrato?.health_insurance_id)?.name ?? "—",
            Valor: r.amount,
            Vencimento: formatarData(r.due_date),
            Status: r.status === "pago" ? "Pago" : r.status === "pendente" ? "Pendente" : "Atrasado",
          };
        }),
    },
    {
      nome: "Contratos a vencer (90 dias)",
      categoria: "Financeiro",
      descricao: "Contratos ativos com vigência encerrando nos próximos 90 dias.",
      arquivo: "contratos-a-vencer",
      gerar: () =>
        contratos
          .filter((c) => {
            if (!c.end_date || c.status !== "ativo") return false;
            const dias = (new Date(c.end_date).getTime() - Date.now()) / 86400000;
            return dias >= 0 && dias <= 90;
          })
          .map((c) => ({
            Hospital: hospitais.find((h) => h.id === c.hospital_id)?.name ?? "—",
            Convênio: convenios.find((v) => v.id === c.health_insurance_id)?.name ?? "—",
            "Início da vigência": formatarData(c.start_date),
            "Fim da vigência": formatarData(c.end_date),
            "Valor mensal": c.monthly_value ?? 0,
          })),
    },
  ];

  // Memoizado: sem isso, cada card recalcularia seu dataset inteiro a cada
  // render só para exibir a contagem de linhas — com a base crescendo, isso
  // vira trabalho desperdiçado a cada tecla digitada em qualquer lugar da tela.
  const relatoriosComDados = useMemo(
    () => relatorios.map((r) => ({ ...r, linhas: r.gerar() })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [producao, internacoes, pacientes, fisioterapeutas, procedimentos, unidades, hospitais, leitos, evolucoes, contratos, convenios, recebiveis]
  );

  function handleExportar(relatorio: { nome: string; arquivo: string; linhas: LinhaRelatorio[] }) {
    try {
      exportarCsv(relatorio.arquivo, relatorio.linhas);
      notificarSucesso(`Relatório exportado (${relatorio.linhas.length} linha(s)).`);
    } catch (erro) {
      notificarErro(`Não foi possível exportar "${relatorio.nome}"`, erro);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatórios"
        description="Relatórios gerados a partir dos dados reais desta empresa, exportáveis em CSV (abre direto no Excel e no Google Sheets)."
      />

      <Card>
        <CardHeader>
          <CardTitle>Produção contabilizada por período</CardTitle>
          <p className="text-sm text-ink-soft mt-0.5">Contagem de procedimentos Motora x Respiratória (e demais categorias) no período escolhido.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="periodo_de">De</Label>
              <Input id="periodo_de" type="date" value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="periodo_ate">Até</Label>
              <Input id="periodo_ate" type="date" value={periodoAte} onChange={(e) => setPeriodoAte(e.target.value)} />
            </div>
            <Button variant="secondary" size="sm" onClick={exportarContabilizados} disabled={producaoNoPeriodo.length === 0}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>

          {contabilizadosPorCategoria.length === 0 ? (
            <p className="text-sm text-ink-soft">Nenhum procedimento lançado nesse período.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-line p-3">
                <p className="text-xs uppercase tracking-wide text-ink-soft">Total no período</p>
                <p className="font-display text-lg font-semibold text-ink">{producaoNoPeriodo.length}</p>
              </div>
              {contabilizadosPorCategoria.map(([categoria, total]) => (
                <div key={categoria} className="rounded-md border border-line p-3">
                  <p className="text-xs uppercase tracking-wide text-ink-soft">{categoria}</p>
                  <p className="font-display text-lg font-semibold text-ink">{total}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {relatoriosComDados.map((r) => {
          const totalLinhas = r.linhas.length;
          return (
            <Card key={r.nome}>
              <CardContent className="flex h-full flex-col gap-3 pt-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-clinical-50 text-clinical-600">
                    <BarChart3 className="h-4.5 w-4.5" />
                  </div>
                  <Badge variant={categoriaVariant[r.categoria]}>{r.categoria}</Badge>
                </div>
                <div className="flex-1">
                  <p className="font-display font-semibold text-ink">{r.nome}</p>
                  <p className="mt-1 text-sm text-ink-soft">{r.descricao}</p>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="text-xs text-ink-soft">
                    {totalLinhas === 0 ? "Sem dados no momento" : `${totalLinhas} linha(s) disponíveis`}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => handleExportar(r)} disabled={totalLinhas === 0}>
                    <Download className="h-4 w-4" /> Exportar CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
