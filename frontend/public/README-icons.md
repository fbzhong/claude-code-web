# Favicon and App Icon Configuration

This directory contains a complete set of favicon and app icon files for the Martian Code web application.

## Files Overview

### Favicon Files (for browser tabs and bookmarks)
- `favicon.svg` - Vector favicon (modern browsers, scalable)
- `favicon-16x16.png` - Small favicon for browser tabs
- `favicon-32x32.png` - Standard favicon size
- `favicon-48x48.png` - High-DPI small screens
- `favicon-64x64.png` - Retina small screens
- `favicon-96x96.png` - Android Chrome
- `favicon-128x128.png` - Chrome Web Store

### App Icons (for PWA and mobile)
- `app-icon-192x192.png` - PWA manifest icon, Android home screen
- `app-icon-256x256.png` - High-DPI PWA icon
- `app-icon-512x512.png` - Splash screen, iOS/Android app icons

## Browser Support

### Modern Browsers
- **SVG favicon**: Chrome 93+, Firefox 41+, Safari 9+, Edge 79+
- **PNG fallbacks**: All browsers with multiple sizes

### Mobile Platforms
- **iOS**: Uses app-icon-* files for home screen and splash
- **Android**: Uses app-icon-192x192.png and larger sizes
- **PWA**: All sizes defined in manifest.json

## Configuration Files

### HTML Head (index.html)
```html
<!-- Favicon configuration -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
<link rel="icon" type="image/png" sizes="64x64" href="/favicon-64x64.png" />
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
<link rel="icon" type="image/png" sizes="128x128" href="/favicon-128x128.png" />

<!-- Apple Touch Icons -->
<link rel="apple-touch-icon" sizes="192x192" href="/app-icon-192x192.png" />
<link rel="apple-touch-icon" sizes="256x256" href="/app-icon-256x256.png" />
<link rel="apple-touch-icon" sizes="512x512" href="/app-icon-512x512.png" />
```

### PWA Manifest (manifest.json)
- All icon sizes are defined with proper purpose attributes
- Includes `maskable` icons for adaptive icons on Android

## Icon Design Notes

The current icon appears to be a code/development related design with:
- Black color scheme on transparent background
- Vector format for scalability
- Suitable for both light and dark themes

## Testing

To test the favicon setup:
1. Clear browser cache
2. Visit the site in different browsers
3. Check browser tab, bookmarks, and home screen icons
4. Test PWA installation on mobile devices

## Future Improvements

If you want to create a favicon.ico file for maximum compatibility with older browsers, you can use online tools or ImageMagick:

```bash
# If ImageMagick is available:
convert favicon-32x32.png favicon-16x16.png favicon.ico
```