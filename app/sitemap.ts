import type { MetadataRoute } from "next";
import { absoluteUrl, appAbsoluteUrl } from "../lib/seo";
import { listMixes } from "../lib/mixtapes";
import { listStations } from "../lib/stations";

export const dynamic = "force-dynamic";

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
      listMixes("", { publicOnly: true }),
      listStations({ publicOnly: true })
    ]);

    const mixEntries: MetadataRoute.Sitemap = mixes
      .filter((mix) => mix.isPublic && mix.slug.trim())
      .map((mix) => ({
        url: appAbsoluteUrl(`m/${mix.slug}`),
        lastModified: mix.updatedAt ? new Date(mix.updatedAt) : undefined,
        changeFrequency: "monthly" as const,
        priority: 0.7
      }));

    const stationEntries: MetadataRoute.Sitemap = stations
      .filter((station) => station.isPublic && station.handle.trim())
      .map((station) => ({
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
