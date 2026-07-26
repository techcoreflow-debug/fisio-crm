import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useProfiles, useUnassignedProfiles, useCompanies, repository } from "@/data/repository";
import { useAuth } from "@/auth/auth-provider";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { UserRole } from "@/types/domain";

const papelConfig: Record<UserRole, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  admin: { label: "Admin", variant: "critical" },
  gestor: { label: "Gestor", variant: "clinical" },
  financeiro: { label: "Financeiro", variant: "attention" },
  fisioterapeuta: { label: "Fisioterapeuta", variant: "recovery" },
  auditor: { label: "Auditor", variant: "neutral" },
};

function iniciais(nome: string) {
  const partes = nome.trim().split(" ");
  return (partes[0]?.[0] ?? "?").concat(partes[1]?.[0] ?? "").toUpperCase();
}

export default function UsuariosPermissoes() {
  const perfis = useProfiles();
  const pendentes = useUnassignedProfiles().filter((p) => !p.is_platform_admin);
  const empresas = useCompanies();
  const { profile: meuPerfil } = useAuth();

  async function handleTrocarPapel(id: string, role: UserRole) {
    try {
      await repository.profiles.update(id, { role });
      notificarSucesso("Papel atualizado.");
    } catch (erro) {
      notificarErro("Não foi possível atualizar o papel", erro);
    }
  }

  async function handleAtribuirEmpresa(id: string, companyId: string) {
    try {
      await repository.profiles.update(id, { company_id: companyId });
      notificarSucesso("Usuário vinculado à empresa.");
    } catch (erro) {
      notificarErro("Não foi possível vincular à empresa", erro);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuários e Permissões"
        description="Usuários com acesso a esta empresa e seus papéis. Convite por e-mail ainda não está automatizado — quem se cadastra pelo app entra aqui."
      />

      {meuPerfil?.is_platform_admin && pendentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aguardando vínculo com uma empresa</CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">
              Criaram conta pelo app mas ainda não pertencem a nenhuma empresa — sem isso, não enxergam nada no sistema.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pendentes.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-md border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar>
                    <AvatarFallback>{iniciais(p.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-ink">{p.full_name}</p>
                    <p className="text-xs text-ink-soft">{p.email ?? "—"}</p>
                  </div>
                </div>
                <Select onValueChange={(v) => handleAtribuirEmpresa(p.id, v)}>
                  <SelectTrigger className="h-8 w-52">
                    <SelectValue placeholder="Vincular a uma empresa…" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        {perfis.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="font-medium text-ink">Nenhum usuário nesta empresa ainda</p>
            <p className="text-sm text-ink-soft">Assim que alguém criar conta vinculada a esta empresa, aparece aqui.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Papel</th>
                  <th className="px-4 py-3 font-medium">Desde</th>
                </tr>
              </thead>
              <tbody>
                {perfis.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar>
                          <AvatarFallback>{iniciais(p.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-ink">{p.full_name}</p>
                          <p className="text-xs text-ink-soft">{p.email ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.is_platform_admin ? (
                        <Badge variant="critical">Admin InovareTech</Badge>
                      ) : meuPerfil?.is_platform_admin || meuPerfil?.id === p.id ? (
                        <Select value={p.role} onValueChange={(v) => handleTrocarPapel(p.id, v as UserRole)}>
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(papelConfig).map(([valor, cfg]) => (
                              <SelectItem key={valor} value={valor}>{cfg.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={papelConfig[p.role].variant}>{papelConfig[p.role].label}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
