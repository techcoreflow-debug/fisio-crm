# Manual do usuário — inovare.fisio

> Este arquivo é a fonte viva do manual — atualizado na mesma entrega
> sempre que uma funcionalidade muda ou é criada, igual o `CHANGELOG.md`.
> As versões em Word e PowerPoint são exportações geradas a partir daqui;
> se algo divergir, este arquivo manda. Serve tanto pra uso interno
> (entender o que cada tela faz e por quê) quanto como manual de usuário.

## O que é o inovare.fisio

Produto InovareTech para gestão de empresas de fisioterapia que atuam
**dentro de hospitais** — cadastro de pacientes, acompanhamento de
internados, distribuição de equipe, lançamento de produção, faturamento
por convênio (com controle de glosa) e conciliação com os relatórios do
Tasy.

## Perfis de acesso

| Perfil | Padrão de acesso |
|---|---|
| **Admin InovareTech** | Acesso total, em todas as empresas do grupo. Só ele vê o seletor de empresa no topo, pode vincular um usuário novo a uma empresa, e é o único que enxerga a Zona de risco. |
| **Admin de empresa** | Acesso completo, travado na própria empresa. |
| **Gestor** | Acesso completo por padrão — ajustável em Permissões. |
| **Financeiro** | Acesso completo aos módulos financeiros (Financeiro, Faturamento, Fechamento, Painel de Procedimentos, Relatórios, Contratos); só visualização no resto. |
| **Auditor** | Só visualização, em todos os módulos. |
| **Fisioterapeuta (lançador)** | Acesso restrito a Minha Fila, Novo Atendimento, Pacientes, Pacientes Internados e Produção Diária — o essencial pro dia a dia dele. Usa o **modo tablet** (ver seção própria). |

Cada um desses é só o **padrão embutido** — um admin pode ajustar
qualquer combinação de papel×módulo×ação (ver/criar/editar/excluir) na
tela de **Permissões** (dentro de Usuários e Permissões), sem precisar
de código novo.

## Primeiros passos (uma empresa nova)

Ordem que funciona sem travar em nenhum cadastro-pré-requisito:

1. **Empresas** → criar a empresa. Vira a empresa ativa automaticamente.
2. **Hospitais** → cadastrar o(s) hospital(is) atendidos.
3. **Unidades** → alas dentro do hospital (ex.: UTI, Enfermaria 2º andar).
4. **Quartos** e **Leitos** (opcional, mas recomendado para controle de ocupação).
5. **Convênios** → operadoras que pagam pelos atendimentos.
6. **Contratos** → vincula hospital + convênio + valor mensal. Marque se
   cobre **todas as unidades** do hospital ou só alas específicas, e se
   é direto com o hospital (sem convênio específico).
7. **Equipes** e **Fisioterapeutas**.
8. **Procedimentos** → catálogo de códigos (ou deixe a Conciliação Tasy
   no modo "Carga inicial" criar automaticamente).

Depois disso, o dia a dia roda por **Minha Fila**, **Pacientes
Internados** e **Produção Diária** — o resto é consulta/ajuste ocasional.

---

# Painéis

## Painel do Gestor

Central de comando do dia, tudo em tempo real: taxa de confirmação de
hoje (goniômetro), internados agora, procedimentos lançados, e quantos
ainda não foram distribuídos pra ninguém. Um cartão por fisioterapeuta
mostra o progresso da fila dele (concluídos × total) e quem ainda falta
atender, com barra de progresso. "Ainda sem distribuição" lista quem
precisa ser colocado na fila de algum fisioterapeuta, com atalho direto.
No final, atalhos visuais pra Fechamento, Faturamento, Financeiro e
Painel de Procedimentos, cada um já mostrando um número relevante.

## Dashboard Executivo

Indicadores estratégicos consolidados — visão de todas as empresas,
hospitais e contratos de uma vez (é a tela inicial de quem não é
fisioterapeuta).

## Dashboard Operacional

Produção diária, ocupação de leitos, escalas e produtividade da equipe
assistencial, também em tempo real.

## Dashboard Financeiro

Visão financeira consolidada — contratos, contas a receber, glosa.

---

# Cadastros

Telas de "configuração de base" — usadas com frequência baixa, o
oposto do fluxo assistencial do dia a dia.

- **Empresas**: as empresas do grupo (ex.: InovareTech). Admin InovareTech
  troca entre elas pelo seletor no topo; os demais perfis ficam travados
  na própria.
- **Hospitais** e **Clínicas**: onde a empresa presta serviço.
- **Unidades**: alas dentro de um hospital (UTI, Enfermaria, etc.).
- **Quartos**: agrupam leitos dentro de uma unidade.
- **Leitos**: status (livre/ocupado/higienização). Sobe pra "ocupado"
  sozinho quando vinculado a uma internação ativa, e pra "higienização"
  quando essa internação recebe alta. Sair de "higienização" é manual —
  não existe jeito automático de saber quando a limpeza física terminou,
  então tem um botão "Concluir" no próprio leito.
- **Convênios**: operadoras (Unimed, Apas, etc.).
- **Centros de Custo**: agrupam contratos/financeiro por área.
- **Equipes**: agrupam fisioterapeutas.
- **Fisioterapeutas**: cadastro da equipe assistencial. O campo
  vinculando ao login (`user_id`) é o que faz **Minha Fila** e o modo
  tablet funcionarem pra aquela pessoa.
- **Procedimentos**: catálogo de código + nome + categoria (Motora,
  Respiratória, etc.) — a categoria alimenta os relatórios e painéis
  que separam por tipo de atendimento.
- **Contratos**: vincula hospital + convênio (ou fica "direto com o
  hospital", sem convênio específico, via checkbox) + valor mensal +
  escopo (todas as unidades do hospital, ou só alas específicas).

---

# Fluxo assistencial (dia a dia)

## Minha Fila

Tela do fisioterapeuta: só os pacientes **distribuídos pra ele** naquele
dia, em ordem de sequência, com aviso se já foi lançado algum
procedimento hoje pra aquele paciente, e um botão pra marcar como
concluído. É a primeira tela que o fisioterapeuta vê ao logar (inclusive
no modo tablet).

## Novo Atendimento (fluxo guiado)

Jeito mais rápido de começar do zero: cadastra **paciente → internação →
procedimento** em sequência, um passo de cada vez. Pode parar em
qualquer etapa — só cadastrar o paciente já é válido, ou parar depois de
registrar a internação sem lançar procedimento ainda. Depois de lançar
um procedimento, um botão "Adicionar mais procedimentos para o mesmo
paciente" volta direto pra etapa 3, sem reiniciar o fluxo.

## Pacientes

Cadastro com nome, data de nascimento, sexo e **convênio** — trocar o
convênio de um paciente grava automaticamente no histórico dele, nunca
sobrescreve em silêncio. Cada paciente tem uma **linha do tempo** (ícone
de relógio na lista): internações, altas, procedimentos e evoluções em
ordem cronológica, tudo num só lugar.

## Pacientes Internados

Lista de quem está sendo acompanhado pela equipe — a "lista do que tem a
ser feito". Filtros por unidade, status (internado/alta/todos — alta
fica **oculto por padrão**), período de entrada, busca por nome, código
ou **Nr. Atendimento**, e um botão "Só pendentes de hoje".

- **Nr. Atendimento**: campo digitado ao criar a internação — é o ID da
  internação no Tasy, usado como **chave da conciliação** (ver seção
  própria). Uma internação pode ter vários procedimentos em várias datas
  enquanto durar, todos sob o mesmo Nr. Atendimento.
- **Lançar procedimento**: direto na linha, sem precisar ir em Produção
  Diária.
- **Dar alta**: sempre pede confirmação explícita, mostrando se já tem
  procedimento lançado hoje ou não. Pede **data e hora exatas**. Se não
  houver nenhum procedimento lançado na data da alta, **bloqueia** e
  pergunta se houve atendimento antes de sair — obriga lançar na hora ou
  confirmar explicitamente que não houve.
- **Gerar/imprimir lista**: seleciona pacientes (ou usa todos os
  filtrados, se nada selecionado) e gera uma lista pronta pra imprimir —
  sequência numerada, Nr. Atendimento, paciente, procedimento do dia,
  quarto, leito e hospital (cada coluna liga/desliga antes de gerar).
- **Distribuir**: a partir da mesma seleção, escolhe um fisioterapeuta e
  uma data — os pacientes entram na fila dele (**Minha Fila**), na ordem
  em que aparecem na tela.

## Produção Diária

Lançamento e listagem de procedimentos, com filtro por internação. Os
campos de busca (internação, fisioterapeuta, procedimento) sempre pedem
digitação — nenhum vem pré-selecionado, pra evitar lançar sem querer no
primeiro item da lista. Cada lançamento tem **data e hora**, mostra o
**Nr. Atendimento** da internação, o **código do procedimento**, e o
status de conciliação (confirmado/não confirmado pelo Tasy). Editar e
excluir só funcionam enquanto o lançamento **não foi confirmado** — depois
disso, é o registro oficial e fica travado.

## Evolução Clínica

Prontuário de evolução por paciente internado — agrupado por internação
(não uma lista solta): cada paciente com evolução vira um cartão
próprio, que expande mostrando as notas em ordem cronológica, com
contador e data da última. Um aviso no topo lista quem ainda não tem
nenhuma evolução registrada.

## Escalas

Turnos de trabalho da equipe assistencial.

---

# Financeiro

## Financeiro

**Contas a receber**: uma linha por contrato/competência, com status
(pendente/pago/atrasado) e **valor líquido** (bruto menos glosa).

**Glosa** tem um parâmetro em Configurações que muda como ela é registrada:

- **Modo detalhado** (ligado): marca a glosa procedimento a procedimento
  em Produção Diária/Pacientes Internados; o Financeiro soma sozinho na
  competência do convênio.
- **Modo manual** (desligado): digita o valor direto na conta a receber,
  sem detalhar procedimento a procedimento.

## Faturamento

Lançamento manual do relatório de repasse do Tasy (valor pago, valor
glosado) por Nr. Atendimento + procedimento + data — mesma chave da
conciliação. É uma ponte: o relatório oficial hoje só existe em PDF
escaneado (sem texto real por trás, OCR testado e não confiável o
suficiente pra dado financeiro), então a importação automática ainda não
é viável.

## Fechamento

Visão de lançado × confirmado (pelo Tasy) × não confirmado — o "ritual de
fechamento" diário/semanal. Presets de período (Hoje, Ontem, Esta semana,
Este mês, ou personalizado), filtro por hospital e convênio. Mostra a
taxa de confirmação (goniômetro), gráficos por dia e por hospital, e a
lista de quem ainda não foi confirmado — pronta para exportar ou agir.

## Painel de Procedimentos

Visão cruzada de produção × glosa: filtra por período, hospital, unidade,
convênio, fisioterapeuta, categoria e status de glosa. Mostra KPIs, 3
gráficos (categoria, convênio × glosa, evolução diária) e a tabela
detalhada, exportável em CSV.

## Relatórios

Relatórios prontos (produção, ocupação de leitos, internações sem
evolução, evoluções, contas a receber, contratos a vencer) e um card
específico de **produção contabilizada por período**, com contagem por
categoria (Motora/Respiratória/etc.). Tudo exportável em CSV — abre direto
no Excel.

---

# Conciliação Tasy

**Não é carga por padrão** — a equipe lança o procedimento manualmente
primeiro (em Pacientes Internados, Novo Atendimento ou Produção Diária).
O Tasy chega depois só pra conferir: sobe o relatório "Produtividade
Médica" (`.xls`, mas na prática é texto) e o sistema tenta casar cada
linha com um lançamento já existente.

**Chave da conciliação: Nr. Atendimento + código do procedimento + data.**
Uma internação pode ter o mesmo procedimento 2+ vezes no mesmo dia — a
conciliação valida por **quantidade**, não por horário exato (uma fila
por chave, não um casamento fixo 1-para-1).

- **Bateu** → o lançamento fica marcado como **confirmado** (baixado/
  finalizado pelo hospital).
- **Não bateu** → vira uma **pendência** — o sistema não cria nada
  sozinho (nem paciente, nem procedimento, nem internação) e não marca
  como glosa automaticamente. Alguém revisa a lista de pendências e
  decide (pode editar o lançamento não confirmado, se foi erro de
  digitação, ou registrar glosa).

"Desfazer conciliação" reverte de verdade: volta tudo que aquela
conciliação tinha confirmado para "não confirmado".

**Modo alternativo — Carga inicial:** pra popular uma empresa nova de uma
vez, dá pra escolher "Carga inicial" em vez de "Conciliar" — aí cria
hospital, convênio, paciente, procedimento e internação a partir do
arquivo (o modo antigo, de quando o Tasy ainda era tratado como fonte
única). Fica marcado visualmente como arriscado, porque pode precisar
corrigir cadastros depois.

**Limitação conhecida e proposital:** hoje não existe tabela de preço por
procedimento×convênio, então não há valor em R$ pra mostrar por
procedimento na conciliação em si — o que dá pra acompanhar ali é
contagem (quantos foram lançados × quantos vieram confirmados pelo
Tasy). Valor em R$ vem do **Faturamento** (lançamento manual, por ora).

---

# Administração

## Usuários e Permissões

Lista de usuários (com quem ainda não tem empresa vinculada separado, pro
admin InovareTech resolver), e a matriz de **Permissões por papel**:
ver/criar/editar/excluir, módulo a módulo, ajustável por papel (Admin de
empresa, Gestor, Financeiro, Fisioterapeuta, Auditor). Sem ajuste
manual, cada papel usa o padrão sensato já embutido no sistema.

**Criar usuário** (só admin InovareTech): nome, e-mail, senha
provisória, empresa e papel — o usuário já nasce confirmado e vinculado,
sem precisar clicar em e-mail nenhum nem esperar alguém resgatar da
lista de pendentes.

## Configurações

Dados da empresa, preferências de notificação e o parâmetro de glosa —
tudo salva de verdade no banco assim que você altera, sem botão "salvar"
escondido que não faz nada.

## Auditoria

Trilha real de quem criou, editou, excluiu, deu alta ou importou o quê e
quando — gerada automaticamente pelo sistema, nunca editável.

## Zona de risco (só admin InovareTech)

Em Configurações, um card vermelho só visível pro admin InovareTech:
limpeza de base por categoria (pacientes, internações, contratos,
estrutura física etc., cada categoria com checkbox próprio), sempre
restrita à **empresa ativa** no momento — nunca todas de uma vez. Pede
confirmação antes de apagar. Sem volta depois de confirmado.

---

# Modo tablet (fisioterapeuta)

Quem loga como fisioterapeuta (lançador) vê um app completamente
diferente: sem menu lateral, navegação por ícones grandes na parte de
baixo da tela (Fila, Lançar, Pacientes, Internados, Produção) — pensado
pra usar com o dedo em tablet, na correria do plantão. As abas mostradas
se ajustam sozinhas conforme as permissões daquele papel — se um admin
liberar mais acesso, a barra ganha mais abas sem precisar mexer em
código.
