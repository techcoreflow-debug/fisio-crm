import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/app-store";
import { useCompanies, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { APP_NAME, APP_VERSION } from "@/lib/version";
import type { NotificationPreferences } from "@/types/domain";

const notificacoes: { chave: keyof NotificationPreferences; texto: string }[] = [
  { chave: "sem_evolucao_48h", texto: "Alertar sobre internações sem evolução clínica há mais de 48h" },
  { chave: "tasy_inconsistencias", texto: "Alertar sobre inconsistências em importações do Tasy" },
  { chave: "contratos_vencendo", texto: "Notificar vencimento de contratos nos próximos 90 dias" },
];

export default function Configuracoes() {
  const activeCompanyId = useAppStore((s) => s.activeCompanyId);
  const companies = useCompanies();
  const empresa = companies.find((c) => c.id === activeCompanyId) ?? companies[0];
  const [salvando, setSalvando] = useState(false);
  const [salvandoPreferencia, setSalvandoPreferencia] = useState<string | null>(null);

  async function handleSalvarDados(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!empresa) return;
    const form = new FormData(e.currentTarget);
    setSalvando(true);
    try {
      await repository.companies.update(empresa.id, {
        name: String(form.get("name") ?? ""),
        cnpj: String(form.get("cnpj") ?? "") || null,
      });
      notificarSucesso("Dados da empresa atualizados.");
    } catch (erro) {
      notificarErro("Não foi possível salvar os dados da empresa", erro);
    } finally {
      setSalvando(false);
    }
  }

  async function handleTogglePreferencia(chave: keyof NotificationPreferences, valor: boolean) {
    if (!empresa) return;
    setSalvandoPreferencia(chave);
    try {
      await repository.companies.update(empresa.id, {
        notification_preferences: { ...empresa.notification_preferences, [chave]: valor },
      });
    } catch (erro) {
      notificarErro("Não foi possível salvar a preferência", erro);
    } finally {
      setSalvandoPreferencia(null);
    }
  }

  async function handleToggleGlosaDetalhada(valor: boolean) {
    if (!empresa) return;
    setSalvandoPreferencia("glosa_por_procedimento");
    try {
      await repository.companies.update(empresa.id, { glosa_por_procedimento: valor });
      notificarSucesso(valor ? "Glosa por procedimento ativada." : "Glosa por competência ativada.");
    } catch (erro) {
      notificarErro("Não foi possível salvar", erro);
    } finally {
      setSalvandoPreferencia(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description="Configurações gerais da empresa ativa, marca e preferências." />

      <Card>
        <CardHeader>
          <CardTitle>Dados da empresa</CardTitle>
        </CardHeader>
        <form onSubmit={handleSalvarDados}>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Nome da empresa</Label>
                <Input id="name" name="name" required defaultValue={empresa?.name} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" name="cnpj" defaultValue={empresa?.cnpj ?? ""} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={salvando || !empresa}>
                {salvando ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {notificacoes.map((n) => (
            <label key={n.chave} className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={empresa?.notification_preferences?.[n.chave] ?? false}
                disabled={!empresa || salvandoPreferencia === n.chave}
                onChange={(e) => handleTogglePreferencia(n.chave, e.target.checked)}
                className="h-4 w-4 rounded border-line-strong accent-clinical-500 disabled:opacity-50"
              />
              {n.texto}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Glosa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={empresa?.glosa_por_procedimento ?? false}
              disabled={!empresa || salvandoPreferencia === "glosa_por_procedimento"}
              onChange={(e) => handleToggleGlosaDetalhada(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line-strong accent-clinical-500 disabled:opacity-50"
            />
            <span>
              Registrar glosa por procedimento
              <span className="mt-0.5 block text-xs text-ink-soft">
                Ligado: você marca a glosa em cada procedimento na Produção Diária, e a competência soma
                automaticamente no Financeiro. Desligado: você digita o valor glosado direto na conta a
                receber, sem detalhar procedimento a procedimento.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sobre o {APP_NAME}</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 text-sm text-ink-soft">
          {APP_NAME} v{APP_VERSION} · Um produto InovareTech · Autenticação e dados conectados ao Supabase
        </CardContent>
      </Card>
    </div>
  );
}
