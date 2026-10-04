# Backlog — "do volume ao resultado" (inovare.fisio)

Objetivo: o sistema hoje prova **produção** (o que foi feito e faturado).
Este backlog o torna referência provando **resultado clínico** (o paciente
saiu melhor e mais rápido) e **valor** (o que isso poupou ao hospital),
com IA como apoio — nunca como decisora.

Princípios (valem para todos os itens):
- Todo número vem do dado real; sem dado, o sistema diz "sem dado", nunca estima em silêncio.
- IA apoia, nunca decide: tudo que a IA produz passa por confirmação humana antes de virar registro.
- Funciona sem IA: cada item tem um caminho determinístico; a IA só melhora.
- Dados clínicos são sensíveis (LGPD): isolamento por empresa (RLS), trilha de auditoria.

Legenda de status: `FEITO` · `FEITO (depende de config)` · `PENDENTE` — atualizado a cada entrega; Fases A–D (v0.58–v0.61), menu (v0.62.0) e itens E (v0.63.0) concluídos; resta PERME. Fase C só funciona após deploy da função + secret.

| ID | Item | Prioridade | Versão | Status | Dependências / observações |
|----|------|-----------|--------|--------|----------------------------|
| A1 | Avaliação funcional estruturada (Barthel, MRC-SS, IMS, FSS-ICU, Borg) com momentos admissão/reavaliação/alta | P0 | 0.58.0 | FEITO | Migration 0034. Itens das escalas devem ser validados pela equipe clínica antes do uso oficial |
| A2 | Curva de ganho funcional por paciente + ganho por unidade | P0 | 0.58.0 | FEITO | Depende de A1 |
| A3 | Jornada do paciente (linha do tempo única: internação → mudanças de unidade → evoluções → procedimentos → avaliações → alta) | P1 | 0.58.0 | FEITO | Usa admission_unit_history (v0.56.0) |
| B1 | Painel de valor: ganho funcional × dias de internação × reinternação × glosa | P0 | 0.59.0 | FEITO | Depende de A1 |
| B2 | Relatório mensal narrativo (texto determinístico a partir dos números) | P1 | 0.59.0 | FEITO | Versão com IA em C3 |
| B3 | Radar de prioridade do dia, explicável (regras, com o motivo de cada paciente) | P0 | 0.59.0 | FEITO | Regras transparentes; sem "caixa preta" |
| B4 | Briefing da manhã na Minha Fila | P2 | 0.59.0 | FEITO | Usa B3 |
| C1 | Edge Function `ai-assist` (chave Anthropic em secret, limites, sem dado identificável desnecessário) | P0 | 0.60.0 | FEITO (depende de config) | Requer deploy da função + secret `ANTHROPIC_API_KEY` |
| C2 | IA: evolução livre → dado estruturado (escalas, intercorrências, condutas, metas) com confirmação do fisio | P0 | 0.60.0 | FEITO (depende de config) | Depende de C1 e A1 |
| C3 | IA: relatório mensal narrativo e "perguntar aos dados" | P1 | 0.60.0 | FEITO (depende de config) | Responde só a partir de números agregados enviados pelo app |
| C4 | IA: resumo de alta para paciente/família (imprimível) | P2 | 0.60.0 | FEITO (depende de config) | Revisão obrigatória do fisio antes de entregar |
| D1 | Prevenção de glosa: checagens antes do faturamento (duplicidade, frequência diária, lançamento fora da internação ativa, sem diagnóstico) | P1 | 0.61.0 | FEITO | Regras de convênio específicas ficam para quando houver tabela de regras cadastrada |
| D2 | Projeção do faturamento do mês (rotulada como estimativa) | P2 | 0.61.0 | FEITO | Linear sobre produção real do mês |
| — | Escala PERME e outras escalas | P3 | — | PENDENTE | Precisa da tabela oficial de itens validada pela equipe clínica |
| E1 | Ditado por voz na evolução (reconhecimento do navegador, pt-BR) | P3 | 0.63.0 | FEITO | Depende do navegador (Chrome/Edge/Safari); no tablet funciona onde o navegador suportar |
| E2 | Regras de glosa por convênio (limite/dia, teto por internação, exige diagnóstico) | P3 | 0.63.0 | FEITO | Migration 0036. As regras reais de cada convênio precisam ser cadastradas por quem conhece o contrato |
| E3 | Previsão de alta por mediana histórica (estimativa) | P3 | 0.63.0 | FEITO | Só calcula com 5+ altas anteriores; modelo estatístico mais sofisticado fica para quando houver volume de avaliações (A1) |
| F1 | Menu enxuto com hubs e abas (rotas e permissões preservadas) | P1 | 0.62.0 | FEITO | Pesquisa de Satisfação e Importação Tasy mantidas como itens próprios |
