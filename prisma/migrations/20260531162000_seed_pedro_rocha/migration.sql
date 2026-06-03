INSERT INTO public."Shop" (
  "id", "name", "slug", "primaryDomain", "isDefault", "isActive",
  "metadataTitle", "metadataDescription", "whatsappNumber", "instagramUrl",
  "addressLine", "businessHours", "logoPath", "faviconPath", "brandColor",
  "brandColorStrong", "brandColorMuted", "backgroundColor", "textColor",
  "fontStyle", "designTemplate", "heroImageUrl", "heroEyebrow", "heroTitle",
  "heroSubtitle", "primaryCtaLabel", "secondaryCtaLabel", "secondaryCtaHref",
  "attendanceText", "reviewsTitle", "reviewsEmptyText", "createdAt", "updatedAt"
) VALUES (
  'shop_pedro_rocha_barbearia',
  'Pedro Rocha Barbearia',
  'pedro-rocha-barbearia',
  NULL,
  true,
  true,
  'Pedro Rocha Barbearia | Corte classico e acabamento preciso',
  'Agende seu horario na Pedro Rocha Barbearia e viva uma experiencia de cuidado em cada detalhe.',
  '(11) 95825-7965',
  'https://www.instagram.com/pedrorocha_barbearia/',
  'Endereco sob consulta',
  'Horario sob consulta',
  'https://fgrbqtcyxesjxduftajn.supabase.co/storage/v1/object/public/product-images/brands/pedro-rocha/email-logo.png',
  '/brands/pedro-rocha/favicon.png',
  '#b8945f',
  '#f1e8d8',
  'rgba(184, 148, 95, 0.16)',
  '#080807',
  '#f5efe3',
  'classic',
  'dark-premium',
  '/brands/pedro-rocha/logo.png',
  'Pedro Rocha Barbearia',
  'Corte classico, acabamento preciso.',
  'Uma experiencia de cuidado pensada para valorizar seu estilo em cada detalhe.',
  'Agendar horario',
  'Ver planos',
  '/planos',
  'Atendimento com hora marcada',
  'Confianca construida no atendimento.',
  'As avaliacoes da Pedro Rocha Barbearia aparecerao aqui em breve.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "isDefault" = true,
  "isActive" = true,
  "faviconPath" = EXCLUDED."faviconPath",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO public."ShopEmailSettings" (
  "id", "shopId", "fromName", "replyToEmail", "notificationEmail",
  "createdAt", "updatedAt"
) VALUES (
  'shop_email_settings_pedro_rocha_barbearia',
  'shop_pedro_rocha_barbearia',
  'Barbearia Rocha',
  'wadisson97.w.g@gmail.com',
  'wadisson97.w.g@gmail.com',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("shopId") DO UPDATE SET
  "fromName" = EXCLUDED."fromName",
  "replyToEmail" = EXCLUDED."replyToEmail",
  "notificationEmail" = EXCLUDED."notificationEmail",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO public."VipPlan" (
  "id", "shopId", "code", "name", "price", "tokensPerCycle",
  "isActive", "createdAt", "updatedAt"
) VALUES
  ('vip_plan_bronze', 'shop_pedro_rocha_barbearia', 'CORTE', 'Bronze', 120, 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('vip_plan_prata', 'shop_pedro_rocha_barbearia', 'CORTE_SOBRANCELHA', 'Prata', 140, 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('vip_plan_ouro', 'shop_pedro_rocha_barbearia', 'CORTE_BARBA_SOBRANCELHA', 'Ouro', 180, 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("shopId", "code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "price" = EXCLUDED."price",
  "tokensPerCycle" = 4,
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO public."Service" (
  "id", "shopId", "name", "description", "price", "duration",
  "bufferAfter", "commissionType", "commissionValue", "isActive",
  "createdAt", "updatedAt"
)
SELECT
  seed."id",
  'shop_pedro_rocha_barbearia',
  seed."name",
  seed."description",
  seed."price",
  seed."duration",
  0,
  'PERCENT',
  40,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('service_acabamento', 'Acabamento', 'Ajuste rapido de contornos e pezinho.', 20::decimal, 20),
    ('service_barba', 'Barba', 'Modelagem e acabamento da barba.', 35::decimal, 30),
    ('service_corte_barba', 'Corte e barba', 'Combo com corte masculino e barba.', 70::decimal, 70),
    ('service_corte_sobrancelha', 'Corte e sobrancelha', 'Combo com corte masculino e sobrancelha.', 60::decimal, 55),
    ('service_corte_masculino', 'Corte masculino', 'Corte personalizado com acabamento.', 45::decimal, 40),
    ('service_corte_sobrancelha_barba', 'Corte, sobrancelha e barba', 'Combo completo com corte masculino, sobrancelha e barba.', 95::decimal, 85),
    ('service_sobrancelha', 'Sobrancelha', 'Alinhamento simples para complementar o visual.', 15::decimal, 15)
) AS seed("id", "name", "description", "price", "duration")
WHERE NOT EXISTS (
  SELECT 1
  FROM public."Service" current_service
  WHERE current_service."shopId" = 'shop_pedro_rocha_barbearia'
    AND current_service."name" = seed."name"
);
