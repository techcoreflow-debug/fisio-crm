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

## v0.32.0 — 06/08/2026

**Novo painel "Impacto Assistencial"** — indicadores clínicos, não só
operacionais/financeiros. Usa só dado que já existia, sem coleta nova:

- **Tempo médio até o 1º atendimento** pós-internação (goniômetro, em
  horas) — indicador real de resposta da equipe.
- **Cobertura diária** — % dos internados de hoje que já foram
  atendidos hoje.
- **Intensidade terapêutica** — procedimentos por paciente-dia
  atendido, mostra profundidade do cuidado.
- **Mix de categoria ao longo do tempo** — área empilhada por semana
  (Motora × Respiratória × etc.), mostra a complexidade dos casos
  evoluindo, não só uma foto do momento.
- **Comparativo entre hospitais** — cobertura e confirmação lado a
  lado (aparece só quando há mais de um hospital ativo).
- **Números de impacto** — pacientes atendidos, procedimentos
  realizados e dias de internação acompanhados no período.

Filtro de período e hospital, igual o padrão dos outros painéis. Sem
migration — usa só tabelas que já existiam.

---

## v0.31.1 — 05/08/2026

**Filtro por Hospital em Pacientes Internados** — ao lado do filtro de
unidade (que agora se ajusta sozinho, só mostrando unidades daquele
hospital quando um é escolhido).

**Anotado pra revisão calma depois**: usuário reportou um dashboard
mostrando lançamentos vinculados à UNIMED sem entender a origem do
vínculo — investigar quando houver tempo pra olhar com calma (não é
uma correção que dá pra fazer às cegas, precisa entender o dado real
primeiro).

Sem migration — só código.

---

## v0.31.0 — 05/08/2026

**Varredura de UX/consistência** — resultado de auditar todo o sistema
em busca de padrões aplicados num lugar e esquecidos em outro:

- **"Já lançados hoje"** (o aviso com lista de horário+procedimento, que
  já existia na Alta, no lançamento avulso e em Minha Fila) agora
  também aparece em **Novo Atendimento** (ao adicionar mais
  procedimentos pro mesmo atendimento) e em **Produção Diária** (ao
  escolher a internação no lançamento manual).
- **Permissão de "Excluir" conectada de verdade** em Pacientes,
  Internações e Procedimentos — antes a coluna "Excluir" na tela de
  Permissões não tinha efeito nenhum em lugar nenhum (14 botões de
  excluir espalhados pelo sistema, nenhum checava a permissão). Os
  outros 11 ainda não checam — ficou combinado focar nesses três por
  agora.

Campos de Data/Hora nos lançamentos de procedimento foram conferidos em
todos os formulários (Internações, Alta, Minha Fila, Novo Atendimento,
Produção Diária) — todos já têm o campo corretamente.

Sem migration — só código.

---

## v0.30.2 — 05/08/2026

**Faltava Data e Hora no "Lançar mais um procedimento" da tela de
Alta.** Esse formulário só tinha Fisioterapeuta e Procedimento — a
data/hora do lançamento era copiada em silêncio da data/hora da própria
alta, sem opção de ajustar. Agora tem campos próprios de Data e Hora,
igual a tela avulsa de lançar procedimento — importante pra registrar
um procedimento feito num horário diferente do momento da alta.

Sem migration — só código.

---

## v0.30.1 — 05/08/2026

**Lançar procedimento avulso não fecha mais sozinho.** Em Pacientes
Internados, a tela de "+ Procedimento" fechava depois de um único
lançamento — agora continua aberta: limpa só o campo de procedimento
(mantém o fisioterapeuta selecionado, já que costuma ser a mesma pessoa
lançando vários seguidos), atualiza a lista de "já lançados hoje" na
hora, e deixa lançar quantos precisar. Botão "Fechar" pra sair quando
terminar.

Sem migration — só código.

---

## v0.30.0 — 05/08/2026

**Categoria de procedimento virou lista de verdade, não texto livre.**
Antes cada um digitava do seu jeito (Respiratória, respiratoria,
RESPIRATÓRIA...), quebrando os agrupamentos por categoria nos
relatórios. Agora é um combo box — escolhe entre as categorias já
cadastradas, ou cria uma nova na hora (botão "+" ao lado). Migration
`0026` (`procedure_categories`) já entra populada com as categorias que
já estavam em uso, ninguém perde nada do que já tinha digitado.

**Código do procedimento na lista impressa** — a coluna "Procedimento
(hoje)" agora mostra código + descrição juntos na mesma célula (ex.:
"20103441 - Fisio Respiratória..."), não só a descrição.

**"Já lançados hoje" também no lançamento avulso** — o mesmo aviso que
já existia na tela de Alta (lista com horário + nome de cada
procedimento já lançado) agora também aparece ao lançar procedimento
direto (em Pacientes Internados e em Minha Fila) — evita lançar a mais
por engano.

**Investigado**: usuários "superusuário" (Monika, Carlos) sem conseguir
editar outros usuários — não é bug de código, é configuração: só o
e-mail do Kleber está na lista de admins InovareTech no banco. Passei
o SQL pra adicionar os dois — pendente de confirmação de teste.

---

## v0.29.0 — 04/08/2026

**Ordenação por Leito** em Pacientes Internados — novo item no
seletor, e a ordenação "Unidade" agora também segue a sequência dos
leitos dentro de cada unidade (útil pra visita física, quarto por
quarto, não só por nome do paciente).

**Extrações de produção completas** — Produção Diária, Relatórios
("Produção diária consolidada") e Painel de Procedimentos agora
exportam também **Nr. Atendimento, Unidade, Quarto, Leito e
Diagnóstico**, além do que já existia (paciente, procedimento,
fisioterapeuta, conciliação).

**Fluxo de alta redesenhado.** Antes eram 3 etapas separadas, com um
beco sem saída se não tivesse procedimento lançado. Agora é uma tela
só: sempre mostra quantos procedimentos já foram lançados hoje **com a
lista** (horário + nome de cada um), o botão **"Lançar mais um
procedimento"** fica sempre disponível (lança e volta pra essa mesma
tela, não confirma sozinho), e o botão **"Sim, confirmar alta"** também
fica sempre disponível — mesmo sem nenhum procedimento lançado, já que
o aviso está sempre visível e quem confirma decide com a informação em
mãos, sem ficar preso numa validação bloqueante.

Sem migration — só código.

---

## v0.28.1 — 04/08/2026

**Recuperação automática de deploy novo.** Depois de eu publicar uma
versão nova, quem já estava com o app aberto podia ver "Failed to fetch
dynamically imported module" ao navegar — a página antiga em cache
tentando carregar um arquivo de tela que não existe mais no servidor
(o build novo troca os nomes). Agora, quando isso acontece, o app
recarrega a página sozinho (uma vez só) em vez de mostrar erro — resolve
sem precisar pedir pra todo mundo dar F5 a cada entrega.

Sem migration — só código.

---

## v0.28.0 — 04/08/2026

**Pacientes Internados redesenhado — de tabela pra lista em cartão.** A
tabela original tinha colunas demais brigando por espaço: o nome do
paciente quebrava em 2+ linhas, e mesmo assim faltava espaço pra
mostrar tudo (Nr. Atendimento, hospital/unidade, leito, convênio,
entrada, status, diagnóstico). Redesenhado assim:

- **Linha 1**: nome do paciente em destaque + status + "Em atendimento"/"Pendente" do dia
- **Linha 2** (menor, cinza): Nr. Atendimento · Hospital/Unidade · Quarto
  · Leito · Convênio · Entrada — tudo numa linha compacta só, sem
  disputar espaço com o nome
- **Linha 3** (se tiver): diagnóstico, truncado com o texto completo ao
  passar o mouse

O nome nunca mais quebra linha por falta de espaço, e nenhuma
informação foi removida — só reorganizada por prioridade visual. Todas
as ações (editar, +Procedimento, Alta, excluir) e a seleção por
checkbox continuam funcionando exatamente igual.

Sem migration — só visual.

---

## v0.27.0 — 04/08/2026

**Botões mais enxutos em Pacientes Internados** — "Dar alta" virou
**"Alta"**, "Lançar procedimento" virou **"+ Procedimento"** — mesma
ação, ícone e comportamento, só o texto mais curto (com tooltip ao
passar o mouse, pra não perder clareza). Botão de editar também ganhou
tooltip.

**Fisioterapeuta pode escolher entre layout tablet e PC.** Antes, o
perfil fisioterapeuta sempre caía no modo tablet (sem sidebar,
navegação por ícones). Agora tem um botão pra trocar pro layout padrão
(o mesmo dos outros perfis) — ícone de monitor no cabeçalho do tablet,
ou "Usar layout tablet" no menu do usuário quando já estiver no padrão.
A escolha fica salva **por aparelho** (não por conta), então o tablet do
plantão e o PC do escritório guardam preferências independentes — do
jeito que faz sentido pra quem usa os dois.

Sem migration — só código.

---

## v0.26.0 — 04/08/2026

**Bug corrigido — leito não aparecia pra selecionar.** Internações e
Novo Atendimento filtravam leitos "livres" pelo campo `status` gravado
no banco — o mesmo tipo de dessincronia que já corrigimos em Leitos
podia deixar um leito preso como "ocupado" sem internação real, e ele
simplesmente sumia da lista de opções. Agora os dois calculam
disponibilidade ao vivo, igual Leitos já fazia.

**Excluir internação — só pro papel admin** (empresa ou InovareTech).
Bloqueia se já tiver produção, evolução, fila ou faturamento lançado
(mesma proteção padrão do resto do sistema).

**Exportar CSV em Produção Diária** — respeitando os filtros aplicados
na hora (período, unidade, convênio, busca).

**Filtro de período em Relatórios** — um seletor de período geral
(De/Até) que vale pra Produção, Internações, Evoluções e Contas a
receber (por competência). Ocupação de Leitos e Contratos a vencer
continuam sempre "foto de agora", já que não fazem sentido filtrados
por período passado.

**Ainda pendente**: os dashboards da ONA — precisa dos indicadores
específicos que a operação acompanha antes de reorganizar os relatórios
em torno disso, pra não montar algo genérico que não serve pra
acreditação de verdade.

---

## v0.25.1 — 04/08/2026

**Bug crítico corrigido — mudar a Unidade na internação não gravava.**
No formulário de internação (Internações), trocar a Unidade também
precisava limpar o Leito selecionado — isso disparava duas atualizações
seguidas no mesmo estado combinado (rascunho), e a segunda **apagava a
mudança da primeira** antes de gravar (as duas partiam do mesmo "estado
antigo", então só a última sobrevivia). Resultado: parecia que a Unidade
tinha sido trocada na tela, mas ao salvar, voltava pro valor de antes.

Corrigido combinando as duas mudanças numa única atualização. Conferido
que não existe o mesmo padrão em nenhum outro lugar do sistema (Novo
Atendimento e Leitos usam estados separados pra cada campo, não têm
esse risco).

Com isso corrigido, editar uma internação já existente volta a permitir
trocar Unidade, Leito e Quarto normalmente.

---

## v0.25.0 — 04/08/2026

**Diagnóstico da internação** — campo de texto livre, no formulário de
internação (Internações e Novo Atendimento), logo abaixo do Nr.
Atendimento. Aparece em Pacientes Internados **logo após o nome do
paciente** (truncado, com o texto completo ao passar o mouse), e é uma
opção a mais na lista impressa. A coluna Hospital/Unidade ficou mais
compacta (uma linha só, fonte menor) pra abrir espaço pro diagnóstico.
Migration `0025` (`admissions.diagnostico`).

---

## v0.24.0 — 04/08/2026

**Ordenação em Pacientes Internados** — por Unidade (padrão agora),
Paciente (A-Z), Entrada (mais recente) ou Nr. Atendimento.

**Mensagem de erro mais clara ao gerenciar usuários.** O "Failed to
send a request to the Edge Function" (ou variações genéricas do SDK)
não dizia nada útil quando a requisição nem chegava na função — agora
o app explica o motivo mais provável (função não publicada, ou
problema de rede) em vez de repetir o texto técnico cru. Criado
`src/lib/edge-function.ts`, um helper único pra chamar Edge Functions
com essa mensagem melhor — reaproveitável em qualquer função futura.

**Exclusão avançada, em Configurações** (admin de empresa ou admin
InovareTech): excluir paciente ou procedimento **mesmo com dependências**
— o botão normal de excluir continua bloqueando por segurança (proteção
contra perda de dado), mas aqui dá pra forçar, apagando junto tudo que
depende (internações, evoluções, produção, fila, faturamento — no caso
do paciente; lançamentos de produção — no caso do procedimento). Ação
clara e deliberadamente separada do fluxo normal, com confirmação
explícita mostrando o que vai junto.

---

## v0.23.0 — 03/08/2026

**Admin InovareTech pode editar, excluir e trocar a senha de outros
usuários** — em Usuários e Permissões, cada linha (menos a do próprio
admin InovareTech) ganhou três ações:

- **Editar**: nome, empresa e papel — direto, sem precisar de Edge
  Function (o admin já tem permissão de banco pra isso).
- **Trocar senha**: define uma senha nova pra qualquer usuário, sem
  precisar saber a antiga — usa o mesmo campo com "olhinho" do resto do
  sistema.
- **Excluir**: apaga o usuário de vez (login e tudo) — não dá pra
  excluir a própria conta por aqui, de propósito.

As duas últimas exigiram estender a Edge Function `create-user` (agora
aceita um campo `action`: `create` / `delete` / `reset-password`) — **é
preciso publicar essa versão nova da função** (mesmo comando de antes:
copia o código novo no editor do Supabase e clica em Deploy).

---

## v0.22.0 — 03/08/2026

**Leitos reorganizado em seções — Ocupados, Em Higienização e Livres**,
cada uma com sua contagem. Filtro por hospital adicionado (além dos que
já existiam: unidade, status, código, só-sem-quarto).

**Higienização automática de 2h** — dar alta libera o leito pra
higienização como sempre, mas agora, depois de **2 horas**, ele volta a
ficar **livre sozinho**, sem precisar de ninguém clicar em nada (o botão
"Liberar agora" continua existindo, pra quem quiser liberar antes do
prazo). Enquanto está em higienização, o card mostra quanto tempo falta.
Migration `0024` (`beds.higienizacao_desde`).

**Pacientes Internados mais enxuto** — removida de vez a coluna
"Código" (`IN-000123`, interno) pra todo mundo, não só pro fisioterapeuta
— deixava a linha grande demais. O Nr. Atendimento (a referência que
importa de verdade) continua.

**Menu lateral recolhível** — botão no rodapé da sidebar (desktop) pra
encolher pra só ícones, ganhando espaço de tela. Preferência salva no
navegador, entre sessões.

**Validado**: a pergunta de confirmação ao dar alta é o mesmo código pra
todo mundo — nenhum papel pula essa etapa.

---

## v0.21.0 — 03/08/2026

**Quarto definido na hora, sem precisar ir em Leitos antes.** No
formulário de internação (Internações e Novo Atendimento), se o leito
escolhido ainda não tem quarto vinculado, aparece um campo extra
"Quarto deste leito (opcional)" — e ao salvar, isso já grava direto no
leito. Continua sendo a mesma fonte única de verdade (o quarto vem do
leito, não da internação), só que agora dá pra resolver isso num passo
só, sem precisar de uma ida separada a Leitos antes de internar alguém.

---

## v0.20.0 — 03/08/2026

**Filtros em Leitos** — busca por código, unidade, status (livre/ocupado/
higienização) e um botão "Só sem quarto vinculado".

**Explicado e sinalizado o motivo do quarto sumindo em algumas listas**:
o quarto de um paciente nunca vem do cadastro dele nem da internação —
vem só do **leito** (campo "Quarto (opcional)" ao cadastrar/editar em
Leitos). Se um leito foi criado sem vincular quarto, nenhum paciente
alocado nele mostra quarto em lugar nenhum do sistema, não importa por
onde a internação foi feita. Agora cada leito sem quarto mostra
**"sem quarto"** no próprio card, pra ficar fácil de achar e corrigir —
e o filtro novo já isola só esses de uma vez.

---

## v0.19.1 — 02/08/2026

**Fisioterapeuta agora dá alta** — o botão "Dar alta" volta a aparecer
em Pacientes Internados pro perfil fisioterapeuta (antes só para
admin/gestor). Continua com a mesma validação de sempre (confirma
explicitamente, bloqueia se não tiver procedimento lançado no dia).
"Nova internação" e "Editar" continuam restritos — só a alta foi
liberada.

---

## v0.19.0 — 02/08/2026

**Filtros em Produção Diária** — período (data de/até), unidade e
convênio, no mesmo padrão de Pacientes Internados — além da busca por
paciente/fisioterapeuta que já existia.

**Leitos: visão corrigida de alocação/desalocação.** A cor do card vinha
do campo `status` gravado no banco, enquanto o texto ("Ocupado") vinha de
uma checagem separada contra internações ativas — as duas podiam
dessincronizar (leito aparecendo verde/livre com texto "Ocupado" em
cima, ou o oposto). Agora existe uma única fonte de verdade: o status
visual é sempre calculado ao vivo a partir de quem está de fato internado
naquele leito. Também adicionada uma **autocorreção silenciosa**: se o
banco ainda disser "ocupado" pra um leito sem internação ativa de
verdade (resíduo de bugs antigos já corrigidos na origem), a tela
conserta sozinha ao carregar — importante porque outras telas (ex.:
seletor de leito livre em Nova Internação) leem esse campo direto do
banco.

**Migration 0023** (grant explícito de `service_role` em todas as
tabelas, corrige "permission denied for table profiles" na Edge Function
`create-user`) incluída nesta entrega, como combinado.

---

## v0.18.0 — 02/08/2026

**Três bugs de sessão/login corrigidos:**

- **Foco perdido ao trocar de janela/ALT+TAB**: alguns navegadores
  disparam `SIGNED_IN` de novo ao voltar o foco da aba, revalidando a
  MESMA sessão — sem tratar isso, o app achava que era um login novo,
  mostrava a tela cheia de carregamento e desmontava a tela que a
  pessoa estava usando. Agora só trata como login de verdade quando o
  usuário realmente muda.
- **Usuário novo caindo em Usuários e Permissões**: a URL ficava presa
  na última tela de quem tinha acabado de sair (ex.: admin criando
  usuários) — quando a próxima pessoa logava na mesma aba, o roteador
  tentava abrir aquela mesma rota antes de checar se ela podia ver.
  Agora a URL volta pra `/` no logout, então o próximo login sempre
  começa limpo e cada um cai na tela certa pro seu papel.
- **Erro de senha errada não aparecia**: o componente que mostra os
  avisos na tela (`Toaster`) só existia dentro da área logada — a tela
  de login não tinha onde exibir nada. Movido pra raiz do app, sempre
  presente.

**Olhinho pra mostrar a senha** — campo de login e "Trocar senha" (menu
do usuário, desktop e tablet) ganharam o ícone de mostrar/esconder.

Sem migration — só código.

---

## v0.17.1 — 02/08/2026

**Minha Fila não conclui mais sozinho depois de lançar.** Antes, lançar
um procedimento marcava o item da fila como concluído automaticamente —
agora pergunta: **"Concluir atendimento do paciente"**, **"Lançar outro
procedimento"** (reabre o formulário pro mesmo paciente, em branco) ou
**"Deixar em aberto por enquanto"** (fecha sem concluir, o item continua
pendente na fila). Cobre o caso de paciente com mais de um procedimento
previsto no dia.

---

## v0.17.0 — 02/08/2026

**Bug crítico de fuso horário corrigido em todo o sistema.** Várias
telas calculavam "hoje" com `new Date().toISOString().slice(0,10)` —
isso converte pra **UTC** antes de formatar. Como o Brasil está 3h atrás
de UTC, entre **21h e meia-noite (horário de Brasília)**, essa conta
calculava o dia **seguinte** por engano. Isso explica casos como
"distribuí um paciente mas não apareceu pro fisioterapeuta" — a
distribuição pode ter sido gravada com a data de amanhã sem ninguém
perceber.

Corrigido em 13 arquivos: Minha Fila, Painel do Gestor, Fechamento,
Painel de Procedimentos, Pacientes Internados, Produção Diária, Novo
Atendimento, Faturamento, Relatórios, Escalas, Dashboard Operacional,
o repository e a exportação de CSV. Criado `src/lib/data-local.ts`
(`hojeLocalIso()`, `dataParaIsoLocal()`) como padrão único daqui pra
frente — nenhum lugar do sistema deve mais usar `toISOString()` pra
calcular datas de "hoje".

**Sem migration** — é só código. Vale reconferir distribuições feitas à
noite antes desta versão; podem ter ficado com a data errada gravada.

---

## v0.16.1 — 02/08/2026

**Pacientes Internados mais enxuto pro fisioterapeuta** — o perfil
fisioterapeuta (lançador) não vê mais a coluna "Código" (`IN-000123`,
interno) nem o nome do hospital na listagem — só a unidade, que é o que
importa pra saber pra onde ir. Admin/gestor continuam vendo tudo normal.

---

## v0.16.0 — 02/08/2026

**Convênio na lista impressa** — Pacientes Internados, "Gerar/imprimir
lista" ganhou o Convênio como coluna opcional.

**Minha Fila ganhou lançamento de verdade**: cada item pendente mostra o
**procedimento sugerido** (se quem distribuiu escolheu um) e tem botão
**"Lançar procedimento"** — abre um formulário rápido, pré-preenchido com
a sugestão, e lança direto pra `daily_production`, marcando o item da
fila como concluído sozinho. Depois de concluído, ainda dá pra "Lançar
mais um procedimento" pro mesmo paciente, igual o fluxo de Novo
Atendimento. Migration `0022` (`patient_queue.procedure_id`) — o campo
"Procedimento sugerido (opcional)" também apareceu no diálogo de
Distribuir, em Pacientes Internados.

**Cadastros ordenados** — Empresas, Hospitais, Clínicas, Unidades,
Quartos, Leitos, Convênios, Centros de Custo, Equipes, Fisioterapeutas e
Procedimentos agora vêm sempre em ordem alfabética (ou por código, pra
quartos/leitos/procedimentos) — ordenação feita direto na consulta ao
banco, não só na tela, então vale em qualquer lugar que usa esses dados.
Novo cadastro aparece na posição certa da lista sozinho, sem precisar
recarregar nada.

---

## v0.15.0 — 02/08/2026

**Criar usuários em lote** — em Usuários e Permissões, botão "Criar em
lote" ao lado do individual: cola uma lista de nomes completos (um por
linha), o e-mail é gerado sozinho (`primeiro.ultimo@dominio`, domínio
configurável), define senha provisória + empresa + papel uma vez só pra
todo mundo, mostra prévia antes de confirmar e o resultado (criado/erro)
de cada um em tempo real.

**Trocar a própria senha** — qualquer usuário logado agora troca a senha
pelo menu de usuário (desktop: canto superior direito; tablet: ícone de
chave no cabeçalho). Não precisa mais de um admin pra isso depois da
conta criada com senha provisória.

---

## v0.14.1 — 02/08/2026

**Vínculo fisioterapeuta × login, agora pela tela** — em
Fisioterapeutas, campo "Usuário vinculado (login)" busca entre os
usuários da empresa (nome/e-mail), e a tabela mostra "Vinculado" ou "Sem
login" por linha. Esse campo (`user_id`) já existia no banco desde o
começo, mas nunca teve como preencher pela interface — sem ele, **Minha
Fila** e o **modo tablet** não sabem qual fisioterapeuta é aquele
usuário logado.

---

## v0.14.0 — 01/08/2026

**Admin InovareTech pode criar usuário direto** — em Usuários e
Permissões, botão "Criar usuário" (só visível pro admin InovareTech):
nome, e-mail, senha provisória, empresa e papel, tudo numa tela só. O
usuário já nasce **confirmado e vinculado** — não precisa clicar em
nenhum e-mail de confirmação nem esperar alguém "resgatar" ele da lista
de pendentes depois.

Implementado como **Edge Function** (`supabase/functions/create-user`),
porque criar usuário sem confirmação exige a `service_role key` do
Supabase — essa chave nunca pode rodar no navegador, só no servidor.
**Precisa fazer o deploy da função** (`supabase functions deploy
create-user`) pra esse botão funcionar — só copiar o código não é
suficiente dessa vez.

---

## v0.13.0 — 31/07/2026

**Novo módulo "Painel do Gestor"** — central de comando do dia, em tempo
real (nada aqui é dado parado, tudo vem dos mesmos hooks com Realtime já
usados no resto do sistema):

- Goniômetro de taxa de confirmação do dia, internados agora,
  procedimentos lançados hoje, e quantos ainda não foram distribuídos
  pra nenhum fisioterapeuta.
- **Equipe hoje**: um cartão por fisioterapeuta com fila distribuída,
  barra de progresso (concluídos × total) e a lista de quem ainda falta.
- **Ainda sem distribuição**: internados ativos que ninguém colocou na
  fila do dia, com atalho direto pra ir distribuir.
- Atalhos visuais pra Fechamento, Faturamento, Financeiro e Painel de
  Procedimentos, cada um já com um número relevante daquele painel.

Sem migration — usa só tabelas que já existiam (`patient_queue`,
`daily_production`, `billing_entries`, `admissions`).

---

## v0.12.0 — 31/07/2026

**Gerar/imprimir lista de atendimento** — em Pacientes Internados,
selecione pacientes (ou deixe sem seleção pra usar todos os filtrados) e
gere uma lista pronta pra imprimir: sequência numerada, Nr. Atendimento,
paciente, procedimento do dia, quarto, leito e hospital — cada coluna
pode ser ligada/desligada antes de gerar.

**Distribuir para fisioterapeuta** — a partir da mesma seleção, distribui
os pacientes escolhidos pra um fisioterapeuta específico, numa data,
criando uma fila em ordem. Migration `0021` (`patient_queue`).

**Novo módulo "Minha Fila"** — o fisioterapeuta vê só os pacientes
distribuídos pra ele no dia, em ordem de sequência, com indicador de
"já lançado hoje" e botão de concluir. Virou a **rota inicial** do
perfil fisioterapeuta (inclusive no modo tablet), substituindo Novo
Atendimento nesse lugar — mas Novo Atendimento continua acessível como
antes, só deixou de ser a primeira tela.

---

## v0.11.0 — 31/07/2026

**Permissões granulares por papel** — nova tela em Usuários e Permissões:
matriz de ver/criar/editar/excluir por módulo, para cada papel (Admin de
empresa, Gestor, Financeiro, Fisioterapeuta, Auditor). Substitui a regra
fixa que só existia pro fisioterapeuta — agora qualquer papel pode ser
ajustado, e o padrão embutido cobre tudo até alguém mexer manualmente.
Migration `0020` (`role_permissions`).

**Faturamento manual** — novo módulo pra lançar o que veio no relatório
de repasse do Tasy (valor pago, glosado) por Nr. Atendimento +
procedimento + data, enquanto a importação automática desse relatório
não é viável (é PDF escaneado, sem texto real — OCR testado e não confiável
o bastante pra dado financeiro). Migration `0020` (`billing_entries`).

**Importação Tasy ganhou um segundo modo**: além de "Conciliar" (padrão,
não cria nada), agora tem "Carga inicial" — cria hospital, convênio,
paciente, procedimento e internação a partir do arquivo, pra popular uma
empresa nova de uma vez. Visualmente marcado como modo de risco (pode
precisar corrigir depois).

**Modo tablet para o fisioterapeuta** — perfil lançador agora usa um
shell completamente diferente ao logar: sem sidebar, navegação inferior
com ícones grandes (Lançar, Internados, Pacientes, Produção), pensado
pra uso com o dedo em tablet na correria do plantão. Se adapta sozinho às
permissões configuradas (se um admin liberar mais acesso pro
fisioterapeuta, a barra inferior mostra mais abas).

---

## v0.10.0 — 31/07/2026

**Bug crítico corrigido — travamento ao criar/editar internação.** Causa
raiz: o hook `useDraftState` (rascunho persistido contra reload de aba)
tinha uma função "limpar" que só apagava o rascunho salvo, mas nunca
resetava o estado de verdade — por isso Cancelar/X não fechavam nada, só
o botão Voltar do navegador. Corrigido.

**Nr. Atendimento vira campo real da internação e chave da conciliação.**
Antes casávamos Tasy × lançamento por (paciente + procedimento + data);
agora é pelo **Nr. Atendimento** — o ID da internação no Tasy, 1:1 com a
internação (que pode ter vários procedimentos em várias datas enquanto o
paciente estiver internado). Campo adicionado no cadastro de internação
(Internações e Novo Atendimento), visível e buscável na listagem, e
exibido em Produção Diária, na conciliação Tasy e no Fechamento.

**Internações finalizadas ficam ocultas por padrão** — só aparecem se o
filtro de status for mudado explicitamente.

**Alta sempre confirma** — o passo inicial virou uma pergunta explícita
("Tem certeza que quer dar alta?"), mostrando se já tem procedimento
lançado hoje ou não, em vez de só completar silenciosamente quando havia
lançamento.

**Combobox de fisioterapeuta/procedimento não vem mais pré-selecionado**
em nenhuma tela — força busca, evita lançar sem querer no default.

**Leitos**: corrigido bug onde editar uma internação já com alta
reocupava o leito sem querer. Adicionado botão "Concluir" pra sair de
"Higienização" — não existe critério automático pra saber quando a
limpeza física terminou, então é uma ação manual.

**Contratos**: convênio agora é opcional via checkbox — "Este contrato
tem um convênio específico"; desmarcado, o contrato é direto com o
hospital, cobrindo todos os atendimentos independente do convênio do
paciente.

---

## v0.9.0 — 30/07/2026

**Correção crítica**: importações/conciliações grandes causavam
"Failed to fetch" no fim do processo — cada linha alterada disparava uma
busca completa via Realtime, e com milhares de linhas de uma vez isso
sobrecarregava o navegador. `useSupabaseCollection` agora agrupa
("debounce") mudanças próximas numa única busca.

**Evolução Clínica redesenhada de novo** — desta vez como prontuário:
agrupada por paciente/internação, cada grupo mostra suas notas em ordem
cronológica, com contador e data da última evolução. Muito mais fácil de
entender que uma lista solta de notas.

**Edição de lançamento não confirmado** — Produção Diária ganhou editar e
excluir, mas só para lançamentos que **ainda não foram confirmados pelo
Tasy** (depois de confirmado, fica travado — é o registro oficial).

**Novo módulo "Fechamento"** — visão de lançado × confirmado × não
confirmado, com presets de período (Hoje/Ontem/Semana/Mês/Personalizado),
filtro por hospital e convênio, goniômetro de taxa de confirmação, barra
de composição visual, gráficos por dia e por hospital, e a lista dos não
confirmados prontos pra ação. Pensado como o "ritual de fechamento"
diário/semanal da operação.

---

## v0.8.0 — 30/07/2026

**Zona de risco em Configurações** (só para o admin InovareTech): limpeza
de base por categoria, restrita à **empresa ativa** (nunca todas de uma
vez). Checkboxes por categoria (auditoria, Tasy, financeiro, atendimento,
internações, escalas, contratos, pacientes, equipe, procedimentos,
convênios, estrutura física), diálogo de confirmação simples, exclusão
numa ordem que respeita as dependências entre tabelas. Sem migration —
usa as tabelas que já existem.

---

## v0.7.1 — 30/07/2026

- **Hora de entrada na internação** (migration `0019`) — simétrico ao
  horário de alta que já existia. Aplicado em Internações e no fluxo
  Novo Atendimento.
- **Código do procedimento buscável** — todos os Comboboxes de
  procedimento agora mostram e permitem buscar pelo código, não só nome.
- **Correção real na conciliação Tasy**: o índice de casamento tratava só
  UM lançamento por (paciente + procedimento + dia) — se o paciente
  tivesse o mesmo procedimento 2x no mesmo dia (ex.: Motora de manhã e à
  tarde), o segundo lançamento nunca conseguia ser confirmado. Agora é
  uma fila por chave — a conciliação valida **quantidade por dia**, não
  horário exato, exatamente como esperado.
- **"Adicionar mais procedimentos para o mesmo paciente"** — no fluxo
  Novo Atendimento, depois de lançar um procedimento e ver "Feito!", um
  botão leva direto de volta pra lançar outro procedimento pro mesmo
  paciente/internação, sem reiniciar o fluxo inteiro.

---

## v0.7.0 — 30/07/2026

**Correção de bug crítico:** edição de paciente (e qualquer tela com Select
dentro de Sheet) podia travar a página inteira sem erro no console —
combinação conhecida de conflito de foco entre essas duas bibliotecas.
Adicionada rede de segurança global (`usePointerEventsGuard`) que libera a
página sozinha se isso acontecer de novo, em qualquer tela.

**Evolução Clínica reescrita** — tinha o mesmo defeito de seletor sem busca
já corrigido em outras telas, mostrava ID cru em vez de hospital/unidade,
e não tinha filtro nenhum. Agora com Combobox pesquisável, filtro por
paciente e exibição decente.

**Hora no lançamento de procedimento** (migration `0018`) — todo
lançamento agora registra horário, não só data. Aplicado em Produção
Diária, lançamento rápido em Pacientes Internados e lançamento antes da
alta. Data+hora exibidos juntos em todas as tabelas e relatórios que
mostram produção.

**Código do procedimento visível** em todas as telas que mostram nome de
procedimento (Produção Diária, Painel de Procedimentos, Relatórios,
linha do tempo do paciente).

**Status "Em atendimento"** — internação com 1+ procedimento lançado no
dia deixa de aparecer como "Lançado" e passa a "Em atendimento";
"Pendente" fica só para quem não tem nenhum lançamento ainda.

**Filtros em Pacientes Internados**: status (internado/alta/todos) e
período de entrada (de/até), além dos já existentes (unidade, busca,
pendentes de hoje).

**Novo módulo "Novo Atendimento"** — fluxo guiado Paciente → Internação →
Procedimento, um passo de cada vez, podendo encerrar em qualquer etapa
(só cadastrar o paciente, ou parar depois da internação, sem obrigar o
lançamento do procedimento). Liberado também para o perfil fisioterapeuta
lançador, como rota inicial dele.

---

## v0.6.0 — 29/07/2026 — *"Tasy vira conciliação"*

**Mudança de modelo, não incremento** — a importação Tasy funcionava
errado desde a v0.5.x: tratava o arquivo como carga (criava paciente,
internação, procedimento do zero). O real é o oposto: a equipe lança o
procedimento manualmente primeiro; o Tasy chega depois só para conferir.

- Importação Tasy **não cria mais nada** — hospital, convênio,
  fisioterapeuta, paciente, procedimento e internação continuam 100%
  cadastro manual, anterior ao Tasy.
- Cada linha do relatório tenta casar com um lançamento de produção já
  existente (**paciente + código do procedimento + data**). Bateu →
  `confirmado_tasy = true` (baixado/finalizado). Não bateu → vira uma
  **pendência** (nova aba na tela), sem criar nada e sem virar glosa
  sozinha — alguém decide depois.
- **"Desfazer conciliação" agora reverte de verdade**: volta
  `confirmado_tasy` a `false` em tudo que aquela importação tinha
  confirmado (antes só mudava um rótulo no histórico).
- Produção Diária mostra o status de conciliação (Confirmado / Não
  confirmado) em vez da antiga coluna "Origem".
- Migration `0017`: `daily_production.confirmado_tasy` +
  `confirmado_em`; `tasy_import_rows` ganha `matched_daily_production_id`
  e os status viram `confirmado` / `pendente` / `ignorado`.

**Isolado como etapa futura, de propósito:** valores em R$ no Financeiro
dependem de uma tabela de preço por procedimento×convênio que ainda não
existe — hoje o sistema só pode mostrar contagem (lançados × confirmados),
não faturamento em reais.

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
