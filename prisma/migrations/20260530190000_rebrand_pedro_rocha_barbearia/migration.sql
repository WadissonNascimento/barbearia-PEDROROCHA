DO $$
DECLARE
  shop_id_column RECORD;
BEGIN
  UPDATE "Shop"
  SET
    "id" = 'shop_pedro_rocha_barbearia',
    "name" = 'Pedro Rocha Barbearia',
    "slug" = 'pedro-rocha-barbearia',
    "primaryDomain" = NULL,
    "metadataTitle" = 'Pedro Rocha Barbearia | Corte classico e acabamento preciso',
    "metadataDescription" = 'Agende seu horario na Pedro Rocha Barbearia e viva uma experiencia de cuidado em cada detalhe.',
    "whatsappNumber" = NULL,
    "instagramUrl" = NULL,
    "addressLine" = 'Endereco sob consulta',
    "businessHours" = 'Horario sob consulta',
    "logoPath" = '/brands/pedro-rocha/logo.png',
    "faviconPath" = '/brands/pedro-rocha/favicon.png',
    "brandColor" = '#b8945f',
    "brandColorStrong" = '#f1e8d8',
    "brandColorMuted" = 'rgba(184, 148, 95, 0.16)',
    "backgroundColor" = '#080807',
    "textColor" = '#f5efe3',
    "fontStyle" = 'classic',
    "designTemplate" = 'dark-premium',
    "heroImageUrl" = '/brands/pedro-rocha/logo.png',
    "heroEyebrow" = 'Pedro Rocha Barbearia',
    "heroTitle" = 'Corte classico, acabamento preciso.',
    "heroSubtitle" = 'Uma experiencia de cuidado pensada para valorizar seu estilo em cada detalhe.',
    "primaryCtaLabel" = 'Agendar horario',
    "secondaryCtaLabel" = 'Ver servicos',
    "secondaryCtaHref" = '/servicos',
    "attendanceText" = 'Atendimento com hora marcada',
    "reviewsTitle" = 'Confianca construida no atendimento.',
    "reviewsEmptyText" = 'As avaliacoes da Pedro Rocha Barbearia aparecerao aqui em breve.',
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = 'shop_jak_barber';

  FOR shop_id_column IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'shopId'
      AND column_default LIKE '%shop_jak_barber%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN "shopId" SET DEFAULT %L',
      shop_id_column.table_name,
      'shop_pedro_rocha_barbearia'
    );
  END LOOP;
END $$;

INSERT INTO "ShopHomeContent" (
  "id",
  "shopId",
  "heroEyebrow",
  "heroTitle",
  "heroSubtitle",
  "primaryButtonLabel",
  "primaryButtonHref",
  "secondaryButtonLabel",
  "secondaryButtonHref",
  "infoOneLabel",
  "infoOneValue",
  "infoTwoLabel",
  "infoTwoValue",
  "infoThreeLabel",
  "infoThreeValue",
  "servicesEyebrow",
  "servicesTitle",
  "servicesDescription",
  "barbersEyebrow",
  "barbersTitle",
  "barbersDescription",
  "reviewsEyebrow",
  "reviewsTitle",
  "reviewsEmptyText",
  "aboutEyebrow",
  "aboutTitle",
  "aboutBody",
  "contactEyebrow",
  "contactTitle",
  "contactBody",
  "footerText",
  "updatedAt"
) VALUES (
  'home_pedro_rocha_barbearia',
  'shop_pedro_rocha_barbearia',
  'Pedro Rocha Barbearia',
  'Corte classico, acabamento preciso.',
  'Uma experiencia de cuidado pensada para valorizar seu estilo em cada detalhe.',
  'Agendar horario',
  '/agendar',
  'Ver servicos',
  '/servicos',
  'Atendimento',
  'Com hora marcada',
  'Ambiente',
  'Classico e acolhedor',
  'Experiencia',
  'Cuidado em cada detalhe',
  'Servicos',
  'Escolha seu proximo cuidado.',
  'Servicos pensados para manter seu visual em dia com praticidade.',
  'Equipe',
  'Profissionais que entendem seu estilo.',
  'Conheca quem cuida de cada detalhe do seu atendimento.',
  'Avaliacoes',
  'Confianca construida no atendimento.',
  'As avaliacoes da Pedro Rocha Barbearia aparecerao aqui em breve.',
  'A barbearia',
  'Tradicao no visual. Precisao no acabamento.',
  'Na Pedro Rocha Barbearia, cada atendimento combina tecnica, atencao e um ambiente preparado para voce desacelerar.',
  'Contato',
  'Reserve seu horario.',
  'Escolha o melhor horario e venha viver a experiencia Pedro Rocha Barbearia.',
  'Pedro Rocha Barbearia. Cuidado em cada detalhe.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("shopId") DO UPDATE SET
  "heroEyebrow" = EXCLUDED."heroEyebrow",
  "heroTitle" = EXCLUDED."heroTitle",
  "heroSubtitle" = EXCLUDED."heroSubtitle",
  "updatedAt" = CURRENT_TIMESTAMP;
