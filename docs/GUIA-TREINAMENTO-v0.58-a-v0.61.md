# Guia de treinamento — novidades das versões 0.58 a 0.61 (inovare.fisio)

Para quem conduz o treinamento: cada seção é uma "mini-aula" de 5–10 minutos
por perfil. Sugestão de ordem: Fisioterapeuta → Supervisor/Gestor → Financeiro → Diretoria.

> Mensagem-chave para a equipe: **a IA e os painéis ajudam, mas quem decide é o profissional.** Tudo que a IA sugere precisa ser revisado antes de gravar.

## Antes de começar (TI / administrador)
1. Aplicar no Supabase as migrations **0032, 0033, 0034 e 0035** (nessa ordem).
2. Publicar a função de IA: `supabase functions deploy ai-assist` e definir o secret `ANTHROPIC_API_KEY`. Sem isso, os botões de IA avisam "ainda não configurada" e todo o resto funciona normalmente.
3. Equipe clínica: **validar os itens das escalas** (Barthel, MRC-SS, IMS, FSS-ICU, Borg) antes do uso oficial.

## 1. Fisioterapeuta (uso diário)

**Minha Fila — briefing da manhã**
- Ao abrir, aparece a saudação com o resumo da fila e o bloco **"Quem olhar primeiro"**.
- Cada paciente mostra o **motivo** (ex.: "Sem atendimento há 3 dias", "Piora funcional em Barthel: 60 → 45"). Clique em *Como é calculado* para ver todas as regras.
- Treinar: "o radar sugere, você decide" — se discordar, siga a sua avaliação clínica.

**Avaliação funcional**
1. Menu *Avaliação funcional* → escolha o paciente.
2. *Nova avaliação* → escolha a escala (Barthel, MRC-SS, IMS, FSS-ICU ou Borg), o momento (**Admissão**, **Reavaliação** ou **Alta**) e responda todos os itens. O escore aparece ao vivo; só salva com tudo respondido.
3. A **curva de ganho** aparece no topo; o ganho só é calculado a partir da 2ª avaliação.
- Regra de ouro para treinar: **avaliar na admissão e na alta, no mínimo**. Sem as duas pontas, não há como provar o resultado.
- Erro de lançamento? Use a lixeira da avaliação e lance de novo (reavaliar cria uma linha nova; não se edita o passado).

**Evolução clínica com IA (opcional)**
1. *Evolução Clínica → Nova evolução* → escreva o texto normalmente.
2. Clique **Estruturar com IA** (ou *Preencher manualmente*). Surgem resumo, intercorrências, condutas e metas **editáveis**.
3. Corrija o que for preciso e salve. O texto original continua sendo o registro oficial.
4. Se o texto citar IMS ou Borg com número, aparece o botão para registrar direto na Avaliação funcional.
- Treinar: **nunca salvar sem ler**. Não digitar CPF/telefone no texto (o sistema remove antes de enviar à IA, mas o hábito certo é não colocar).

**Jornada do paciente**
- Menu *Jornada do paciente* → escolha o paciente: linha do tempo única (entrada, mudanças de unidade, evoluções, procedimentos por dia, avaliações, alta). Botão *Imprimir*.
- Útil para passagem de plantão e reunião de caso.

**Resumo de alta para a família**
- Na Jornada → *Gerar rascunho*. Leia, edite, marque **"Revisei o texto e assumo a responsabilidade"** e só então imprima.
- A IA não recebe o nome do paciente nem o texto das evoluções — o nome é colocado só na impressão.

## 2. Supervisor / Gestor operacional
- **Painel do Gestor → Radar de prioridade**: visão de todos os internados com sinal de atenção, ordenados por pontos e com o motivo. Use na reunião da manhã para redistribuir a equipe.
- **Impacto Assistencial → Painel de valor**: ganho funcional, permanência média, reinternação em 30 dias, glosa e **cobertura de avaliação**.
  - Treinar: "sem dado" não é erro — significa que a equipe ainda não lançou reavaliações suficientes. O primeiro indicador a cobrar é a **cobertura de avaliação**.
- **Avaliação funcional → Ganho por unidade**: compara o ganho médio entre unidades (UTI, Enfermaria…).
- Cobrança sugerida: toda internação com avaliação de admissão em até 24–48 h e reavaliação semanal (definir a meta com a coordenação clínica).

## 3. Financeiro / faturamento
- **Fechamento → Prevenção de glosa**: antes de fechar o período, abra a lista. Resolva primeiro os alertas **vermelhos** (duplicidade, fora da internação, sem procedimento) e depois os amarelos (frequência alta, sem diagnóstico, sem convênio).
  - Os filtros por regra aceleram a correção em lote; *Quais regras são checadas* explica cada uma.
  - Limite: regras específicas de cada convênio ainda **não** são checadas.
- **Fechamento → Projeção do mês**: estimativa linear (média diária × dias do mês). Treinar: é **estimativa**, não promessa — não considera glosas futuras nem o atraso do repasse do hospital. Mostra "sem dado" quando faltam 3 dias de lançamento ou o repasse do mês anterior.

## 4. Diretoria
- **Impacto Assistencial → Painel de valor**: os 5 números que contam a história do hospital — *ganho funcional, permanência, reinternação, glosa, cobertura*.
- **Relatório do período**: texto pronto (copiar e colar em ata/e-mail). *Reescrever com IA* produz uma versão para diretoria, mantendo os mesmos números — revise antes de enviar.
- **Pergunte aos dados**: perguntas em linguagem natural ("a glosa está alta?"). A IA responde **só** com os indicadores agregados da tela; se os dados não bastam, ela diz que não dá para responder.

## Perguntas frequentes para o treinamento
- *A IA vê os dados dos pacientes?* Só o que a tela enviar: no painel, números agregados; na evolução, o texto digitado (com CPF/e-mail/telefone removidos); no resumo de alta, dados clínicos agregados sem nome.
- *E se a IA estiver fora do ar?* Tudo continua funcionando; os botões de IA avisam e o caminho manual segue disponível.
- *Os números podem estar errados?* Todos vêm dos registros lançados. "Sem dado" aparece quando não há base — nada é estimado em silêncio (exceto a Projeção do mês, sempre rotulada como estimativa).
- *Posso editar uma avaliação?* Não; exclua e lance de novo (preserva a curva e a auditoria).

## Checklist de implantação (2 semanas)
1. Semana 1: treinar fisioterapeutas em Avaliação funcional (admissão + alta) e Minha Fila.
2. Semana 1: supervisor acompanha a **cobertura de avaliação** diariamente.
3. Semana 2: ligar a IA (função + secret), treinar evolução estruturada e Jornada.
4. Fim da semana 2: gestor e diretoria passam a usar Painel de valor e Relatório do período em reunião.
