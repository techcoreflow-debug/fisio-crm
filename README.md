# Fisio

SaaS multiempresa para gestão operacional, assistencial, administrativa e financeira de empresas de fisioterapia hospitalar.

## Stack

- React + TypeScript + Vite + TailwindCSS v4 + Radix UI
- Supabase (Auth, Postgres com RLS, Storage, Edge Functions) — projeto próprio, conta separada
- Deploy: GitHub + Cloudflare Pages
- Gráficos: Recharts · Estado global leve: Zustand

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com o projeto Supabase do Fisio
npm run dev
```

## Estrutura

```
src/
  app/                 registro central de módulos e rotas (modules-registry.ts)
  components/ui/       design system (Button, Card, Badge, Input, Avatar, DropdownMenu…)
  components/layout/   Sidebar, Topbar, AppShell
  components/shared/   PageHeader, GoniometerGauge (KPI-assinatura), ModuleScaffold
  modules/<slug>/      uma pasta por módulo do sistema
  lib/                  cliente Supabase, utilitários
  store/                estado global (empresa ativa, tema, sidebar)
  types/database.ts     tipos do banco (placeholder até gerar via Supabase CLI)
supabase/migrations/    schema SQL com isolamento multiempresa via RLS
```

## Status dos módulos

Todos os 24 módulos do escopo estão implementados na camada de front-end, navegáveis e com
dados de exemplo (mock) — nenhum ainda está conectado ao Supabase. Isso inclui os 3 dashboards,
todos os cadastros, o fluxo assistencial completo (pacientes → internações → leitos → escalas →
fisioterapeutas → procedimentos → produção diária → evolução clínica), financeiro, auditoria,
relatórios, BI (com cruzamento interativo de dimensão x métrica), usuários/permissões,
integrações e configurações.

## Banco de dados

1. Crie um projeto novo no Supabase (conta própria do Fisio).
2. Rode as migrations em `supabase/migrations/` na ordem numérica, via SQL Editor ou
   `supabase db push`.
3. Gere os tipos definitivos:
   ```bash
   npx supabase gen types typescript --project-id <ID_DO_PROJETO> > src/types/database.ts
   ```
4. Preencha `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Identidade visual

Paleta clínica (teal + verde de recuperação + âmbar de atenção), tipografia Space Grotesk
(display) + Inter (corpo) + JetBrains Mono (dados). O elemento-assinatura é o **Arco de
Amplitude** (`GoniometerGauge`): todo KPI é lido como uma leitura de goniômetro, 0°–180°,
referenciando diretamente o instrumento central da avaliação fisioterapêutica.
