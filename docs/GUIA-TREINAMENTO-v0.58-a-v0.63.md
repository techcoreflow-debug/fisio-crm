# Guia de treinamento — novidades das versões 0.58 a 0.63 (inovare.fisio)

Para quem conduz o treinamento: cada seção é uma "mini-aula" de 5–10 minutos
por perfil. Sugestão de ordem: Fisioterapeuta → Supervisor/Gestor → Financeiro → Diretoria.

> Mensagem-chave para a equipe: **a IA e os painéis ajudam, mas quem decide é o profissional.** Tudo que a IA sugere precisa ser revisado antes de gravar.

## Antes de começar (TI / administrador)
1. Aplicar no Supabase as migrations **0032 a 0036** (nessa ordem). A **0036** (regras por convênio) é a mais recente.
2. IA (pode ficar para depois): `supabase functions deploy ai-assist` e definir o secret `ANTHROPIC_API_KEY`. **Enquanto não estiver configurada, nada trava**: os botões de IA só mostram um aviso amarelo ("ainda não está configurada") e todo o resto funciona normalmente.
3. Equipe clínica: **validar os itens das escalas** (Barthel, MRC-SS, IMS, FSS-ICU, Borg) antes do uso oficial.
4. Financeiro/coordenação: **cadastrar as regras reais de cada convênio** em Cadastros → Convênios (veja a seção 3).

## 0. O novo menu (para todos — 5 minutos)
O menu ficou bem menor (cerca de 16 itens para o administrador, antes eram ~38). Nenhuma tela sumiu: as telas parecidas foram **agrupadas com abas no topo da página**.

| Item do menu | Abas dentro |
|---|---|
| **Painéis** | Executivo · Dia a dia · Impacto clínico · Operacional · Financeiro |
| **Pacientes Internados** | Lista · Mapa de leitos · Evolução clínica · Avaliação funcional · Jornada |
| **Financeiro** | Contas a receber · Repasse Tasy · Fechamento |
| **Controle e auditoria** | Auditoria · Diagnóstico · Desempenho da fila |
| **Relatórios e BI** | Relatórios · Procedimentos · Business Intelligence |
| **Cadastros** | Empresas · Hospitais · Clínicas · Unidades · Quartos · Convênios · Contratos · Centros de custo · Equipes |
| **Configurações** | Geral · Usuários e permissões · Integrações |

- Cada pessoa vê **apenas as abas que tem permissão** — as permissões continuam por tela, na mesma tela de Permissões de sempre.
- Links e favoritos antigos continuam funcionando.
- "Escalas" agora se chama **Escala de trabalho** (para não confundir com as escalas funcionais Barthel/MRC etc.).
- Dica: o atalho de busca (paleta de comandos) continua achando qualquer tela pelo nome.

## 1. Fisioterapeuta (uso diário)

**Minha Fila — briefing da manhã**
- Ao abrir, aparece a saudação com o resumo da fila e o bloco **"Quem olhar primeiro"**.
- Cada paciente mostra o **motivo** (ex.: "Sem atendimento há 3 dias", "Piora funcional em Barthel: 60 → 45"). Clique em *Como é calculado* para ver todas as regras.
- Treinar: "o radar sugere, você decide" — se discordar, siga a sua avaliação clínica.

**Avaliação funcional**
1. *Pacientes Internados → aba Avaliação funcional* → escolha o paciente.
2. *Nova avaliação* → escolha a escala (Barthel, MRC-SS, IMS, FSS-ICU ou Borg), o momento (**Admissão**, **Reavaliação** ou **Alta**) e responda todos os itens. O escore aparece ao vivo; só salva com tudo respondido.
3. A **curva de ganho** aparece no topo; o ganho só é calculado a partir da 2ª avaliação.
- Regra de ouro para treinar: **avaliar na admissão e na alta, no mínimo**. Sem as duas pontas, não há como provar o resultado.
- Erro de lançamento? Use a lixeira da avaliação e lance de novo (reavaliar cria uma linha nova; não se edita o passado).

**Evolução clínica com IA (opcional)**
1. *Pacientes Internados → aba Evolução clínica → Nova evolução* → escreva o texto normalmente.
2. Clique **Estruturar com IA** (ou *Preencher manualmente*). Surgem resumo, intercorrências, condutas e metas **editáveis**.
3. Corrija o que for preciso e salve. O texto original continua sendo o registro oficial.
4. Se o texto citar IMS ou Borg com número, aparece o botão para registrar direto na Avaliação funcional.
- Treinar: **nunca salvar sem ler**. Não digitar CPF/telefone no texto (o sistema remove antes de enviar à IA, mas o hábito certo é não colocar).

**Ditado por voz**
- Na Evolução clínica, botão **Ditar** (microfone): fale e o texto vai sendo escrito; **Parar ditado** encerra. Funciona em Chrome/Edge/Safari recentes e pede permissão de microfone na primeira vez.
- Aviso para a equipe: o áudio é processado pelo reconhecimento de voz do navegador — **não ditar nome completo, CPF ou telefone do paciente**. Sempre releia o texto ditado antes de salvar.

**Jornada do paciente**
- Menu *Pacientes Internados → aba Jornada*: escolha o paciente: linha do tempo única (entrada, mudanças de unidade, evoluções, procedimentos por dia, avaliações, alta). Botão *Imprimir*.
- Útil para passagem de plantão e reunião de caso.

**Resumo de alta para a família**
- Na Jornada → *Gerar rascunho*. Leia, edite, marque **"Revisei o texto e assumo a responsabilidade"** e só então imprima.
- A IA não recebe o nome do paciente nem o texto das evoluções — o nome é colocado só na impressão.

## 2. Supervisor / Gestor operacional
- **Painéis → Dia a dia → Altas prováveis (próx. 3 dias)**: estimativa de altas pela **mediana histórica** de permanência (mesmo diagnóstico ou, sem base, mesma unidade). Só aparece com 5+ altas anteriores; marca quem já passou da mediana. Treinar: é **estimativa**, não prognóstico — não considera a gravidade; a decisão de alta é clínica. Útil para planejar leitos e alta responsável. A mesma estimativa aparece na Jornada do paciente.
- **Painéis → Dia a dia → Radar de prioridade**: visão de todos os internados com sinal de atenção, ordenados por pontos e com o motivo. Use na reunião da manhã para redistribuir a equipe.
- **Painéis → Impacto clínico → Painel de valor**: ganho funcional, permanência média, reinternação em 30 dias, glosa e **cobertura de avaliação**.
  - Treinar: "sem dado" não é erro — significa que a equipe ainda não lançou reavaliações suficientes. O primeiro indicador a cobrar é a **cobertura de avaliação**.
- **Pacientes Internados → Avaliação funcional → Ganho por unidade**: compara o ganho médio entre unidades (UTI, Enfermaria…).
- Cobrança sugerida: toda internação com avaliação de admissão em até 24–48 h e reavaliação semanal (definir a meta com a coordenação clínica).

## 3. Financeiro / faturamento
- **Cadastros → Convênios → Regras de faturamento (opcional)** *(novo)*: para cada convênio, informe o **máximo de procedimentos por dia**, o **teto de procedimentos por internação** (sessões autorizadas) e se o convênio **exige diagnóstico**. Em branco = vale a regra geral. Quem cadastra deve ter o contrato/tabela do convênio em mãos — o sistema não presume nenhuma regra.
- **Financeiro → Fechamento → Prevenção de glosa**: antes de fechar o período, abra a lista. Resolva primeiro os alertas **vermelhos** (duplicidade, fora da internação, sem procedimento) e depois os amarelos (frequência alta, sem diagnóstico, sem convênio).
  - Os filtros por regra aceleram a correção em lote; *Quais regras são checadas* explica cada uma.
  - O alerta **"Acima do limite do convênio"** só aparece para convênios com regra cadastrada.
- **Financeiro → Fechamento → Projeção do mês**: estimativa linear (média diária × dias do mês). Treinar: é **estimativa**, não promessa — não considera glosas futuras nem o atraso do repasse do hospital. Mostra "sem dado" quando faltam 3 dias de lançamento ou o repasse do mês anterior.

## 4. Diretoria
- **Painéis → Impacto clínico → Painel de valor**: os 5 números que contam a história do hospital — *ganho funcional, permanência, reinternação, glosa, cobertura*.
- **Relatório do período**: texto pronto (copiar e colar em ata/e-mail). *Reescrever com IA* produz uma versão para diretoria, mantendo os mesmos números — revise antes de enviar.
- **Pergunte aos dados**: perguntas em linguagem natural ("a glosa está alta?"). A IA responde **só** com os indicadores agregados da tela; se os dados não bastam, ela diz que não dá para responder.

## Perguntas frequentes para o treinamento
- *A IA vê os dados dos pacientes?* Só o que a tela enviar: no painel, números agregados; na evolução, o texto digitado (com CPF/e-mail/telefone removidos); no resumo de alta, dados clínicos agregados sem nome.
- *E se a IA estiver fora do ar?* Tudo continua funcionando; os botões de IA avisam e o caminho manual segue disponível.
- *Ainda falta alguma coisa?* A escala **PERME** não foi incluída: depende da tabela oficial de itens validada pela equipe clínica. Quando vocês enviarem, entra.
- *Os números podem estar errados?* Todos vêm dos registros lançados. "Sem dado" aparece quando não há base — nada é estimado em silêncio (exceto a Projeção do mês, sempre rotulada como estimativa).
- *Posso editar uma avaliação?* Não; exclua e lance de novo (preserva a curva e a auditoria).

## Checklist de implantação (2 semanas)
0. Dia 1: apresentar o **novo menu** a todos (seção 0) e cadastrar as regras dos convênios.
1. Semana 1: treinar fisioterapeutas em Avaliação funcional (admissão + alta) e Minha Fila.
2. Semana 1: supervisor acompanha a **cobertura de avaliação** diariamente.
3. Semana 2: treinar evolução estruturada, ditado por voz e Jornada; ligar a IA (função + secret) quando estiver pronta — antes disso os botões de IA apenas avisam.
4. Fim da semana 2: gestor e diretoria passam a usar Painel de valor e Relatório do período em reunião.
