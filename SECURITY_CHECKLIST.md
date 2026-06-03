# Security Checklist

## Status desta rodada

- [x] Rotas privadas protegidas por middleware por papel: cliente, barbeiro e admin.
- [x] Server actions criticas validam sessao e papel no backend.
- [x] Cancelamento e avaliacao de atendimento verificam dono do agendamento.
- [x] Acoes de barbeiro conferem se o recurso pertence ao barbeiro logado.
- [x] Acoes de admin exigem papel `ADMIN` no backend.
- [x] Login, cadastro, recuperacao de senha, verificacao de codigo, agendamento, avaliacoes e exports possuem rate limit inicial em memoria.
- [x] APIs JSON passaram a limitar tamanho do payload.
- [x] Headers de seguranca adicionados: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy e Permissions-Policy.
- [x] Uploads de imagens limitados a JPG, PNG e WEBP, com limite de 3MB e verificacao basica de assinatura do arquivo.
- [x] Erros de API deixam de retornar stack trace ou detalhes internos para o cliente.
- [x] Logs de seguranca adicionados para falhas de login, acesso negado, IDOR bloqueado e rate limit.
- [x] `.env` e bancos locais estao ignorados no Git.
- [x] RLS aplicado no Supabase para as tabelas do sistema, com policies por cliente, barbeiro, admin e tenant.

## Limites aplicados

- Login: 8 tentativas por IP + e-mail a cada 15 minutos.
- Cadastro inicial: 5 tentativas por IP + e-mail por hora.
- Verificacao de cadastro: 10 tentativas por IP + e-mail a cada 15 minutos.
- Reenvio de codigo de cadastro: 3 tentativas por IP + e-mail a cada 30 minutos.
- Recuperacao de senha: 5 solicitacoes por IP + e-mail por hora.
- Reenvio de recuperacao: 3 tentativas por IP + e-mail a cada 30 minutos.
- Verificacao de recuperacao: 10 tentativas por IP + e-mail a cada 15 minutos.
- Criacao de agendamento: 12 tentativas por cliente por hora.
- Consulta de disponibilidade: 90 consultas por cliente a cada 15 minutos.
- Avaliacoes: 10 envios por cliente por hora.
- Exports admin: 20 exportacoes por admin a cada 15 minutos.

## Variaveis que devem ficar apenas no servidor

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `AUTH_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASS`
- `EMAIL_FROM`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

## Variaveis que podem ser publicas

- `NEXT_PUBLIC_APP_URL`, desde que contenha apenas a URL publica do site e nenhum segredo.

## Supabase e RLS

RLS foi aplicado com a migration `20260531161000_pedro_rocha_security`.

- 37 tabelas do sistema estao com `relrowsecurity = true`.
- Acesso direto `anon` foi revogado.
- As tabelas de sessao/codigos (`Account`, `Session`, `VerificationToken`, `PendingRegistration`, `PasswordResetRequest`) ficam sem grants diretos para `anon`/`authenticated`.
- As policies de negocio usam `app.current_user_id`, `app.current_shop_id`, `app.current_role` ou claims JWT equivalentes em `app_metadata`/`user_metadata`.
- `User.passwordHash` nao possui grant de SELECT para `authenticated`.

O app ainda usa Prisma no backend. Se algum cliente Supabase for introduzido no navegador, o JWT precisa carregar `userId`, `shopId` e `role`, ou a conexao precisa setar os GUCs usados pelas policies.

## Recomendacoes para VPS/Nginx/Cloudflare

- Usar Cloudflare ou WAF equivalente na frente da VPS.
- Ativar rate limiting no Nginx para `/login`, `/api/auth/*`, `/register`, `/forgot-password/*` e `/api/booking/*`.
- Limitar `client_max_body_size` no Nginx para 3MB ou 5MB.
- Bloquear acesso direto ao banco a partir da internet.
- Liberar no firewall apenas 80/443 e SSH restrito.
- Desativar login SSH por senha e usar chave publica.
- Habilitar fail2ban para SSH e Nginx.
- Rodar a aplicacao com usuario sem privilegio de root.
- Rotacionar segredos apos qualquer exposicao acidental.
- Usar HTTPS obrigatorio e HSTS no proxy de producao.
