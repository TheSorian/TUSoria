import zlib from 'zlib';
import fs from 'fs';
import path from 'path';

// Standard CRC32 implementation for PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function createPng(width, height, drawFn) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Scanlines: width * 4 + 1 (filter byte) per row
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[offset++] = Math.max(0, Math.min(255, Math.round(r)));
      rawData[offset++] = Math.max(0, Math.min(255, Math.round(g)));
      rawData[offset++] = Math.max(0, Math.min(255, Math.round(b)));
      rawData[offset++] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }

  const idatChunk = makeChunk('IDAT', zlib.deflateSync(rawData, { level: 9 }));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Distance to rounded rectangle
function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const inside = Math.min(Math.max(qx, qy), 0);
  return Math.sqrt(ox * ox + oy * oy) + inside - r;
}

// Draw full-bleed maskable icon with safe-zone centered emblem
function drawTUSoriaIcon(x, y, size) {
  const nx = x / size; // 0 to 1
  const ny = y / size; // 0 to 1

  // 1. Full-bleed modern vibrant background gradient (Deep Navy to Electric Blue)
  // Ensures 100% full bleed so circular masks NEVER show clipping/white corners
  const grad = (nx * 0.4 + ny * 0.6);
  let r = 12 * (1 - grad) + 30 * grad;
  let g = 24 * (1 - grad) + 70 * grad;
  let b = 50 * (1 - grad) + 160 * grad;
  let a = 255;

  // Center coordinate space (-1 to 1)
  const cx = (x - size / 2) / (size / 2);
  const cy = (y - size / 2) / (size / 2);

  // 2. Inner Shield / Card (well within the safe zone, scale 0.68)
  const shieldDist = sdRoundedBox(cx, cy, 0.66, 0.66, 0.28);
  if (shieldDist < 0) {
    // Inside shield: bright cobalt blue gradient with subtle top highlight
    const sGrad = 0.5 + 0.5 * (-cy);
    const sR = 37 * (1 - sGrad * 0.2) + 59 * (sGrad * 0.3);
    const sG = 99 * (1 - sGrad * 0.2) + 130 * (sGrad * 0.4);
    const sB = 235 * (1 - sGrad * 0.1) + 246 * (sGrad * 0.1);
    
    // Smooth anti-aliased border
    const edgeAlpha = Math.min(1, Math.max(0, -shieldDist * size * 0.3));
    r = r * (1 - edgeAlpha) + sR * edgeAlpha;
    g = g * (1 - edgeAlpha) + sG * edgeAlpha;
    b = b * (1 - edgeAlpha) + sB * edgeAlpha;
  }

  // Shield subtle glow/border
  if (shieldDist >= -0.04 && shieldDist <= 0.02) {
    const borderAlpha = Math.max(0, 1 - Math.abs(shieldDist + 0.01) / 0.03);
    r = r * (1 - borderAlpha * 0.4) + 255 * (borderAlpha * 0.4);
    g = g * (1 - borderAlpha * 0.4) + 255 * (borderAlpha * 0.4);
    b = b * (1 - borderAlpha * 0.4) + 255 * (borderAlpha * 0.4);
  }

  // 3. Bus Silhouette / Emblem (scale factor positioned in safe zone)
  // Bus Body: rounded rect centered slightly above middle (cy from -0.38 to +0.22)
  const busBody = sdRoundedBox(cx, cy + 0.06, 0.40, 0.34, 0.12);
  if (busBody < 0) {
    const bodyAlpha = Math.min(1, Math.max(0, -busBody * size * 0.4));
    r = r * (1 - bodyAlpha) + 255 * bodyAlpha;
    g = g * (1 - bodyAlpha) + 255 * bodyAlpha;
    b = b * (1 - bodyAlpha) + 255 * bodyAlpha;
  }

  // Bus Windshield (upper window): cut out with deep blue
  const windshield = sdRoundedBox(cx, cy + 0.20, 0.31, 0.12, 0.04);
  if (windshield < 0) {
    const winAlpha = Math.min(1, Math.max(0, -windshield * size * 0.4));
    const winR = 15;
    const winG = 28;
    const winB = 55;
    r = r * (1 - winAlpha) + winR * winAlpha;
    g = g * (1 - winAlpha) + winG * winAlpha;
    b = b * (1 - winAlpha) + winB * winAlpha;
  }

  // Bus Headlights (Left & Right circles)
  const leftLightDist = Math.sqrt((cx + 0.24) ** 2 + (cy + 0.02) ** 2) - 0.045;
  const rightLightDist = Math.sqrt((cx - 0.24) ** 2 + (cy + 0.02) ** 2) - 0.045;
  if (leftLightDist < 0 || rightLightDist < 0) {
    const lDist = Math.min(leftLightDist, rightLightDist);
    const lightAlpha = Math.min(1, Math.max(0, -lDist * size * 0.4));
    // Warm amber / yellow headlight
    r = r * (1 - lightAlpha) + 245 * lightAlpha;
    g = g * (1 - lightAlpha) + 158 * lightAlpha;
    b = b * (1 - lightAlpha) + 11 * lightAlpha;
  }

  // Bus Grille line / Route indicator in center
  const grille = sdRoundedBox(cx, cy - 0.08, 0.14, 0.02, 0.01);
  if (grille < 0) {
    const gAlpha = Math.min(1, Math.max(0, -grille * size * 0.4));
    r = r * (1 - gAlpha) + 37 * gAlpha;
    g = g * (1 - gAlpha) + 99 * gAlpha;
    b = b * (1 - gAlpha) + 235 * gAlpha;
  }

  // Bus Wheels (bottom left & right)
  const leftWheel = sdRoundedBox(cx + 0.24, cy - 0.32, 0.07, 0.05, 0.02);
  const rightWheel = sdRoundedBox(cx - 0.24, cy - 0.32, 0.07, 0.05, 0.02);
  if (leftWheel < 0 || rightWheel < 0) {
    const wDist = Math.min(leftWheel, rightWheel);
    const wheelAlpha = Math.min(1, Math.max(0, -wDist * size * 0.4));
    r = r * (1 - wheelAlpha) + 255 * wheelAlpha;
    g = g * (1 - wheelAlpha) + 255 * wheelAlpha;
    b = b * (1 - wheelAlpha) + 255 * wheelAlpha;
  }

  return [r, g, b, a];
}

// Generate all standard icon sizes
const sizes = [
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon.png', size: 64 }
];

console.log('Generating crisp full-bleed maskable PWA icons...');

for (const item of sizes) {
  const pngBuf = createPng(item.size, item.size, (x, y, s) => drawTUSoriaIcon(x, y, s));
  const outPath = path.join(process.cwd(), 'public', item.name);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`✓ Generated ${item.name} (${item.size}x${item.size}) [${pngBuf.length} bytes]`);
}

console.log('All icons generated successfully with full-bleed maskable safe zones!');
