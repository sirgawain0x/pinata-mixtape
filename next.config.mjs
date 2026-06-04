/** @type {import('next').NextConfig} */
const defaultEmbedFrameHosts = [
  "https://www.youtube.com",
  "https://youtube.com",
  "https://www.youtube-nocookie.com",
  "https://tv.creativeplatform.xyz",
  "https://lvpr.tv",
  "https://open.spotify.com",
  "https://soundcloud.com",
  "https://w.soundcloud.com",
  "https://bandcamp.com",
  "https://music.apple.com",
  "https://embed.music.apple.com"
];

/** Alchemy Account Kit + Turnkey (required for sign-in modal). */
const defaultAuthFrameHosts = ["https://auth.turnkey.com", "https://accounts.google.com"];

const defaultAuthConnectHosts = [
  "https://api.g.alchemy.com",
  "https://*.g.alchemy.com",
  "https://auth.turnkey.com",
  "https://api.turnkey.com",
  "https://accounts.google.com",
  "https://oauth2.googleapis.com",
  "https://www.googleapis.com",
  "https://*.walletconnect.org",
  "wss://*.walletconnect.org",
  "https://relay.walletconnect.org"
];

function mergeCspHosts(defaults, envKey) {
  const hosts = new Set(defaults);
  const raw = process.env[envKey]?.trim();
  if (!raw) return [...hosts];

  for (const entry of raw.split(/[\s,]+/)) {
    const trimmed = entry.trim().toLowerCase();
    if (!trimmed) continue;
    if (
      trimmed.startsWith("https://") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("wss://")
    ) {
      hosts.add(trimmed);
    } else {
      hosts.add(`https://${trimmed}`);
    }
  }
  return [...hosts];
}

function cspFrameHosts() {
  return mergeCspHosts([...defaultEmbedFrameHosts, ...defaultAuthFrameHosts], "MIXTAPE_EMBED_IFRAME_HOSTS");
}

function cspConnectHosts() {
  return mergeCspHosts(
    [
      "https://livepeercdn.com",
      "https://livepeer.studio",
      "https://*.livepeercdn.com",
      ...defaultAuthConnectHosts
    ],
    "MIXTAPE_CSP_CONNECT_HOSTS"
  );
}

const allFrameHosts = cspFrameHosts();
const allConnectHosts = cspConnectHosts();

const nextConfig = {
  basePath: "/app",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              `frame-src 'self' ${allFrameHosts.join(" ")}`,
              "media-src 'self' blob: https://livepeercdn.com https://*.livepeercdn.com",
              `connect-src 'self' ${allConnectHosts.join(" ")}`
            ].join("; ")
          }
        ]
      }
    ];
  },
  // kokoro-js loads voice .bin files via path relative to its dist/ folder; bundling breaks that (ENOENT under .next/server/voices).
  serverExternalPackages: ["kokoro-js", "onnxruntime-node"],
  // Kokoro is disabled on Vercel (see lib/tts/index.ts); keep ONNX stack out of serverless zips (250MB limit).
  outputFileTracingExcludes: {
    "*": [
      "node_modules/onnxruntime-node/**/*",
      "node_modules/kokoro-js/**/*",
      "node_modules/@huggingface/transformers/**/*",
      "node_modules/phonemizer/**/*"
    ]
  },
  webpack: (config) => {
    // viem 2.x's `ox` package uses a dynamic require for chain definitions
    // that webpack cannot statically analyze. The warning is harmless.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /node_modules\/ox\// }
    ];
    return config;
  }
};

export default nextConfig;
