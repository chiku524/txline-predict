import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes = ["/", "/matches", "/markets", "/dashboard"];

  return routes.map((path) => ({
    url: `${siteConfig.url}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: path === "/" || path === "/matches" ? "hourly" : "daily",
    priority: path === "/" ? 1 : 0.8,
  }));
}
