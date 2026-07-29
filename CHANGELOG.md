# Changelog — inovare.fisio

Todo bump de versão em `src/lib/version.ts` (e `package.json`) precisa de
uma entrada aqui, na mesma entrega. É isso que dá controle real do que
está em cada build — sem isso, "v0.5.0" é só um número sem significado.

## Como usar isto

Antes de subir um deploy:
1. Decida o número da próxima versão (regra abaixo).
2. Atualize `APP_VERSION` em `src/lib/version.ts` **e** `version` em
   `package.json` — os dois sempre juntos, nunca só um.
3. Adicione uma entrada nova aqui, no topo, com data e o que mudou.
4. Só then gera o build final e entrega.

**Regra de incremento (semver simplificado, enquanto pré-1.0):**
- **Patch** (0.5.**1**): correção de bug, ajuste visual, sem mudar comportamento.
- **Minor** (0.**6**.0): funcionalidade nova ou mudança de fluxo que o usuário percebe.
- **1.0.0**: quando sair do piloto controlado para uso geral sem supervisão direta.

---

## v0.5.3 — 29/07/2026

- Fisioterapeuta lançador ganhou acesso a **Pacientes Internados** (antes
  só via Pacientes + Produção Diária) — a tela evoluiu pra ter filtro por
  unidade, indicador de pendência do dia e lançamento direto, ficando
  melhor que o fluxo antigo. Rota inicial dele também passou a ser essa
  tela em vez de Produção Diária.
- Mas o acesso é **só de leitura + lançar procedimento**: "Nova
  internação", "Editar" e "Dar alta" continuam escondidos pra esse papel
  — são ações administrativas fora do escopo original ("apenas lançar e
  cadastrar").

---

## v0.5.2 — 29/07/2026

- **Rascunho persistido** no formulário de internação (`src/lib/use-draft-state.ts`):
  o painel "Nova/Editar internação" agora sobrevive a um reload real da
  aba (comum em tablet, quando o navegador descarta abas em segundo
  plano por memória) — reabre exatamente com o que estava preenchido.
  Isso é diferente do bug de ALT+TAB já corrigido antes (aquele era o
  app inteiro remontando por causa do refresh de token; este é sobre a
  aba realmente recarregar do zero). Aplicado só em Internações por
  enquanto — dá pra estender pros outros formulários do sistema.

---

## v0.5.1 — 29/07/2026

- Módulo "Internações" renomeado para **"Pacientes Internados"** — a
  empresa de fisio acompanha o paciente internado, não interna ninguém;
  o nome anterior dava a entender o contrário. Troca só de texto (menu,
  título da página, estado vazio), banco e rotas continuam iguais.
- **Lançar procedimento direto da lista de Pacientes Internados** — novo
  botão por linha abre um formulário rápido (fisioterapeuta, procedimento,
  data) sem precisar navegar até Produção Diária e procurar o paciente de
  novo no seletor.

---

## v0.5.0 — 29/07/2026 — *"Pronto para piloto"*

Primeira versão liberada para teste real com a equipe.

**Usabilidade (avaliação UX/PO antes do piloto):**
- Combobox pesquisável substituindo o seletor de internação em Produção
  Diária — só mostra pacientes ativos, busca por nome/unidade.
- Paginação (25/página) em Pacientes, Internações e Produção Diária.
- Banner de aviso quando a conexão cai.
- Menu lateral recolhível — Cadastros/Sistema começam fechados, expandem
  sozinhos na rota ativa.
- Indicador "Lançado/Pendente" de atendimento do dia em Internações, com
  filtro rápido "só pendentes de hoje".

**Ajustes de uso real (levantados pela operação):**
- Perfil "fisioterapeuta" (lançador): acesso restrito a só Pacientes e
  Produção Diária.
- Paciente: sexo, convênio com histórico real de mudança, linha do tempo
  (internações, altas, procedimentos, evoluções em ordem cronológica).
- Internação: código legível (`IN-000123`), edição habilitada, alta com
  data/hora exata e **bloqueio** se não houver procedimento lançado no dia
  (com fluxo pra lançar na hora ou confirmar "sem atendimento").
- Contrato: escopo por todas as unidades do hospital ou só alas específicas.
- Correção de bug: refresh automático de token do Supabase (ao voltar de
  ALT+TAB) estava recarregando a tela inteira e perdendo formulários
  abertos.

**Painel de Procedimentos (novo módulo):**
- Filtros por período, hospital, unidade, convênio, fisioterapeuta,
  categoria e status de glosa; KPIs, 3 gráficos e tabela exportável.

**Glosa:**
- Parâmetro por empresa: modo detalhado (por procedimento, soma automática
  na competência) ou manual (direto na conta a receber).
- Financeiro e Dashboard Financeiro mostram valor líquido e taxa de glosa real.

**Importação Tasy (parser real):**
- Lê o relatório "Produtividade Médica" (texto tab-separado, não binário
  Excel) — testado contra arquivo real do cliente.
- Busca-ou-cria hospital/convênio/fisioterapeuta/paciente/procedimento sem
  duplicar; agrupa por "Nr. Atend." como internação; grava produção com
  referência única (reimportar não duplica).

**Banco de dados real:**
- Autenticação via Supabase Auth; dois níveis de acesso (admin InovareTech
  global vs. admin de empresa); todas as 21 entidades migradas do mock
  para consultas reais com Realtime.
- Correção de bugs de infraestrutura: `GRANT` de tabela nunca concedido ao
  role `authenticated` (causava 403 em tudo); colisão de canal Realtime
  entre múltiplas telas usando o mesmo hook (derrubava a página).

**Identidade:**
- Rebranding para "inovare.fisio", paleta azul InovareTech, versão exibida
  no login.

---

## v0.4.0 e anteriores — histórico pré-controle-de-versão

Tudo construído antes deste changelog existir, reconstruído de memória:

- Estrutura completa do SaaS (26 módulos): cadastros (empresas, hospitais,
  clínicas, unidades, quartos, convênios, contratos, centros de custo,
  equipes), assistencial (pacientes, internações, leitos, escalas,
  fisioterapeutas, procedimentos, produção diária, evolução clínica),
  financeiro (contas a receber, auditoria), inteligência (relatórios, BI).
- Dashboards Executivo, Operacional e Financeiro.
- Sistema de design próprio (paleta clínica original, depois trocada pela
  azul InovareTech), goniômetro como elemento-assinatura visual.
- Camada de dados mock (Zustand) com validação de integridade referencial,
  depois totalmente substituída pelo Supabase real.
- Exportação CSV em Relatórios.
