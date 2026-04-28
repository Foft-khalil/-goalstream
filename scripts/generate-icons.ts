import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

const svgPath = join(import.meta.dir, '..', 'public', 'icon.svg');
const svgBuffer = readFileSync(svgPath);

async function generateIcons() {
  // 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(join(import.meta.dir, '..', 'public', 'icon-192.png'));
  console.log('✅ Generated icon-192.png');

  // 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(join(import.meta.dir, '..', 'public', 'icon-512.png'));
  console.log('✅ Generated icon-512.png');

  // Apple touch icon 180x180
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(join(import.meta.dir, '..', 'public', 'apple-touch-icon.png'));
  console.log('✅ Generated apple-touch-icon.png');

  // Favicon 32x32
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(join(import.meta.dir, '..', 'public', 'favicon-32.png'));
  console.log('✅ Generated favicon-32.png');

  // Maskable icon - same icon with more padding for safe zone
  // For maskable, we need the icon to be within the center 80% (40% padding from each edge)
  const maskableSize = 512;
  const iconDrawSize = Math.round(maskableSize * 0.8); // 410px
  const offset = Math.round((maskableSize - iconDrawSize) / 2); // 51px

  await sharp(svgBuffer)
    .resize(iconDrawSize, iconDrawSize)
    .extend({
      top: offset,
      bottom: offset,
      left: offset,
      right: offset,
      background: { r: 22, g: 163, b: 74, alpha: 1 }, // #16a34a
    })
    .png()
    .toFile(join(import.meta.dir, '..', 'public', 'icon-maskable-512.png'));
  console.log('✅ Generated icon-maskable-512.png');
}

generateIcons().catch(console.error);
