import { prisma } from "@/lib/prisma";

type StockMovementClient = Pick<typeof prisma, "stockMovement">;

export async function registerStockMovement(input: {
  productId: string;
  shopId?: string;
  type: string;
  quantity: number;
  reason?: string | null;
}, db: StockMovementClient = prisma) {
  if (input.quantity <= 0) {
    return null;
  }

  return db.stockMovement.create({
    data: {
      shopId: input.shopId,
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason || null,
    },
  });
}
