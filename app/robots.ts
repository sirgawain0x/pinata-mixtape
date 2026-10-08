import type { MetadataRoute } from "next";
import { absoluteUrl } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/app/"],
      disallow: ["/app/api/", "/app/dashboard"]
    },
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
