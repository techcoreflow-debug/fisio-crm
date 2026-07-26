import { useState } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTasyImports, useCompanies, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";

const previaLinhas = [
  { paciente: "Marina Salgado Costa", procedimento: "Fisioterapia respiratória", data: "22/07/2026", situacao: "novo" as const },
  { paciente: "José Everton Lima", procedimento: "Cinesioterapia motora", data: "22/07/2026", situacao: "atualizado" as const },
  { paciente: "Cecília Andrade Ferraz", procedimento: "Fisioterapia respiratória", data: "23/07/2026", situacao: "novo" as const },
  { paciente: "—", procedimento: "Código de convênio ausente", data: "23/07/2026", situacao: "inconsistencia" as const },
];

const situacaoConfig = {
  novo: { label: "Novo", variant: "recovery" as const },
  atualizado: { label: "Atualizado", variant: "clinical" as const },
  inconsistencia: { label: "Inconsistência", variant: "critical" as const },
};

export default function ImportacaoTasy() {
  const historico = useTasyImports();
  const empresas = useCompanies();
  const [arquivoCarregado, setArquivoCarregado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  async function handleConfirmar() {
    setConfirmando(true);
    try {
      await repository.tasyImports.create({
        file_name: "tasy_producao_2026-07-24.csv",
        total_rows: 493,
        inconsistencies: 1,
        company_id: empresas[0]?.id ?? "c1",
      });
      notificarSucesso("Importação concluída: 493 registros gravados.");
      setArquivoCarregado(false);
    } catch (erro) {
      notificarErro("Não foi possível concluir a importação", erro);
    } finally {
      setConfirmando(false);
    }
  }

  async function handleDesfazer(id: string) {
    try {
      await repository.tasyImports.undo(id);
      notificarSucesso("Importação desfeita.");
    } catch (erro) {
      notificarErro("Não foi possível desfazer a importação", erro);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Importação Tasy"
        description="Envie o arquivo exportado do Tasy. O Fisio reconhece o formato, valida os dados e mostra uma prévia antes de qualquer gravação."
      />

      <Card>
        <CardContent className="pt-6">
          {!arquivoCarregado ? (
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-line-strong bg-surface-sunken/60 px-6 py-14 text-center transition-colors hover:border-clinical-500 hover:bg-clinical-50">
              <input
                type="file"
                className="hidden"
                accept=".csv,.txt,.xls,.xlsx"
                onChange={() => setArquivoCarregado(true)}
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-clinical-50 text-clinical-600">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="font-display font-semibold text-ink">Arraste o arquivo do Tasy ou clique para selecionar</p>
                <p className="mt-1 text-sm text-ink-soft">Formatos aceitos: CSV, TXT, XLS, XLSX — reconhecimento automático do layout</p>
              </div>
            </label>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3 rounded-md border border-line bg-surface-sunken/60 p-3">
                <FileSpreadsheet className="h-5 w-5 text-clinical-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">tasy_producao_2026-07-24.csv</p>
                  <p className="text-xs text-ink-soft">2,4 MB · 494 linhas reconhecidas · layout Tasy identificado automaticamente</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setArquivoCarregado(false)}>
                  Trocar arquivo
                </Button>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Prévia antes de importar</p>
                <div className="overflow-x-auto rounded-md border border-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-surface-sunken text-left text-xs uppercase tracking-wide text-ink-soft">
                        <th className="px-3 py-2 font-medium">Paciente</th>
                        <th className="px-3 py-2 font-medium">Procedimento</th>
                        <th className="px-3 py-2 font-medium">Data</th>
                        <th className="px-3 py-2 font-medium">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previaLinhas.map((linha, i) => (
                        <tr key={i} className="border-b border-line last:border-0">
                          <td className="px-3 py-2 text-ink">{linha.paciente}</td>
                          <td className="px-3 py-2 text-ink-soft">{linha.procedimento}</td>
                          <td className="px-3 py-2 font-mono text-xs text-ink-soft">{linha.data}</td>
                          <td className="px-3 py-2">
                            <Badge variant={situacaoConfig[linha.situacao].variant}>
                              {situacaoConfig[linha.situacao].label}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md bg-attention-100 px-4 py-3 text-sm text-attention-600">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> 1 registro com inconsistência será ignorado — sem código de convênio.
                </span>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setArquivoCarregado(false)}>Cancelar</Button>
                <Button onClick={handleConfirmar} disabled={confirmando}>
                  <CheckCircle2 className="h-4 w-4" /> {confirmando ? "Importando…" : "Confirmar importação (493 registros)"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de importações</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <div className="flex flex-col divide-y divide-line">
            {historico.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">{item.file_name}</p>
                  <p className="font-mono text-xs text-ink-soft">
                    {item.id.slice(0, 8)} · {item.total_rows} registros · {item.inconsistencies} inconsistência(s) ·{" "}
                    {new Date(item.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                {item.status === "desfeita" ? (
                  <Badge variant="neutral">Desfeita</Badge>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => handleDesfazer(item.id)}>
                    <Undo2 className="h-4 w-4" /> Desfazer importação
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
