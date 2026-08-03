import { useState, type FormEvent } from "react";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/auth/auth-provider";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { APP_NAME, APP_VERSION } from "@/lib/version";

export default function Login() {
  const { signInWithPassword, signUp } = useAuth();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [carregando, setCarregando] = useState(false);
  const [cadastroFeito, setCadastroFeito] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const senha = String(form.get("password") ?? "");

    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await signInWithPassword(email, senha);
        if (error) {
          notificarErro("Não foi possível entrar", error);
        }
      } else {
        const nomeCompleto = String(form.get("full_name") ?? "").trim();
        const { error } = await signUp(email, senha, nomeCompleto);
        if (error) {
          notificarErro("Não foi possível criar a conta", error);
        } else {
          notificarSucesso("Conta criada.");
          setCadastroFeito(true);
        }
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-clinical-500 text-white">
            <Activity className="h-6 w-6" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight text-ink">{APP_NAME}</span>
          <p className="text-sm text-ink-soft">Gestão de fisioterapia hospitalar</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {cadastroFeito ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="font-display font-semibold text-ink">Confirme seu e-mail</p>
                <p className="text-sm text-ink-soft">
                  Enviamos um link de confirmação. Depois de confirmar, volte aqui e entre normalmente.
                </p>
                <Button variant="secondary" size="sm" onClick={() => { setModo("entrar"); setCadastroFeito(false); }}>
                  Voltar para o login
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-5 flex rounded-md bg-surface-sunken p-1">
                  <button
                    type="button"
                    onClick={() => setModo("entrar")}
                    className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${modo === "entrar" ? "bg-surface-raised text-ink shadow-sm" : "text-ink-soft"}`}
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setModo("cadastrar")}
                    className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${modo === "cadastrar" ? "bg-surface-raised text-ink shadow-sm" : "text-ink-soft"}`}
                  >
                    Criar conta
                  </button>
                </div>

                <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                  {modo === "cadastrar" && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="full_name">Nome completo</Label>
                      <Input id="full_name" name="full_name" required placeholder="Seu nome" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" name="email" type="email" required placeholder="voce@empresa.com" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="password">Senha</Label>
                    <PasswordInput id="password" name="password" required minLength={6} placeholder="Mínimo 6 caracteres" />
                  </div>
                  <Button type="submit" disabled={carregando} className="mt-1">
                    {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {modo === "entrar" ? "Entrar" : "Criar conta"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-ink-soft">
          Um produto <span className="font-medium text-ink-soft">InovareTech</span> · v{APP_VERSION}
        </p>
      </div>
    </div>
  );
}
