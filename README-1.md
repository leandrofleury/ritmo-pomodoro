# Ritmo - Pomodoro Timer (PWA)

Ritmo is a calm, installable Pomodoro timer for Android. It is built as a Progressive Web App (PWA), uses no third-party dependencies or backend, and has a Brazilian Portuguese user interface.

## Features

- **Customizable focus and break durations:** 1-180 minutes for focus and 1-60 minutes for breaks.
- **Timer controls:** start, pause, resume, reset, and skip to the next phase.
- **Visual feedback:** circular progress indicator, clear timer states, completed-session counter, and a four-session progress indicator.
- **Session tasks:** add, complete, delete, and clear completed tasks, with a task progress bar.
- **Optional completion chime** when a timer reaches zero.
- **Optional system notifications** while the app is running, subject to browser support and permissions.
- **Local persistence:** settings, tasks, completed sessions, and timer state are saved on the device using `localStorage`.
- **Offline support:** a service worker caches the application's static assets for use without an internet connection.
- **Installable PWA:** includes a web app manifest and 192x192, 512x512, and maskable icons.

## Install on Android

**First, deploy the project to an HTTPS website.** Opening `index.html` through a `file://` URL or directly from a ZIP archive does not enable normal service worker registration or PWA installation.

### Option A: GitHub Pages

1. Extract the downloaded ZIP archive.
2. Create a GitHub repository, such as `ritmo-pomodoro`.
3. Upload the **contents** of the `ritmo-pomodoro/` directory to the repository root. The `index.html`, `app.js`, `styles.css`, `sw.js`, and `manifest.webmanifest` files must be at the root, alongside the `icons/` directory.
4. In the repository, open **Settings > Pages > Build and deployment**. Under **Source**, select **Deploy from a branch**, then choose your default branch (usually `main`) and **/ (root)**.
5. Open the HTTPS URL provided by GitHub Pages, for example: `https://YOUR-USERNAME.github.io/ritmo-pomodoro/`.
6. On Android, open that URL in **Google Chrome**. Choose **Install** if prompted, or open the browser menu and select **Install app** or **Add to Home screen** (the label may vary).
7. Open the app once while connected to the internet to allow its resources to be cached. Subsequent visits can work offline.

### Option B: Netlify Drop

1. Extract the ZIP archive.
2. Open [Netlify Drop](https://app.netlify.com/drop) and upload the `ritmo-pomodoro/` project folder.
3. Open the generated HTTPS URL in Chrome on Android and install the app from the browser menu.

> Deployment interfaces may change. No backend, database, API key, or account system is required by the application itself.

## Run locally

From the project directory, start a local HTTP server:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080` on the same computer. Browsers treat `localhost` as a trustworthy origin for service worker testing.

**Note:** Opening `http://YOUR-PC-IP:8080` from an Android device is not equivalent to localhost or HTTPS and may prevent service worker registration and PWA installation.

## Important limitations

- **Timer recovery:** The remaining time is calculated using the device clock. If Android suspends or closes the app, the timer is reconciled when you reopen it. An elapsed focus session is counted **only once**.
- **Background alerts:** Sounds and notifications are **not guaranteed** while the app is in the background, the screen is locked, or the app is closed. Ritmo does not use push notifications or Android's native alarm scheduler. Reliable, precisely timed background alarms would require an additional native or server-backed solution.
- **Local-only data:** Clearing browser/app storage or uninstalling the app with its data may delete saved progress. Data is not synchronized across browsers or devices.
- **Offline availability:** Offline operation depends on at least one successful online visit and service worker caching. The browser or operating system may evict cached files under storage pressure.
- **Audio playback:** The completion sound depends on browser audio policies, permissions, and device volume.

## Privacy

Ritmo does not load remote JavaScript libraries, send task data to a server, collect analytics, or require an account. Tasks and preferences are stored locally in the browser or installed app.

## Project structure

```text
ritmo-pomodoro/
|-- index.html
|-- styles.css
|-- app.js
|-- manifest.webmanifest
|-- sw.js
|-- icons/
|   |-- icon-192.png
|   |-- icon-512.png
|   `-- icon-maskable-512.png
`-- README.md
```

Additional development and test files may be included in the source package.

## Updating the PWA

When releasing an updated version, change the `CACHE_NAME` constant in `sw.js` (for example, to `ritmo-offline-v2`) to invalidate the previous cache. Once the service worker updates, online users can receive the refreshed assets.

The local storage key `ritmo:pomodoro:v1` retains existing user data as long as the stored format remains compatible.
