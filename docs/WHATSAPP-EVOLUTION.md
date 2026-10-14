# WhatsApp via Evolution API — passo a passo (v0.67.0)

Mesmo padrão do OficinaOS. Um número (instância) por empresa cliente.

## 1. Banco
Aplique `supabase/migrations/0038_whatsapp_evolution.sql` no projeto Supabase do fisio (SQL Editor).
É idempotente nas colunas de paciente (`if not exists`). Aplicar **antes** de publicar a função.

## 2. Função
```
supabase functions deploy whatsapp
```
Sem secret extra. Ela só aceita chamadas de usuário logado da própria empresa (ou admin InovareTech).

## 3. Servidor Evolution
- HTTPS no domínio (ex.: `https://evo.inovaretech.com`) — a função **recusa** http, localhost e IPs privados.
- Use a chave **global** (`AUTHENTICATION_API_KEY`) para a função conseguir criar a instância.

## 4. No sistema (admin da empresa)
Configurações → WhatsApp → Conexão:
1. Endereço, nome da instância (um por número, ex. `fisio-minhaempresa`), chave. Marque "Envio automático ligado". Salvar.
2. **Conectar por QR Code** e ler com o WhatsApp do número da empresa (Aparelhos conectados).
3. Aba Modelos: revise o texto "Pesquisa de satisfação pós-alta" (variáveis: `{{primeiro_nome}}`, `{{empresa}}`, `{{hospital}}`, `{{data_alta}}`, `{{link}}`).
4. Cadastre o telefone dos pacientes (Pacientes → campo Telefone/WhatsApp).

## 5. Uso
- Individual: Pacientes Internados → paciente com alta → Pesquisa. Sai pelo WhatsApp se conectado; senão abre o `wa.me`.
- Lote: Pesquisa de Satisfação → "Enviar para altas sem pesquisa". Fica de fora: óbito, alta na UTI externa, sem telefone válido, opt-out, quem já tem pesquisa.
- Acompanhe em WhatsApp → Envios (pausar/retomar/cancelar).

## Cuidados
- API **não oficial**: há risco de bloqueio do número. Mantenha pausa de 5–12 s e limite diário baixo (padrão 150/24 h); comece com poucos envios.
- Opt-out: marcando "Não enviar mensagens por WhatsApp" no paciente, o servidor recusa o envio (individual e em lote).
- Fechar a tela durante um lote interrompe o laço; o lote fica "Em andamento" e continua em Envios → Continuar.
