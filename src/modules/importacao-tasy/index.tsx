import { useState, type ChangeEvent } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Undo2, Loader2, HelpCircle, X, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useTasyImports, useTasyImportRowsPendentes, repository } from "@/data/repository";
import { useAppStore } from "@/store/app-store";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { parseTasyReport, resumirImportacao, type TasyParseResult } from "@/lib/tasy-parser";
import { exportarCsv } from "@/lib/csv";
import type { MotivoPendenciaTasy } from "@/types/domain";

const MOTIVO_LABEL: Record<MotivoPendenciaTasy, { label: string; variant: NonNullable<BadgeProps["variant"]>; dica: string }> = {
  internacao_nao_encontrada: {
    label: "Internação não encontrada",
    variant: "critical",
    dica: "O Nr. Atendimento do Tasy não bate com nenhuma internação cadastrada — provável erro de digitação no número, ou internação nunca criada.",
  },
  procedimento_nao_cadastrado: {
    label: "Procedimento não cadastrado",
    variant: "attention",
    dica: "O código de procedimento do Tasy não existe no cadastro de Procedimentos — cadastre esse código.",
  },
  lancamento_nao_encontrado: {
    label: "Falta lançar",
    variant: "clinical",
    dica: "A internação e o procedimento existem, mas ninguém lançou esse atendimento no sistema ainda — lance retroativamente.",
  },
};

const TODOS = "todos";

async function lerArquivoComoTextoLatin1(arquivo: File): Promise<string> {
  const buffer = await arquivo.arrayBuffer();
  return new TextDecoder("iso-8859-1").decode(buffer);
}

export default function ImportacaoTasy() {
  const historico = useTasyImports();
  const pendencias = useTasyImportRowsPendentes();
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const [filtroMotivo, setFiltroMotivo] = useState<MotivoPendenciaTasy | typeof TODOS>(TODOS);

  const pendenciasFiltradas = filtroMotivo === TODOS ? pendencias : pendencias.filter((p) => p.raw_data.motivo === filtroMotivo);

  function handleExportarPendencias() {
    exportarCsv(
      "pendencias-conciliacao-tasy",
      pendenciasFiltradas.map((p) => ({
        Data: p.raw_data.data.split("-").reverse().join("/"),
        "Nr. Atendimento": p.raw_data.referenciaExterna,
        Paciente: p.raw_data.paciente,
        Convênio: p.raw_data.convenio,
        "Código do procedimento": p.raw_data.procedimentoCodigo,
        Procedimento: p.raw_data.procedimentoNome,
        Motivo: p.raw_data.motivo ? MOTIVO_LABEL[p.raw_data.motivo].label : "—",
      }))
    );
  }

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [prevendo, setPrevendo] = useState(false);
  const [resultado, setResultado] = useState<TasyParseResult | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [modo, setModo] = useState<"conciliar" | "carga">("conciliar");

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
      if (modo === "carga") {
        const saida = await repository.tasyImports.processarComoCarga(empresaId, arquivo.name, texto);
        notificarSucesso(
          "Carga concluída",
          `${saida.totalInseridos} lançamento(s) criado(s)${saida.totalDuplicados > 0 ? ` · ${saida.totalDuplicados} já existiam` : ""}`
        );
      } else {
        const saida = await repository.tasyImports.processarArquivo(empresaId, arquivo.name, texto);
        const partes = [`${saida.confirmados} confirmado(s)`];
        if (saida.pendentes > 0) partes.push(`${saida.pendentes} sem lançamento correspondente (pendência)`);
        notificarSucesso("Conciliação concluída", partes.join(" · "));
      }
      handleTrocarArquivo();
    } catch (erro) {
      notificarErro(modo === "carga" ? "Não foi possível concluir a carga" : "Não foi possível concluir a conciliação", erro);
    } finally {
      setConfirmando(false);
    }
  }

  async function handleDesfazer(id: string) {
    try {
      await repository.tasyImports.undo(id);
      notificarSucesso("Conciliação desfeita — os lançamentos voltaram a não confirmados.");
    } catch (erro) {
      notificarErro("Não foi possível desfazer", erro);
    }
  }

  async function handleIgnorarPendencia(id: string) {
    try {
      await repository.tasyImportRows.ignorar(id);
      notificarSucesso("Pendência marcada como ignorada.");
    } catch (erro) {
      notificarErro("Não foi possível ignorar a pendência", erro);
    }
  }

  const resumo = resultado ? resumirImportacao(resultado.linhas) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conciliação Tasy"
        description="Confere o que a equipe já lançou manualmente contra o relatório do Tasy — não cria paciente, procedimento ou internação nenhum. O que bate com um lançamento existente (mesmo paciente, código e data) fica confirmado; o que não bate vira uma pendência para revisão."
      />

      <div className="flex items-start gap-2.5 rounded-md bg-clinical-50 px-4 py-3 text-sm text-clinical-700">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
        Lance o procedimento primeiro (em Pacientes Internados ou Produção Diária) — depois use esta tela para conferir contra o Tasy.
      </div>

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
                <p className="mt-1 text-sm text-ink-soft">Relatório "Produtividade Médica" exportado do Tasy — aceita .xls (TAB) ou .csv (vírgula)</p>
              </div>
            </label>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3 rounded-md border border-line bg-surface-sunken/60 p-3">
                <FileSpreadsheet className="h-5 w-5 text-clinical-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{arquivo.name}</p>
                  <p className="text-xs text-ink-soft">
                    {resumo ? `${resumo.totalLinhas} linhas reconhecidas` : "Processando…"}
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
                            <th className="px-3 py-2 font-medium">Nr. Atendimento</th>
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
                              <td className="px-3 py-2 font-mono text-xs text-ink-soft">{linha.referenciaExterna}</td>
                              <td className="px-3 py-2 text-ink">{linha.pacienteNome}</td>
                              <td className="px-3 py-2 text-ink-soft">{linha.convenioNome}</td>
                              <td className="px-3 py-2 text-ink-soft">
                                <span className="font-mono text-xs">{linha.procedimentoCodigo}</span> {linha.procedimentoNome}
                              </td>
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
                            <span className="font-mono text-xs">{codigo}</span>: {nomes.join(" / ")}
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

                  <div className="flex flex-col gap-2 rounded-md border border-line p-3">
                    <p className="text-sm font-medium text-ink">Como processar este arquivo?</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <label className={`flex-1 cursor-pointer rounded-md border p-3 text-sm ${modo === "conciliar" ? "border-clinical-500 bg-clinical-50" : "border-line"}`}>
                        <input type="radio" name="modo" className="mr-2" checked={modo === "conciliar"} onChange={() => setModo("conciliar")} />
                        <span className="font-medium text-ink">Conciliar com o que já foi lançado</span>
                        <span className="mt-1 block text-xs text-ink-soft">Padrão. Não cria nada — só confirma lançamentos já existentes.</span>
                      </label>
                      <label className={`flex-1 cursor-pointer rounded-md border p-3 text-sm ${modo === "carga" ? "border-attention-400 bg-attention-100" : "border-line"}`}>
                        <input type="radio" name="modo" className="mr-2" checked={modo === "carga"} onChange={() => setModo("carga")} />
                        <span className="font-medium text-ink">Carga inicial (criar tudo)</span>
                        <span className="mt-1 block text-xs text-ink-soft">
                          Cria hospital, convênio, paciente, procedimento e internação a partir do arquivo. Use pra
                          popular uma empresa nova — dá pra corrigir os cadastros depois.
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={handleTrocarArquivo} disabled={confirmando}>
                      Cancelar
                    </Button>
                    <Button onClick={handleConfirmar} disabled={confirmando} variant={modo === "carga" ? "destructive" : "primary"}>
                      {confirmando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {confirmando
                        ? modo === "carga" ? "Importando…" : "Conciliando…"
                        : modo === "carga" ? `Importar como carga (${resumo.totalLinhas} linhas)` : `Conciliar (${resumo.totalLinhas} linhas)`}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Pendências de conciliação ({pendenciasFiltradas.length})</CardTitle>
              <p className="text-sm text-ink-soft mt-0.5">
                Vieram no Tasy mas não bateram com nenhum lançamento existente. Cada uma mostra o motivo — não é
                tudo a mesma coisa, e a ação certa muda conforme o motivo.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filtroMotivo} onValueChange={(v) => setFiltroMotivo(v as typeof filtroMotivo)}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Todos os motivos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os motivos</SelectItem>
                  {Object.entries(MOTIVO_LABEL).map(([chave, cfg]) => (
                    <SelectItem key={chave} value={chave}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="secondary" size="sm" onClick={handleExportarPendencias} disabled={pendenciasFiltradas.length === 0}>
                <Download className="h-3.5 w-3.5" /> Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        {pendencias.length > 0 && (
          <CardContent className="flex flex-wrap gap-3 pb-0 pt-0">
            {Object.entries(MOTIVO_LABEL).map(([chave, cfg]) => {
              const qtd = pendencias.filter((p) => p.raw_data.motivo === chave).length;
              if (qtd === 0) return null;
              return (
                <button
                  key={chave}
                  type="button"
                  onClick={() => setFiltroMotivo(chave as MotivoPendenciaTasy)}
                  className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm hover:bg-surface-sunken"
                >
                  <Badge variant={cfg.variant}>{qtd}</Badge> {cfg.label}
                </button>
              );
            })}
          </CardContent>
        )}
        {pendenciasFiltradas.length === 0 ? (
          <CardContent className="py-8 text-center text-sm text-ink-soft">Nenhuma pendência no momento.</CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Nr. Atendimento</th>
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Convênio</th>
                  <th className="px-4 py-3 font-medium">Procedimento</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {pendenciasFiltradas.map((p) => {
                  const motivoCfg = p.raw_data.motivo ? MOTIVO_LABEL[p.raw_data.motivo] : null;
                  return (
                    <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                      <td className="px-4 py-3 font-mono text-xs text-ink-soft">{p.raw_data.data.split("-").reverse().join("/")}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-soft">{p.raw_data.referenciaExterna}</td>
                      <td className="px-4 py-3 font-medium text-ink">{p.raw_data.paciente}</td>
                      <td className="px-4 py-3 text-ink-soft">{p.raw_data.convenio}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        <span className="font-mono text-xs">{p.raw_data.procedimentoCodigo}</span> {p.raw_data.procedimentoNome}
                      </td>
                      <td className="px-4 py-3">
                        {motivoCfg && (
                          <Badge variant={motivoCfg.variant} title={motivoCfg.dica}>{motivoCfg.label}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleIgnorarPendencia(p.id)}>
                          <X className="h-3.5 w-3.5" /> Ignorar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de conciliações</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          {historico.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">Nenhuma conciliação ainda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-line">
              {historico.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{item.file_name}</p>
                    <p className="font-mono text-xs text-ink-soft">
                      {item.total_rows} linhas · {item.inconsistencies} pendência(s) ·{" "}
                      {new Date(item.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {item.status === "desfeita" ? (
                    <Badge variant="neutral">Desfeita</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleDesfazer(item.id)}>
                      <Undo2 className="h-4 w-4" /> Desfazer
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
