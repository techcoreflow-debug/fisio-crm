# Mapeamento de dados — do mock ao Supabase real

Este documento existe para não perder o fio de como os dados fluem no Fisio.
**Desde a migration 0010, o `repository.ts` já consulta o Supabase real** —
não é mais mock em memória. `src/data/supabase-collection.ts` é a camada
genérica (busca + Realtime + CRUD) que todo hook e toda função de
`repository.*` usa por baixo. Nenhuma tela precisou mudar nessa troca:
todas continuam chamando só `use*()` e `repository.*`.

## Tabela ↔ módulo/tela ↔ camada de acesso

| Tabela (`supabase/migrations`) | Módulo / tela              | Hook de leitura                    | Escrita (`repository`)              |
|---------------------------------|-----------------------------|-------------------------------------|--------------------------------------|
| `companies`                     | Empresas                    | `useCompanies()`                    | `repository.companies.create`        |
| `hospitals`                     | Hospitais                   | `useHospitals()`                    | `repository.hospitals.create`        |
| `clinics`                       | Clínicas                    | `useClinics()`                      | `repository.clinics.create`          |
| `units`                         | Unidades (Alas do hospital)  | `useUnits()`                        | `repository.units.create`            |
| `rooms`                         | Quartos                     | `useRooms()`                        | `repository.rooms.create`            |
| `health_insurances`              | Convênios                   | `useHealthInsurances()`             | `repository.healthInsurances.create` |
| `contracts`                     | Contratos                   | `useContracts()`                    | `repository.contracts.create`        |
| `patients`                      | Pacientes                   | `usePatients()`                     | `repository.patients.create`         |
| `physiotherapists`               | Fisioterapeutas              | `usePhysiotherapists()`             | `repository.physiotherapists.create` |
| `cost_centers`                  | Centros de Custo             | `useCostCenters()`                    | `repository.costCenters.create` / `.remove` |
| `teams`                         | Equipes                     | `useTeams()`                          | `repository.teams.create` / `.remove` |
| `beds`                          | Leitos                      | `useBeds()`                          | `repository.beds.create` / `.updateStatus` |
| `admissions`                    | Internações                 | `useAdmissions()`                    | `repository.admissions.create` / `.discharge` |
| `procedures`                    | Procedimentos                | `useProcedures()`                    | `repository.procedures.create`        |
| `daily_production`               | Produção Diária              | `useDailyProduction()`               | `repository.dailyProduction.create`   |
| `clinical_evolutions`            | Evolução Clínica             | `useClinicalEvolutions()`            | `repository.clinicalEvolutions.create` |
| `shifts`                        | Escalas                     | `useShifts()`                        | `repository.shifts.create`            |
| `tasy_imports` / `tasy_import_rows` | Importação Tasy          | `useTasyImports()`                    | `repository.tasyImports.create` / `.undo` |
| `activity_log`                  | Auditoria                    | `useActivityLog()`                    | gravado automaticamente pelo `logActivity` interno do store — nenhuma tela grava direto |
| `receivables`                   | Financeiro, Dashboard Financeiro | `useReceivables()`               | `repository.receivables.create` / `.markPaid` / `.remove` |

Todos os módulos do escopo original, incluindo Centros de Custo e Equipes,
já seguem o padrão `use*()` / `repository.*`.

## Como conectar o Supabase real, quando existir

1. Rodar as migrations de `supabase/migrations/` no projeto novo.
2. Preencher `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Em `src/data/repository.ts`, trocar o corpo de cada função `create` e de cada
   hook `use*()` para chamar `supabase.from("<tabela>")` em vez de
   `useMockStore`. Os nomes dos campos não mudam — `src/types/domain.ts` já
   está em snake_case, idêntico às colunas do Postgres.
4. Gerar os tipos definitivos com o Supabase CLI (substituindo o placeholder
   em `src/types/database.ts`) e apontar `domain.ts` para eles, se preferir
   tipos gerados em vez de escritos à mão.
5. Nenhuma tela (`src/modules/**`) precisa ser alterada nesse processo — elas
   só conhecem os hooks e o `repository`, nunca a fonte de dados.

## Ajustes de uso real (migration 0016)

Depois do primeiro uso real, vários ajustes de comportamento:

- **Perfil "fisioterapeuta" (lançador)**: sidebar e rotas restritas a só
  Pacientes e Produção Diária (`src/app/modules-registry.ts`,
  `SLUGS_LANCADOR`) — qualquer outra rota redireciona automaticamente.
- **Paciente**: `sexo` e convênio com histórico real
  (`patient_insurance_history` — toda troca de convênio grava uma linha,
  nunca sobrescreve silenciosamente). Linha do tempo do paciente
  (`src/components/shared/patient-timeline.tsx`) agrega internações, altas,
  procedimentos e evoluções em ordem cronológica.
- **Internação**: código legível (`admission_number`, exibido como
  `IN-000123`) em vez do UUID truncado. Edição habilitada. Alta agora pede
  data **e hora** exatas (`discharge_at`) e **bloqueia** se não houver
  nenhum procedimento lançado na data da alta — obriga lançar o
  atendimento ali mesmo ou confirmar explicitamente que não houve
  (`confirmou_sem_atendimento_alta`).
- **Contrato**: checkbox "aplica a todas as unidades do hospital"
  (`aplica_todas_unidades`) ou escopo por alas específicas
  (`contract_units`).
- **Bug de ALT+TAB corrigido**: o refresh automático de token do Supabase
  ao voltar o foco da aba disparava um recarregamento de perfil que
  desmontava a tela inteira (formulários abertos, digitação em andamento).
  `src/auth/auth-provider.tsx` agora só mostra a tela de carregamento na
  primeira busca da sessão, nunca em refreshes de token em segundo plano.

## Importação Tasy — parser real

`src/lib/tasy-parser.ts` lê o relatório "Produtividade Médica" do Tasy — que
tem extensão `.xls` mas na prática é texto separado por TAB, confirmado num
arquivo real do cliente. Resolve hospital/convênio/fisioterapeuta/paciente/
procedimento por nome/código (busca ou cria, migration `0013`), agrupa por
`Nr. Atend.` (uma internação) e grava a produção com `tasy_reference` único
por empresa — reimportar o mesmo período não duplica nada, o Postgres
ignora quem já existe via `on conflict`.

**Limitação conhecida e deliberada:** "Desfazer importação" hoje só marca o
registro como desfeito — não reverte os `daily_production`/`admissions`
criados. Reverter de verdade exigiria saber se cada registro criado foi
tocado por outra coisa depois (ex.: uma evolução clínica lançada manualmente
numa internação que a importação criou) antes de decidir apagar — essa
lógica ainda não foi construída.

## Endereço automático por CEP

`hospitals` e `clinics` têm endereço estruturado (`cep`, `street`, `neighborhood`,
`city`, `state` — migration `0003_address_details.sql`), preenchido no front-end
via `src/components/shared/address-fields.tsx`, que consulta a API pública
ViaCEP (`src/lib/cep.ts`) assim que o CEP tem 8 dígitos. Cidade e estado ficam
bloqueados para edição manual só quando a busca é bem-sucedida; se o CEP não
for encontrado, os campos destravam para preenchimento manual — o cadastro
nunca fica bloqueado por falha na consulta.

## Hierarquia física (hospital → ala → quarto → leito)

A empresa presta serviço de fisioterapia **dentro de hospitais** (um ou mais) —
não é dona de clínica própria. A hierarquia real é:

```
Hospital → Ala/Unidade (units) → Quarto (rooms) → Leito (beds)
```

`rooms` existe porque um quarto pode ter mais de um leito (enfermaria
compartilhada) ou só um (apartamento). Migration `0005_rooms.sql`.

## Erros sempre visíveis, nunca silenciosos

Toda ação de criar/editar/excluir passa por `src/store/toast-store.ts`:
sucesso e erro aparecem como notificação, nunca só no console. As exclusões
no `mock-store.ts` validam integridade referencial antes de remover — por
exemplo, não deixam excluir um hospital com alas vinculadas, ou um leito
com internação ativa — e lançam um `Error` com a mensagem exata do que está
bloqueando. Ao trocar pelo Supabase real, o ideal é que essas mesmas
mensagens venham das constraints do Postgres (FK, unique) capturadas no
`catch` de cada função do repository.

## Autenticação e níveis de acesso

O Supabase do Fisio já está conectado (migrations 0001–0009 aplicadas) e a
**autenticação é real** — `src/auth/auth-provider.tsx` faz login/cadastro via
Supabase Auth e carrega o `profile` correspondente.

Dois níveis de acesso (migration `0008_platform_admin.sql`):

- **Admin InovareTech** (`profiles.is_platform_admin = true`, `company_id`
  null): vê e opera em todas as empresas. É quem usa o seletor "trocar de
  empresa" no topo — para qualquer outro perfil, esse seletor não aparece,
  a empresa vem fixa do próprio `profile.company_id` (ver `AppShell`).
- **Demais papéis** (admin de uma empresa, gestor, financeiro,
  fisioterapeuta, auditor): vinculados a uma única empresa via
  `profiles.company_id`, como no desenho original.

`platform_admin_emails` (migration `0009`) mantém a lista de e-mails que
sempre viram admin InovareTech automaticamente ao criar conta — hoje contém
`kleberfnascimento@gmail.com`. Adicionar alguém é um insert nessa tabela, sem
nova migration.

**O que ainda falta para a autenticação virar o único caminho de dados:**
todas as telas de cadastro (`use*()` / `repository.*`) ainda leem do mock em
memória, não do Postgres. A troca é mecânica — ver seção seguinte — mas
precisa ser feita tela por tela antes de a autenticação ter efeito real sobre
o que aparece na interface.

## Multiempresa

Toda entidade tem `company_id`. Hoje o filtro por empresa ativa (`useAppStore`)
ainda não é aplicado nas queries do mock — é o próximo passo antes de conectar
o Supabase, para já nascer testado com o mesmo filtro que a RLS vai aplicar
no banco real.
