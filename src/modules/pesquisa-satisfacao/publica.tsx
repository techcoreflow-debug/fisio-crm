import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Activity, CheckCircle2, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { PerguntaSatisfacao } from "@/types/domain";

/**
 * Página pública — SEM login, acessada por link com token (enviado por
 * e-mail/WhatsApp após a alta). Fala só com a Edge Function
 * `pesquisa-satisfacao`, nunca direto nas tabelas (evita expor RLS
 * anônimo, que vazaria pesquisas de todo mundo pra qualquer um).
 */
export default function PesquisaPublica() {
  const { token } = useParams<{ token: string }>();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [jaRespondida, setJaRespondida] = useState(false);
  const [nomeModelo, setNomeModelo] = useState("");
  const [perguntas, setPerguntas] = useState<PerguntaSatisfacao[]>([]);
  const [respostas, setRespostas] = useState<Record<string, unknown>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    async function buscar() {
      try {
        const { data, error } = await supabase.functions.invoke("pesquisa-satisfacao", { body: { action: "buscar", token } });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        if (data.jaRespondida) {
          setJaRespondida(true);
        } else {
          setNomeModelo(data.nome ?? "Pesquisa de satisfação");
          setPerguntas(data.perguntas ?? []);
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível abrir essa pesquisa.");
      } finally {
        setCarregando(false);
      }
    }
    if (token) buscar();
  }, [token]);

  async function handleEnviar() {
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("pesquisa-satisfacao", {
        body: { action: "responder", token, respostas },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar sua resposta.");
    } finally {
      setEnviando(false);
    }
  }

  const perguntasObrigatoriasRespondidas = perguntas
    .filter((p) => p.tipo !== "texto")
    .every((p) => respostas[p.id] !== undefined);

  return (
    <div className="flex min-h-screen flex-col items-center bg-surface px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-2 pb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-clinical-500 text-white">
          <Activity className="h-5 w-5" />
        </div>
        <span className="font-display text-lg font-semibold text-ink">inovare.fisio</span>
      </div>

      <div className="w-full max-w-md rounded-lg border border-line bg-surface-raised p-6 shadow-sm">
        {carregando ? (
          <div className="flex flex-col items-center gap-3 py-10 text-ink-soft">
            <Loader2 className="h-6 w-6 animate-spin" />
            Carregando…
          </div>
        ) : erro ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="font-medium text-ink">Não foi possível abrir essa pesquisa</p>
            <p className="text-sm text-ink-soft">{erro}</p>
          </div>
        ) : jaRespondida || enviado ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-recovery-500" />
            <p className="font-display font-semibold text-ink">Obrigado pela resposta!</p>
            <p className="text-sm text-ink-soft">
              {enviado ? "Sua avaliação foi registrada com sucesso." : "Essa pesquisa já foi respondida antes."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <p className="font-display font-semibold text-ink">{nomeModelo}</p>
              <p className="mt-1 text-sm text-ink-soft">Sua opinião ajuda a melhorar nosso atendimento.</p>
            </div>

            {perguntas.map((p) => (
              <div key={p.id} className="flex flex-col gap-2">
                <p className="text-sm font-medium text-ink">{p.texto}</p>
                {p.tipo === "nps" && (
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: 11 }, (_, n) => n).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRespostas((r) => ({ ...r, [p.id]: n }))}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium transition-colors",
                          respostas[p.id] === n
                            ? "border-clinical-500 bg-clinical-500 text-white"
                            : "border-line-strong text-ink-soft hover:bg-surface-sunken"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
                {p.tipo === "estrelas" && (
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setRespostas((r) => ({ ...r, [p.id]: n }))}>
                        <Star
                          className={cn(
                            "h-7 w-7",
                            typeof respostas[p.id] === "number" && (respostas[p.id] as number) >= n
                              ? "fill-attention-400 text-attention-400"
                              : "text-line-strong"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                )}
                {p.tipo === "texto" && (
                  <Textarea
                    rows={3}
                    value={(respostas[p.id] as string) ?? ""}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRespostas((r) => ({ ...r, [p.id]: e.target.value }))}
                    placeholder="Escreva aqui…"
                  />
                )}
              </div>
            ))}

            <Button onClick={handleEnviar} disabled={enviando || !perguntasObrigatoriasRespondidas}>
              {enviando ? "Enviando…" : "Enviar resposta"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
