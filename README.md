# inovare.fisio

Produto InovareTech. SaaS multiempresa para gestão operacional, assistencial, administrativa e financeira de empresas de fisioterapia hospitalar.

## Controle de versão

Versão atual em `src/lib/version.ts` (`APP_VERSION`) — aparece no login e
em Configurações. **Todo bump precisa de uma entrada em
[`CHANGELOG.md`](./CHANGELOG.md) na mesma entrega** — é isso que dá
controle real do que está em cada build. Ver o topo do changelog para o
processo e a regra de incremento.

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

## Deploy (Cloudflare Pages)

1. **Build command**: `npm run build` · **Output directory**: `dist`
2. **Settings → Environment variables** (Production *e* Preview): adicione
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. São variáveis do Vite —
   ficam embutidas no build; adicionar depois de já ter feito o deploy não
   tem efeito até rodar um novo build.
3. Depois de configurar as variáveis, **refaça o deploy** (um redeploy
   simples, sem precisar de novo commit).
4. `public/_redirects` já está no projeto (`/* /index.html 200`) — necessário
   para o roteamento client-side (React Router) funcionar em qualquer rota,
   não só na home.

Se a tela aparecer em branco, é quase sempre variável de ambiente ausente no
build: o app agora mostra uma tela de erro explicando isso em vez de travar
sem avisar (`src/lib/supabase.ts` + o guard em `src/App.tsx`).

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
