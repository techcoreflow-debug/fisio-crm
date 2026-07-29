import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Activity,
  Wallet,
  Building2,
  Hospital,
  Landmark,
  MapPin,
  HeartHandshake,
  FileSignature,
  Users,
  Users2,
  DoorClosed,
  BedDouble,
  CalendarClock,
  UserRound,
  ListChecks,
  ClipboardList,
  NotebookPen,
  ShieldAlert,
  BarChart3,
  PieChart,
  Settings,
  KeyRound,
  Plug,
  UploadCloud,
  SlidersHorizontal,
} from "lucide-react";

export interface ModuleDef {
  slug: string;
  path: string;
  label: string;
  icon: LucideIcon;
  /** Curta descrição usada nos empty states das páginas ainda não construídas */
  description: string;
  status: "pronto" | "em-construcao";
}

export interface ModuleGroup {
  id: string;
  label: string;
  modules: ModuleDef[];
  /** Recolhido por padrão — grupos de configuração/cadastro esporádico,
   *  não o que se usa todo dia. Sempre expande sozinho se a rota ativa
   *  estiver dentro dele. */
  recolhidoPorPadrao?: boolean;
}

export const moduleGroups: ModuleGroup[] = [
  {
    id: "visao-geral",
    label: "Visão geral",
    modules: [
      {
        slug: "dashboard-executivo",
        path: "/",
        label: "Dashboard Executivo",
        icon: LayoutDashboard,
        description: "Indicadores estratégicos consolidados de todas as empresas, hospitais e contratos.",
        status: "pronto",
      },
      {
        slug: "dashboard-operacional",
        path: "/operacional",
        label: "Dashboard Operacional",
        icon: Activity,
        description: "Produção diária, ocupação de leitos, escalas e produtividade da equipe assistencial em tempo real.",
        status: "pronto",
      },
      {
        slug: "dashboard-financeiro",
        path: "/financeiro-dashboard",
        label: "Dashboard Financeiro",
        icon: Wallet,
        description: "Faturamento por convênio, glosas, inadimplência e margem por contrato.",
        status: "pronto",
      },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    recolhidoPorPadrao: true,
    modules: [
      { slug: "empresas", path: "/empresas", label: "Empresas", icon: Building2, description: "Empresas do grupo, cada uma com seus dados isolados por RLS multiempresa.", status: "pronto" },
      { slug: "hospitais", path: "/hospitais", label: "Hospitais", icon: Hospital, description: "Hospitais atendidos, contatos operacionais e unidades vinculadas.", status: "pronto" },
      { slug: "clinicas", path: "/clinicas", label: "Clínicas", icon: Landmark, description: "Clínicas próprias ou parceiras vinculadas às empresas do grupo.", status: "pronto" },
      { slug: "unidades", path: "/unidades", label: "Unidades", icon: MapPin, description: "Alas/setores dentro de cada hospital onde a equipe atua (ex.: UTI, Enfermaria).", status: "pronto" },
      { slug: "quartos", path: "/quartos", label: "Quartos", icon: DoorClosed, description: "Quartos dentro de cada ala/unidade do hospital, com um ou mais leitos.", status: "pronto" },
      { slug: "convenios", path: "/convenios", label: "Convênios", icon: HeartHandshake, description: "Convênios e operadoras, tabelas de procedimentos e regras de faturamento.", status: "pronto" },
      { slug: "contratos", path: "/contratos", label: "Contratos", icon: FileSignature, description: "Contratos com hospitais e convênios, vigência, escopo e valores.", status: "pronto" },
      { slug: "centros-de-custo", path: "/centros-de-custo", label: "Centros de Custo", icon: Wallet, description: "Centros de custo usados para organizar contratos e o financeiro por área.", status: "pronto" },
      { slug: "equipes", path: "/equipes", label: "Equipes", icon: Users2, description: "Equipes de fisioterapeutas, usadas em escalas e organização assistencial.", status: "pronto" },
    ],
  },
  {
    id: "assistencial",
    label: "Assistencial",
    modules: [
      { slug: "pacientes", path: "/pacientes", label: "Pacientes", icon: Users, description: "Cadastro de pacientes atendidos, histórico clínico e internações relacionadas.", status: "pronto" },
      { slug: "internacoes", path: "/internacoes", label: "Pacientes Internados", icon: BedDouble, description: "Pacientes internados acompanhados pela equipe, com leito, hospital e status de atendimento do dia.", status: "pronto" },
      { slug: "leitos", path: "/leitos", label: "Leitos", icon: BedDouble, description: "Mapa de leitos por ala e quarto, ocupação em tempo real e histórico de giro.", status: "pronto" },
      { slug: "escalas", path: "/escalas", label: "Escalas", icon: CalendarClock, description: "Escalas de trabalho dos fisioterapeutas por unidade e turno.", status: "pronto" },
      { slug: "fisioterapeutas", path: "/fisioterapeutas", label: "Fisioterapeutas", icon: UserRound, description: "Equipe assistencial, especialidades, produtividade e vínculos com unidades.", status: "pronto" },
      { slug: "procedimentos", path: "/procedimentos", label: "Procedimentos", icon: ListChecks, description: "Catálogo de procedimentos fisioterapêuticos e tabelas de referência por convênio.", status: "pronto" },
      { slug: "producao-diaria", path: "/producao-diaria", label: "Produção Diária", icon: ClipboardList, description: "Lançamento e conferência da produção assistencial diária, manual ou importada do Tasy.", status: "pronto" },
      { slug: "evolucao-clinica", path: "/evolucao-clinica", label: "Evolução Clínica", icon: NotebookPen, description: "Registro da evolução clínica do paciente ao longo do tratamento.", status: "pronto" },
    ],
  },
  {
    id: "financeiro-auditoria",
    label: "Financeiro & auditoria",
    modules: [
      { slug: "financeiro", path: "/financeiro", label: "Financeiro", icon: Wallet, description: "Faturamento, contas a receber por convênio/contrato e fechamento mensal.", status: "pronto" },
      { slug: "auditoria", path: "/auditoria", label: "Auditoria", icon: ShieldAlert, description: "Trilha de auditoria de lançamentos, importações e alterações sensíveis.", status: "pronto" },
    ],
  },
  {
    id: "inteligencia",
    label: "Inteligência",
    modules: [
      { slug: "painel-procedimentos", path: "/painel-procedimentos", label: "Painel de Procedimentos", icon: SlidersHorizontal, description: "Procedimentos lançados com filtros por período, unidade, convênio e categoria — cruza direto com glosa.", status: "pronto" },
      { slug: "relatorios", path: "/relatorios", label: "Relatórios", icon: BarChart3, description: "Relatórios operacionais, assistenciais e financeiros prontos para exportação.", status: "pronto" },
      { slug: "bi", path: "/bi", label: "Business Intelligence", icon: PieChart, description: "Análises avançadas e cruzamentos customizados entre todas as bases do Fisio.", status: "pronto" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    recolhidoPorPadrao: true,
    modules: [
      { slug: "importacao-tasy", path: "/importacao-tasy", label: "Importação Tasy", icon: UploadCloud, description: "Upload de arquivos do Tasy, prévia, validação e histórico de importações.", status: "pronto" },
      { slug: "usuarios-permissoes", path: "/usuarios-permissoes", label: "Usuários e Permissões", icon: KeyRound, description: "Usuários do sistema, papéis e permissões por empresa, hospital e módulo.", status: "pronto" },
      { slug: "integracoes", path: "/integracoes", label: "Integrações", icon: Plug, description: "Integrações externas além do Tasy: faturamento, comunicação e dados.", status: "pronto" },
      { slug: "configuracoes", path: "/configuracoes", label: "Configurações", icon: Settings, description: "Configurações gerais da empresa, marca, notificações e preferências.", status: "pronto" },
    ],
  },
];

export const allModules: ModuleDef[] = moduleGroups.flatMap((g) => g.modules);

/**
 * Perfil "fisioterapeuta" (lançador): só lança produção e cadastra
 * paciente — sem acesso ao resto do sistema (nem financeiro, nem
 * internações, nem cadastros administrativos). Admin InovareTech e outros
 * papéis (admin de empresa, gestor, financeiro, auditor) continuam vendo
 * tudo normalmente.
 */
export const SLUGS_LANCADOR = ["pacientes", "internacoes", "producao-diaria"];
export const ROTA_PADRAO_LANCADOR = "/internacoes";
