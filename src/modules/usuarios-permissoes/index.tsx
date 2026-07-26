import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Papel = "admin" | "gestor" | "financeiro" | "fisioterapeuta" | "auditor";

interface UsuarioRow {
  nome: string;
  email: string;
  papel: Papel;
  empresas: string;
  ultimoAcesso: string;
}

const usuarios: UsuarioRow[] = [
  { nome: "By Finc", email: "byfinc@fisio.app", papel: "admin", empresas: "Todas", ultimoAcesso: "Agora" },
  { nome: "Ana Beatriz Correia", email: "ana.correia@fisio.app", papel: "fisioterapeuta", empresas: "Reab Hospitalar", ultimoAcesso: "Hoje, 09:41" },
  { nome: "Juliana Prado Andrade", papel: "gestor", email: "juliana.andrade@fisio.app", empresas: "Reab Hospitalar", ultimoAcesso: "Ontem, 18:20" },
  { nome: "Marcos Villela", email: "marcos.villela@fisio.app", papel: "financeiro", empresas: "Corpore Fisioterapia", ultimoAcesso: "há 3 dias" },
  { nome: "Renata Cabral", email: "renata.cabral@fisio.app", papel: "auditor", empresas: "Todas", ultimoAcesso: "há 1 semana" },
];

const papelConfig: Record<Papel, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  admin: { label: "Admin", variant: "critical" },
  gestor: { label: "Gestor", variant: "clinical" },
  financeiro: { label: "Financeiro", variant: "attention" },
  fisioterapeuta: { label: "Fisioterapeuta", variant: "recovery" },
  auditor: { label: "Auditor", variant: "neutral" },
};

function iniciais(nome: string) {
  const partes = nome.split(" ");
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default function UsuariosPermissoes() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuários e Permissões"
        description="Usuários do sistema, papéis e permissões por empresa, hospital e módulo."
        actions={
          <Button size="sm">
            <Plus className="h-4 w-4" /> Convidar usuário
          </Button>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Usuário</th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Empresas</th>
                <th className="px-4 py-3 font-medium">Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.email} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar>
                        <AvatarFallback>{iniciais(u.nome)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-ink">{u.nome}</p>
                        <p className="text-xs text-ink-soft">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={papelConfig[u.papel].variant}>{papelConfig[u.papel].label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{u.empresas}</td>
                  <td className="px-4 py-3 text-ink-soft">{u.ultimoAcesso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
