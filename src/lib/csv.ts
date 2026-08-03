/**
 * Exportação de relatórios em CSV.
 *
 * CSV em vez de PDF/XLSX de propósito: gera no próprio navegador, sem
 * dependência extra no bundle e sem servidor, e abre direto no Excel e no
 * Google Sheets — que é o destino real desses dados na operação. Se um dia
 * for preciso PDF com layout, aí sim entra uma lib dedicada.
 */

export type LinhaRelatorio = Record<string, string | number>;

import { hojeLocalIso } from "@/lib/data-local";

function escaparCampo(valor: string | number): string {
  const texto = String(valor ?? "");
  if (texto.includes(";") || texto.includes('"') || texto.includes("\n")) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

export function exportarCsv(nomeArquivo: string, linhas: LinhaRelatorio[]) {
  if (linhas.length === 0) {
    throw new Error("Não há dados para exportar neste relatório.");
  }

  const colunas = Object.keys(linhas[0]);
  // Separador ";" e BOM UTF-8: é o que o Excel em português abre
  // corretamente sem pedir configuração de importação.
  const conteudo = [
    colunas.join(";"),
    ...linhas.map((linha) => colunas.map((c) => escaparCampo(linha[c])).join(";")),
  ].join("\n");

  const blob = new Blob([`\uFEFF${conteudo}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeArquivo}-${hojeLocalIso()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
