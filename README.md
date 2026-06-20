# Apex Goal Tracker PWA

This is the final no-Flutter version. It is a static Progressive Web App that can be hosted on GitHub Pages, opened on Android, and installed to the home screen. It also works on Windows through Chrome or Edge as an installable web app.

## Final Features

- User types their own goal. No default goal is forced.
- Full month calendar with previous/next month navigation.
- Daily data saved by date in the browser.
- Add/delete daily custom tasks.
- Permanent Backlog section that cannot be deleted.
- Permanent Revision section that cannot be deleted.
- Backlog tick states affect productivity, punctuality, and overall progress.
- Separate glowing metric circles, not concentric circles.
- Toggle between circle analytics and bar graph analytics.
- Offline local storage through `localStorage`.
- Service worker and manifest for installable PWA behavior.

## Files To Upload To GitHub

Upload all files in this folder:

```text
index.html
styles.css
app.js
manifest.webmanifest
sw.js
icon.svg
README.md
```

## GitHub Pages Setup

1. Create a GitHub repository.
2. Upload all files from this folder.
3. Go to `Settings > Pages`.
4. Set source to `Deploy from a branch`.
5. Select branch `main` and folder `/root`.
6. Save.
7. Open the GitHub Pages URL.

## Install On Android

1. Open the GitHub Pages URL in Chrome.
2. Tap the three-dot menu.
3. Tap `Add to Home screen` or `Install app`.

## Install On Windows

1. Open the GitHub Pages URL in Chrome or Edge.
2. Click the install icon in the address bar, or open browser menu.
3. Choose `Install Apex Goal Tracker`.
