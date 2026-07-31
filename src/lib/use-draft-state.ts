import { useEffect, useState } from "react";

/**
 * Estado que sobrevive a um reload real da página — não é sobre ALT+TAB
 * (isso o navegador já resolve sozinho, a rota fica na URL), é sobre o
 * navegador/tablet DESCARTAR a aba em segundo plano por memória (comum em
 * tablet de hospital) e recarregar do zero ao voltar o foco. Sem isso, um
 * painel aberto com campos já preenchidos (ex.: "Nova internação" com
 * paciente e leito escolhidos) simplesmente some.
 *
 * Funciona como useState, mas espelha o valor em sessionStorage a cada
 * mudança e restaura automaticamente na montagem seguinte. `limpar()`
 * apaga o rascunho — chame ao salvar com sucesso ou ao cancelar, senão um
 * formulário fechado "ressuscita" preenchido na próxima vez que abrir.
 */
export function useDraftState<T>(chave: string, valorInicial: T): [T, (novo: T) => void, () => void] {
  const chaveCompleta = `fisio:rascunho:${chave}`;

  const [valor, setValor] = useState<T>(() => {
    try {
      const salvo = sessionStorage.getItem(chaveCompleta);
      return salvo ? (JSON.parse(salvo) as T) : valorInicial;
    } catch {
      return valorInicial;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(chaveCompleta, JSON.stringify(valor));
    } catch {
      // sessionStorage indisponível (modo privado, etc.) — degrada
      // graciosamente para o comportamento normal de useState, sem travar
      // a tela por causa disso.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  function limpar() {
    try {
      sessionStorage.removeItem(chaveCompleta);
    } catch {
      // ver comentário acima
    }
    setValor(valorInicial);
  }

  return [valor, setValor, limpar];
}
