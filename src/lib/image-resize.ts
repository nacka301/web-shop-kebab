// Smanjuje fotografiju s mobitela prije slanja: najduža stranica 1280 px, JPEG. Slika s kamere
// ima 5-10 MB; ovako je ~150-300 KB, pa se jelovnik brzo učitava i na slaboj vezi.
export async function resizeImage(file: File, maxSide = 1280, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/jpeg", quality);
  });
}
