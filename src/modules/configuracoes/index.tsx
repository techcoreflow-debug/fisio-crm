import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/app-store";
import { useCompanies } from "@/data/repository";

export default function Configuracoes() {
  const activeCompanyId = useAppStore((s) => s.activeCompanyId);
  const companies = useCompanies();
  const empresa = companies.find((c) => c.id === activeCompanyId) ?? companies[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description="Configurações gerais da empresa ativa, marca e preferências." />

      <Card>
        <CardHeader>
          <CardTitle>Dados da empresa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-soft">Nome da empresa</label>
              <Input defaultValue={empresa?.name} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-soft">CNPJ</label>
              <Input defaultValue={empresa?.cnpj ?? ""} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm">Salvar alterações</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {[
            "Alertar sobre internações sem evolução clínica há mais de 48h",
            "Alertar sobre inconsistências em importações do Tasy",
            "Notificar vencimento de contratos nos próximos 90 dias",
          ].map((texto) => (
            <label key={texto} className="flex items-center gap-2.5 text-sm text-ink">
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-line-strong accent-clinical-500" />
              {texto}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sobre o Fisio</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 text-sm text-ink-soft">
          Versão 0.2 · Autenticação conectada ao Supabase — dados de cadastro ainda em memória (mock), migração tela a tela em andamento
        </CardContent>
      </Card>
    </div>
  );
}
