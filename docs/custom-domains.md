# Dominios customizados

Este fluxo existe para escalar dominios proprios de clientes sem deixar um
dominio desconhecido cair na JakBarber por acidente.

## Regras de seguranca

- O app so resolve uma barbearia quando o `Host` existe em `Shop.primaryDomain`.
- Host desconhecido nao usa fallback em producao.
- O endpoint `/api/domain-allow` e somente leitura e retorna 200 apenas para
  dominios ativos cadastrados.
- Antes de emitir SSL para qualquer dominio, valide DNS e permissao do dominio.

## Fluxo para um novo cliente

1. Criar a barbearia pelo fluxo manual de provisionamento com o dominio
   principal do cliente.
2. Pedir para o cliente apontar o DNS:
   - `A @ -> 2.24.65.212`
   - `CNAME www -> dominio-principal.com` ou `A www -> 2.24.65.212`
3. Na VPS, validar DNS:

```bash
cd /var/www/jakbarber
npm run domain:check -- --domain dominio-do-cliente.com
```

4. Validar que o app autoriza o dominio:

```bash
curl -i "http://127.0.0.1:3000/api/domain-allow?domain=dominio-do-cliente.com"
```

O retorno esperado e HTTP 200 com `ok: true`. Se retornar 404, nao emita SSL.

## Catch-all HTTP no Nginx

Este bloco recebe qualquer dominio na porta 80 e preserva o `Host` original para
o Next.js resolver o tenant.

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## HTTPS

Nginx consegue receber qualquer HTTP com `server_name _`, mas HTTPS precisa de
certificado valido para cada dominio antes do navegador confiar.

Enquanto nao houver automacao completa, use este criterio:

1. `domain:check` precisa retornar `DNS OK`.
2. `/api/domain-allow` precisa retornar HTTP 200.
3. So entao emitir certificado para o dominio.

Para automacao real de SSL sob demanda, a opcao mais limpa e colocar Caddy ou
Traefik na frente usando `/api/domain-allow` como endpoint de autorizacao. Assim
o proxy so emite certificado quando o dominio ja esta cadastrado e ativo.

## Ativacao assistida

Depois que o dominio ja estiver com `DNS OK` e autorizado por
`/api/domain-allow`, use o script assistido. Por padrao ele roda em dry-run:

```bash
cd /var/www/jakbarber
npm run domain:activate -- --domain dominio-do-cliente.com
```

Para executar de verdade:

```bash
cd /var/www/jakbarber
DOMAIN_ACTIVATION_ENABLED=1 npm run domain:activate -- --domain dominio-do-cliente.com --execute
```

O script valida DNS, valida `/api/domain-allow`, emite certificado se ainda nao
existir, cria o bloco Nginx, roda `nginx -t` e recarrega Nginx. Se qualquer
validacao falhar, ele para antes de alterar a configuracao.
