# Banking Speed Drills — navigation, timer, resume & UI fixes (v3)

## What is corrected

- The original uploaded mock-test HTML/CSS/assets remain in place; the new UI integration is in `js/drill-exam.js` only. Do not replace original assets.
- The original Other Important Instructions panel now contains a **Subject / Section, No. of Questions, Time, Maximum Marks** summary table.
- On clicking **I am ready to begin** (or Resume drill), the browser requests fullscreen directly from the click. Browser/OS policy can deny automatic fullscreen; F11 remains the manual alternative.
- **One overall deadline:** Normal 45 seconds x selected question count; Challenge 30 seconds x count. No forced timeout/auto-advance for an individual question. Countdown remains server-enforced even after closing browser.
- Users can revisit any question using the original palette and Previous. Selecting an option alone does not save; Save & Next and Mark for Review & Next save. Clear Response clears the VM-saved response.
- Active attempts can be resumed from **Resume Test** directly below Start; starting another while one is unfinished shows a warning. The older attempt's countdown continues.
- Logged-out visitors see a shaded, locked Speed Drills area and sign-in prompt; server checks remain in force.
- Home no longer displays the redundant connected-to-VM success banner.
- Performance page shows a loading overlay until its data request resolves or fails.

## Deployment order — backend FIRST

Do NOT upload the backend ZIP to GitHub Pages.

1. Download `Banking_Speed_Drills_VM_Hooks_Update_v3.zip` to your Windows Downloads folder.
2. Upload from a new local Windows PowerShell session (replace key/IP with values from your normal SSH command):

   ```powershell
   scp -i "PATH_TO_YOUR_SSH_KEY" "$env:USERPROFILE\Downloads\Banking_Speed_Drills_VM_Hooks_Update_v3.zip" ubuntu@YOUR_VM_PUBLIC_IP:/home/ubuntu/projects/banking-speed-drills/
   ```

3. In the SSH terminal to your Oracle VM, backup only the new banking hooks and install the two replacement files:

   ```bash
   cd ~/projects/banking-speed-drills
   SNAPSHOT="$(date -u +%Y%m%dT%H%M%SZ)"
   mkdir -p backups
   cp -a pb_hooks "backups/pb_hooks_before_v3_${SNAPSHOT}"
   unzip -t Banking_Speed_Drills_VM_Hooks_Update_v3.zip
   unzip -o Banking_Speed_Drills_VM_Hooks_Update_v3.zip -d .
   sudo systemctl restart banking-speed-drills
   sudo systemctl is-active banking-speed-drills
   curl -fsS http://127.0.0.1:8097/api/bankdrills/health
   ```

   Expected: `active` and `{"service":"bankdrills","status":"up"}` (JSON property order may differ). If not, **stop**, run `sudo journalctl -u banking-speed-drills -n 60 --no-pager` and share the non-sensitive error output. Do not reinstall PocketBase or delete pb_data.

4. Only after the backend is healthy, download `Banking_Speed_Drills_Frontend_Update_v3.zip` and extract it locally. Upload and **replace only the included files** to the root and matching `js/`, `css/` folders in the existing GitHub repository `banking-speed-drills`. **Do not remove existing CSS, images, fonts, previous controllers, or question assets from the repo.** The update ZIP intentionally excludes original art/font assets because they are already on GitHub. Keep `index.html` in the root. Commit and wait for Pages to publish.
5. Open `https://nitingit7.github.io/banking-speed-drills/` and press `Ctrl+Shift+R`. Test a new 5- or 10-question Normal drill, subject table, full screen, palette jump, returning with Previous, saving/marking, Resume Test, and score history.

## What this does NOT change

- Existing database collections, stored questions, source answers, completed scores or records.
- Existing Nginx, TLS, RRB Station Master project/port 8090 or the separate banking PocketBase service definition.
- Original exam markup/layout/assets except cache-busting script query parameters.

## Runtime notes

- A resume screen does **not pause or restart** the existing VM timer. If it has expired, the backend finalizes it and the results page opens instead.
- Multiple in-progress attempts are allowed; each runs on its own VM deadline.
- Expiration is enforced on server endpoints; changing the browser's system clock cannot extend a drill.
- The backend exposes only the selected question content and saved response while active, never correct answers until completion.
- The browser Fullscreen API requires an actual user click, and may be denied by browser settings; the code requests it immediately on Ready / Resume click.

## Rollback (if the banking service fails)

Stop before redeploying GitHub. Find the newest backup folder:

```bash
ls -dt ~/projects/banking-speed-drills/backups/pb_hooks_before_v3_*
```

After confirming the correct backup path, restore it into `~/projects/banking-speed-drills/pb_hooks/` and restart only `banking-speed-drills`. Never delete `pb_data`.

## Validation performed

JavaScript syntax checks and controlled, simulated browser/API tests passed for overall Normal/Challenge countdowns, palette navigation, Previous, option saving, question/answer privacy shape, two simultaneous attempts, original instruction table, fullscreen request, sign-in gate, Resume Test, performance loading, and marking/scoring. The actual Oracle VM + GitHub Pages end-to-end test must be performed after both replacements are deployed.
