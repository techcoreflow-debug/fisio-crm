import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Ditado por voz (Web Speech API do navegador, pt-BR). Sem backend nem
 * custo extra, mas depende do navegador (Chrome/Edge/Safari recentes) e,
 * no Chrome, o áudio é processado pelo serviço de reconhecimento do
 * próprio navegador — por isso o app avisa e o ditado nunca é obrigatório.
 */
interface ReconhecimentoVoz {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function criarReconhecimento(): ReconhecimentoVoz | null {
  const w = window as unknown as { SpeechRecognition?: new () => ReconhecimentoVoz; webkitSpeechRecognition?: new () => ReconhecimentoVoz };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function ditadoSuportado(): boolean {
  return typeof window !== "undefined" && criarReconhecimento() !== null;
}

/** `aoTexto` recebe cada trecho FINAL reconhecido, já pronto para anexar ao texto. */
export function useDitado(aoTexto: (trecho: string) => void, aoErro: (mensagem: string) => void) {
  const [ouvindo, setOuvindo] = useState(false);
  const ref = useRef<ReconhecimentoVoz | null>(null);
  const aoTextoRef = useRef(aoTexto);
  const aoErroRef = useRef(aoErro);
  aoTextoRef.current = aoTexto;
  aoErroRef.current = aoErro;

  const parar = useCallback(() => {
    ref.current?.stop();
  }, []);

  const iniciar = useCallback(() => {
    const rec = criarReconhecimento();
    if (!rec) {
      aoErroRef.current("Este navegador não suporta ditado por voz. Use o Chrome ou o Edge atualizados.");
      return;
    }
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) aoTextoRef.current(e.results[i][0].transcript.trim());
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") aoErroRef.current("Permita o uso do microfone no navegador para ditar.");
      else if (e.error !== "no-speech" && e.error !== "aborted") aoErroRef.current(`Não foi possível ditar (${e.error}).`);
    };
    rec.onend = () => setOuvindo(false);
    ref.current = rec;
    rec.start();
    setOuvindo(true);
  }, []);

  useEffect(() => () => ref.current?.stop(), []);

  return { ouvindo, iniciar, parar };
}
