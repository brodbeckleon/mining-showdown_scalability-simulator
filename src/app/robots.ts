import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://mining-showdown.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/solo", "/create", "/join"],
        disallow: ["/session/", "/join/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
