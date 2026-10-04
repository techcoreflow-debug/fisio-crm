import { useAuth } from "@/auth/auth-provider";
import { useRolePermissions } from "@/data/repository";
import { permissaoPadrao } from "@/lib/permissions";

/** Mesma regra de permissão usada na sidebar e nas rotas: override do admin > padrão do papel. */
export function usePodeVerModulo(): (slug: string) => boolean {
  const { profile } = useAuth();
  const permissoes = useRolePermissions();
  return (slug: string) => {
    if (!profile) return false;
    if (profile.is_platform_admin) return true;
    const linha = permissoes.find((p) => p.role === profile.role && p.module_slug === slug);
    return linha ? linha.can_view : permissaoPadrao(profile.role, slug).can_view;
  };
}
