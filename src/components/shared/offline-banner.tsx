import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Não é suporte offline de verdade (isso exigiria fila de ações pendentes e
 * sincronização — fora de escopo por ora). É uma rede de segurança mais
 * simples: avisa CLARAMENTE quando a conexão cai, pra ninguém preencher um
 * formulário inteiro sem saber que nada vai salvar até a internet voltar.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const marcarOnline = () => setOnline(true);
    const marcarOffline = () => setOnline(false);
    window.addEventListener("online", marcarOnline);
    window.addEventListener("offline", marcarOffline);
    return () => {
      window.removeEventListener("online", marcarOnline);
      window.removeEventListener("offline", marcarOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-critical-400 px-4 py-2 text-sm font-medium text-white">
      <WifiOff className="h-4 w-4" />
      Sem conexão com a internet — o que você preencher agora não será salvo até a conexão voltar.
    </div>
  );
}
