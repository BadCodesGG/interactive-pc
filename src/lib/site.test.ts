import type { Metadata } from "next";
import { describe, expect, it, vi } from "vitest";
import { metadata as layoutMetadata } from "@/app/layout";
import { metadata as buildMetadata } from "@/app/build/page";
import { metadata as homeMetadata } from "@/app/page";
// The layout calls next/font at module scope, which only the Next compiler provides.
vi.mock("next/font/google", () => ({ IBM_Plex_Mono: () => ({ variable: "" }), Manrope: () => ({ variable: "" }) }));

import { OG_IMAGE, pageMetadata, shareTitle, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./site";

const routes: [string, Metadata, string][] = [
  ["layout", layoutMetadata, "/"],
  ["/", homeMetadata, "/"],
  ["/build", buildMetadata, "/build"],
];

describe("share metadata", () => {
  it("points at the https custom domain", () => {
    expect(SITE_URL).toBe("https://pc.badcodes.dev");
  });

  it("describes the image and sizes it for large cards", () => {
    expect(OG_IMAGE).toMatchObject({ url: "/og.jpg", width: 1200, height: 630 });
    expect(OG_IMAGE.alt.length).toBeGreaterThan(20);
  });

  it("the layout resolves relative urls against the site", () => {
    expect(String(layoutMetadata.metadataBase)).toBe(`${SITE_URL}/`);
    expect(layoutMetadata.description).toBe(SITE_DESCRIPTION);
  });

  it.each(routes)("%s carries the image on og and twitter", (_name, meta, path) => {
    expect(meta.openGraph?.images).toEqual([OG_IMAGE]);
    expect(meta.twitter?.images).toEqual([OG_IMAGE.url]);
    expect(meta.openGraph).toMatchObject({ siteName: SITE_NAME, type: "website" });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    if (path !== "/") expect(meta.alternates?.canonical).toBe(path);
  });

  it.each(routes.slice(1))("%s has its own og title, description and url", (_name, meta, path) => {
    const card = shareTitle(meta.title as string, path);
    expect(meta.openGraph).toMatchObject({ title: card, description: meta.description, url: path });
    expect(meta.twitter).toMatchObject({ title: card, description: meta.description });
  });

  it("pageMetadata builds the full fragment", () => {
    expect(pageMetadata({ title: "T", description: "D", path: "/x" })).toEqual({
      title: "T",
      description: "D",
      alternates: { canonical: "/x" },
      openGraph: { type: "website", siteName: SITE_NAME, title: "T | Interactive", description: "D", url: "/x", images: [OG_IMAGE] },
      twitter: { card: "summary_large_image", title: "T | Interactive", description: "D", images: ["/og.jpg"] },
    });
  });
  it("a card's title is the page's <title>: the root page as written, every other route with the suffix", () => {
    expect(shareTitle("T", "/")).toBe("T");
    expect(shareTitle("T", "/x")).toBe(`T | ${SITE_NAME}`);
  });

});
