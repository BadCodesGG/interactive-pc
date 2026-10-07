import type { Metadata } from "next";

/** The production custom domain. A literal on purpose: a relative or deployment URL makes Slack and Facebook drop the image. */
export const SITE_URL = "https://pc.badcodes.dev";
export const SITE_NAME = "Interactive";
export const SITE_DESCRIPTION = "Pull a gaming PC apart in 3D, read what every part does, then build it yourself in the right order.";

/** The share image in `public/`. Next resolves the relative url against `metadataBase` in the layout. */
export const OG_IMAGE = {
  url: "/og.jpg",
  width: 1200,
  height: 630,
  alt: "A gaming PC pulled apart in 3D: the case, glass panel, CPU cooler and memory separated.",
};

/**
 * The title a card shows, which is the page's own `<title>`. The layout's template
 * (`%s | ${SITE_NAME}`) applies to every route below the root but never to the root page, and
 * og:title and twitter:title never go through it, so the suffix is added here.
 */
export function shareTitle(title: string, path: string): string {
  return path === "/" ? title : `${title} | ${SITE_NAME}`;
}

/**
 * Metadata for one route. Next replaces a layout's `openGraph` and `twitter` wholesale when a route
 * declares its own, so a route that set only its title would lose the image or carry the layout's
 * title. Every route that sets metadata goes through this.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const card = shareTitle(title, path);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, title: card, description, url: path, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: card, description, images: [OG_IMAGE.url] },
  };
}
