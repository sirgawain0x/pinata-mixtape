import type { MetadataRoute } from "next";
import { absoluteUrl, appAbsoluteUrl } from "../lib/seo";
import { listPublicMixesForSitemap } from "../lib/mixtapes";
import { listPublicStationsForSitemap } from "../lib/stations";

/** Cache sitemap to limit crawler-driven DB load (robots.txt advertises this URL). */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: appAbsoluteUrl(),
      changeFrequency: "weekly",
      priority: 0.9
    }
  ];

  try {
    const [mixes, stations] = await Promise.all([
      listPublicMixesForSitemap(),
      listPublicStationsForSitemap()
    ]);

    const mixEntries: MetadataRoute.Sitemap = mixes.map((mix) => ({
      url: appAbsoluteUrl(`m/${mix.slug}`),
      lastModified: mix.updatedAt ? new Date(mix.updatedAt) : undefined,
      changeFrequency: "monthly" as const,
      priority: 0.7
    }));

    const stationEntries: MetadataRoute.Sitemap = stations.map((station) => ({
      url: appAbsoluteUrl(`s/${station.handle}`),
      lastModified: station.updatedAt ? new Date(station.updatedAt) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.6
    }));

    return [...staticEntries, ...mixEntries, ...stationEntries];
  } catch {
    return staticEntries;
  }
}
