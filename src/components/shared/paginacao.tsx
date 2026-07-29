import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginacaoProps {
  paginaAtual: number;
  totalPaginas: number;
  onChange: (pagina: number) => void;
  totalItens: number;
  itensPorPagina: number;
}

/**
 * Paginação simples client-side. As listas já vêm inteiras do Supabase
 * (empresas pequenas, algumas centenas de linhas) — isso só corta o
 * RENDER em páginas pra tabela não crescer sem fim na tela. Quando o
 * volume justificar paginação de verdade no servidor (`.range()` do
 * Supabase), essa troca fica isolada no repository, sem mexer aqui.
 */
export function Paginacao({ paginaAtual, totalPaginas, onChange, totalItens, itensPorPagina }: PaginacaoProps) {
  if (totalPaginas <= 1) return null;

  const inicio = (paginaAtual - 1) * itensPorPagina + 1;
  const fim = Math.min(paginaAtual * itensPorPagina, totalItens);

  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
      <p className="text-ink-soft">
        {inicio}–{fim} de {totalItens}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          disabled={paginaAtual === 1}
          onClick={() => onChange(paginaAtual - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-ink-soft">
          {paginaAtual} / {totalPaginas}
        </span>
        <Button
          variant="ghost"
          size="icon"
          disabled={paginaAtual === totalPaginas}
          onClick={() => onChange(paginaAtual + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function usarPaginacao<T>(itens: T[], itensPorPagina: number, paginaAtual: number) {
  const totalPaginas = Math.max(1, Math.ceil(itens.length / itensPorPagina));
  const paginaValida = Math.min(paginaAtual, totalPaginas);
  const inicio = (paginaValida - 1) * itensPorPagina;
  const pagina = itens.slice(inicio, inicio + itensPorPagina);
  return { pagina, totalPaginas, paginaValida };
}
