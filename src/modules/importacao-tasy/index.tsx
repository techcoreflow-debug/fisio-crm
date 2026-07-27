import { useState, type ChangeEvent } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Undo2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTasyImports, repository } from "@/data/repository";
import { useAppStore } from "@/store/app-store";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { parseTasyReport, resumirImportacao, type TasyParseResult } from "@/lib/tasy-parser";

async function lerArquivoComoTextoLatin1(arquivo: File): Promise<string> {
  const buffer = await arquivo.arrayBuffer();
  return new TextDecoder("iso-8859-1").decode(buffer);
}

export default function ImportacaoTasy() {
  const historico = useTasyImports();
  const empresaId = useAppStore((s) => s.activeCompanyId);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [prevendo, setPrevendo] = useState(false);
  const [resultado, setResultado] = useState<TasyParseResult | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  async function handleSelecionarArquivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivo(file);
    setPrevendo(true);
    setResultado(null);
    try {
      const texto = await lerArquivoComoTextoLatin1(file);
      const parse = parseTasyReport(texto);
      if (parse.linhas.length === 0) {
        notificarErro(
          "Nenhuma linha reconhecida",
          "Confira se o arquivo é uma exportação \"Produtividade Médica\" do Tasy — o formato não bateu com o esperado."
        );
        setArquivo(null);
        return;
      }
      setResultado(parse);
    } catch (erro) {
      notificarErro("Não foi possível ler o arquivo", erro);
      setArquivo(null);
    } finally {
      setPrevendo(false);
    }
  }

  function handleTrocarArquivo() {
    setArquivo(null);
    setResultado(null);
  }

  async function handleConfirmar() {
    if (!arquivo || !resultado || !empresaId) return;
    setConfirmando(true);
    try {
      const texto = await lerArquivoComoTextoLatin1(arquivo);
      const saida = await repository.tasyImports.processarArquivo(empresaId, arquivo.name, texto);
      const partes = [`${saida.totalInseridos} novo(s) lançamento(s) de produção`];
      if (saida.totalDuplicados > 0) partes.push(`${saida.totalDuplicados} já existente(s), ignorado(s)`);
      notificarSucesso("Importação concluída", partes.join(" · "));
      handleTrocarArquivo();
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

  const resumo = resultado ? resumirImportacao(resultado.linhas) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Importação Tasy"
        description="Envie o arquivo exportado do Tasy (Produtividade Médica). O Fisio reconhece o formato, resolve hospital/convênio/fisioterapeuta/paciente/procedimento automaticamente e nunca duplica um lançamento já importado."
      />

      <Card>
        <CardContent className="pt-6">
          {!arquivo ? (
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-line-strong bg-surface-sunken/60 px-6 py-14 text-center transition-colors hover:border-clinical-500 hover:bg-clinical-50">
              <input type="file" className="hidden" accept=".xls,.xlsx,.csv,.txt" onChange={handleSelecionarArquivo} />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-clinical-50 text-clinical-600">
                {prevendo ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
              </div>
              <div>
                <p className="font-display font-semibold text-ink">
                  {prevendo ? "Lendo arquivo…" : "Arraste o arquivo do Tasy ou clique para selecionar"}
                </p>
                <p className="mt-1 text-sm text-ink-soft">Relatório "Produtividade Médica" exportado do Tasy (.xls)</p>
              </div>
            </label>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3 rounded-md border border-line bg-surface-sunken/60 p-3">
                <FileSpreadsheet className="h-5 w-5 text-clinical-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{arquivo.name}</p>
                  <p className="text-xs text-ink-soft">
                    {resumo ? `${resumo.totalLinhas} linhas de produção reconhecidas` : "Processando…"}
                    {resultado?.periodoTexto ? ` · período: ${resultado.periodoTexto}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleTrocarArquivo} disabled={confirmando}>
                  Trocar arquivo
                </Button>
              </div>

              {resumo && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      ["Hospitais", resumo.hospitais.size],
                      ["Convênios", resumo.convenios.size],
                      ["Fisioterapeutas", resumo.fisioterapeutas.size],
                      ["Pacientes", resumo.pacientes.size],
                      ["Internações (Nr. Atend.)", resumo.internacoes.size],
                      ["Procedimentos distintos", resumo.procedimentos.size],
                    ].map(([rotulo, valor]) => (
                      <div key={rotulo as string} className="rounded-md border border-line p-3">
                        <p className="text-xs uppercase tracking-wide text-ink-soft">{rotulo}</p>
                        <p className="font-display text-lg font-semibold text-ink">{valor}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-ink">Prévia (10 primeiras linhas)</p>
                    <div className="overflow-x-auto rounded-md border border-line">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-line bg-surface-sunken text-left text-xs uppercase tracking-wide text-ink-soft">
                            <th className="px-3 py-2 font-medium">Data</th>
                            <th className="px-3 py-2 font-medium">Paciente</th>
                            <th className="px-3 py-2 font-medium">Convênio</th>
                            <th className="px-3 py-2 font-medium">Procedimento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultado!.linhas.slice(0, 10).map((linha, i) => (
                            <tr key={i} className="border-b border-line last:border-0">
                              <td className="px-3 py-2 font-mono text-xs text-ink-soft">
                                {linha.dataProducao.split("-").reverse().join("/")}
                              </td>
                              <td className="px-3 py-2 text-ink">{linha.pacienteNome}</td>
                              <td className="px-3 py-2 text-ink-soft">{linha.convenioNome}</td>
                              <td className="px-3 py-2 text-ink-soft">{linha.procedimentoNome}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {resumo.codigosComDescricaoDivergente.size > 0 && (
                    <div className="rounded-md bg-attention-100 px-4 py-3 text-sm text-attention-600">
                      <p className="flex items-center gap-2 font-medium">
                        <AlertTriangle className="h-4 w-4" /> Códigos com descrição divergente no arquivo
                      </p>
                      <ul className="mt-1.5 list-disc pl-5">
                        {[...resumo.codigosComDescricaoDivergente.entries()].map(([codigo, nomes]) => (
                          <li key={codigo}>
                            <span className="font-mono text-xs">{codigo}</span>: {nomes.join(" / ")} — será usado o primeiro nome encontrado.
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {resultado!.avisos.length > 0 && (
                    <div className="rounded-md bg-surface-sunken px-4 py-3 text-xs text-ink-soft">
                      {resultado!.avisos.length} linha(s) do arquivo foram ignoradas (rodapé de página ou formato
                      inesperado) — nenhuma delas era um lançamento de produção.
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={handleTrocarArquivo} disabled={confirmando}>
                      Cancelar
                    </Button>
                    <Button onClick={handleConfirmar} disabled={confirmando}>
                      {confirmando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {confirmando ? "Importando…" : `Confirmar importação (${resumo.totalLinhas} linhas)`}
                    </Button>
                  </div>
                </>
              )}
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
          {historico.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">Nenhuma importação ainda.</p>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
