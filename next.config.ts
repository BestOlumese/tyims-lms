import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" }, // Faker avatars
      { protocol: "https", hostname: "cdn.jsdelivr.net" }, // Faker avatars (newer)
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "randomuser.me" },
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
  sassOptions: {
    silenceDeprecations: ["import"],
  },
  experimental: {
    // This app has multiple root layouts (template shell vs Tailwind dashboards), so there
    // is no single layout to compose a 404 from. app/global-not-found.tsx supplies one for
    // the whole app. See components/root-shell.tsx for why the roots are split.
    globalNotFound: true,
  },
};

export default nextConfig;

