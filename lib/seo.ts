const DEFAULT_SITE_ORIGIN = "https://mixtape.creativeplatform.xyz";

/** Public site origin (marketing + app), without trailing slash. */
export function siteOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_MARKETING_ORIGIN?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      // fall through
    }
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "")}`;
  }
  return DEFAULT_SITE_ORIGIN;
}

export function absoluteUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${siteOrigin()}${path}`;
}

/** Canonical path for a Next app route (basePath `/app` is included). */
export function appPath(route = ""): string {
  const trimmed = route.replace(/^\/+/, "");
  return trimmed ? `/app/${trimmed}` : "/app";
}

export function appAbsoluteUrl(route = ""): string {
  return absoluteUrl(appPath(route));
}

export function marketingLandingHtml(rawHtml: string): string {
  const canonical = absoluteUrl("/");
  if (rawHtml.includes('rel="canonical"')) {
    return rawHtml;
  }
  return rawHtml.replace("</head>", `  <link rel="canonical" href="${canonical}" />\n</head>`);
}
