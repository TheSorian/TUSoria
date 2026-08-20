import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Clean, modern, high-contrast SVG with full-bleed background and central safe-zone emblem
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient: Deep Midnight Navy matching #0c1425 -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#111d38"/>
      <stop offset="100%" stop-color="#080e1c"/>
    </linearGradient>

    <!-- Badge Gradient: Royal Transit Blue with sleek depth -->
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>

    <!-- Glass Windshield Gradient -->
    <linearGradient id="glassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>

    <!-- Soft Depth Shadow -->
    <filter id="badgeShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Full-bleed background: 100% of 512x512 canvas so masks never clip -->
  <rect width="512" height="512" fill="url(#bgGrad)"/>

  <!-- Centered Circular Badge inside Safe Zone (r=138px -> diameter 276px, well inside the 409px circular mask) -->
  <circle cx="256" cy="256" r="140" fill="url(#badgeGrad)" filter="url(#badgeShadow)"/>
  <circle cx="256" cy="256" r="139" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-opacity="0.7"/>

  <!-- Modern Bus Graphic inside Badge (Centered around 256, 256) -->
  <g transform="translate(256, 256)">
    <!-- Bus Main Outer Body -->
    <rect x="-70" y="-62" width="140" height="120" rx="24" fill="#ffffff"/>

    <!-- Bus Windshield Glass -->
    <rect x="-56" y="-48" width="112" height="44" rx="10" fill="url(#glassGrad)"/>

    <!-- Destination LED matrix / line sign in windshield -->
    <rect x="-38" y="-42" width="76" height="11" rx="3" fill="#f59e0b"/>
    <text x="0" y="-33.5" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="8" fill="#000000" text-anchor="middle" letter-spacing="1">SORIA</text>

    <!-- Bus Grille Accent Line -->
    <rect x="-42" y="10" width="84" height="6" rx="3" fill="#cbd5e1"/>

    <!-- Twin Amber Headlights with bright center -->
    <circle cx="-46" cy="28" r="10" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5"/>
    <circle cx="-46" cy="28" r="4" fill="#ffffff"/>

    <circle cx="46" cy="28" r="10" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5"/>
    <circle cx="46" cy="28" r="4" fill="#ffffff"/>

    <!-- License Plate / Logo emblem in bumper -->
    <rect x="-18" y="24" width="36" height="10" rx="2" fill="#1e293b"/>
    <text x="0" y="31.5" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="6.5" fill="#38bdf8" text-anchor="middle">TUS</text>

    <!-- Side Mirrors -->
    <rect x="-78" y="-36" width="8" height="18" rx="3" fill="#ffffff"/>
    <rect x="70" y="-36" width="8" height="18" rx="3" fill="#ffffff"/>

    <!-- Bus Wheels (bottom) -->
    <rect x="-56" y="54" width="24" height="14" rx="4" fill="#0f172a"/>
    <rect x="32" y="54" width="24" height="14" rx="4" fill="#0f172a"/>
  </g>
</svg>
`;

async function generateAll() {
  console.log('Generating crisp modern PWA icons with safe-zone compliance...');
  const pubDir = path.join(process.cwd(), 'public');

  // Save SVG
  fs.writeFileSync(path.join(pubDir, 'favicon.svg'), svgIcon.trim());
  console.log('✓ Saved public/favicon.svg');

  const svgBuffer = Buffer.from(svgIcon);

  // 1. pwa-512x512.png (512x512)
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(pubDir, 'pwa-512x512.png'));
  console.log('✓ Generated public/pwa-512x512.png (512x512)');

  // 2. pwa-maskable-512x512.png (512x512)
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(pubDir, 'pwa-maskable-512x512.png'));
  console.log('✓ Generated public/pwa-maskable-512x512.png (512x512)');

  // 3. pwa-192x192.png (192x192)
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(pubDir, 'pwa-192x192.png'));
  console.log('✓ Generated public/pwa-192x192.png (192x192)');

  // 4. pwa-maskable-192x192.png (192x192)
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(pubDir, 'pwa-maskable-192x192.png'));
  console.log('✓ Generated public/pwa-maskable-192x192.png (192x192)');

  // 5. apple-touch-icon.png (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(pubDir, 'apple-touch-icon.png'));
  console.log('✓ Generated public/apple-touch-icon.png (180x180)');

  // 6. favicon.png (64x64)
  await sharp(svgBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.join(pubDir, 'favicon.png'));
  console.log('✓ Generated public/favicon.png (64x64)');

  // 7. Android Native Mipmaps
  const androidResDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(androidResDir)) {
    const mipmaps = [
      { folder: 'mipmap-mdpi', size: 48, fgSize: 108 },
      { folder: 'mipmap-hdpi', size: 72, fgSize: 162 },
      { folder: 'mipmap-xhdpi', size: 96, fgSize: 216 },
      { folder: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
      { folder: 'mipmap-xxxhdpi', size: 192, fgSize: 432 }
    ];

    for (const m of mipmaps) {
      const dir = path.join(androidResDir, m.folder);
      if (fs.existsSync(dir)) {
        await sharp(svgBuffer).resize(m.size, m.size).png().toFile(path.join(dir, 'ic_launcher.png'));
        await sharp(svgBuffer).resize(m.size, m.size).png().toFile(path.join(dir, 'ic_launcher_round.png'));
        await sharp(svgBuffer).resize(m.fgSize, m.fgSize).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
        console.log(`✓ Generated Android ${m.folder} icons (${m.size}x${m.size})`);
      }
    }
  }

  console.log('All icons generated successfully!');
}

generateAll().catch(console.error);
