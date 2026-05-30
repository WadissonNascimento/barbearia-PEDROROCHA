ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "backgroundColor" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "textColor" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "fontStyle" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "designTemplate" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "heroImageUrl" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "heroEyebrow" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "heroTitle" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "heroSubtitle" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "primaryCtaLabel" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "secondaryCtaLabel" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "secondaryCtaHref" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "attendanceText" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "reviewsTitle" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "reviewsEmptyText" TEXT;

UPDATE "Shop"
SET
  "backgroundColor" = COALESCE("backgroundColor", '#030712'),
  "textColor" = COALESCE("textColor", '#f6f7fb'),
  "fontStyle" = COALESCE("fontStyle", 'modern'),
  "designTemplate" = COALESCE("designTemplate", 'dark-premium'),
  "heroEyebrow" = COALESCE("heroEyebrow", 'Barbearia premium'),
  "heroTitle" = COALESCE("heroTitle", 'Seu estilo comeca aqui.'),
  "heroSubtitle" = COALESCE("heroSubtitle", 'Agende seu horario com praticidade e tenha uma experiencia premium.'),
  "primaryCtaLabel" = COALESCE("primaryCtaLabel", 'Agendar horario'),
  "secondaryCtaLabel" = COALESCE("secondaryCtaLabel", 'Ver servicos'),
  "secondaryCtaHref" = COALESCE("secondaryCtaHref", '/servicos'),
  "attendanceText" = COALESCE("attendanceText", 'Com hora marcada'),
  "reviewsTitle" = COALESCE("reviewsTitle", 'O que os clientes acharam.'),
  "reviewsEmptyText" = COALESCE("reviewsEmptyText", 'As avaliacoes reais dos clientes vao aparecer aqui depois dos atendimentos concluidos.');
