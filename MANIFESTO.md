# Manifesto de integridade — inovare.fisio

Este arquivo existe porque o ambiente onde o projeto é desenvolvido já
resetou duas vezes (08/08/2026 e 20/08/2026), perdendo código que
precisou ser reconstruído manualmente. Esse manifesto é a prova de que
o pacote que você está recebendo agora é uma cópia **completa e
verificada** — não um pedaço, não uma reconstrução parcial.

## Este pacote

- **Versão:** 0.44.0
- **Gerado em:** 26/08/2026
- **Tipo:** projeto completo (não é um delta/incremento)
- **Arquivos de código:** 111 (.ts, .tsx, .sql)

## Verificação feita antes de empacotar

- [x] `npx tsc --noEmit` — zero erros de tipo
- [x] `npm run build` — build de produção concluído sem erros
- [x] `python3 scripts/auditoria_funcionalidades.py` — **38/38 funcionalidades OK, 5/5 arquivos livres do bug de fuso horário**
- [x] Parser Tasy Modelo 2 testado contra o arquivo real da Dra. Monika (846 linhas extraídas corretamente)

## Prática a partir de agora

Pra evitar perder trabalho de novo: **toda entrega passa a ser o
projeto completo**, não só os arquivos que mudaram. Isso custa um
pouco mais de espaço no zip, mas garante que qualquer pacote entregue,
sozinho, é o suficiente pra reconstruir o sistema inteiro — não
depende de "pacote anterior + este aqui".

**Recomendação importante:** guarde uma cópia deste zip em um lugar
que não seja só o computador de trabalho — Google Drive, OneDrive, ou
qualquer nuvem — com a data no nome do arquivo. O ambiente onde o
código é gerado não tem garantia de persistência entre sessões; a
cópia que fica com você é que é o backup real.
