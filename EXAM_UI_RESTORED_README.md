# Banking Speed Drills — Original Exam UI Restored

This frontend is based on the exact user-supplied `Banking_Mock_Examination-main(3).zip`.

## What was preserved
- The original exam HTML structure from `exam.html` (copied into `drill.html`, with only the bottom runtime script references swapped).
- All original CSS files and image/font assets byte-for-byte.
- Original responsive UI scaling controller (`js/renderer.js`), byte-for-byte.
- Original visible instructions/declaration layout, question-paper popup, question palette and action buttons.

## Requested watermark change
- `js/security.js`: the original watermark generator remains in use, but the displayed text is always **9345****** (four digits followed by exactly six asterisks). It never reads a phone number from storage.

## Necessary VM integration
- `js/drill-exam.js` is a server-connected controller, not the original browser-side exam controller. It uses your `https://bankdb.practiceking.in` backend for questions, answers, scoring and timers.
- The original question paper preview lists status and question numbers. Future questions are intentionally not sent early.
- The VM currently enforces sequential questions: after advancing, you cannot reopen earlier questions. The palette LOOK and legend remain original, but tapping locked question numbers does not navigate.
- Home confirmation now opens the original **General Instructions** page and **Other Important Instructions** declaration, with 'I am ready to begin'. The VM timer only starts after clicking the begin button.

## Deploy to GitHub Pages
1. Finish any current active drill first.
2. Extract the ZIP on your computer.
3. Upload the extracted **contents** to the root of your existing GitHub repository `banking-speed-drills`, replacing the files with the same names and retaining folders.
4. Wait for GitHub Pages deployment to finish and hard-refresh (`Ctrl+Shift+R`).
5. Log in if needed, select 5 or 10 Simplification questions, start a Normal drill and test the instruction screens, answer selection, palette, and results.

DO NOT upload this ZIP to the Oracle VM and do not upload any private question-answer JSON to GitHub. Existing PocketBase data and backend are unchanged.

## Validation limits
Browser DOM interaction tests with simulated server responses passed for instructions, declaration, option selection, clear response, question paper modal, palette collapse, and watermark. The actual live GitHub Pages-to-Oracle end-to-end test must be done after deployment; no backend changes were made here.
