import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as {
  prismaBase: PrismaClient | undefined;
};

const shouldLogQueries =
  process.env.PRISMA_QUERY_LOG === "1" ||
  process.env.PRISMA_QUERY_LOG?.toLowerCase() === "true";

export const basePrisma =
  globalForPrisma.prismaBase ||
  new PrismaClient({
    log: shouldLogQueries ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = basePrisma;
}
