# Mahmood — Offline local-storage edition

This edition stores all business data in the current browser's local storage. It has no database or application server.

## First setup

1. Install Node.js 22 or newer.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm run setup`.
5. Open `.env.local` and change `APP_PASSWORD` and `SESSION_SECRET`.

## Run for development

Run `npm run dev`, then open `http://localhost:3000`.

## Build the offline edition

Run `npm run build`. The static application is created in `out/`.

Records exist only in the browser/device that entered them. Use the report page's backup button regularly. Clearing browser storage deletes unexported records.

## GitHub Pages

Push the project to a GitHub repository, then open Settings → Pages and choose GitHub Actions as the source. The included workflow publishes the static app automatically. GitHub hosts only the app files; store records remain in each device's browser storage.
