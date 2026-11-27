# Banking Speed Drills – Original UI restoration v4

This is a **complete frontend snapshot** for the existing GitHub Pages repository. It restores the original uploaded mock examination's result page and read-only analysis flow while retaining the original exam HTML/CSS structure and the previously installed v3 PocketBase service.

## What changed

- `result.html`: restored from `Banking_Mock_Examination-main(3).zip`. **Only the Home button was added** to its visible action row. Its original cards, charts, tables, buttons and footer are preserved.
- `css/result.css`: original result styles preserved; a minimal Home button style appended.
- `js/result-original-adapted.js`: original `result.js` layout/renderer with data-accuracy adjustments (completed instead of made-up pass/fail; no made-up cutoff, integrity badge or per-question timings).
- `js/drill-result-bridge.js`: authenticates and retrieves finished-attempt results from your current PocketBase, converts into source result screen data structures. It never exposes an active test answer key.
- `js/drill-analyse.js`: supplies a **read-only** result analysis in the original exam screen; shows correct and selected answer after the drill is completed; supports palette and Previous/Next navigation.  Its base DOM/CSS are original.
- `drill.html`: original uploaded `exam.html` markup and styles retained; only scripts at the end changed for PocketBase functionality.
- `config.js`: verified fixed to `https://bankdb.practiceking.in`.
- All original **non-font** CSS/images/assets necessary for the exam UI included. Keep the original supplied project font assets that already exist on GitHub; this archive intentionally does not redistribute font binaries.

## Deploy safely

1. Finish any active drill. Download this ZIP and extract it locally. The archive contains `index.html`, `drill.html`, `performance.html`, `result.html`, `config.js`, `css/`, `images/`, `img/`, `js/` and supporting assets at the **root**, not inside an extra folder.
2. Back up your existing `banking-speed-drills` repository, then **merge the extracted contents into its root**, preserving folder paths. Replace matching files. **Do not delete** preexisting font assets, or upload the VM hooks, question-bank JSON, or `pb_data`.
3. Commit the change and allow GitHub Pages to publish. Hard refresh (`Ctrl+Shift+R`).
4. Check the published **HTTP 200** paths below (they must show CSS/JS text, not GitHub's 404 page):
   - `https://nitingit7.github.io/banking-speed-drills/css/style.css`
   - `https://nitingit7.github.io/banking-speed-drills/css/result.css`
   - `https://nitingit7.github.io/banking-speed-drills/js/drill-analyse.js`
   - `https://nitingit7.github.io/banking-speed-drills/js/drill-result-bridge.js`
   - `https://nitingit7.github.io/banking-speed-drills/config.js`
5. Test a completed attempt: **Results → Analyse → Previous / Next / palette → Back to Results → Home**. The source result UI is used, not the earlier custom cards.

## Backend compatibility and limits

- **Do not restart or replace PocketBase.** This frontend uses the already deployed v3 hooks and the same existing `drill_members` account and 100 imported questions.
- Only the authenticated owner can load the answer key, via `/api/bankdrills/attempts/{id}/result` **after** completion. Do not put JSON questions or answer keys in your public repository.
- Exact-same-question reattempt buttons remain visible in the source Results UI but show an explanatory message, because the current VM does not have a dedicated exact-reattempt endpoint. They **do not** pretend to create an identical reattempt.
- Per-question elapsed time, pass/fail cutoffs, and integrity events are not in the current VM result payload, so none are invented.
- No live production site was modified from this build environment. The preview checks used fabricated mock API responses **only for UI testing**, not questions to import or to expose publicly.
