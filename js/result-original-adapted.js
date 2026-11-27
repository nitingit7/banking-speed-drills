/**
 * result.js
 * Result screen logic.
 * Guard: redirects to index.html if no active attempt or not submitted.
 */

(function () {
  'use strict';

  // ── Guard ───────────────────────────────────────────────────────────────────
  const activeAttempt = Storage.loadActiveAttempt();
  // Prefer testData embedded in the attempt (stays matched even after re-attempt filtering)
  const testData = (activeAttempt && activeAttempt.testData) || Storage.loadTestData();

  if (!activeAttempt || !testData || !activeAttempt.submitted) {
    window.location.replace('index.html');
    return;
  }

  // ── Load results ────────────────────────────────────────────────────────────
  const completedRecord = Storage.getAttemptById(activeAttempt.attemptId);
  const results = completedRecord || State.calculateResults(activeAttempt);

  // ── DOM ─────────────────────────────────────────────────────────────────────
  const elHeader = document.getElementById('result-header');
  const elOverall = document.getElementById('result-overall');
  const elSectionTable = document.getElementById('result-sections');
  const elCharts = document.getElementById('result-charts');
  const elQTimeTable = document.getElementById('q-time-table');
  const elAttemptHistory = document.getElementById('result-attempt-history');
  const elFooter = document.getElementById('result-footer');

  const btnAnalyse = document.getElementById('btn-analyse');
  const btnReattemptFull = document.getElementById('btn-reattempt-full');
  const btnReattemptWrong = document.getElementById('btn-reattempt-wrong');
  const btnNewTest = document.getElementById('btn-new-test');

  // ── Render ──────────────────────────────────────────────────────────────────
  function render() {
    if (elFooter) elFooter.textContent = 'Version : 1.0.0';

    renderHeader();
    renderOverall();
    renderSectionTable();
    renderCharts();
    renderQTimeTable();
    renderAttemptHistory();
    bindButtons();
  }

  function renderHeader() {
    if (!elHeader) return;
    const cMobile = results.candidateMobile || (activeAttempt && activeAttempt.candidateMobile) || '';
    const mobileStr = cMobile ? ` (Roll No: ${_esc(cMobile)})` : '';
    elHeader.innerHTML = `
      <div class="result-header-inner">
        <span class="result-exam-name">${_esc(testData.meta.examName)} – ${_esc(testData.meta.testName)}</span>
        <span class="result-candidate">${_esc(results.candidateName || 'Candidate')}${mobileStr}</span>
      </div>
    `;
  }

  function renderOverall() {
    if (!elOverall) return;
    const dur = results.totalTime ? Timer.formatHuman(results.totalTime) : '—';
    const submitted = results.submittedAt ? new Date(results.submittedAt).toLocaleString('en-IN') : '—';
    const passClass = 'result-pass';
    const passText = '✔ Completed';

    // Exam integrity status
    const integ = results.integrity || activeAttempt.integrity || { tabSwitches: 0, fullscreenExits: 0, tamperEvents: 0, blockedKeyAttempts: 0 };
    const totalViolations = (integ.tabSwitches || 0) + (integ.fullscreenExits || 0) + (integ.tamperEvents || 0) + (integ.blockedKeyAttempts || 0);
    const isClean = totalViolations === 0;

    const integrityBoxHtml = results.integrity ? `
      <div class="stat-box" style="min-width: 110px; ${!isClean ? 'background: #fff5f5; border-color: #fca5a5;' : 'background: #f0fdf4; border-color: #86efac;'}">
        <div class="stat-val ${isClean ? 'green' : 'red'}" style="font-size: 18px; line-height: 1.3;">
          ${isClean ? '✔ Clean' : `⚠️ ${totalViolations}`}
        </div>
        <div class="stat-lbl" title="Tab switches: ${integ.tabSwitches || 0}, Fullscreen exits: ${integ.fullscreenExits || 0}, Watermark tampers: ${integ.tamperEvents || 0}, Blocked shortcuts: ${integ.blockedKeyAttempts || 0}">Integrity</div>
      </div>
    ` : '';

    const integrityDetailHtml = results.integrity ? `
      <div class="integrity-detail-bar" style="margin-top: 14px; padding: 10px 14px; border-radius: 6px; background: ${isClean ? '#f0fdf4' : '#fff1f2'}; border: 1px solid ${isClean ? '#bbf7d0' : '#fecdd3'}; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span>${isClean ? '🛡️' : '⚠️'}</span>
          <span style="font-weight: 600; font-size: 13px; color: ${isClean ? '#15803d' : '#be123c'};">
            ${isClean ? 'Exam Integrity: Verified Clean (Zero Security Violations)' : `Exam Integrity: ${totalViolations} Security Violation(s) Logged`}
          </span>
        </div>
        <div style="display: flex; gap: 12px; font-size: 12px; color: ${isClean ? '#166534' : '#9f1239'};">
          <span>Tab Switches: <strong>${integ.tabSwitches || 0}</strong></span>
          <span>Fullscreen Exits: <strong>${integ.fullscreenExits || 0}</strong></span>
          <span>Tamper Events: <strong>${integ.tamperEvents || 0}</strong></span>
          <span>Blocked Keys: <strong>${integ.blockedKeyAttempts || 0}</strong></span>
        </div>
      </div>
    ` : '';

    elOverall.innerHTML = `
      <div class="overall-score-box">
        <div class="overall-score">${results.totalScore} <span>/ ${results.totalMarks}</span></div>
        <div class="overall-verdict ${passClass}">${passText}</div>
      </div>
      <div class="overall-stats">
        <div class="stat-box"><div class="stat-val green">${results.totalCorrect}</div><div class="stat-lbl">Correct</div></div>
        <div class="stat-box"><div class="stat-val red">${results.totalWrong}</div><div class="stat-lbl">Wrong</div></div>
        <div class="stat-box"><div class="stat-val grey">${results.totalUnattempted}</div><div class="stat-lbl">Unattempted</div></div>
        <div class="stat-box"><div class="stat-val blue">${results.totalAttempted}</div><div class="stat-lbl">Attempted</div></div>
        <div class="stat-box"><div class="stat-val">${results.overallAccuracy}%</div><div class="stat-lbl">Accuracy</div></div>
        <div class="stat-box"><div class="stat-val">${dur}</div><div class="stat-lbl">Total Time</div></div>
        ${integrityBoxHtml}
      </div>
      ${integrityDetailHtml}
      <div class="overall-meta" style="margin-top: 10px;">Submitted: ${submitted}</div>
    `;
  }

  function renderSectionTable() {
    if (!elSectionTable) return;
    const hasEndReason = results.sectionResults.some(r => r.endReason && r.endReason !== '-');
    const rows = results.sectionResults.map(r => {
      const passClass = r.passed ? 'pass-cell' : 'fail-cell';
      const scaledNote = r.cutoffScaled
        ? `<span class="cutoff-note" title="Scaled from standard ${r._standardCutoff || ''}/${r._standardCount || ''} questions">*</span>` : '';
      const endReasonText = (r.endReason === 'time-out' || r.endReason === 'timeout')
        ? '<span style="color:#c53030; font-weight:600;">Time out</span>'
        : (r.endReason === 'submitted' ? '<span style="color:#2f855a; font-weight:600;">Submitted</span>' : (r.endReason || '-'));
      const endReasonCol = hasEndReason ? `<td class="text-center">${endReasonText}</td>` : '';
      return `
        <tr>
          <td>${_esc(r.sectionName)}</td>
          <td class="text-center">${r.totalQuestions}</td>
          <td class="text-center">${r.attempted}</td>
          <td class="text-center green">${r.correct}</td>
          <td class="text-center red">${r.wrong}</td>
          <td class="text-center">${r.accuracy}%</td>
          <td class="text-center">${r.timeSpent==null?'—':Timer.formatDuration(r.timeSpent)}</td>
          <td class="text-center"><strong>${r.score}</strong> / ${r.totalMarks}</td>
          <td class="text-center">${r.cutoff==null?'—':r.cutoff}${scaledNote}</td>
          ${endReasonCol}
          <td class="text-center ${passClass}">${r.passed==null?'—':r.passed?'PASS':'FAIL'}</td>
        </tr>
      `;
    }).join('');

    const endReasonHead = hasEndReason ? '<th>Ended By</th>' : '';

    elSectionTable.innerHTML = `
      <h3>Section-wise Results</h3>
      ${results.sectionResults.some(r => r.cutoffScaled)
        ? `<p class="cutoff-scale-note">* Cut-off scaled proportionally from standard question count. 
           See README for details.</p>` : ''}
      <div class="table-scroll">
        <table class="result-table" aria-label="Section-wise results">
          <thead><tr>
            <th>Section</th><th>Total Qs</th><th>Attempted</th>
            <th>Correct</th><th>Wrong</th><th>Accuracy</th><th>Time</th>
            <th>Score</th><th>Cut-off</th>${endReasonHead}<th>Result</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ── SVG charts ──────────────────────────────────────────────────────────────
  function renderCharts() {
    if (!elCharts) return;

    const donutHtml = renderDonutChart({
      correct: results.totalCorrect,
      wrong: results.totalWrong,
      unattempted: results.totalUnattempted,
      total: results.totalQ,
    });

    const barHtml = renderBarChart(results.sectionResults);

    elCharts.innerHTML = `
      <div class="charts-wrap">
        <div class="chart-box">
          <h4>Attempt Overview</h4>
          ${donutHtml}
          <div class="donut-legend">
            <span class="dl-correct">■ Correct (${results.totalCorrect})</span>
            <span class="dl-wrong">■ Wrong (${results.totalWrong})</span>
            <span class="dl-un">■ Unattempted (${results.totalUnattempted})</span>
          </div>
        </div>
        <div class="chart-box">
          <h4>Section Scores</h4>
          ${barHtml}
        </div>
      </div>
    `;
  }

  function renderDonutChart({ correct, wrong, unattempted, total }) {
    if (total === 0) return '<p>No data</p>';
    const r = 70, cx = 90, cy = 90, stroke = 28;
    const circumference = 2 * Math.PI * r;
    const correctPct = correct / total;
    const wrongPct = wrong / total;
    const unPct = unattempted / total;

    // Segments: correct (green), wrong (red), unattempted (grey)
    // Draw as stroked circles with dasharray
    const segments = [
      { pct: correctPct, color: '#22a95a', offset: 0 },
      { pct: wrongPct, color: '#e05353', offset: correctPct },
      { pct: unPct, color: '#aaa', offset: correctPct + wrongPct },
    ];

    const arcs = segments.map(seg => {
      if (seg.pct <= 0) return '';
      const dash = seg.pct * circumference;
      const gap = circumference - dash;
      const rotate = seg.offset * 360 - 90;
      return `<circle cx="${cx}" cy="${cy}" r="${r}"
        fill="none" stroke="${seg.color}" stroke-width="${stroke}"
        stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
        transform="rotate(${rotate.toFixed(2)} ${cx} ${cy})" />`;
    }).join('');

    return `<svg viewBox="0 0 180 180" width="160" height="160" role="img" aria-label="Donut chart">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e8e8e8" stroke-width="${stroke}" />
      ${arcs}
      <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">${correct}</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="11" fill="#666">Correct</text>
    </svg>`;
  }

  function renderBarChart(sectionResults) {
    if (!sectionResults.length) return '<p>No data</p>';
    const maxScore = Math.max(...sectionResults.map(r => r.totalMarks), 1);
    const barW = 50, barGap = 30, svgH = 160, labelH = 30, padding = 20;
    const svgW = sectionResults.length * (barW + barGap) + padding * 2;
    const chartH = svgH - labelH;

    const bars = sectionResults.map((r, i) => {
      const x = padding + i * (barW + barGap);
      const scoreH = Math.max(2, (Math.max(0, r.score) / maxScore) * (chartH - 20));
      const cutoffY = r.cutoff==null ? null : chartH - (r.cutoff / maxScore) * (chartH - 20);
      const barY = chartH - scoreH;
      const color = r.score>=0 ? '#22a95a' : '#e05353';
      const shortName = r.sectionName.replace('Ability', '').replace('Language', '').replace('Aptitude', '').trim().slice(0, 8);

      return `
        <rect x="${x}" y="${barY}" width="${barW}" height="${scoreH}" fill="${color}" rx="3"/>
        ${cutoffY==null?'':`<line x1="${x - 5}" y1="${cutoffY}" x2="${x + barW + 5}" y2="${cutoffY}" stroke="#f90" stroke-width="1.5" stroke-dasharray="4,3"/>`}
        <text x="${x + barW / 2}" y="${chartH + 18}" text-anchor="middle" font-size="10" fill="#555">${shortName}</text>
        <text x="${x + barW / 2}" y="${barY - 4}" text-anchor="middle" font-size="11" font-weight="bold" fill="#333">${r.score}</text>
      `;
    }).join('');

    return `<svg viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" role="img" aria-label="Bar chart">
      <line x1="${padding - 5}" y1="0" x2="${padding - 5}" y2="${chartH}" stroke="#ccc" stroke-width="1"/>
      ${bars}
      ${sectionResults.some(r=>r.cutoff!=null)?`<text x="${svgW - padding}" y="40" font-size="10" fill="#f90">— cut-off</text>`:''}
    </svg>`;
  }

  // ── Question time table ─────────────────────────────────────────────────────
  function renderQTimeTable() {
    if (!elQTimeTable) return;
    const qt = results.questionTimes || [];
    if (!qt.length) { elQTimeTable.innerHTML = '<h3>Question-wise Time</h3><p style="color:#666;font-size:13px">Individual question times are not recorded by the current VM API.</p>'; return; }

    const avgTime = results.avgTimePerQ || 0;

    // Slowest questions list
    const slowestQs = qt.slice().filter(q => q.timeSpent > 0).sort((a, b) => b.timeSpent - a.timeSpent).slice(0, 5);
    const slowestListHtml = slowestQs.length ? `
      <div class="slowest-questions-bar" style="margin-bottom:12px; padding:10px 14px; background:#fff8e1; border:1px solid #ffe082; border-radius:4px; font-size:13px;">
        <strong>⏳ Slowest Questions:</strong>
        <span style="margin-left:8px; display:inline-flex; gap:10px; flex-wrap:wrap;">
          ${slowestQs.map(q => {
            const fi = qt.indexOf(q);
            return `<span style="background:#fff; border:1px solid #ffd54f; border-radius:3px; padding:2px 8px; font-weight:600;">Q${fi + 1}: ${Timer.formatDuration(q.timeSpent)}</span>`;
          }).join('')}
        </span>
      </div>
    ` : '';

    const rows = qt.map((q, i) => {
      const isSlow = q.timeSpent > avgTime && avgTime > 0;
      const isAnswered = q.status === 'answered' || q.status === 'answered-marked';
      const isCorrect = isAnswered && q.selectedOption === q.correctOption;
      const isWrong = isAnswered && !isCorrect;
      const statusClass = isCorrect ? 'q-correct' : isWrong ? 'q-wrong' : '';
      const sec = testData.sections[q.sectionIndex];

      return `<tr class="${isSlow ? 'q-slow' : ''} ${statusClass}">
        <td>${i + 1}</td>
        <td>${_esc(sec ? sec.name.slice(0, 15) : '')}</td>
        <td>${Timer.formatDuration(q.timeSpent)}</td>
        <td>${q.status.replace(/-/g,' ')}</td>
        <td>${isCorrect ? '✔' : isWrong ? '✘' : '—'}</td>
      </tr>`;
    }).join('');

    elQTimeTable.innerHTML = `
      <h3>Question-wise Time <span class="avg-note">(avg: ${Timer.formatDuration(avgTime)} | <span class="q-slow-key">■ slow</span>)</span></h3>
      ${slowestListHtml}
      <div class="table-scroll">
        <table class="time-table" aria-label="Question time table">
          <thead><tr><th>#</th><th>Section</th><th>Time</th><th>Status</th><th>Result</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ── Attempt history ─────────────────────────────────────────────────────────
  function renderAttemptHistory() {
    if (!elAttemptHistory) return;
    const attempts = Storage.loadAttempts();
    if (!attempts.length) { elAttemptHistory.innerHTML = ''; return; }

    // Score trend SVG
    const trendHtml = renderTrendChart(attempts);

    const rows = attempts.slice().reverse().map((a, i) => {
      const dt = a.submittedAt ? new Date(a.submittedAt).toLocaleString('en-IN') : '—';
      const aInteg = a.integrity || (a.state && a.state.integrity);
      let integBadge = '—';
      if (aInteg) {
        const v = (aInteg.tabSwitches || 0) + (aInteg.fullscreenExits || 0) + (aInteg.tamperEvents || 0) + (aInteg.blockedKeyAttempts || 0);
        integBadge = v === 0
          ? '<span style="color:#22a95a; font-weight:600;">✔ Clean</span>'
          : `<span style="color:#e05353; font-weight:600;" title="Tab switches: ${aInteg.tabSwitches || 0}, Fullscreen exits: ${aInteg.fullscreenExits || 0}, Tamper: ${aInteg.tamperEvents || 0}, Blocked: ${aInteg.blockedKeyAttempts || 0}">⚠️ ${v}</span>`;
      }
      let reattemptsHtml = '';
      if (a.reattempts && a.reattempts.length > 0) {
        reattemptsHtml = `<div style="margin-top:4px; font-size:11px; color:#147eb3;">` +
          a.reattempts.map(r => `<div>↳ <strong>${_esc(r.name)}:</strong> ${r.totalCorrect} correct, ${r.totalWrong} wrong (${Timer.formatDuration(r.totalTime || 0)})</div>`).join('') +
          `</div>`;
      }
      const aTotalTime = a.totalTime || (a.state && a.state.questions && a.state.questions.reduce((s, q) => s + (q.timeSpent || 0), 0)) || 0;
      return `<tr>
        <td>${attempts.length - i}</td>
        <td>${_esc(a.testName || '—')}${reattemptsHtml}</td>
        <td>${a.totalScore !== undefined ? a.totalScore : '—'} / ${a.totalMarks || '—'}</td>
        <td>${Timer.formatDuration(aTotalTime)}</td>
        <td class="text-center">${integBadge}</td>
        <td>${dt}</td>
        <td><button class="btn-view-attempt" data-id="${a.attemptId}">Analyse</button></td>
      </tr>`;
    }).join('');

    elAttemptHistory.innerHTML = `
      <h3>Attempt History</h3>
      ${trendHtml}
      <div class="table-scroll">
        <table class="history-table" aria-label="Attempt history">
          <thead><tr><th>#</th><th>Test</th><th>Score</th><th>Time</th><th>Integrity</th><th>Date</th><th>Action</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    elAttemptHistory.querySelectorAll('.btn-view-attempt').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = Storage.getAttemptById(btn.dataset.id);
        if (a) {
          Storage.saveAnalysisAttempt(a.state || a);
          window.location.href = `exam.html?mode=analyse&attempt=${btn.dataset.id}`;
        }
      });
    });
  }

  function renderTrendChart(attempts) {
    if (attempts.length < 2) return '';
    const scores = attempts.map(a => a.totalScore || 0);
    const maxScore = Math.max(...scores, 1);
    const w = 300, h = 80, pad = 20;
    const xStep = (w - 2 * pad) / (scores.length - 1 || 1);

    const points = scores.map((s, i) => {
      const x = pad + i * xStep;
      const y = h - pad - ((s / maxScore) * (h - 2 * pad));
      return `${x},${y}`;
    }).join(' ');

    const dots = scores.map((s, i) => {
      const x = pad + i * xStep;
      const y = h - pad - ((s / maxScore) * (h - 2 * pad));
      return `<circle cx="${x}" cy="${y}" r="4" fill="#1a73e8"/>
              <title>Attempt ${i+1}: ${s}</title>`;
    }).join('');

    return `<div class="trend-chart-wrap">
      <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Score trend">
        <polyline points="${points}" fill="none" stroke="#1a73e8" stroke-width="2"/>
        ${dots}
      </svg>
    </div>`;
  }

  // ── Buttons ─────────────────────────────────────────────────────────────────
  function bindButtons() {
    const meta = testData.meta;
    const allowReattempt = meta.allowReattempt !== false;

    btnAnalyse?.addEventListener('click', () => {
      Storage.saveAnalysisAttempt(activeAttempt);
      window.location.href = `exam.html?mode=analyse&attempt=${activeAttempt.attemptId}`;
    });

    if (!allowReattempt) {
      [btnReattemptFull, btnReattemptWrong].forEach(btn => {
        if (btn) {
          btn.disabled = true;
          btn.title = 'Re-attempt is disabled for this test';
        }
      });
    }

    btnReattemptFull?.addEventListener('click', () => {
      if (!allowReattempt) return;
      startReattempt('full');
    });

    btnReattemptWrong?.addEventListener('click', () => {
      if (!allowReattempt) return;
      startReattempt('wrong-unattempted');
    });

    btnNewTest?.addEventListener('click', () => {
      Storage.clearActiveAttempt();
      window.location.href = 'index.html';
    });
  }

  function startReattempt(mode) {
    // Always base re-attempts on the original full test data
    const baseData = Storage.loadOriginalTestData() || testData;
    let newTestData = JSON.parse(JSON.stringify(baseData));

    if (mode === 'wrong-unattempted') {
      // Filter to only wrong and unattempted questions
      const activeQs = activeAttempt.questions;
      newTestData.sections = newTestData.sections.map((sec, si) => {
        const filtered = sec.questions.filter((q, qi) => {
          const qState = activeQs.find(qs => qs.sectionIndex === si && qs.questionIndex === qi);
          if (!qState) return true;
          const isAnswered = qState.status === 'answered' || qState.status === 'answered-marked';
          const isCorrect = isAnswered && qState.selectedOption === q.correct;
          return !isCorrect; // keep wrong and unattempted
        });
        return { ...sec, questions: filtered };
      }).filter(sec => sec.questions.length > 0);

      if (!newTestData.sections.length) {
        alert('No wrong or unattempted questions to re-attempt!');
        return;
      }
    }

    Storage.saveTestData(newTestData);
    Storage.clearActiveAttempt();
    window.location.href = 'exam.html';
  }

  // ── Helper ──────────────────────────────────────────────────────────────────
  const _esc = (typeof Sanitiser !== 'undefined' && (Sanitiser.escapeHtml || Sanitiser._esc)) ||
               (typeof window !== 'undefined' && window._esc) ||
               function(str) {
                 if (!str) return '';
                 return String(str)
                   .replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&#39;');
               };

  render();

})();
