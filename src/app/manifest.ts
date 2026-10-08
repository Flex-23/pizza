import type { MetadataRoute } from "next";

/**
 * The web app manifest, served at `/manifest.webmanifest`.
 *
 * Its job here is the icon set: this is what a phone uses when the site is
 * added to the home screen, and one more place that names the pizza mark as
 * the brand icon. The `icon.png` and `apple-icon.png` files in this folder
 * cover the browser tab and iOS through Next's file convention — see
 * `scripts/generate-icons.mjs`, which renders all of them from one SVG.
 *
 * Deliberately static and German: a manifest is fetched once, outside any
 * request the language cookie rides on, so it cannot follow the visitor's
 * locale the way the pages do.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pizza Day & Night — Lieferservice Karlsruhe",
    short_name: "Pizza Day & Night",
    description:
      "Pizza, Pasta, Burger, Gyros und mehr — täglich frisch geliefert in Karlsruhe.",
    start_url: "/",
    display: "standalone",
    background_color: "#1a1412",
    theme_color: "#1a1412",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
