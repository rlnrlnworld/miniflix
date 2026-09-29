import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseUrl
        ? [new URL(`${supabaseUrl}/storage/v1/object/public/**`)]
        : []),
      new URL("https://lh3.googleusercontent.com/**"),
    ],
  },
};

export default nextConfig;
