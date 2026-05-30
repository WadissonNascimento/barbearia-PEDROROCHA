import { basePrisma } from "@/lib/prisma-core";
import {
  DEFAULT_SHOP_ID,
  getCurrentShopId,
  getRequestHost,
  getRequestPath,
  logTenantObservabilityEvent,
} from "@/lib/shop";

const SHOP_SCOPED_MODELS = new Set([
  "User",
  "Account",
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
  "ProductImage",
  "BarberServiceCommission",
  "ExtraProduct",
  "AppointmentItem",
  "StockMovement",
  "ExtraStockMovement",
  "BarberPayout",
  "BarberTip",
  "HomeImage",
  "EmailDeliveryLog",
  "AppNotification",
  "PushSubscription",
]);

const ID_SCOPED_MODELS = new Set([
  "User",
  "Account",
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
  "ProductImage",
  "BarberServiceCommission",
  "ExtraProduct",
  "AppointmentItem",
  "StockMovement",
  "ExtraStockMovement",
  "BarberPayout",
  "BarberTip",
  "HomeImage",
  "EmailDeliveryLog",
  "AppNotification",
  "PushSubscription",
]);

function mergeWhereWithShop(
  where: Record<string, unknown> | undefined,
  shopId: string
) {
  if (!where) {
    return { shopId };
  }

  if (Array.isArray((where as { AND?: unknown[] }).AND)) {
    return {
      ...where,
      AND: [...((where as { AND: unknown[] }).AND || []), { shopId }],
    };
  }

  return {
    AND: [where, { shopId }],
  };
}

function rewriteUniqueWhere(
  model: string,
  where: Record<string, unknown> | undefined,
  shopId: string
) {
  if (!where) {
    return where;
  }

  if ("id_shopId" in where) {
    const { shopId: _ignoredShopId, id_shopId: idShopId, ...rest } = where;

    if (typeof idShopId === "object" && idShopId !== null) {
      return {
        ...rest,
        id_shopId: {
          ...(idShopId as Record<string, unknown>),
          shopId,
        },
      };
    }

    return where;
  }

  if ("id" in where && ID_SCOPED_MODELS.has(model)) {
    const { id, shopId: _ignoredShopId, ...rest } = where as {
      id: string;
      shopId?: unknown;
    } & Record<string, unknown>;
    return {
      ...rest,
      id_shopId: {
        id,
        shopId,
      },
    };
  }

  return where;
}

function withShopId(
  data: Record<string, unknown> | undefined,
  shopId: string
): Record<string, unknown> | undefined {
  if (!data) {
    return data;
  }

  return {
    ...data,
    shopId,
  };
}

function mapArrayCreateData(value: unknown, shopId: string) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((entry) =>
    typeof entry === "object" && entry !== null
      ? withShopId(entry as Record<string, unknown>, shopId)
      : entry
  );
}

function injectNestedShopId(
  model: string,
  data: Record<string, unknown> | undefined,
  shopId: string
) {
  const nextData = withShopId(data, shopId);

  if (!nextData) {
    return nextData;
  }

  if (model === "User") {
    const customerProfile = nextData.customerProfile as
      | { create?: Record<string, unknown> }
      | undefined;

    if (customerProfile?.create) {
      nextData.customerProfile = {
        ...customerProfile,
        create: withShopId(customerProfile.create, shopId),
      };
    }
  }

  if (model === "Appointment") {
    const services = nextData.services as
      | { create?: unknown[] }
      | undefined;
    const items = nextData.items as
      | { create?: unknown[] }
      | undefined;

    if (services?.create) {
      nextData.services = {
        ...services,
        create: mapArrayCreateData(services.create, shopId),
      };
    }

    if (items?.create) {
      nextData.items = {
        ...items,
        create: mapArrayCreateData(items.create, shopId),
      };
    }
  }

  return nextData;
}

export const prisma: typeof basePrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !SHOP_SCOPED_MODELS.has(model)) {
          return query(args);
        }

        const shopId = await getCurrentShopId().catch(async (error) => {
          const [host, path] = await Promise.all([
            getRequestHost().catch(() => null),
            getRequestPath().catch(() => null),
          ]);

          logTenantObservabilityEvent({
            event: "tenant_prisma_scope_fallback_used",
            host,
            path,
            resolvedShopId: DEFAULT_SHOP_ID,
            usedFallback: true,
            fallbackReason: "getCurrentShopId_failed",
            prismaModel: model,
            prismaOperation: operation,
            errorName: error instanceof Error ? error.name : "UnknownError",
            errorMessage: error instanceof Error ? error.message : "unknown",
          });

          return DEFAULT_SHOP_ID;
        });

        if (
          operation === "findMany" ||
          operation === "findFirst" ||
          operation === "findFirstOrThrow" ||
          operation === "count" ||
          operation === "aggregate" ||
          operation === "groupBy" ||
          operation === "updateMany" ||
          operation === "deleteMany"
        ) {
          return query({
            ...args,
            where: mergeWhereWithShop(
              args.where as Record<string, unknown> | undefined,
              shopId
            ),
          } as never);
        }

        if (
          operation === "findUnique" ||
          operation === "findUniqueOrThrow" ||
          operation === "update" ||
          operation === "delete"
        ) {
          const scopedArgs = args as {
            where?: Record<string, unknown>;
            data?: Record<string, unknown>;
          };

          return query({
            ...scopedArgs,
            where: rewriteUniqueWhere(
              model,
              scopedArgs.where,
              shopId
            ),
            data: injectNestedShopId(
              model,
              scopedArgs.data,
              shopId
            ),
          } as never);
        }

        if (operation === "upsert") {
          const scopedArgs = args as {
            where?: Record<string, unknown>;
            create?: Record<string, unknown>;
            update?: Record<string, unknown>;
          };

          return query({
            ...scopedArgs,
            where: rewriteUniqueWhere(
              model,
              scopedArgs.where,
              shopId
            ),
            create: injectNestedShopId(
              model,
              scopedArgs.create,
              shopId
            ),
            update: injectNestedShopId(
              model,
              scopedArgs.update,
              shopId
            ),
          } as never);
        }

        if (operation === "create") {
          const scopedArgs = args as {
            data?: Record<string, unknown>;
          };

          return query({
            ...scopedArgs,
            data: injectNestedShopId(
              model,
              scopedArgs.data,
              shopId
            ),
          } as never);
        }

        if (operation === "createMany") {
          const createManyArgs = args as {
            data: Record<string, unknown> | Record<string, unknown>[];
          };

          return query({
            ...createManyArgs,
            data: Array.isArray(createManyArgs.data)
              ? createManyArgs.data.map((entry) => withShopId(entry, shopId))
              : withShopId(createManyArgs.data as Record<string, unknown>, shopId),
          } as never);
        }

        return query(args);
      },
    },
  },
}) as typeof basePrisma;
