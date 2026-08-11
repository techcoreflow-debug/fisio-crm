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
| **Supervisor** | Mesmo acesso do fisioterapeuta (lançador) nos módulos do dia a dia, mais visão e controle dos painéis operacionais (Painel do Gestor, Dashboard Operacional, Impacto Assistencial, Leitos, Escalas, Evolução Clínica, Fisioterapeutas, Procedimentos, Relatórios) — sem ser admin, e sem acesso a faturamento. |
| **Financeiro** | Acesso completo aos módulos financeiros (Financeiro, Faturamento, Fechamento, Painel de Procedimentos, Relatórios, Contratos); só visualização no resto. |
| **Auditor** | Só visualização, em todos os módulos. |
| **Fisioterapeuta (lançador)** | Acesso restrito a Minha Fila, Novo Atendimento, Pacientes, Pacientes Internados e Produção Diária — o essencial pro dia a dia dele. Usa o **modo tablet** (ver seção própria). |

Cada um desses é só o **padrão embutido** — um admin pode ajustar
qualquer combinação de papel×módulo×ação (ver/criar/editar/excluir) na
tela de **Permissões** (dentro de Usuários e Permissões), sem precisar
de código novo.

No desktop, o menu lateral tem um botão no rodapé pra recolher só pra
ícones, ganhando espaço de tela — a preferência fica salva entre sessões.

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

## Impacto Assistencial

Indicadores clínicos — o que a equipe está entregando de cuidado, não
só números operacionais/financeiros: tempo médio até o 1º atendimento
pós-internação, cobertura diária (% dos internados de hoje já
atendidos), intensidade terapêutica (procedimentos por paciente-dia),
mix de categoria evoluindo semana a semana, comparativo entre
hospitais, e os números do período (pacientes atendidos, procedimentos,
dias de internação acompanhados). Também: efetividade Motora ×
Respiratória mensal (com filtro por unidade), altas (diário/mensal/%
do período), distribuição por convênio e perfil por sexo. Filtro de
período e hospital.

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
- **Leitos**: organizado em três seções — **Ocupados**, **Em
  Higienização** e **Livres**, cada uma com sua contagem. Status sempre
  calculado ao vivo a partir de quem está de fato internado ali — não
  confia num campo que possa ficar desatualizado no banco (e se achar um
  leito ocupado sem internação de verdade, corrige sozinho ao carregar a
  tela). Sobe pra "higienização" quando a internação recebe alta, e
  depois de **2 horas** volta a ficar **livre sozinho** — sem precisar
  de ninguém clicar em nada (tem um botão "Liberar agora" pra quem
  quiser liberar antes do prazo, e o card mostra quanto tempo falta).
  Filtros por código, hospital, unidade, status e "só sem quarto
  vinculado". Não precisa ir em Leitos pra vincular um quarto antes de
  internar alguém: se o leito escolhido na hora da internação (em
  Internações ou Novo Atendimento) ainda não tem quarto, um campo extra
  aparece ali mesmo pra definir — e já grava direto no leito.
- **Convênios**: operadoras (Unimed, Apas, etc.).
- **Centros de Custo**: agrupam contratos/financeiro por área.
- **Equipes**: agrupam fisioterapeutas.
- **Fisioterapeutas**: cadastro da equipe assistencial. O campo
  **"Usuário vinculado (login)"** é o que faz **Minha Fila** e o modo
  tablet funcionarem pra aquela pessoa — busca por nome ou e-mail entre
  os usuários já criados; a tabela mostra "Vinculado" ou "Sem login" por
  linha. Sem esse vínculo, o fisioterapeuta loga mas não vê a própria
  fila.
- **Procedimentos**: catálogo de código + nome + categoria (Motora,
  Respiratória, etc.) — a categoria alimenta os relatórios e painéis
  que separam por tipo de atendimento. Escolhida por combo box (não é
  mais texto livre) — cria uma nova categoria na hora, se precisar,
  pelo botão "+" ao lado do campo.
- **Contratos**: vincula hospital + convênio (ou fica "direto com o
  hospital", sem convênio específico, via checkbox) + valor mensal +
  escopo (todas as unidades do hospital, ou só alas específicas).

---

# Fluxo assistencial (dia a dia)

## Minha Fila

Tela do fisioterapeuta: só os pacientes **distribuídos pra ele** naquele
dia, em ordem, com o **procedimento sugerido** (se quem distribuiu
escolheu um) e um botão **"Lançar procedimento"** — abre um formulário
rápido, já pré-preenchido com a sugestão, e lança direto, marcando o
item da fila como concluído sozinho. Depois de concluído, ainda dá pra
lançar mais um procedimento pro mesmo paciente (igual o fluxo de Novo
Atendimento). É a primeira tela que o fisioterapeuta vê ao logar
(inclusive no modo tablet).

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
ser feito". Filtros por hospital, unidade (se ajusta sozinha conforme o
hospital escolhido), status (internado/alta/todos — alta
fica **oculto por padrão**), período de entrada, busca por nome, código
ou **Nr. Atendimento**, e um botão "Só pendentes de hoje". Ordenação por
Unidade (padrão — e dentro da unidade, segue a sequência dos leitos),
Leito, Paciente (A-Z), Entrada (mais recente) ou Nr. Atendimento.

- **Nr. Atendimento**: campo digitado ao criar a internação — é o ID da
  internação no Tasy, usado como **chave da conciliação** (ver seção
  própria). Uma internação pode ter vários procedimentos em várias datas
  enquanto durar, todos sob o mesmo Nr. Atendimento.
- **Diagnóstico**: texto livre, também preenchido ao criar a internação —
  aparece logo após o nome do paciente na listagem, e é uma opção a mais
  na lista impressa.
- **Pré-lançamento**: dois códigos de procedimento sugeridos na triagem
  — Motora e Respiratória, sempre juntos (não dá pra salvar só um) —
  pra reduzir erro de codificação na hora de lançar de verdade depois.
  Só admin e supervisor podem definir ou alterar; o fisioterapeuta
  lançador só vê o que já foi definido. Aparece como selo (só os
  códigos) na listagem e é uma opção a mais na lista impressa. Não
  lança nada sozinho, é só referência.
- **Excluir internação** (só papel admin, de empresa ou InovareTech):
  bloqueia se já tiver produção, evolução, fila ou faturamento
  lançado — mesma proteção do resto do sistema.

O fisioterapeuta lançador pode **editar** uma internação já existente
(trocar unidade, leito, quarto — útil porque paciente muda de quarto com
frequência), mas nunca criar internação nova nem excluir.
- **Lançar procedimento** ("+ Procedimento"): direto na linha, sem precisar ir em Produção
  Diária.
- **Dar alta** ("Alta"): sempre mostra quantos procedimentos já foram
  lançados hoje pra esse paciente, com a lista (horário + nome de cada
  um). O botão "Lançar mais um procedimento" fica sempre disponível —
  lança e volta pra essa mesma tela, sem confirmar a alta sozinho. O
  botão "Sim, confirmar alta" também fica sempre disponível, mesmo sem
  nenhum procedimento lançado — o aviso já está visível, então quem
  confirma decide com a informação em mãos. Pede **data e hora exatas**
  da alta.
- **Gerar/imprimir lista**: escolhe quais colunas aparecem (sequência
  numerada sempre entra; Nr. Atendimento, paciente, procedimento do dia,
  quarto, leito, hospital e convênio são opcionais, todas ligadas por
  padrão) e abre uma janela pronta pra imprimir.
- **Distribuir**: escolhe um fisioterapeuta, uma data e, opcionalmente,
  um **procedimento sugerido** — os pacientes selecionados entram na
  fila dele (**Minha Fila**), na ordem em que aparecem na tela.

## Produção Diária

Lançamento e listagem de procedimentos, com filtro por internação,
**período (data de/até), unidade e convênio** — mesmo padrão de
Pacientes Internados. Os campos de busca (internação, fisioterapeuta,
procedimento) sempre pedem digitação — nenhum vem pré-selecionado, pra
evitar lançar sem querer no primeiro item da lista. Cada lançamento tem
**data e hora**, mostra o **Nr. Atendimento** da internação, o **código
do procedimento**, e o status de conciliação (confirmado/não confirmado
pelo Tasy). Editar e excluir só funcionam enquanto o lançamento **não
foi confirmado** — depois disso, é o registro oficial e fica travado.
Exporta em CSV, respeitando os filtros aplicados na hora (período,
unidade, convênio, busca).

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
categoria (Motora/Respiratória/etc.). Um filtro de período geral
(De/Até) vale pra Produção, Internações, Evoluções e Contas a receber —
Ocupação de Leitos e Contratos a vencer sempre mostram a foto de agora,
não fazem sentido filtrados por período passado. Tudo exportável em
CSV — abre direto no Excel.

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
lista de pendentes. **"Criar em lote"** faz o mesmo pra vários de uma
vez — cola os nomes completos (um por linha), o e-mail é gerado sozinho
(`primeiro.ultimo@dominio`).

Cada usuário (menos o próprio admin InovareTech) também pode ser
**editado** (nome, empresa, papel), ter a **senha trocada** por um
admin (sem precisar da senha antiga) ou ser **excluído** de vez — tudo
direto na listagem.

Qualquer usuário troca a própria senha depois, pelo menu de usuário
(ícone de chave, tanto no desktop quanto no modo tablet).

## Configurações

Dados da empresa, preferências de notificação e o parâmetro de glosa —
tudo salva de verdade no banco assim que você altera, sem botão "salvar"
escondido que não faz nada.

**Exclusão avançada** (admin de empresa ou admin InovareTech): o botão
normal de excluir paciente/procedimento bloqueia se houver dados
dependentes (paciente com internação, procedimento com lançamento) —
proteção contra perda de dado. Aqui dá pra forçar, apagando junto tudo
que depende. Sem volta depois de confirmar.

## Diagnóstico do Sistema

Checagens automáticas contra os dados reais, pensadas pra pegar
problema antes de virar reclamação: leitos travados como "ocupado" sem
internação real, leitos com dupla ocupação, internações ativas sem
unidade/hospital, fisioterapeutas sem login vinculado, e procedimentos
lançados com data no futuro. Também mostra um gráfico de lançamentos
por dia (últimos 7 dias) — uma queda repentina sem explicação óbvia é
sinal de alerta. Roda toda vez que a tela é aberta, com os dados de
agora. Acesso: admin, gestor e supervisor.

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

**Dá pra trocar pro layout padrão** (o mesmo dos outros perfis) —
ícone de monitor no cabeçalho do modo tablet, ou "Usar layout tablet"
no menu do usuário quando já estiver no padrão. A escolha fica salva
**por aparelho**, não por conta — o tablet do plantão e o PC do
escritório guardam preferências independentes.
