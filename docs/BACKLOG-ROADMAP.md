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

Legenda de status: `FEITO` · `FEITO (depende de config)` · `PENDENTE` — atualizado a cada entrega; Fase A (A1–A3) concluída na v0.58.0; B, C e D pendentes.

| ID | Item | Prioridade | Versão | Status | Dependências / observações |
|----|------|-----------|--------|--------|----------------------------|
| A1 | Avaliação funcional estruturada (Barthel, MRC-SS, IMS, FSS-ICU, Borg) com momentos admissão/reavaliação/alta | P0 | 0.58.0 | FEITO | Migration 0034. Itens das escalas devem ser validados pela equipe clínica antes do uso oficial |
| A2 | Curva de ganho funcional por paciente + ganho por unidade | P0 | 0.58.0 | FEITO | Depende de A1 |
| A3 | Jornada do paciente (linha do tempo única: internação → mudanças de unidade → evoluções → procedimentos → avaliações → alta) | P1 | 0.58.0 | FEITO | Usa admission_unit_history (v0.56.0) |
| B1 | Painel de valor: ganho funcional × dias de internação × reinternação × glosa | P0 | 0.59.0 | PENDENTE | Depende de A1 |
| B2 | Relatório mensal narrativo (texto determinístico a partir dos números) | P1 | 0.59.0 | PENDENTE | Versão com IA em C3 |
| B3 | Radar de prioridade do dia, explicável (regras, com o motivo de cada paciente) | P0 | 0.59.0 | PENDENTE | Regras transparentes; sem "caixa preta" |
| B4 | Briefing da manhã na Minha Fila | P2 | 0.59.0 | PENDENTE | Usa B3 |
| C1 | Edge Function `ai-assist` (chave Anthropic em secret, limites, sem dado identificável desnecessário) | P0 | 0.60.0 | PENDENTE | Requer deploy da função + secret `ANTHROPIC_API_KEY` |
| C2 | IA: evolução livre → dado estruturado (escalas, intercorrências, condutas, metas) com confirmação do fisio | P0 | 0.60.0 | PENDENTE | Depende de C1 e A1 |
| C3 | IA: relatório mensal narrativo e "perguntar aos dados" | P1 | 0.60.0 | PENDENTE | Responde só a partir de números agregados enviados pelo app |
| C4 | IA: resumo de alta para paciente/família (imprimível) | P2 | 0.60.0 | PENDENTE | Revisão obrigatória do fisio antes de entregar |
| D1 | Prevenção de glosa: checagens antes do faturamento (duplicidade, frequência diária, lançamento fora da internação ativa, sem diagnóstico) | P1 | 0.61.0 | PENDENTE | Regras de convênio específicas ficam para quando houver tabela de regras cadastrada |
| D2 | Projeção do faturamento do mês (rotulada como estimativa) | P2 | 0.61.0 | PENDENTE | Linear sobre produção real do mês |
| — | Escala PERME e outras escalas | P3 | — | PENDENTE | Precisa da tabela oficial de itens validada pela equipe clínica |
| — | IA por voz (ditado) no tablet | P3 | — | PENDENTE | Depende de C2 estável em produção |
| — | Regras de glosa por convênio (cadastro de regras) | P3 | — | PENDENTE | Depende de levantar as regras reais de cada convênio |
| — | Previsão de alta / tempo de permanência com modelo estatístico | P3 | — | PENDENTE | Precisa de volume de avaliações (A1) acumulado para ter base |
