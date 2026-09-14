# In-app PDF viewer

`viewer.js` renders PDFs on a canvas using PDF.js. Both web (sandboxed iframe with `srcDoc`) and native (HTML WebView) use the same `html.ts` wrapper. This avoids relying on a device's PDF browser plug-in or sending signed document URLs to a third-party viewer.

The reader supports page navigation, fit-to-width, zoom, loading/error states and retry. It renders one page at a time and caps canvas pixel dimensions. The full-screen document modal lives in `ContractsScreen.tsx`; closing returns to the existing contract state. External opening is an explicit secondary action.

Run `npm run build:pdf-viewer --workspace=@nestyk/consumer-app` after changing the viewer or updating PDF.js. Commit the generated `bundle.ts`; it includes the reader and its in-process worker so native builds need no extra worker URLs, CDN or native modules. PDF.js is Apache-2.0; see `LICENSE.pdfjs`.

Storage must allow CORS for the signed file URL, including the opaque origin used by the sandboxed web iframe. Retry reuses the URL; if it has expired, close and reopen the reservation preview to obtain a fresh link. Embedded-font mock PDFs are covered; specialized PDFs requiring external CMaps/WASM assets are not currently configured.

Validated with desktop Chromium at a mobile viewport: rendered signed mock, zoom and failed-load retry UI. Native iOS/Android device testing remains necessary before release.
