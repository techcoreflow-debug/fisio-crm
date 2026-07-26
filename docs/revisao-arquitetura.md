# Revisão de arquitetura — Fisio

Estado do projeto antes da conexão com o Supabase.

## O que está bem resolvido

**Camada de dados isolada.** Nenhuma tela conhece a origem dos dados: todas
consomem `use*()` e `repository.*` (`src/data/repository.ts`). Trocar o mock
pelo Supabase muda só esse arquivo — 26 dos 28 módulos não precisam ser
tocados. Os dois que faltam (Usuários/Permissões e Integrações) dependem de
autenticação real, não de teimosia.

**Tipos espelham o banco.** `src/types/domain.ts` usa snake_case e os mesmos
nomes de coluna das migrations. Quando o Supabase gerar os tipos oficiais, a
troca é direta, sem camada de tradução.

**Isolamento multiempresa testado antes do banco.** Todo hook filtra pela
empresa ativa — a mesma regra que a RLS vai aplicar no Postgres. Se houver
vazamento entre empresas, aparece agora, não em produção.

**Erros nunca silenciosos.** Toda gravação passa por try/catch com toast, e as
exclusões validam integridade referencial com mensagem específica do que está
bloqueando. Isso já está no formato que as constraints do Postgres vão
devolver depois.

**Code-splitting por rota.** Cada módulo é um chunk próprio; o bundle inicial
ficou em ~114 kB gzip. Recharts (99 kB gzip) só carrega ao abrir um dashboard.

## Correções feitas nesta revisão

**Re-render global desnecessário (importante).** Os seletores do Zustand v5
usavam `.filter()` direto, que devolve um array novo a cada chamada — o
resultado é que qualquer escrita em qualquer parte do store fazia *todas* as
telas re-renderizarem. Com a base pequena isso não aparece; com milhares de
registros e vários usuários, vira lentidão difícil de diagnosticar. Todos os
seletores agora usam `useShallow`.

**Recálculo em cascata nos Relatórios.** Cada card recalculava seu dataset
inteiro a cada render só para mostrar a contagem de linhas. Memoizado.

## Riscos e pontos de atenção

**`mock-store.ts` tem 642 linhas.** É o maior arquivo do projeto e concentra
seed + regras de validação. Não vale quebrar agora: ele desaparece quando o
Supabase entrar, e as validações migram para constraints do banco. Se por
algum motivo o mock sobreviver como ambiente de testes, aí sim vale dividir
por entidade.

**Validação só no cliente.** Hoje as regras de integridade vivem no
`mock-store.ts`. No banco real elas precisam existir como FK, `unique` e
`check` — não como código de front. O front deve capturar e traduzir o erro do
Postgres, nunca ser a única linha de defesa.

**Sem testes automatizados.** O build e o `tsc` pegam erro de tipo, não erro de
regra de negócio. Antes de ir para produção vale cobrir pelo menos: alta libera
leito, exclusão bloqueada por dependência, e isolamento entre empresas.

**Paginação inexistente.** Todas as listas renderizam tudo. Com centenas de
pacientes ou milhares de lançamentos de produção, as tabelas vão pesar. A
solução natural é paginar no servidor (`.range()` do Supabase) — por isso não
foi resolvido no mock: implementar paginação em memória seria trabalho jogado
fora.

**Datas como string.** Funciona e evita fuso horário no mock, mas quando o
Supabase entrar vale padronizar o parsing num único lugar em vez de
`split("-")` espalhado.

## Veredito

A fundação está sólida para crescer: a separação de camadas é real (não
decorativa), o design system é consistente, o isolamento multiempresa já é
testável, e o tratamento de erro é sério. Os pontos abertos — testes,
paginação, validação no banco — são todos coisas que se resolvem melhor
*depois* que o Supabase existir, não antes.
