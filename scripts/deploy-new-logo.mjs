import sharp from "sharp";
import fs from "fs";

async function deploy() {
  const inputPath = "/Users/amy/.gemini/antigravity/brain/d5b2c105-6ab2-4ec5-8e07-0318a086e602/cutout_perfect.png";
  
  // 1. Ensure backup directory
  if (!fs.existsSync("public/brand/_backup")) {
    fs.mkdirSync("public/brand/_backup", { recursive: true });
    if (fs.existsSync("public/brand/logo.png")) {
      fs.copyFileSync("public/brand/logo.png", "public/brand/_backup/logo.png.bak");
    }
    if (fs.existsSync("public/brand/logo-arena.webp")) {
      fs.copyFileSync("public/brand/logo-arena.webp", "public/brand/_backup/logo-arena.webp.bak");
    }
    if (fs.existsSync("public/share-icon.png")) {
      fs.copyFileSync("public/share-icon.png", "public/brand/_backup/share-icon.png.bak");
    }
  }

  // 2. Generate public/brand/logo.png
  // High-res transparent PNG 1080x1080
  console.log("Generating public/brand/logo.png...");
  await sharp(inputPath)
    .png({ compressionLevel: 9, effort: 10 })
    .toFile("public/brand/logo.png");

  // 3. Generate public/brand/logo-arena.webp
  // Trimmed to non-transparent bounding box with 6px padding
  console.log("Generating public/brand/logo-arena.webp...");
  const trimmedPng = await sharp(inputPath)
    .trim({ threshold: 5 })
    .png()
    .toBuffer();

  const meta = await sharp(trimmedPng).metadata();
  const padW = meta.width + 12;
  const padH = meta.height + 12;

  await sharp({
    create: {
      width: padW,
      height: padH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: trimmedPng, left: 6, top: 6 }])
    .webp({ quality: 95, effort: 6 })
    .toFile("public/brand/logo-arena.webp");

  // 4. Generate public/brand/social-logo.png (512x512 on #040a1a)
  console.log("Generating public/brand/social-logo.png...");
  const logo512 = await sharp(trimmedPng)
    .resize(440, 440, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const bg512 = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 4, g: 10, b: 26, alpha: 1 }
    }
  }).png().toBuffer();

  await sharp(bg512)
    .composite([{ input: logo512, gravity: "center" }])
    .png()
    .toFile("public/brand/social-logo.png");

  // 5. Generate public/share-icon.png (256x256 on #040a1a)
  console.log("Generating public/share-icon.png...");
  const logo256 = await sharp(trimmedPng)
    .resize(220, 220, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const bg256 = await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 4,
      background: { r: 4, g: 10, b: 26, alpha: 1 }
    }
  }).png().toBuffer();

  await sharp(bg256)
    .composite([{ input: logo256, gravity: "center" }])
    .png()
    .toFile("public/share-icon.png");

  // 6. Generate public/favicon.ico
  // Modern ICO container with 256x256 PNG
  console.log("Generating public/favicon.ico...");
  const faviconPng = await sharp(trimmedPng)
    .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const icoHeader = Buffer.alloc(22);
  icoHeader.writeUInt16LE(0, 0); // reserved
  icoHeader.writeUInt16LE(1, 2); // type 1 = icon
  icoHeader.writeUInt16LE(1, 4); // 1 image
  icoHeader.writeUInt8(0, 6);   // width 0 = 256
  icoHeader.writeUInt8(0, 7);   // height 0 = 256
  icoHeader.writeUInt8(0, 8);   // color palette
  icoHeader.writeUInt8(0, 9);   // reserved
  icoHeader.writeUInt16LE(1, 10); // color planes
  icoHeader.writeUInt16LE(32, 12); // bits per pixel
  icoHeader.writeUInt32LE(faviconPng.length, 14); // image size
  icoHeader.writeUInt32LE(22, 18); // offset where image data starts

  const icoBuffer = Buffer.concat([icoHeader, faviconPng]);
  fs.writeFileSync("public/favicon.ico", icoBuffer);

  console.log("All logo assets generated and deployed into public/ successfully!");
}

deploy();
