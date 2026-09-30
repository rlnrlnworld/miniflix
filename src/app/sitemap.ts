import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [contents, series] = await Promise.all([
    prisma.content.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.series.findMany({ select: { slug: true, updatedAt: true } }),
  ]);
  return [
    {
      url: new URL("/", base).toString(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...contents.map((c) => ({
      url: new URL(`/watch/${c.slug}`, base).toString(),
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...series.map((s) => ({
      url: new URL(`/title/${s.slug}`, base).toString(),
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
