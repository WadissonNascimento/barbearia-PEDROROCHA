-- The customer-facing product area is now a visual catalog only.
-- Remove the retired checkout/order/coupon tables to avoid keeping dead
-- e-commerce behavior in production.
DROP TABLE IF EXISTS "OrderItem" CASCADE;
DROP TABLE IF EXISTS "Order" CASCADE;
DROP TABLE IF EXISTS "Coupon" CASCADE;
