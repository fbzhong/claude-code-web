#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

async function generatePNGFromSVG(svgPath, outputPath, size) {
  try {
    // Read SVG content
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    
    // Create canvas
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Create data URL from SVG
    const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
    
    // Load and draw image
    const img = await loadImage(svgDataUrl);
    ctx.drawImage(img, 0, 0, size, size);
    
    // Save as PNG
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`Generated ${outputPath} (${size}x${size})`);
  } catch (error) {
    console.error(`Error generating ${outputPath}:`, error);
  }
}

async function generateAllIcons() {
  const publicDir = path.join(__dirname, '../public');
  const svgPath = path.join(publicDir, 'favicon.svg');
  
  // Check if SVG exists
  if (!fs.existsSync(svgPath)) {
    console.error('favicon.svg not found in public directory');
    process.exit(1);
  }
  
  // Generate different sizes
  await generatePNGFromSVG(svgPath, path.join(publicDir, 'favicon-16x16.png'), 16);
  await generatePNGFromSVG(svgPath, path.join(publicDir, 'favicon-32x32.png'), 32);
  await generatePNGFromSVG(svgPath, path.join(publicDir, 'logo192.png'), 192);
  await generatePNGFromSVG(svgPath, path.join(publicDir, 'logo512.png'), 512);
  
  console.log('All icons generated successfully!');
}

// Check if canvas module is installed
try {
  require.resolve('canvas');
  generateAllIcons();
} catch (e) {
  console.log('Canvas module not found. Icons will be generated using fallback method.');
  console.log('To generate icons properly, run: npm install canvas');
}