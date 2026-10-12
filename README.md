# Mahmood — Offline local-storage edition

This edition stores all business data in the current browser's local storage. It has no database or application server.

## First setup

1. Install Node.js 22 or newer.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Open the app and create the first store with its name and a 4–8 digit PIN.
5. Existing records are retained in the first store. Use the store-switch button to add the second store.

## Separate stores and reports

Each store has separate purchases, traders, sales, archives and backups in this browser. The PIN is a local convenience lock, not server authentication or data encryption. There is no phone-to-phone sync. Keep the PIN and export a backup for each store regularly; clearing browser data removes both store profiles and records.

The report shows one net profit/loss figure and one net weight figure, calculated only for sold purchases. Profit includes the 6% purchase charge and sale expenses. A 100,000 IQD profit and 150,000 IQD loss display as a 50,000 IQD net loss. Unsold purchases remain inventory.

Filter by store period/archive, item, purchase or sale date, and date range. Choose individual transactions or grouping by item. Select receipts (or leave them all unselected to use all filtered results), then print the buying or selling batch. Each receipt gets its own page. Select **Save as PDF** in the device print dialog where supported. Report printing includes all filtered results; receipt checkboxes apply to receipt batches only.

## Checks

Run `node --experimental-strip-types --test scripts/test-stores.mjs` for store isolation and report calculations, then `npm run build`.

`scripts/test-mobile.mjs` tests an isolated browser context against a local static server at `http://localhost:3101`. It needs Playwright (or `PLAYWRIGHT_MODULE` pointing to an installed copy) and its Chromium browser (or `CHROMIUM_PATH`). It uses disposable fixture data and writes screenshots and PDF samples under `outputs/`.

## Run for development

Run `npm run dev`, then open `http://localhost:3000`.

## Build the offline edition

Run `npm run build`. The static application is created in `out/`.

Records exist only in the browser/device that entered them. Use the report page's backup button regularly. Clearing browser storage deletes unexported records.

## GitHub Pages

Push the project to a GitHub repository, then open Settings → Pages and choose GitHub Actions as the source. The included workflow publishes the static app automatically. GitHub hosts only the app files; store records remain in each device's browser storage.
