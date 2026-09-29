import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("missing env: DATABASE_URL");
  return new PrismaClient({ adapter: new PrismaPg(url) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
