import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Link2Off, Loader2, QrCode, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/ui/password-input";
import { whatsapp, useWhatsappSettings } from "@/data/whatsapp";
import { rotuloEstadoConexao, formatarTelefone } from "@/lib/whatsapp";
import { notificarErro, notificarSucesso, notificarAviso } from "@/store/toast-store";

const URL_PADRAO = "https://evo.inovaretech.com";

interface Props {
  empresaId: string;
  podeAdministrar: boolean;
}

export function ConexaoWhatsapp({ empresaId, podeAdministrar }: Props) {
  const { config, carregando, recarregar } = useWhatsappSettings();

  const [url, setUrl] = useState(URL_PADRAO);
  const [instancia, setInstancia] = useState("");
  const [chave, setChave] = useState("");
  const [versao, setVersao] = useState<"v1" | "v2">("v2");
  const [ativo, setAtivo] = useState(false);
  const [delayMin, setDelayMin] = useState(5);
  const [delayMax, setDelayMax] = useState(12);
  const [limiteDiario, setLimiteDiario] = useState(150);
  const [salvando, setSalvando] = useState(false);

  const [qr, setQr] = useState<string | null>(null);
  const [codigoPareamento, setCodigoPareamento] = useState<string | null>(null);
  const [telefone, setTelefone] = useState("");
  const [conectando, setConectando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const jaPreencheu = useRef(false);

  useEffect(() => {
    if (!config || jaPreencheu.current) return;
    jaPreencheu.current = true;
    setUrl(config.evolution_url || URL_PADRAO);
    setInstancia(config.instance_name);
    setVersao(config.api_version);
    setAtivo(config.enabled);
    setDelayMin(config.delay_min_s);
    setDelayMax(config.delay_max_s);
    setLimiteDiario(config.daily_limit);
  }, [config]);

  const configurado = !!config && !!config.evolution_url && !!config.instance_name && config.api_key_set;
  const conectado = config?.connection_state === "open";

  async function verificarStatus(silencioso = false) {
    if (!configurado) return;
    setVerificando(true);
    try {
      const r = await whatsapp.status(empresaId);
      await recarregar();
      if (r.state === "open") {
        setQr(null);
        setCodigoPareamento(null);
      }
      if (!silencioso) notificarSucesso(r.state === "open" ? "WhatsApp conectado" : `Estado: ${rotuloEstadoConexao(r.state)}`);
    } catch (erro) {
      if (!silencioso) notificarErro("Não foi possível verificar a conexão", erro);
    } finally {
      setVerificando(false);
    }
  }

  // Enquanto o QR está na tela, confere a cada 4 s se a leitura já aconteceu.
  useEffect(() => {
    if (!qr && !codigoPareamento) return;
    const t = setInterval(() => void verificarStatus(true), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr, codigoPareamento, configurado]);

  async function handleSalvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await whatsapp.salvarConfig(empresaId, {
        evolutionUrl: url,
        instanceName: instancia,
        apiKey: chave || undefined,
        apiVersion: versao,
        enabled: ativo,
        delayMinS: delayMin,
        delayMaxS: delayMax,
        dailyLimit: limiteDiario,
      });
      setChave("");
      await recarregar();
      notificarSucesso("Configuração do WhatsApp salva");
    } catch (erro) {
      notificarErro("Não foi possível salvar", erro);
    } finally {
      setSalvando(false);
    }
  }

  async function handleConectar() {
    setConectando(true);
    try {
      const r = await whatsapp.conectar(empresaId, telefone || undefined);
      if (r.state === "open") {
        notificarSucesso("O WhatsApp já está conectado");
        await recarregar();
      } else if (r.qr || r.pairingCode) {
        setQr(r.qr ?? null);
        setCodigoPareamento(r.pairingCode ?? null);
      } else {
        notificarAviso("A Evolution não devolveu o QR agora", "Tente de novo em alguns segundos.");
      }
    } catch (erro) {
      notificarErro("Não foi possível gerar o QR Code", erro);
    } finally {
      setConectando(false);
    }
  }

  async function handleDesconectar() {
    if (!window.confirm("Desconectar o WhatsApp desta empresa? Os envios automáticos param até conectar de novo.")) return;
    try {
      await whatsapp.desconectar(empresaId);
      setQr(null);
      setCodigoPareamento(null);
      await recarregar();
      notificarSucesso("WhatsApp desconectado");
    } catch (erro) {
      notificarErro("Não foi possível desconectar", erro);
    }
  }

  if (carregando) return <p className="text-sm text-ink-soft">Carregando configuração…</p>;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Conexão</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Badge variant={conectado ? "recovery" : configurado ? "attention" : "neutral"}>
              {configurado ? rotuloEstadoConexao(config?.connection_state) : "Não configurado"}
            </Badge>
            {conectado && config?.connected_number && (
              <span className="text-sm text-ink-soft">Número {formatarTelefone(config.connected_number)}</span>
            )}
          </div>

          {!configurado && (
            <p className="text-sm text-ink-soft">
              Preencha a configuração ao lado e salve. Depois volte aqui para ler o QR Code com o WhatsApp do número da empresa.
            </p>
          )}

          {configurado && !conectado && !qr && !codigoPareamento && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="wa-tel">Número do WhatsApp (opcional, para código de pareamento)</Label>
              <Input id="wa-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(18) 99999-0000" />
            </div>
          )}

          {qr && (
            <div className="flex flex-col items-center gap-2 rounded-md border border-line bg-white p-4">
              <img src={qr} alt="QR Code para conectar o WhatsApp" className="h-56 w-56" />
              <p className="text-center text-sm text-ink-soft">
                No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho → ler este QR. Ele atualiza sozinho.
              </p>
            </div>
          )}
          {codigoPareamento && (
            <p className="rounded-md border border-line bg-surface-sunken p-3 text-center font-mono text-lg tracking-widest">
              {codigoPareamento}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {podeAdministrar && configurado && !conectado && (
              <Button onClick={handleConectar} disabled={conectando}>
                {conectando ? <Loader2 className="animate-spin" /> : <QrCode />}
                {qr || codigoPareamento ? "Gerar novo QR" : "Conectar por QR Code"}
              </Button>
            )}
            {configurado && (
              <Button variant="secondary" onClick={() => void verificarStatus()} disabled={verificando}>
                {verificando ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Verificar conexão
              </Button>
            )}
            {podeAdministrar && conectado && (
              <Button variant="secondary" onClick={handleDesconectar}>
                <Link2Off /> Desconectar
              </Button>
            )}
          </div>

          {conectado && !config?.enabled && (
            <p className="flex items-start gap-2 text-sm text-attention-600">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Conectado, mas o envio automático está desligado. Ative em "Envio automático" e salve.
            </p>
          )}
          {conectado && config?.enabled && (
            <p className="flex items-start gap-2 text-sm text-recovery-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Tudo pronto: as pesquisas pós-alta saem direto pelo WhatsApp da empresa.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuração da Evolution API</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSalvar} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wa-url">Endereço (https)</Label>
              <Input id="wa-url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={!podeAdministrar} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wa-inst">Nome da instância</Label>
              <Input id="wa-inst" value={instancia} onChange={(e) => setInstancia(e.target.value)} placeholder="fisio-suaempresa" disabled={!podeAdministrar} required />
              <p className="text-xs text-ink-soft">Uma instância por número. Letras, números, - e _.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wa-key">Chave da API {config?.api_key_set && <span className="text-recovery-600">(já salva)</span>}</Label>
              <PasswordInput
                id="wa-key"
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                placeholder={config?.api_key_set ? "deixe em branco para manter a atual" : "chave global da Evolution"}
                disabled={!podeAdministrar}
                autoComplete="off"
              />
              <p className="text-xs text-ink-soft">Fica guardada só no servidor — o navegador nunca volta a ler.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wa-dmin">Pausa mín. (s)</Label>
                <Input id="wa-dmin" type="number" min={1} max={120} value={delayMin} onChange={(e) => setDelayMin(Number(e.target.value))} disabled={!podeAdministrar} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wa-dmax">Pausa máx. (s)</Label>
                <Input id="wa-dmax" type="number" min={1} max={300} value={delayMax} onChange={(e) => setDelayMax(Number(e.target.value))} disabled={!podeAdministrar} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wa-lim">Limite/24 h</Label>
                <Input id="wa-lim" type="number" min={1} max={5000} value={limiteDiario} onChange={(e) => setLimiteDiario(Number(e.target.value))} disabled={!podeAdministrar} />
              </div>
            </div>
            <p className="text-xs text-ink-soft">
              A Evolution é uma API não oficial: pausas aleatórias e um limite diário baixo reduzem o risco de o número ser bloqueado.
            </p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} disabled={!podeAdministrar} />
                Envio automático ligado
              </label>
              <label className="flex items-center gap-2 text-sm">
                Versão
                <select
                  value={versao}
                  onChange={(e) => setVersao(e.target.value as "v1" | "v2")}
                  disabled={!podeAdministrar}
                  className="rounded-md border border-line-strong bg-surface-raised px-2 py-1 text-sm"
                >
                  <option value="v2">v2</option>
                  <option value="v1">v1</option>
                </select>
              </label>
            </div>
            {podeAdministrar ? (
              <Button type="submit" disabled={salvando} className="self-start">
                {salvando ? <Loader2 className="animate-spin" /> : <Save />} Salvar configuração
              </Button>
            ) : (
              <p className="text-sm text-ink-soft">Só administradores alteram a configuração.</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
