import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const contents = await prisma.content.findMany({
    select: { slug: true, updatedAt: true },
  });
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
  ];
}
