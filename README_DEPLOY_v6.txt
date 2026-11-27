BANKING SPEED DRILLS — v6 UPDATE (2026-11-27)
================================================

REQUIRES the existing dedicated Banking PocketBase v5 installation at:
 /home/ubuntu/projects/banking-speed-drills
Service: banking-speed-drills (127.0.0.1:8097)
Public HTTPS API: https://bankdb.practiceking.in
GitHub Pages frontend: https://nitingit7.github.io/banking-speed-drills/

NO databases, migrations, question content, answer keys, or saved attempts are contained in this update.

WHAT CHANGED
1. Analyse palette: correctness-based green/red, original purple marked styles, grey skipped/unseen.
2. Performance: 20 attempts per page with page numbers/Prev/Next; score/accuracy chart toggle,
   periods last 7 days / last 30 days / last 6 months / all; subject filter.
   Subject-specific trend includes ONLY drills with exactly one selected subject.
3. New tests: one server-controlled timer per selected subject, randomized subject order,
   section lock upon manual submission or timeout. Previously started v5 attempts retain
   their former single-deadline behavior.
4. Home: separate question allocation and independently adjustable seconds/question for
   each selected subject. Normal defaults to 45 sec/question, Challenge to 30 sec/question;
   selected mode is shared by every section.
5. Practice time: new v6 tests count foreground practice through authenticated server
   heartbeats (~8 seconds). This excludes theoretical exam duration and idle time.
   Historical v5 attempts did NOT record foreground activity, so they are EXCLUDED
   from the new Practice Time total, rather than falsely estimating activity.

BACKEND DEPLOY FIRST (do not do this during a live speed drill)
----------------------------------------------------------------
Copy Banking_Speed_Drills_v6_VM_Hooks.zip from Windows Downloads to the VM:
  scp -i "PATH_TO_YOUR_SSH_KEY" "$env:USERPROFILE\Downloads\Banking_Speed_Drills_v6_VM_Hooks.zip" ubuntu@YOUR_VM_PUBLIC_IP:/home/ubuntu/projects/banking-speed-drills/

On the VM:
  cd ~/projects/banking-speed-drills
  unzip -t Banking_Speed_Drills_v6_VM_Hooks.zip
  SNAPSHOT=$(date -u +%Y%m%dT%H%M%SZ)
  mkdir -p backups
  cp -a pb_hooks "backups/pb_hooks_before_v6_${SNAPSHOT}"
  unzip -o Banking_Speed_Drills_v6_VM_Hooks.zip -d .
  sudo systemctl restart banking-speed-drills
  sleep 3
  sudo systemctl is-active banking-speed-drills
  curl -fsS http://127.0.0.1:8097/api/bankdrills/health

Expected: active and {"status":"up","service":"bankdrills"} (JSON order may vary).

If you see errors, DO NOT upload the new frontend. Check:
  sudo journalctl -u banking-speed-drills -n 40 --no-pager -l
The old hooks are in the timestamped backups folder above.

FRONTEND DEPLOY SECOND
----------------------
Extract Banking_Speed_Drills_v6_Complete_Frontend.zip on Windows.
Upload its CONTENTS (not the zip file) to the ROOT of the existing
nitingit7/banking-speed-drills GitHub Pages repository, preserving js/, css/,
images/, fonts/ paths. Because this is a COMPLETE frontend, it can replace
old site files. index.html must be at repository root.

Then hard refresh (Ctrl+Shift+R). Verify these browser pages:
  index.html       — select Simplification, Normal, 5 Q -> 3m45s
  drill.html       — instructions, fullscreen-ready, navigation and section lock
  result.html      — result score untouched
  drill.html?mode=analyse&attempt=<completed-attempt-id> — palette colors
  performance.html — chart controls, activity-based Practice Time, history pages

IMPORTANT: Right now, the existing VM has only Simplification questions.
A drill with more than one subject cannot start until approved questions from
those subjects have been imported. No dummy questions were added.

ROLLBACK
--------
If needed, restore the prior backend hook files from the snapshot, then
restart ONLY banking-speed-drills. Revert the GitHub frontend commit separately.
Do NOT revert the backend while v6 sectional attempts are active, because v5
server timing doesn't understand the new section metadata.

SECURITY
--------
Do not put pb_data, backend files, imported source JSON or login credentials
on public GitHub Pages. This package keeps question keys on the VM and only
reveals keys through the authenticated completed-attempt result API.
