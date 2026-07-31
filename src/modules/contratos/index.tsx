import { useMemo, useState, type FormEvent } from "react";
import { Search, Plus, Pencil, FileSignature } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DeleteButton } from "@/components/shared/delete-button";
import { useContracts, useHospitals, useHealthInsurances, useCostCenters, useUnits, useContractUnits, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { Contract } from "@/types/domain";

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function Contratos() {
  const contratos = useContracts();
  const hospitais = useHospitals();
  const convenios = useHealthInsurances();
  const centrosDeCusto = useCostCenters();
  const unidades = useUnits();
  const contratoUnidades = useContractUnits();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [hospitalId, setHospitalId] = useState(hospitais[0]?.id ?? "");
  const [temConvenio, setTemConvenio] = useState(false);
  const [convenioId, setConvenioId] = useState(convenios[0]?.id ?? "");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [aplicaTodasUnidades, setAplicaTodasUnidades] = useState(true);
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<string[]>([]);
  const [editando, setEditando] = useState<Contract | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return contratos;
    return contratos.filter((c) => {
      const hosp = hospitais.find((h) => h.id === c.hospital_id)?.name ?? "";
      const conv = convenios.find((v) => v.id === c.health_insurance_id)?.name ?? "";
      return hosp.toLowerCase().includes(termo) || conv.toLowerCase().includes(termo);
    });
  }, [busca, contratos, hospitais, convenios]);

  function abrirNovo() {
    setEditando(null);
    setHospitalId(hospitais[0]?.id ?? "");
    setTemConvenio(false);
    setConvenioId(convenios[0]?.id ?? "");
    setCentroCustoId("");
    setAplicaTodasUnidades(true);
    setUnidadesSelecionadas([]);
    setOpen(true);
  }

  function abrirEdicao(contrato: Contract) {
    setEditando(contrato);
    setHospitalId(contrato.hospital_id ?? "");
    setTemConvenio(Boolean(contrato.health_insurance_id));
    setConvenioId(contrato.health_insurance_id ?? "");
    setCentroCustoId(contrato.cost_center_id ?? "");
    setAplicaTodasUnidades(contrato.aplica_todas_unidades);
    setUnidadesSelecionadas(contratoUnidades.filter((cu) => cu.contract_id === contrato.id).map((cu) => cu.unit_id));
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const hospital = hospitais.find((h) => h.id === hospitalId);
    if (!hospital) return;
    const dados = {
      hospital_id: hospitalId,
      health_insurance_id: temConvenio ? convenioId || null : null,
      cost_center_id: centroCustoId || null,
      start_date: String(form.get("start_date") ?? ""),
      end_date: String(form.get("end_date") ?? "") || null,
      monthly_value: Number(form.get("monthly_value") ?? 0) || null,
      aplica_todas_unidades: aplicaTodasUnidades,
      company_id: hospital.company_id,
    };
    setSalvando(true);
    try {
      let contractId = editando?.id;
      if (editando) {
        await repository.contracts.update(editando.id, dados);
        notificarSucesso("Contrato atualizado(a).");
      } else {
        const criado = await repository.contracts.create(dados);
        contractId = criado.id;
        notificarSucesso("Contrato criado(a).");
      }
      if (contractId) {
        await repository.contractUnits.definirUnidades(contractId, hospital.company_id, aplicaTodasUnidades ? [] : unidadesSelecionadas);
      }
      setOpen(false);
      setEditando(null);
    } catch (erro) {
      notificarErro(editando ? "Não foi possível salvar as alterações" : "Não foi possível criar", erro);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contratos"
        description="Contratos entre as empresas do grupo, hospitais e convênios — vigência, escopo e valores."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="h-4 w-4" /> Novo contrato
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "novo"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar contrato" : "Novo contrato"}</SheetTitle>
                  <SheetDescription>Vincule um hospital a um convênio, com vigência e valor mensal.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Hospital</Label>
                    <Select value={hospitalId} onValueChange={setHospitalId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o hospital" />
                      </SelectTrigger>
                      <SelectContent>
                        {hospitais.map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2 rounded-md border border-line p-3">
                    <label className="flex items-start gap-2.5 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={temConvenio}
                        onChange={(e) => setTemConvenio(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-line-strong accent-clinical-500"
                      />
                      <span>
                        Este contrato tem um convênio específico
                        <span className="mt-0.5 block text-xs text-ink-soft">
                          Desmarcado: o contrato é direto com o hospital, cobrindo todos os atendimentos
                          (independente do convênio do paciente).
                        </span>
                      </span>
                    </label>
                    {temConvenio && (
                      <Select value={convenioId} onValueChange={setConvenioId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o convênio" />
                        </SelectTrigger>
                        <SelectContent>
                          {convenios.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Centro de custo (opcional)</Label>
                    <Select value={centroCustoId} onValueChange={setCentroCustoId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o centro de custo" />
                      </SelectTrigger>
                      <SelectContent>
                        {centrosDeCusto.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2 rounded-md border border-line p-3">
                    <label className="flex items-start gap-2.5 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={aplicaTodasUnidades}
                        onChange={(e) => setAplicaTodasUnidades(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-line-strong accent-clinical-500"
                      />
                      <span>
                        Aplica-se a todas as unidades deste hospital
                        <span className="mt-0.5 block text-xs text-ink-soft">
                          Desmarque se o contrato cobrir só alas específicas (ex.: só a UTI, não a Enfermaria).
                        </span>
                      </span>
                    </label>
                    {!aplicaTodasUnidades && (
                      <div className="mt-1 flex flex-col gap-1.5 border-t border-line pt-2">
                        {unidades.filter((u) => u.hospital_id === hospitalId).length === 0 ? (
                          <p className="text-xs text-ink-soft">Nenhuma unidade cadastrada para este hospital ainda.</p>
                        ) : (
                          unidades
                            .filter((u) => u.hospital_id === hospitalId)
                            .map((u) => (
                              <label key={u.id} className="flex items-center gap-2 text-sm text-ink">
                                <input
                                  type="checkbox"
                                  checked={unidadesSelecionadas.includes(u.id)}
                                  onChange={(e) =>
                                    setUnidadesSelecionadas((atual) =>
                                      e.target.checked ? [...atual, u.id] : atual.filter((id) => id !== u.id)
                                    )
                                  }
                                  className="h-4 w-4 rounded border-line-strong accent-clinical-500"
                                />
                                {u.name}
                              </label>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="start_date">Início da vigência</Label>
                      <Input id="start_date" name="start_date" type="date" required defaultValue={editando?.start_date ?? ""} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="end_date">Fim da vigência</Label>
                      <Input id="end_date" name="end_date" type="date" defaultValue={editando?.end_date ?? ""} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="monthly_value">Valor mensal (R$)</Label>
                    <Input id="monthly_value" name="monthly_value" type="number" step="0.01" placeholder="Ex.: 186000" defaultValue={editando?.monthly_value ?? ""} />
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={salvando || !hospitalId}>
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar contrato"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <Card>
        <div className="flex flex-col gap-4 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por hospital ou convênio…" className="pl-9" />
          </div>
          <p className="text-sm text-ink-soft">{filtrados.length} de {contratos.length} contratos</p>
        </div>

        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <FileSignature className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum contrato encontrado</p>
            <p className="text-sm text-ink-soft">Ajuste os termos da busca ou cadastre um novo contrato.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Hospital</th>
                  <th className="px-4 py-3 font-medium">Convênio</th>
                  <th className="px-4 py-3 font-medium">Escopo</th>
                  <th className="px-4 py-3 font-medium">Vigência</th>
                  <th className="px-4 py-3 font-medium">Valor mensal</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3 font-medium text-ink">{hospitais.find((h) => h.id === c.hospital_id)?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {c.health_insurance_id ? (
                        convenios.find((v) => v.id === c.health_insurance_id)?.name ?? "—"
                      ) : (
                        <Badge variant="neutral">Direto com hospital</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {c.aplica_todas_unidades ? (
                        <Badge variant="clinical">Todas as unidades</Badge>
                      ) : (
                        <Badge variant="neutral">
                          {contratoUnidades.filter((cu) => cu.contract_id === c.id).length} unidade(s)
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                      {formatarData(c.start_date)}{c.end_date ? ` – ${formatarData(c.end_date)}` : ""}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {c.monthly_value ? `R$ ${c.monthly_value.toLocaleString("pt-BR")}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.status === "ativo" ? "recovery" : "neutral"}>
                        {c.status === "ativo" ? "Ativo" : c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar contrato ${hospitais.find((h) => h.id === c.hospital_id)?.name ?? ""}`}
                          onClick={() => abrirEdicao(c)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton
                          itemLabel={`Contrato ${hospitais.find((h) => h.id === c.hospital_id)?.name ?? ""}`}
                          onConfirm={() => repository.contracts.remove(c.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
