# Unbaloon Progressive Web App Design

## Overview

Turn Unbaloon into an installable Progressive Web App (PWA) without coupling PWA lifecycle behavior to the game. The installed app must work offline after its first successful load, use a balloon icon on the existing sky-blue background, and run without browser chrome where platform support allows.

The installation experience targets iOS, Android, and desktop. Android and desktop use the browser's native installation prompt. iOS users receive concise Add-to-Home-Screen guidance. Updates download in the background and are offered only when the start or play-again screen is visible, so gameplay is never interrupted.

## Goals

- Make Unbaloon installable on iOS, Android, and supported desktop browsers.
- Make the complete game playable offline after the first successful visit.
- Launch the installed app in fullscreen display mode where supported, with standalone mode as the fallback.
- Provide a branded standard icon, maskable icon, and Apple touch icon.
- Offer installation from the existing start screen.
- Notify players about ready updates only on the start or play-again screen.
- Preserve normal website behavior when PWA APIs are unavailable or fail.

## Non-goals

- Push notifications, background sync, or server-side features.
- Runtime caching for APIs or remote media; the game has no such dependencies.
- Interrupting a running game to install or update.
- Custom installation behavior beyond what each browser permits.
- Changes to game mechanics, session state, rendering, or audio.

## Architecture

### Build-time PWA integration

Add `vite-plugin-pwa` to the Vite configuration. It generates the web app manifest and a service worker during `vite build`. The generated service worker precaches the production app shell and all local build assets.

The plugin configuration must honor Vite's existing `base: '/unbaloon/'` setting. Manifest, service-worker, icon, start, scope, and cached asset URLs must remain valid when hosted from that GitHub Pages subpath.

A generated service worker is preferred over a hand-written worker because Unbaloon only needs versioned static precaching and navigation fallback. It does not need custom runtime request handling.

### PWA controller

Add a focused `src/pwa.ts` module. It owns browser PWA lifecycle integration and exposes a small interface to `src/index.ts`:

- Initialize service-worker registration and installation listeners.
- Receive whether a safe prompt surface is currently visible.
- Trigger the stored native install prompt when requested.
- Trigger an accepted service-worker update and reload.

The controller owns no game state. `src/index.ts` tells it when the start or play-again screen is visible. `Game` remains unaware of installation, caching, and service-worker updates.

### DOM UI

Extend the existing start-screen markup and styles with:

- An **Install app** button.
- A lightweight iOS instruction panel explaining **Share → Add to Home Screen**.
- An **Update available** action that can appear on either safe prompt surface.

The controls match the existing child-friendly visual style but remain secondary to the Play button. The iOS panel is dismissible and does not block normal play.

## Manifest and icons

The manifest uses:

- Name and short name: **Unbaloon**
- Theme color and background color: the game's sky blue
- Start URL and scope rooted at `/unbaloon/`
- Primary display mode: `fullscreen`
- Fallback display mode: `standalone`
- Unrestricted orientation

Create a simple colorful balloon centered on the existing sky-blue background. Supply:

- A 192×192 standard PNG icon.
- A 512×512 standard PNG icon.
- A 512×512 maskable PNG icon with adequate safe-zone padding.
- A 180×180 Apple touch PNG icon.
- Browser favicon metadata using the same visual identity.

Icons are static public assets so their URLs are stable and available to the manifest and HTML.

## Installation flow

### Chromium and other native-prompt browsers

1. The controller captures `beforeinstallprompt` and prevents an unsolicited browser prompt.
2. The start-screen **Install app** button becomes visible only while a native prompt is available.
3. Tapping the button invokes the stored native prompt.
4. After acceptance or dismissal, the stored prompt is cleared and the button is hidden for the rest of that page visit.
5. `appinstalled` also clears and hides the installation UI.

### iOS and iPadOS

When running in Safari on iOS or iPadOS and not already in standalone mode, the start-screen install button opens the custom instruction panel. The panel tells the user to use the Share action and select Add to Home Screen.

When already installed, when the platform is unsupported, or when no native prompt is available, irrelevant installation controls remain hidden. Installation detection uses standard display-mode checks and the iOS standalone signal where available.

## Offline behavior

The generated service worker precaches the built HTML, JavaScript, CSS or inlined styles, and icon assets. A cached navigation fallback serves the app shell for `/unbaloon/` navigation while offline.

After one complete online load under service-worker control, the player can relaunch and play the whole game without a network connection. Because audio is synthesized and game assets are local, no runtime network dependency remains.

The first-ever visit still requires connectivity. This is normal PWA behavior and does not require a custom offline-first-load page.

## Update flow

1. The service worker checks for a newer generated build in the background.
2. When the new worker is installed and waiting, the controller records that an update is ready.
3. During gameplay, no update UI is shown.
4. When `src/index.ts` reports that the start or play-again screen is visible, an **Update available** action appears.
5. Tapping it activates the waiting worker and reloads the page once the new worker controls it.

A ready update is never activated automatically during an active session. If the player ignores the action, the current version continues to work and the update remains available on later safe screens.

## Error handling

All PWA behavior is progressive enhancement:

- If service workers are unsupported or registration fails, Unbaloon continues as a normal website.
- If native installation is unsupported, no unusable native-install control is shown.
- If the user dismisses installation, normal play continues and the prompt does not reappear during that page visit.
- If checking for or activating an update fails, the current version keeps running and the player is not interrupted.
- Failures may be logged for development diagnostics but do not produce child-facing error dialogs.

## Testing

### Automated tests

Add focused tests for `src/pwa.ts` using mocked browser events and registration callbacks:

- Capture and invoke the native install prompt.
- Handle prompt acceptance and dismissal.
- Hide installation UI after installation.
- Detect installed or standalone mode.
- Show iOS guidance only on eligible iOS browser sessions.
- Record an available update while gameplay is active without displaying it.
- Reveal and activate the update on a safe prompt surface.
- Degrade safely when PWA APIs are unavailable or operations reject.

Run all existing Vitest tests to verify that game behavior remains unchanged.

Run a production build and verify that it emits:

- The manifest.
- The generated service worker and precache support files.
- All required icon files.
- URLs valid beneath `/unbaloon/`.

### Manual acceptance

Using the production preview or deployed HTTPS site:

- Install from a supported Chromium browser and confirm standalone/fullscreen launch.
- Open iOS guidance and verify that its steps match Safari's Add-to-Home-Screen flow.
- Install on iOS and confirm the Apple touch icon and standalone launch.
- Load once online, disconnect, and confirm the installed game relaunches and plays offline.
- Deploy a changed build, confirm the update downloads silently, and verify that its action appears only on the start or play-again screen.
- Accept the update and confirm one clean reload into the new version.

## Acceptance criteria

The feature is complete when Unbaloon can be installed with the balloon branding on supported target platforms, relaunches and plays fully offline after first load, never interrupts gameplay for installation or updates, applies accepted updates from a safe screen, and continues functioning normally when PWA features are unsupported or fail.
