import { useEffect } from "react";

/**
 * Rede de segurança: bibliotecas de modal (Radix Dialog/Select/Popover)
 * bloqueiam clique no resto da página enquanto um modal está aberto,
 * setando `pointer-events: none` no `<body>`, e removem isso quando
 * fecham. Às vezes — sobretudo com Select dentro de Sheet — esse "remover"
 * não acontece, e a página inteira para de responder a clique sem
 * nenhum erro no console. Isso corrige sozinho: se depois de um tempo sem
 * nenhum modal/dialog/popover realmente aberto na tela o body ainda
 * estiver bloqueado, libera.
 */
export function usePointerEventsGuard() {
  useEffect(() => {
    const intervalo = setInterval(() => {
      const bloqueado = document.body.style.pointerEvents === "none";
      if (!bloqueado) return;
      const algumModalAberto = document.querySelector(
        '[data-state="open"][role="dialog"], [data-state="open"][role="listbox"], [data-state="open"][role="menu"]'
      );
      if (!algumModalAberto) {
        document.body.style.pointerEvents = "";
      }
    }, 400);
    return () => clearInterval(intervalo);
  }, []);
}
