import { PrismaClient } from "@prisma/client";

const RENDER_SQLITE_URL = "file:/tmp/powercouple.db";
const isRender = Boolean(process.env.RENDER);
const envDbUrl = process.env.DATABASE_URL;
const resolvedDbUrl =
  isRender && (!envDbUrl || envDbUrl === "file:./prisma/dev.db")
    ? RENDER_SQLITE_URL
    : envDbUrl;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    resolvedDbUrl
      ? {
          datasources: {
            db: {
              url: resolvedDbUrl,
            },
          },
        }
      : undefined
  );

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
