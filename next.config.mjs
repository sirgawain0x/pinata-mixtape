/** @type {import('next').NextConfig} */
const embedFrameHosts = [
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

const nextConfig = {
  basePath: "/app",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-src 'self' ${embedFrameHosts.join(" ")};`
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
