# Product Image Storage

## O que mudou no banco

A tabela `Product` continua guardando apenas texto de referencia da imagem:

- `imageUrl`: URL publica usada para renderizar a imagem no catalogo e no admin.
- `image_path`: path do objeto no Supabase Storage, usado para substituir ou excluir a imagem antiga.

Nenhum binario de imagem e salvo no banco.

## Storage

As imagens novas sao enviadas para o bucket configurado em `SUPABASE_STORAGE_BUCKET`, com path:

```text
products/{productId}/{uuid}.{ext}
```

O bucket precisa ser publico para o catalogo renderizar as imagens diretamente pela URL publica do Supabase Storage.

## Variaveis de ambiente

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
```

`SUPABASE_SERVICE_ROLE_KEY` deve ficar apenas no servidor.

## Validacoes

- Frontend: aceita JPG, PNG e WEBP ate 2MB, gera preview e tenta otimizar para WebP antes do envio.
- Backend: valida tipo MIME, tamanho maximo de 2MB e assinatura basica do arquivo antes de enviar ao Storage.

