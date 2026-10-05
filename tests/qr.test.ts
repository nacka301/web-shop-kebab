import assert from "node:assert/strict";
import { test } from "node:test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { buildShopUrl, qrPngBuffer } from "../src/lib/qr";
import { SOURCES } from "../src/lib/sources";

// Dekodiramo generiranu sliku istim algoritmom kakav koristi čitač u kameri.
function decode(png: Buffer): string | null {
  const image = PNG.sync.read(png);
  return jsQR(new Uint8ClampedArray(image.data), image.width, image.height)?.data ?? null;
}

test("QR se skenira i vodi na točan link s ?src=qr", async () => {
  const url = buildShopUrl("https://web-shop-kebab.vercel.app", "smash", "qr");
  assert.equal(url, "https://web-shop-kebab.vercel.app/smash?src=qr");
  for (const width of [300, 600, 2048]) {
    assert.equal(decode(await qrPngBuffer(url, width)), url, `širina ${width}`);
  }
});

test("svaki gotov link (ig, fb, gmaps, wa, qr) daje QR koji se čita", async () => {
  for (const src of SOURCES.filter((s) => s !== "other")) {
    const url = buildShopUrl("https://primjer.hr/", "emmito", src);
    assert.equal(decode(await qrPngBuffer(url, 600)), url, src);
  }
});

test("korekcija grešaka: čita se i s oštećenim sredinom koda (~10 % površine)", async () => {
  const url = buildShopUrl("https://web-shop-kebab.vercel.app", "emmito", "qr");
  const image = PNG.sync.read(await qrPngBuffer(url, 800));
  const size = Math.round(image.width * 0.1);
  const start = Math.round(image.width / 2 - size / 2);
  for (let y = start; y < start + size; y += 1) {
    for (let x = start; x < start + size; x += 1) {
      const i = (y * image.width + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
    }
  }
  const result = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
  assert.equal(result?.data, url);
});

test("link bez izvora i s kosom crtom na kraju", () => {
  assert.equal(buildShopUrl("https://a.hr///", "x"), "https://a.hr/x");
});
