import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useReceivables, useContracts, useHospitals, useHealthInsurances, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { ReceivableStatus } from "@/types/domain";

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarCompetencia(iso: string) {
  const [ano, mes] = iso.split("-");
  return `${mes}/${ano}`;
}

const statusConfig: Record<ReceivableStatus, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  pago: { label: "Pago", variant: "recovery" },
  pendente: { label: "Pendente", variant: "attention" },
  atrasado: { label: "Atrasado", variant: "critical" },
};

export default function Financeiro() {
  const recebiveis = useReceivables();
  const contratos = useContracts();
  const hospitais = useHospitals();
  const convenios = useHealthInsurances();

  const competenciaAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  const totalMesAtual = recebiveis
    .filter((r) => r.competencia === competenciaAtual)
    .reduce((acc, r) => acc + r.amount, 0);
  const emAberto = recebiveis.filter((r) => r.status !== "pago").reduce((acc, r) => acc + r.amount, 0);
  const atrasado = recebiveis.filter((r) => r.status === "atrasado").reduce((acc, r) => acc + r.amount, 0);

  function nomeContrato(contractId: string) {
    const contrato = contratos.find((c) => c.id === contractId);
    const hospital = hospitais.find((h) => h.id === contrato?.hospital_id)?.name ?? "—";
    const convenio = convenios.find((v) => v.id === contrato?.health_insurance_id)?.name ?? "—";
    return { hospital, convenio };
  }

  async function handleMarcarPago(id: string) {
    try {
      await repository.receivables.markPaid(id);
      notificarSucesso("Lançamento marcado como pago.");
    } catch (erro) {
      notificarErro("Não foi possível marcar como pago", erro);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Financeiro"
        description="Contas a receber por contrato, com status de pagamento rastreado de verdade."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Previsto — competência atual</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">
              R$ {totalMesAtual.toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Em aberto (pendente + atrasado)</p>
            <p className="mt-1 font-display text-2xl font-semibold text-attention-600">
              R$ {emAberto.toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Atrasado</p>
            <p className="mt-1 font-display text-2xl font-semibold text-critical-600">
              R$ {atrasado.toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contas a receber</CardTitle>
        </CardHeader>
        {recebiveis.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-ink-soft">
            Nenhum lançamento cadastrado ainda.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Hospital</th>
                  <th className="px-4 py-3 font-medium">Convênio</th>
                  <th className="px-4 py-3 font-medium">Competência</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {recebiveis
                  .slice()
                  .sort((a, b) => b.competencia.localeCompare(a.competencia))
                  .map((r) => {
                    const info = nomeContrato(r.contract_id);
                    return (
                      <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                        <td className="px-4 py-3 font-medium text-ink">{info.hospital}</td>
                        <td className="px-4 py-3 text-ink-soft">{info.convenio}</td>
                        <td className="px-4 py-3 text-ink-soft">{formatarCompetencia(r.competencia)}</td>
                        <td className="px-4 py-3 text-ink-soft">R$ {r.amount.toLocaleString("pt-BR")}</td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-soft">{formatarData(r.due_date)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusConfig[r.status].variant}>{statusConfig[r.status].label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.status !== "pago" && (
                            <Button variant="ghost" size="sm" onClick={() => handleMarcarPago(r.id)}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como pago
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
