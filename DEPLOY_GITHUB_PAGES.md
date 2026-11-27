# GitHub Pages deployment — Frontend only

1. Deploy `vm-backend/` FIRST. Confirm that `https://YOUR-PRIVATE-API-HOST/api/bankdrills/health` responds with `{"status":"up","service":"bankdrills"}` and member unlock works.
2. Open `config.js` in this `frontend/` folder and replace `https://drills-api.practiceking.in` (illustrative, NOT provisioned) with your own HTTPS VM subdomain. Do not put any passwords, member tokens, superuser credentials, questions, or answer keys in it.
3. Create a GitHub repository and upload the **contents** of this folder to its root: `index.html`, `drill.html`, `result.html`, `config.js`, `css/`, `js/`, `images/`, `img/` etc. Keep `index.html` at the root. Do NOT upload `vm-backend` or input question PDFs.
4. GitHub → repository Settings → Pages → **Deploy from branch** → main → **/(root)** → Save. Visit your GitHub Pages URL once deployment succeeds.
5. Click **Connect VM** once on each browser, using the private member account you created in PocketBase. This one-time unlock is not public sign-up. Test switching devices and refreshing an active attempt.
6. All future approved question imports, topic edits, final arrangement images and answers happen in the VM's private PocketBase collections, NOT via the GitHub repository. Reload the site to see updated availability.

### Why does it show zero questions?
The source files have only been counted; questions must be independently transcribed/cropped and matched to their original answer material before activation. The UI intentionally displays 0 rather than using fake sample questions.

### Exam UI
`drill.html` reuses the original uploaded exam screen's HTML/CSS layout and image assets. The original project-specific sample exam script/data were removed because browsers must not contain answer keys or own score calculations.

## Phase 2 navigation and configuration

- `index.html` is the **Speed Drills** tab with 40 syllabus topics, Select All and Clear for each subject, one-subject preset/custom question counts, and separate per-subject counts whenever more than one subject is selected.
- `performance.html` is the separate **Performance** tab with Completed Attempts, Average Accuracy, Practice Time, Best Score, Latest Score Improvement, trend and history.
- Deploy the **updated Phase 2 VM hooks/migration** before publishing this frontend. Older Phase 1 servers do not yet support `GET /api/bankdrills/stats` or guaranteed `subject_counts` allocations.
- Do not change `drill.html`, `js/drill-exam.js`, or `result.html` to install this release. The exam interface remains the same.
