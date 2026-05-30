# Relatorio de seguranca e RLS

Data: 2026-05-08

## Resumo

Foi aplicada uma camada de seguranca de banco no Supabase com RLS para as tabelas do sistema, alem de ajustes no backend para reduzir abuso, enumeracao de contas e risco de troca de tenant por IDs manipulados.

O app continua usando Prisma no backend. A migration de RLS protege acesso direto via Supabase/PostgREST usando claims JWT ou GUCs de sessao:

- `app.current_user_id`
- `app.current_shop_id`
- `app.current_role`

## Vulnerabilidades encontradas e corrigidas

1. RLS pendente no Supabase
   - Risco: se uma chave anon/authenticated fosse usada contra as tabelas publicas, dados de clientes, barbeiros, pedidos, repasses e agendamentos poderiam ficar expostos.
   - Correcao: migration `20260508170000_enable_supabase_rls` habilita RLS nas tabelas do sistema, revoga acesso anonimo e cria policies por cliente, barbeiro, admin e tenant.

2. Isolamento por tenant confiava em `shopId` ja presente no `where/data`
   - Risco: se algum fluxo futuro passasse `shopId` vindo do frontend, um atacante poderia tentar forcar outro tenant.
   - Correcao: `lib/prisma.ts` agora sempre aplica o `shopId` da requisicao atual e sobrescreve `shopId` em criacoes/updates de modelos escopados.

3. Login admin direto sem rate limit proprio e com mensagens enumeraveis
   - Risco: brute force e descoberta se e-mail existe, esta inativo ou nao e admin.
   - Correcao: `app/admin/login/actions.ts` e `app/admin/login/submit/route.ts` agora usam rate limit, logs de seguranca e resposta generica para credenciais invalidas.

4. Endpoint de erro do cliente aceitava payload sem limite e sem rate limit
   - Risco: spam de logs, payload grande e poluicao de observabilidade.
   - Correcao: `app/api/client-errors/route.ts` agora tem limite de 4KB, rate limit e truncamento de campos logados.

## Tabelas com RLS ativo

- `Shop`
- `User`
- `Account`
- `Session`
- `VerificationToken`
- `PendingRegistration`
- `PasswordResetRequest`
- `Service`
- `Appointment`
- `AppointmentService`
- `Review`
- `BarberAvailability`
- `BarberBlock`
- `RecurringBarberBlock`
- `ClientNote`
- `CustomerProfile`
- `Product`
- `BarberServiceCommission`
- `ExtraProduct`
- `AppointmentItem`
- `Order`
- `OrderItem`
- `Coupon`
- `StockMovement`
- `ExtraStockMovement`
- `BarberPayout`

As tabelas de credenciais/sessoes/codigos (`Account`, `Session`, `VerificationToken`, `PendingRegistration`, `PasswordResetRequest`) ficam com RLS ativo e sem grants diretos para `anon`/`authenticated`.

## Policies criadas

- Cliente:
  - SELECT dos proprios agendamentos, pedidos, perfil e avaliacoes.
  - INSERT de agendamento/pedido/review apenas quando o registro pertence ao proprio usuario e ao tenant correto.

- Barbeiro:
  - SELECT dos proprios agendamentos, agenda, bloqueios, clientes relacionados, notas e repasses.
  - INSERT/UPDATE/DELETE em disponibilidade, bloqueios e notas somente quando o `barberId` e o proprio barbeiro.

- Admin:
  - SELECT/INSERT/UPDATE/DELETE em recursos do proprio `shopId`.
  - Sem acesso a outro tenant por troca de IDs.

- Publico/anon:
  - Sem acesso direto a tabelas via Supabase.

- Campos sensiveis:
  - `User.passwordHash` nao recebeu grant de SELECT para `authenticated`.

## Arquivos alterados

- `lib/prisma.ts`
- `app/admin/login/actions.ts`
- `app/admin/login/submit/route.ts`
- `app/api/client-errors/route.ts`
- `prisma/migrations/20260508170000_enable_supabase_rls/migration.sql`
- `tests/security-rls.test.ts`
- `SECURITY_RLS_REPORT.md`

## Testes realizados

- `npx prisma validate`
- `npm run build`
- `npm test`
- `npx prisma migrate deploy`
- Consulta em `pg_class` confirmou 26 tabelas com `relrowsecurity = true`.
- Consulta em `pg_policy` confirmou policies nas tabelas de negocio.
- Teste direto com `SET ROLE authenticated` sem contexto:
  - `Appointment` retornou 0 linhas.
  - `User.passwordHash` nao ficou legivel.
- Teste direto com `SET ROLE authenticated` e GUC de cliente:
  - cliente viu 12/12 agendamentos proprios esperados.
- Teste direto com `SET ROLE authenticated` e GUC de barbeiro:
  - barbeiro viu 29/29 agendamentos proprios esperados.

## Pontos que ainda precisam de atencao

- O app usa NextAuth, nao Supabase Auth no frontend. Se no futuro usar Supabase client direto no navegador, o JWT precisa carregar `userId`, `shopId` e `role` em `app_metadata`/`user_metadata`, ou a conexao precisa setar os GUCs esperados.
- O Prisma esta conectado como usuario de banco Supabase/postgres, que normalmente bypassa RLS. A protecao runtime do app continua sendo as validacoes backend + wrapper de `shopId`. RLS protege especialmente acesso direto via roles `anon`/`authenticated`.
- Para producao, manter rate limit tambem em camada de borda, como Cloudflare/Nginx, porque o rate limit atual em memoria nao e distribuido.
- Considerar CAPTCHA em cadastro/recuperacao caso apareca spam real.
- Rotacionar segredos antes do lancamento se algum valor de `.env` ja foi compartilhado fora do servidor.
