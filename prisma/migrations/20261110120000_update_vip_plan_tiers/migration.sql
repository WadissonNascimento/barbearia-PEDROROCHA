UPDATE public."VipPlan"
SET
  "price" = 160,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "shopId" = 'shop_pedro_rocha_barbearia'
  AND "code" = 'CORTE_SOBRANCELHA';

UPDATE public."VipPlan"
SET
  "price" = 200,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "shopId" = 'shop_pedro_rocha_barbearia'
  AND "code" = 'CORTE_BARBA_SOBRANCELHA';

INSERT INTO public."VipPlan" (
  "id", "shopId", "code", "name", "price", "tokensPerCycle",
  "isActive", "createdAt", "updatedAt"
) VALUES
  ('vip_plan_prata_plus', 'shop_pedro_rocha_barbearia', 'CORTE_SOBRANCELHA_ANYDAY', 'Prata+', 180, 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('vip_plan_ouro_plus', 'shop_pedro_rocha_barbearia', 'CORTE_BARBA_SOBRANCELHA_ANYDAY', 'Ouro+', 230, 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("shopId", "code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "price" = EXCLUDED."price",
  "tokensPerCycle" = 4,
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
