import { prisma } from "@/lib/prisma";

type ExtraStockMovementClient = Pick<typeof prisma, "extraStockMovement">;

export async function registerExtraStockMovement(
  input: {
    extraProductId: string;
    shopId?: string;
    type: string;
    quantity: number;
    reason?: null | string;
  },
  db: ExtraStockMovementClient = prisma
) {
  if (!input.extraProductId || !Number.isFinite(input.quantity) || input.quantity <= 0) {
    return null;
  }

  return db.extraStockMovement.create({
    data: {
      shopId: input.shopId,
      extraProductId: input.extraProductId,
      type: input.type,
      quantity: Math.trunc(input.quantity),
      reason: input.reason?.trim() || null,
    },
  });
}
