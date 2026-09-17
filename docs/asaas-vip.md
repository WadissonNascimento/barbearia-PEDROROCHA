# Cobrança automática dos planos VIP

Esta integração é exclusiva das assinaturas VIP dos clientes da barbearia. A cobrança da mensalidade do sistema para a barbearia continua usando o link já definido em `lib/systemBilling.ts` e não é processada por este fluxo.

## Variáveis de ambiente

```text
ASAAS_API_KEY=chave_da_api_do_asaas
ASAAS_WEBHOOK_TOKEN=token_longo_e_aleatorio_do_webhook
ASAAS_ENVIRONMENT=sandbox
VIP_ASAAS_PAYMENTS_ENABLED=true
CRON_SECRET=segredo_do_cron_existente
```

Use `ASAAS_ENVIRONMENT=production` somente depois da homologação. A chave da API e o token do webhook não podem ser expostos ao navegador.

Defina `VIP_ASAAS_PAYMENTS_ENABLED=false` para pausar formulários, cobranças e conciliação sem bloquear os benefícios e agendamentos dos assinantes. Volte para `true` somente depois que a conta Asaas estiver aprovada.

## Webhook

No painel do Asaas, configure o endpoint público:

```text
https://SEU-DOMINIO/api/webhooks/asaas
```

Informe o mesmo valor de `ASAAS_WEBHOOK_TOKEN` na autenticação do webhook. O sistema valida o cabeçalho `asaas-access-token`.

Ative apenas estes eventos de cobrança:

- `PAYMENT_CREATED`
- `PAYMENT_UPDATED`
- `PAYMENT_CONFIRMED`
- `PAYMENT_RECEIVED`
- `PAYMENT_OVERDUE`
- `PAYMENT_REPROVED_BY_RISK_ANALYSIS`
- `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`
- `PAYMENT_REFUNDED`
- `PAYMENT_RECEIVED_IN_CASH_UNDONE`
- `PAYMENT_CHARGEBACK_REQUESTED`
- `PAYMENT_CHARGEBACK_DISPUTE`
- `PAYMENT_DELETED`

O endpoint ignora com segurança cobranças que não pertencem a um plano VIP. Isso permite que a mesma conta Asaas continue atendendo à cobrança já existente da mensalidade do sistema.

## Conciliação de clientes existentes

Agende uma chamada autenticada periódica para:

```text
GET https://SEU-DOMINIO/api/cron/vip-asaas-reconciliation
Authorization: Bearer CRON_SECRET
```

A rotina encontra assinantes VIP ativos que já completaram CPF/CNPJ e ainda não têm identificador do Asaas. Ela cria o cliente, cria a recorrência e mantém os benefícios e regras locais intactos.

Clientes antigos não criam outra conta: eles só completam CPF/CNPJ em `/planos`. A conta, histórico de usos e a assinatura VIP atual permanecem os mesmos.

## Homologação e produção (16/09/2026)

As 13 migrations foram aplicadas em PostgreSQL 18 descartável, com roles Supabase locais. As quatro migrations novas também foram aplicadas ao banco de produção após backup completo.

O formulário de clientes antigos utiliza somente cartão de crédito. Os dados sensíveis são transmitidos por HTTPS ao Asaas e não são armazenados pelo sistema.

A migração preserva a primeira data em `asaasFirstDueDate`. Antes do vencimento, o indicador legado PAID corresponde ao período anterior; após o vencimento, PAID corresponde ao mês quitado. Foram testados Hugo (05/10), Marcelo (05/09 pendente), Geazi e Junior (20/09), Jhonata (13/10), na referência 15/09/2026. Esse tratamento é exclusivo da migração legada.

### Recuperação de 17/09/2026

O corte de produção ocorreu em 16/09. Os ciclos com vencimento anterior ao corte que já estavam pagos devem continuar quitados, independentemente de `paidAt` ser anterior ao dia de vencimento. Não inferir dívida histórica comparando essas datas. As primeiras renovações desses clientes ficam em outubro. Adriel mantém a renovação de 16/09 em aberto; Marcelo e Michael mantêm suas pendências anteriores. A expiração de benefício legado aplica-se somente ao saldo trazido na implantação, para vencimentos de 16 a 30 de setembro, sem pagamento novo ou do Asaas. Ela nunca antecipa uma data de renovação já congelada.

Os registros atingidos foram recuperados do backup anterior ao incidente, com validação dos identificadores e aplicação transacional. O utilitário emergencial e os identificadores de produção não fazem parte do código versionado.

O webhook consulta o estado atual da cobrança antes de atualizar o pagamento, prevenindo regressão causada por eventos atrasados. Há teste em banco isolado para duplicidade, atraso, cobrança avulsa de competência anterior e estorno. Links de pagamento aceitam somente HTTPS em domínio Asaas.

O Asaas rejeita criar novas cobranças com vencimento passado. Para assinaturas legadas vencidas, o sistema conserva a competência e o vencimento originais no banco local, emite uma cobrança avulsa com pagamento imediato e inicia a recorrência no próximo vencimento mensal. Esse fluxo foi validado e limpo no sandbox.

Para repetir os testes de integração: banco descartável em `127.0.0.1:55439`, URLs explícitas DATABASE_URL e DIRECT_URL, `VIP_INTEGRATION_TEST=1`, `NODE_PATH=./node_modules/next/dist/compiled`, `node --conditions=react-server --import tsx --test tests/vip-migration.test.ts tests/vip-webhook.integration.test.ts`. O teste recusa outros endereços de banco.

Em produção, o webhook público está configurado em envio sequencial com os eventos de pagamento, a reconciliação roda a cada dez minutos e as inscrições começam fechadas. Os assinantes legados continuam ativos e só são vinculados ao Asaas depois de informar CPF/CNPJ e validar o cartão de crédito.
