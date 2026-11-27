# Banking Speed Drills v5 — complete frontend

This ZIP is a **complete frontend snapshot**, not a partial overlay.
It includes the original supplied exam HTML structure, CSS, palette images,
and original renderer assets. `config.js` points to
`https://bankdb.practiceking.in`.

## Changes
- Source-project 7-column Submit Exam table using PocketBase statuses.
- Re-attempt checkbox in Analyse works as in-page practice, revealing
  correct/incorrect feedback after each choice. Turning it off restores
  the original result. It does NOT create a scored PocketBase attempt.
- Analyse filters remain based on the ORIGINAL scored attempt.
- Results actions keep only Home and Analyse.
- No changes to questions, answer keys, saved attempts, performance metrics,
  exam watermark, or CSS/image assets.

## Deployment
1. Install and verify the separate `VM_Review_Flags_v5` PocketBase hook update.
2. Finish any live drill.
3. Extract this frontend ZIP, then upload ALL contents preserving paths to
   the root of the existing `banking-speed-drills` GitHub repository.
4. Do not upload PocketBase data, backend hooks, credentials or private
   answer keys to GitHub.
5. Allow GitHub Pages to publish and use Ctrl+Shift+R.
6. Test a completed attempt at Results > Analyse, toggle Re-attempt and
   select an option; check Wrong, Marked for Review and Unseen filters.
7. Check Submit on a fresh drill: seven-column summary with accurate counts.

Notes:
- No question-by-question timing was stored by the existing VM, so the
  original Analyse `Slow` filter remains disabled. No fake data is used.
- Legacy completed attempts lacking visits may not support the `Unseen`
  filter, even after installing the review-flags hook. The frontend disables
  that filter rather than guessing.
- Only owner-authenticated completed-attempt result APIs send answer keys.
