# Icon Generation Guide

The favicon.svg is the source file for all icons. Modern browsers support SVG favicons directly.

## Generate PNG versions (optional)

If you need PNG versions for older browsers or PWA support:

```bash
# Install dependencies
cd frontend
npm install --save-dev canvas

# Run generation script
node scripts/generate-icons.js
```

## Manual generation with online tools

Alternatively, you can use online tools:
1. https://realfavicongenerator.net/
2. https://favicon.io/favicon-converter/

Upload the favicon.svg and download the generated files.

## Current icon setup

- `favicon.svg` - Modern browsers (preferred)
- `manifest.json` - PWA configuration
- `logo192.png` - PWA icon (need to generate)
- `logo512.png` - PWA splash screen (need to generate)