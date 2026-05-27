/** @type {import('next').NextConfig} */
const defaultEmbedFrameHosts = [
  "https://www.youtube.com",
  "https://youtube.com",
  "https://www.youtube-nocookie.com",
  "https://open.spotify.com",
  "https://soundcloud.com",
  "https://w.soundcloud.com",
  "https://bandcamp.com",
  "https://music.apple.com",
  "https://embed.music.apple.com"
];

function cspFrameHosts() {
  const hosts = new Set(defaultEmbedFrameHosts);
  const raw = process.env.MIXTAPE_EMBED_IFRAME_HOSTS?.trim();
  if (!raw) return [...hosts];

  for (const entry of raw.split(/[\s,]+/)) {
    const trimmed = entry.trim().toLowerCase();
    if (!trimmed) continue;
    if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
      hosts.add(trimmed);
    } else {
      hosts.add(`https://${trimmed}`);
    }
  }
  return [...hosts];
}

const allFrameHosts = cspFrameHosts();

const nextConfig = {
  basePath: "/app",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-src 'self' ${allFrameHosts.join(" ")};`
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
