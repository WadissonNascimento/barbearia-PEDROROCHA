# Security Findings

## Alta: checkout online ainda exposto apesar do catalogo

- Problema: a interface foi convertida para catalogo, mas `/api/checkout` ainda aceitava criacao de pedido anonima.
- Risco: abuso de API, criacao de clientes/pedidos falsos, consumo de recursos e possivel confusao operacional.
- Como explorar: enviar POST direto para `/api/checkout` com dados de cliente e itens, mesmo sem passar pela interface.
- Como foi corrigido: endpoint agora fica desativado por padrao e so volta com `ENABLE_ONLINE_CHECKOUT=true`; tambem recebeu schema mais restrito, limite de payload e rate limit.
- Status final: corrigido para o estado atual do produto; revisar novamente quando a loja online voltar.

## Alta: ausencia de rate limit em login e recuperacao

- Problema: login, cadastro, recuperacao de senha e verificacao de codigos dependiam apenas das tentativas salvas em banco para alguns fluxos.
- Risco: brute force, enumeracao de contas, spam de e-mail e alto volume contra banco/e-mail.
- Como explorar: automatizar requisicoes para login, cadastro e recuperacao usando o mesmo e-mail ou muitos e-mails.
- Como foi corrigido: adicionada camada de rate limit por IP + identificador, com 429/erro amigavel e logs de seguranca.
- Status final: mitigado no app; recomendado complementar com Nginx/Cloudflare.

## Media: uploads de produto aceitavam qualquer `image/*`

- Problema: upload de produto aceitava qualquer MIME `image/*`, sem limite forte de tamanho e sem validar assinatura do arquivo.
- Risco: armazenamento de arquivos inesperados, consumo de disco e tentativa de upload malicioso com extensao/tipo falsificado.
- Como explorar: enviar arquivo grande ou arquivo nao suportado com MIME de imagem.
- Como foi corrigido: uploads agora aceitam apenas JPG, PNG e WEBP, limite de 3MB e verificacao basica de assinatura.
- Status final: corrigido.

## Media: payload JSON sem limite explicito em APIs

- Problema: rotas JSON usavam `request.json()` diretamente.
- Risco: abuso com payload grande, consumo de memoria e instabilidade.
- Como explorar: enviar corpo muito grande para APIs de agendamento, disponibilidade, checkout ou webhook.
- Como foi corrigido: adicionada leitura JSON com limite de bytes e retorno 413 para corpo grande.
- Status final: corrigido nas rotas mais sensiveis.

## Media: detalhes internos podiam vazar em respostas de erro

- Problema: algumas rotas/actions retornavam `error.message` para o cliente em falhas internas.
- Risco: exposicao de detalhes de integracoes, mensagens internas e informacoes uteis para ataque.
- Como explorar: provocar erro em checkout/e-mail/webhook e observar a resposta.
- Como foi corrigido: respostas externas foram trocadas por mensagens genericas e logs ficam no servidor.
- Status final: corrigido nos fluxos revisados.

## Media: webhook do Mercado Pago sem limite de volume

- Problema: webhook aceitava alto volume sem rate limit e retornava erro detalhado.
- Risco: abuso de endpoint, ruído operacional e exposicao de erro.
- Como explorar: enviar muitas chamadas POST para `/api/mercadopago/webhook`.
- Como foi corrigido: adicionado rate limit e resposta generica em erro.
- Status final: mitigado; para producao, validar assinatura quando o provedor/configuracao permitir.

## Media: CSP e headers de seguranca ausentes

- Problema: o projeto nao configurava headers globais de seguranca.
- Risco: maior impacto em XSS, clickjacking, MIME sniffing e vazamento de referrer.
- Como explorar: tentar embeber o site em iframe, forcar MIME sniffing ou carregar recursos de origens indevidas.
- Como foi corrigido: adicionados CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy`.
- Status final: corrigido com CSP compativel com Next.js e Mercado Pago; pode ser endurecido com nonce no futuro.

## Baixa: logs de seguranca insuficientes

- Problema: falhas de login, acesso negado, IDOR bloqueado e rate limit nao tinham log dedicado.
- Risco: menor visibilidade para investigacao e resposta a incidente.
- Como explorar: ataques silenciosos ficariam misturados aos erros comuns.
- Como foi corrigido: adicionados logs padronizados sem senha, token ou payload sensivel.
- Status final: corrigido inicialmente; recomendado enviar logs para um coletor em producao.

## Alta: RLS do Supabase estava pendente

- Problema: as tabelas publicas do Supabase ainda nao tinham uma camada completa de RLS alinhada a cliente, barbeiro, admin e tenant.
- Risco: se uma chave `anon`/`authenticated` fosse usada direto contra o Supabase/PostgREST, dados de clientes, agendamentos, pedidos, repasses e comissoes poderiam ficar expostos sem depender do frontend.
- Como explorar: tentar consultar tabelas publicas direto pelo Supabase usando IDs de outro cliente/barbeiro/tenant.
- Como foi corrigido: criada e aplicada a migration `20260508170000_enable_supabase_rls`, com RLS ativo em 26 tabelas, grants anonimos revogados, policies por papel/tenant e protecao para nao selecionar `User.passwordHash`.
- Status final: corrigido no Supabase configurado no `.env`; detalhes em `SECURITY_RLS_REPORT.md`.
