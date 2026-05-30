import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationsPath = path.join(process.cwd(), "prisma", "migrations");
const migrationSql = readdirSync(migrationsPath, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(migrationsPath, entry.name, "migration.sql"))
  .map((migrationPath) => readFileSync(migrationPath, "utf8"))
  .join("\n");

const protectedTables = [
  "Shop",
  "User",
  "Account",
  "Session",
  "VerificationToken",
  "PendingRegistration",
  "PasswordResetRequest",
  "EmailChangeRequest",
  "Service",
  "Appointment",
  "AppointmentService",
  "Review",
  "BarberAvailability",
  "BarberBlock",
  "RecurringBarberBlock",
  "ClientNote",
  "CustomerProfile",
  "Product",
  "BarberServiceCommission",
  "ExtraProduct",
  "AppointmentItem",
  "StockMovement",
  "ExtraStockMovement",
  "BarberPayout",
  "BarberTip",
  "EmailDeliveryLog",
  "RateLimitBucket",
];

test("RLS migration enables row security for every application table", () => {
  for (const table of protectedTables) {
    assert.match(migrationSql, new RegExp(`'${table}'|"${table}"`));
  }

  assert.match(migrationSql, /ENABLE ROW LEVEL SECURITY/);
});

test("RLS migration denies anonymous table access and does not expose password hashes", () => {
  assert.match(migrationSql, /REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon/);
  assert.doesNotMatch(migrationSql, /GRANT SELECT[\s\S]*passwordHash/);
});

test("RLS migration defines tenant, customer, barber, and admin policies", () => {
  assert.match(migrationSql, /app_is_admin/);
  assert.match(migrationSql, /app_is_barber/);
  assert.match(migrationSql, /"customerId" = public\.app_user_id\(\)/);
  assert.match(migrationSql, /"barberId" = public\.app_user_id\(\)/);
  assert.match(migrationSql, /"shopId" = public\.app_shop_id\(\)/);
});
