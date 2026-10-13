import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public, indexable pages only — auth forms and /profile are left out on purpose.
const ROUTES = [
  "",
  "/progress",
  "/changelog",
  "/contact",
  "/tools",
  "/tools/lnp-formula",
  "/tools/tlnp",
  "/tools/ivt",
  "/tools/elisa",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({ url: `${SITE_URL}${path}` }));
}
