ALTER TABLE "Service"
  ALTER COLUMN "price" TYPE DECIMAL(12, 2) USING ROUND("price"::numeric, 2),
  ALTER COLUMN "commissionValue" TYPE DECIMAL(12, 2) USING ROUND("commissionValue"::numeric, 2);

ALTER TABLE "AppointmentService"
  ALTER COLUMN "priceSnapshot" TYPE DECIMAL(12, 2) USING ROUND("priceSnapshot"::numeric, 2),
  ALTER COLUMN "commissionValueSnapshot" TYPE DECIMAL(12, 2) USING ROUND("commissionValueSnapshot"::numeric, 2),
  ALTER COLUMN "barberPayoutSnapshot" TYPE DECIMAL(12, 2) USING ROUND("barberPayoutSnapshot"::numeric, 2),
  ALTER COLUMN "shopRevenueSnapshot" TYPE DECIMAL(12, 2) USING ROUND("shopRevenueSnapshot"::numeric, 2);

ALTER TABLE "Product"
  ALTER COLUMN "price" TYPE DECIMAL(12, 2) USING ROUND("price"::numeric, 2);

ALTER TABLE "BarberServiceCommission"
  ALTER COLUMN "commissionValue" TYPE DECIMAL(12, 2) USING ROUND("commissionValue"::numeric, 2);

ALTER TABLE "ExtraProduct"
  ALTER COLUMN "price" TYPE DECIMAL(12, 2) USING ROUND("price"::numeric, 2),
  ALTER COLUMN "commissionValue" TYPE DECIMAL(12, 2) USING ROUND("commissionValue"::numeric, 2);

ALTER TABLE "AppointmentItem"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(12, 2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "subtotal" TYPE DECIMAL(12, 2) USING ROUND("subtotal"::numeric, 2),
  ALTER COLUMN "commissionValueSnapshot" TYPE DECIMAL(12, 2) USING ROUND("commissionValueSnapshot"::numeric, 2),
  ALTER COLUMN "barberPayoutSnapshot" TYPE DECIMAL(12, 2) USING ROUND("barberPayoutSnapshot"::numeric, 2),
  ALTER COLUMN "shopRevenueSnapshot" TYPE DECIMAL(12, 2) USING ROUND("shopRevenueSnapshot"::numeric, 2);

ALTER TABLE "Order"
  ALTER COLUMN "total" TYPE DECIMAL(12, 2) USING ROUND("total"::numeric, 2),
  ALTER COLUMN "subtotal" TYPE DECIMAL(12, 2) USING ROUND("subtotal"::numeric, 2),
  ALTER COLUMN "shippingCost" TYPE DECIMAL(12, 2) USING ROUND("shippingCost"::numeric, 2),
  ALTER COLUMN "discountTotal" TYPE DECIMAL(12, 2) USING ROUND("discountTotal"::numeric, 2);

ALTER TABLE "OrderItem"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(12, 2) USING ROUND("unitPrice"::numeric, 2);

ALTER TABLE "Coupon"
  ALTER COLUMN "discountValue" TYPE DECIMAL(12, 2) USING ROUND("discountValue"::numeric, 2),
  ALTER COLUMN "minOrderTotal" TYPE DECIMAL(12, 2) USING ROUND("minOrderTotal"::numeric, 2),
  ALTER COLUMN "maxDiscount" TYPE DECIMAL(12, 2) USING ROUND("maxDiscount"::numeric, 2);

ALTER TABLE "BarberPayout"
  ALTER COLUMN "grossRevenue" TYPE DECIMAL(12, 2) USING ROUND("grossRevenue"::numeric, 2),
  ALTER COLUMN "commissionTotal" TYPE DECIMAL(12, 2) USING ROUND("commissionTotal"::numeric, 2),
  ALTER COLUMN "shopNetRevenue" TYPE DECIMAL(12, 2) USING ROUND("shopNetRevenue"::numeric, 2);
