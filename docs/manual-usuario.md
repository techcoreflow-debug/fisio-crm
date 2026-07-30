# Manual do usuário — inovare.fisio

> Este arquivo é a fonte viva do manual — atualizado na mesma entrega
> sempre que uma funcionalidade muda ou é criada, igual o `CHANGELOG.md`.
> As versões em Word e PowerPoint são exportações geradas a partir daqui;
> se algo divergir, este arquivo manda.

## O que é o inovare.fisio

Produto InovareTech para gestão de empresas de fisioterapia que atuam
**dentro de hospitais** — cadastro de pacientes, acompanhamento de
internados, lançamento de produção, faturamento por convênio (com
controle de glosa) e importação direta dos relatórios do Tasy.

## Perfis de acesso

| Perfil | O que vê e faz |
|---|---|
| **Admin InovareTech** | Acesso total, em todas as empresas. Só ele vê o seletor de empresa no topo e pode vincular um usuário novo a uma empresa. |
| **Admin de empresa / Gestor / Financeiro / Auditor** | Acesso completo, mas travado na própria empresa — não veem o seletor. |
| **Fisioterapeuta (lançador)** | Acesso restrito a **Pacientes**, **Pacientes Internados** (só consulta + lançar procedimento, sem criar/editar internação ou dar alta) e **Produção Diária**. |

## Primeiros passos (uma empresa nova)

Ordem que funciona sem travar em nenhum cadastro-pré-requisito:

1. **Empresas** → criar a empresa. Vira a empresa ativa automaticamente.
2. **Hospitais** → cadastrar o(s) hospital(is) atendidos.
3. **Unidades** → alas dentro do hospital (ex.: UTI, Enfermaria 2º andar).
4. **Quartos** e **Leitos** (opcional, mas recomendado para controle de ocupação).
5. **Convênios** → operadoras que pagam pelos atendimentos.
6. **Contratos** → vincula hospital + convênio + valor mensal. Marque se
   cobre **todas as unidades** do hospital ou só alas específicas.
7. **Equipes** e **Fisioterapeutas**.
8. **Procedimentos** → catálogo de códigos (ou deixe a Importação Tasy
   criar automaticamente).

Depois disso, o dia a dia roda por **Pacientes Internados** e
**Produção Diária** — o resto é consulta/ajuste ocasional.

## Novo Atendimento (fluxo guiado)

Jeito mais rápido de começar: cadastra **paciente → internação →
procedimento** em sequência, um passo de cada vez. Pode parar em
qualquer etapa — só cadastrar o paciente já é válido, ou parar depois de
registrar a internação sem lançar procedimento ainda. É a rota inicial do
perfil fisioterapeuta (lançador).

## Pacientes

Cadastro com nome, data de nascimento, sexo e **convênio** — trocar o
convênio de um paciente grava automaticamente no histórico dele, nunca
sobrescreve em silêncio. Cada paciente tem uma **linha do tempo** (ícone
de relógio na lista): internações, altas, procedimentos e evoluções em
ordem cronológica, tudo num só lugar.

## Pacientes Internados

Lista de quem está sendo acompanhado pela equipe. Filtros por **unidade**,
busca por nome ou código (`IN-000123`), e um botão **"Só pendentes de
hoje"** que mostra quem ainda não teve procedimento lançado no dia.

- **Lançar procedimento**: direto na linha, sem precisar ir em Produção
  Diária — escolhe fisioterapeuta, procedimento e data.
- **Dar alta**: pede a **data e hora exatas**. Se não houver nenhum
  procedimento lançado na data da alta, o sistema **bloqueia** e pergunta
  se houve atendimento antes de sair — obriga lançar na hora ou confirmar
  explicitamente que não houve.

## Produção Diária

Lançamento manual de procedimentos fora do fluxo de Pacientes Internados.
Os três campos (internação, fisioterapeuta, procedimento) usam busca —
digite pra filtrar em vez de rolar uma lista longa. Só aparecem internações
**ativas**.

## Conciliação Tasy

**Não é carga** — a equipe lança o procedimento manualmente primeiro (em
Pacientes Internados ou Produção Diária). O Tasy chega depois só pra
conferir: sobe o relatório "Produtividade Médica" (`.xls`, mas na prática
é texto) e o sistema tenta casar cada linha com um lançamento já
existente, pela combinação **paciente + código do procedimento + data**.

- **Bateu** → o lançamento fica marcado como **confirmado** (baixado/
  finalizado pelo hospital).
- **Não bateu** → vira uma **pendência** — o sistema não cria nada
  sozinho (nem paciente, nem procedimento, nem internação) e não marca
  como glosa automaticamente. Alguém revisa a lista de pendências e
  decide.

"Desfazer conciliação" reverte de verdade: volta tudo que aquela
conciliação tinha confirmado para "não confirmado".

**Limitação conhecida e proposital:** hoje não existe tabela de preço por
procedimento×convênio, então não há valor em R$ pra mostrar por
procedimento — o que dá pra acompanhar é contagem (quantos foram
lançados × quantos vieram confirmados pelo Tasy). Faturamento em reais é
uma etapa futura, isolada de propósito.

## Financeiro e glosa

**Contas a receber**: uma linha por contrato/competência, com status
(pendente/pago/atrasado) e **valor líquido** (bruto menos glosa).

**Glosa** tem um parâmetro em Configurações que muda como ela é registrada:

- **Modo detalhado** (ligado): marca a glosa procedimento a procedimento
  em Produção Diária/Pacientes Internados; o Financeiro soma sozinho na
  competência do convênio.
- **Modo manual** (desligado): digita o valor direto na conta a receber,
  sem detalhar procedimento a procedimento.

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

## Configurações

Dados da empresa, preferências de notificação e o parâmetro de glosa —
tudo salva de verdade no banco assim que você altera, sem botão "salvar"
escondido que não faz nada.

## Auditoria

Trilha real de quem criou, editou, excluiu, deu alta ou importou o quê e
quando — gerada automaticamente pelo sistema, nunca editável.
