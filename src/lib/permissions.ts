import type { UserRole } from "@/types/domain";

export interface Permissao {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const TUDO: Permissao = { can_view: true, can_create: true, can_edit: true, can_delete: true };
const NADA: Permissao = { can_view: false, can_create: false, can_edit: false, can_delete: false };
const SO_VER: Permissao = { can_view: true, can_create: false, can_edit: false, can_delete: false };
const VER_E_LANCAR: Permissao = { can_view: true, can_create: true, can_edit: true, can_delete: false };

/** Módulos que o perfil fisioterapeuta (lançador) enxerga — o dia a dia dele. */
export const MODULOS_FISIOTERAPEUTA = ["minha-fila", "novo-atendimento", "pacientes", "internacoes", "producao-diaria"];

/** Módulos onde o perfil financeiro tem acesso completo. */
const MODULOS_FINANCEIRO_COMPLETO = ["financeiro", "faturamento", "fechamento", "painel-procedimentos", "relatorios", "contratos"];

/**
 * Módulos operacionais que o supervisor enxerga ALÉM do que o fisio
 * lançador já vê — painéis, dashboards e gestão de equipe/estrutura,
 * mas nada financeiro/faturamento.
 */
const MODULOS_SUPERVISOR_OPERACIONAL = [
  "painel-gestor",
  "dashboard-operacional",
  "impacto-assistencial",
  "leitos",
  "escalas",
  "evolucao-clinica",
  "fisioterapeutas",
  "procedimentos",
  "relatorios",
];

/**
 * Permissão padrão embutida — usada quando não existe uma linha em
 * `role_permissions` pra essa combinação de empresa+papel+módulo. Um admin
 * pode sobrescrever qualquer uma dessas na tela de Permissões.
 */
export function permissaoPadrao(role: UserRole, moduleSlug: string): Permissao {
  if (role === "admin") return TUDO;
  if (role === "auditor") return SO_VER;
  if (role === "fisioterapeuta") {
    return MODULOS_FISIOTERAPEUTA.includes(moduleSlug) ? VER_E_LANCAR : NADA;
  }
  if (role === "supervisor") {
    if (MODULOS_FISIOTERAPEUTA.includes(moduleSlug)) return VER_E_LANCAR;
    if (MODULOS_SUPERVISOR_OPERACIONAL.includes(moduleSlug)) return TUDO;
    return NADA; // nada de financeiro/faturamento, nem cadastros administrativos
  }
  if (role === "financeiro") {
    return MODULOS_FINANCEIRO_COMPLETO.includes(moduleSlug) ? TUDO : SO_VER;
  }
  return TUDO;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin de empresa",
  gestor: "Gestor",
  financeiro: "Financeiro",
  fisioterapeuta: "Fisioterapeuta (lançador)",
  auditor: "Auditor",
  supervisor: "Supervisor",
};

export const TODOS_OS_ROLES: UserRole[] = ["admin", "gestor", "financeiro", "fisioterapeuta", "supervisor", "auditor"];
