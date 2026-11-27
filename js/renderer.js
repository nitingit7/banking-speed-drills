/**
 * renderer.js
 * Adapter rendering data from JSON/State into the cloned TCS iON DOM.
 */

const Renderer = (() => {

  // Constant setting to show/hide "Question No. N" heading in the question area (default: false)
  const SHOW_QUESTION_NO_LABEL = false;

  // ── Central Option Click Hit-Target Configuration ──────────────────────────
  // Rule: An option is selected only when clicking directly on its text, prefix ("1."),
  // or radio circle (like the real exam). Clicking blank row space does nothing.
  // Modes:
  //   "by-pointer-type" (default): mouse and pen clicks restricted to text/circle/prefix; touch taps allow whole row.
  //   "text-only-always": text/circle/prefix only on all devices.
  //   "row-always": legacy full-row clickability on all devices.
  const OPTION_CLICK_MODE = 'by-pointer-type';

  function getOptionClickMode() {
    if (typeof window !== 'undefined' && window.OPTION_CLICK_MODE !== undefined && window.OPTION_CLICK_MODE !== null) {
      return String(window.OPTION_CLICK_MODE).toLowerCase();
    }
    return OPTION_CLICK_MODE;
  }

  let _lastPointerType = 'mouse';
  const _recentClickLogs = [];

  function recordClickDebug(line) {
    _recentClickLogs.push(line);
    if (_recentClickLogs.length > 5) {
      _recentClickLogs.shift();
    }
    const isDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
    if (isDebug && typeof updateDebugOverlay === 'function') {
      updateDebugOverlay();
    }
  }

  function formatElementTag(el) {
    if (!el || !el.tagName) return 'unknown';
    let s = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\s+/).filter(Boolean);
      if (cls.length > 0) s += '.' + cls.slice(0, 2).join('.');
    }
    if (el.id) s += '#' + el.id;
    return s;
  }

  function isPointInRect(x, y, r, tol = 2) {
    if (!r) return false;
    return x >= (r.left - tol) && x <= (r.right + tol) &&
           y >= (r.top - tol) && y <= (r.bottom + tol);
  }

  function getOptionAllowedRects(optionRow) {
    const rects = [];
    const details = [];

    // (a) Radio circle
    const radios = optionRow.querySelectorAll('input[type="radio"], .opt-radio-wrap, .radioBtnClass');
    radios.forEach(radio => {
      const r = radio.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        rects.push(r);
        details.push({ type: 'radio', rect: r });
      }
    });

    // (b) Number prefix ("1.")
    const prefix = optionRow.querySelector('.opt-prefix');
    if (prefix) {
      const r = prefix.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        rects.push(r);
        details.push({ type: 'prefix', rect: r });
      }
    }

    // (c) Option text client rects line by line
    const textEl = optionRow.querySelector('.opt-text') || optionRow.querySelector('.labelForOptText');
    if (textEl) {
      try {
        const range = document.createRange();
        range.selectNodeContents(textEl);
        const clientRects = range.getClientRects();
        for (let i = 0; i < clientRects.length; i++) {
          const cr = clientRects[i];
          if (cr.width > 0 && cr.height > 0) {
            rects.push(cr);
            details.push({ type: `text line ${i + 1}`, rect: cr });
          }
        }
      } catch (_) {
        const r = textEl.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          rects.push(r);
          details.push({ type: 'text', rect: r });
        }
      }
    }

    // (d) Images inside the option
    const imgs = optionRow.querySelectorAll('img');
    imgs.forEach((img, idx) => {
      const r = img.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        rects.push(r);
        details.push({ type: `image ${idx + 1}`, rect: r });
      }
    });

    return { rects, details };
  }

  function setupOptionClickGeometryGuard() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.__bmtOptionClickGuardInstalled) return;
    window.__bmtOptionClickGuardInstalled = true;

    // Track active pointer type across pointer / mouse / touch events
    ['pointerdown', 'pointerup'].forEach(evtName => {
      window.addEventListener(evtName, e => {
        if (e.pointerType) _lastPointerType = e.pointerType;
      }, true);
    });
    window.addEventListener('touchstart', () => {
      _lastPointerType = 'touch';
    }, true);
    window.addEventListener('mousedown', e => {
      if (!e.pointerType) _lastPointerType = 'mouse';
    }, true);

    // Guard pointerdown / mousedown to prevent text selection and focus shifts on blank areas
    function handleOptionDownCapture(e) {
      const optionRow = e.target && e.target.closest && e.target.closest('.optionLabel, .option-label');
      if (!optionRow) return;
      const pointerType = (e.pointerType && e.pointerType !== '') ? e.pointerType : (_lastPointerType || 'mouse');
      const mode = getOptionClickMode();
      if (mode === 'row-always') return;
      if (mode === 'by-pointer-type' && pointerType === 'touch') return;
      if (e.detail === 0) return;

      const { details } = getOptionAllowedRects(optionRow);
      const isAllowed = details.some(d => isPointInRect(e.clientX, e.clientY, d.rect, 2));
      if (!isAllowed) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
    document.addEventListener('pointerdown', handleOptionDownCapture, true);
    document.addEventListener('mousedown', handleOptionDownCapture, true);

    // Primary Click capture guard: stops label activation and synthetic radio clicks
    document.addEventListener('click', function handleOptionClickCapture(e) {
      const clickX = e.clientX;
      const clickY = e.clientY;
      const pointerType = (e.pointerType && e.pointerType !== '') ? e.pointerType : (_lastPointerType || 'mouse');
      const targetStr = formatElementTag(e.target);

      const optionRow = e.target && e.target.closest && e.target.closest('.optionLabel, .option-label');
      if (!optionRow) {
        // Clicks inside options container but outside any option row (gaps or under options)
        const inOptArea = e.target && e.target.closest && e.target.closest('#quesAnsContent, .Ans_Area, [role="radiogroup"]');
        if (inOptArea && !e.target.closest('button, a, input, select, textarea, .tipIcon')) {
          if (pointerType === 'mouse' || pointerType === 'pen') {
            e.preventDefault();
            e.stopImmediatePropagation();
            recordClickDebug(`click (${Math.round(clickX)}, ${Math.round(clickY)}) pointerType=${pointerType}: BLOCKED (blank area), target element = <${targetStr}>`);
          }
        }
        return;
      }

      // Keyboard or programmatic clicks (event.detail === 0) must pass
      if (e.detail === 0) {
        recordClickDebug(`click (${Math.round(clickX)}, ${Math.round(clickY)}) pointerType=${pointerType}: allowed (keyboard/programmatic detail=0), target element = <${targetStr}>`);
        return;
      }

      const mode = getOptionClickMode();
      if (mode === 'row-always') {
        recordClickDebug(`click (${Math.round(clickX)}, ${Math.round(clickY)}) pointerType=${pointerType}: allowed (row-always), target element = <${targetStr}>`);
        return;
      }

      if (mode === 'by-pointer-type' && pointerType === 'touch') {
        recordClickDebug(`click (${Math.round(clickX)}, ${Math.round(clickY)}) pointerType=touch: allowed (touch whole row), target element = <${targetStr}>`);
        return;
      }

      // Compute allowed rectangles for this option row
      const { details } = getOptionAllowedRects(optionRow);
      let matchedDetail = null;
      for (let i = 0; i < details.length; i++) {
        if (isPointInRect(clickX, clickY, details[i].rect, 2)) {
          matchedDetail = details[i];
          break;
        }
      }

      if (matchedDetail) {
        recordClickDebug(`click (${Math.round(clickX)}, ${Math.round(clickY)}) pointerType=${pointerType}: allowed (${matchedDetail.type}), target element = <${targetStr}>`);
        return; // Allow native interaction
      }

      // Not inside any allowed rectangle -> BLOCKED!
      e.preventDefault();
      e.stopImmediatePropagation();
      recordClickDebug(`click (${Math.round(clickX)}, ${Math.round(clickY)}) pointerType=${pointerType}: BLOCKED (blank area), target element = <${targetStr}>`);
    }, true);
  }

  function updateOptionClickMode() {
    // Backward compatibility stub; geometry guard is active per-event
  }

  // ── Central UI Scaling Configuration (proportional scaling for real exam interface) ──
  const BASE_WIDTH = 1280;          // Auto scale baseline width (w / BASE_WIDTH)
  const BASE_HEIGHT = 600;         // Auto scale baseline height
  const MIN_LAYOUT_WIDTH = 900;     // Measured clean layout minimum width with CSS overrides (safe margin over 880px)
  const MIN_LAYOUT_HEIGHT = 450;    // Measured clean layout minimum height (safe margin over 400px)
  const MIN_SCALE = 1.0;
  const MAX_SCALE = 2.5;            // Extended standard scale choices up to 2.5x (custom up to 3.0x)
  const EXTRA_BOOST = 1.0;          // Multiplier for auto-tuning

  let _lastScaleInfo = {
    mode: 'auto',
    requested: null,
    isReduced: false,
    scale: 1.0,
    maxFittingScale: 2.0,
    scaleFitW: 1.0,
    scaleFitH: 1.0,
    limitedBy: 'none'
  };

  function formatPhysicalExplanation(sInfo) {
    if (typeof window === 'undefined') return '';
    const info = sInfo || _lastScaleInfo;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const dprPct = Math.round(dpr * 100);
    const maxFitPct = Math.floor((info.maxFittingScale || 1.0) * 100);
    const req = (info.requested !== null && info.requested !== undefined) ? info.requested : (info.scale || 1.0);
    const reqPct = Math.round(req * 100);
    const appliedPct = Math.floor((info.scale || 1.0) * 100);
    const physical = ((info.scale || 1.0) * dpr).toFixed(1);
    return `Windows display scale ${dprPct}% (device pixel ratio ${dpr}): the page area is ${w} x ${h}. Largest size that fits: ${maxFitPct}%. You chose ${reqPct}%, applied ${appliedPct}%. On your screen it looks ${physical}x the base size.`;
  }

  function computeUiScale() {
    if (typeof window === 'undefined') return 1.0;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Mobile / stacked layout (< 880px) stays at 1.0 with no up-scaling
    if (w < 880) {
      _lastScaleInfo = { mode: 'mobile', requested: 1.0, isReduced: false, scale: 1.0, maxFittingScale: 1.0, scaleFitW: 1.0, scaleFitH: 1.0, limitedBy: 'width' };
      return 1.0;
    }
    // Compare mode stays at 1.0 baseline
    if (typeof document !== 'undefined' && document.body && (document.body.classList.contains('is-compare-mode') || document.body.classList.contains('is-compare-login') || document.documentElement.classList.contains('is-compare-login'))) {
      _lastScaleInfo = { mode: 'compare', requested: 1.0, isReduced: false, scale: 1.0, maxFittingScale: 1.0, scaleFitW: 1.0, scaleFitH: 1.0, limitedBy: 'none' };
      return 1.0;
    }
    // Landing page in narrow windows (< 1200px) preserves 1.0 baseline layout
    const isLanding = typeof document !== 'undefined' && document.body && document.body.classList.contains('login-body');
    if (isLanding && w < 1200) {
      const urlScale = new URLSearchParams(window.location.search).get('scale');
      let requested = null;
      if (urlScale && !isNaN(parseFloat(urlScale))) requested = parseFloat(urlScale);
      else {
        try {
          const stored = localStorage.getItem('bmt_ui_scale');
          if (stored && stored !== 'auto' && !isNaN(parseFloat(stored))) requested = parseFloat(stored);
        } catch(e) {}
      }
      const isReqAbove1 = requested !== null && requested > 1.0;
      _lastScaleInfo = { mode: isReqAbove1 ? 'manual' : 'auto', requested, isReduced: isReqAbove1, scale: 1.0, maxFittingScale: 1.0, scaleFitW: 1.0, scaleFitH: 1.0, limitedBy: 'width' };
      if (typeof document !== 'undefined') {
        const noteEl = document.getElementById('bmt-scale-fit-note');
        if (noteEl) {
          if (isReqAbove1) {
            noteEl.style.display = 'block';
            noteEl.textContent = formatPhysicalExplanation(_lastScaleInfo);
          } else {
            noteEl.style.display = 'none';
            noteEl.textContent = '';
          }
        }
      }
      return 1.0;
    }

    const scaleFitW = w / MIN_LAYOUT_WIDTH;
    const scaleFitH = h / MIN_LAYOUT_HEIGHT;
    const maxFittingScale = Math.max(MIN_SCALE, Math.min(3.0, Math.min(scaleFitW, scaleFitH)));
    const limitedBy = scaleFitW <= scaleFitH ? 'width' : 'height';

    const autoScale = Math.max(MIN_SCALE, Math.min(2.0, (w / BASE_WIDTH) * EXTRA_BOOST));

    let requested = null;
    let mode = 'auto';
    const urlScale = new URLSearchParams(window.location.search).get('scale');
    if (urlScale && !isNaN(parseFloat(urlScale))) {
      requested = parseFloat(urlScale);
      mode = 'url';
    } else {
      try {
        const stored = localStorage.getItem('bmt_ui_scale');
        if (stored && stored !== 'auto' && !isNaN(parseFloat(stored))) {
          requested = parseFloat(stored);
          mode = 'manual';
        }
      } catch (e) {}
    }

    let finalScale = autoScale;
    let isReduced = false;

    if (requested !== null && requested >= 0.5) {
      if (requested > maxFittingScale + 0.005) {
        finalScale = maxFittingScale;
        isReduced = true;
      } else {
        finalScale = Math.max(0.5, Math.min(3.0, requested));
        isReduced = false;
      }
    }

    _lastScaleInfo = {
      mode,
      requested,
      isReduced,
      scale: finalScale,
      maxFittingScale,
      scaleFitW,
      scaleFitH,
      limitedBy
    };

    if (typeof document !== 'undefined') {
      const noteEl = document.getElementById('bmt-scale-fit-note');
      if (noteEl) {
        if (isReduced) {
          noteEl.style.display = 'block';
          noteEl.textContent = formatPhysicalExplanation(_lastScaleInfo);
        } else {
          noteEl.style.display = 'none';
          noteEl.textContent = '';
        }
      }
    }

    return finalScale;
  }

  function updateDebugOverlay(scale) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const isDebug = new URLSearchParams(window.location.search).get('debug') === '1';
    let overlay = document.getElementById('bmt-debug-overlay');
    if (!isDebug) {
      if (overlay) overlay.remove();
      return;
    }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bmt-debug-overlay';
      overlay.style.cssText = [
        'position: fixed',
        'top: 10px',
        'left: 10px',
        'z-index: 2147483647',
        'background: rgba(10, 20, 30, 0.92)',
        'color: #00ff66',
        'border: 1px solid #00ff66',
        'border-radius: 6px',
        'padding: 10px 14px',
        'font-family: Consolas, "Courier New", monospace',
        'font-size: 12px',
        'line-height: 1.6',
        'pointer-events: none',
        'user-select: none',
        'box-shadow: 0 4px 16px rgba(0,0,0,0.6)',
        'white-space: pre'
      ].join(' !important;');
      document.body.appendChild(overlay);
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const currentScale = scale !== undefined ? scale : computeUiScale();
    const appliedZoom = (document.body && document.body.style.zoom) ? document.body.style.zoom : ((document.body && window.getComputedStyle(document.body).zoom) || '1');

    const qEl = document.querySelector('.textHighlighter') || document.querySelector('#quesAnsContent');
    const qFontSize = qEl ? window.getComputedStyle(qEl).fontSize : 'waiting for question...';

    const cellEl = document.querySelector('.tipIcon.numpan') || document.querySelector('[id^="qtd"]');
    const cellWidth = cellEl ? `${cellEl.getBoundingClientRect().width.toFixed(1)}px` : 'waiting for palette...';

    const headerEl = Array.from(document.querySelectorAll('.headergrup, .subjectdetailsArea, #header')).find(el => el.offsetParent !== null || el.getBoundingClientRect().height > 0) || document.querySelector('.headergrup, #header');
    const headerHeight = headerEl ? `${headerEl.getBoundingClientRect().height.toFixed(1)}px` : 'waiting for header...';

    const pFine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    const pCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const pointerVal = pFine ? 'fine' : (pCoarse ? 'coarse' : 'none');

    const apFine = window.matchMedia && window.matchMedia('(any-pointer: fine)').matches;
    const apCoarse = window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches;
    const anyPointerVal = apFine ? 'fine' : (apCoarse ? 'coarse' : 'none');

    const hoverVal = window.matchMedia && window.matchMedia('(hover: hover)').matches ? 'hover' : 'none';
    const pointerQuery = `pointer: ${pointerVal}, any-pointer: ${anyPointerVal}, hover: ${hoverVal}`;

    const versionsObj = (typeof window !== 'undefined' && window.BMT_FILE_VERSIONS) ? window.BMT_FILE_VERSIONS : {};
    const jsVersions = Object.keys(versionsObj).length > 0
      ? Object.entries(versionsObj).map(([f, v]) => `${f}: ${v}`).join(' | ')
      : 'none';

    const clickLogLines = _recentClickLogs.length > 0
      ? _recentClickLogs.join('\n')
      : '(no option clicks recorded yet)';

    overlay.textContent = [
      `[BMT Debug Overlay (?debug=1)]`,
      `window.innerWidth:        ${w}px`,
      `window.innerHeight:       ${h}px`,
      `devicePixelRatio:         ${dpr}`,
      `navigator.maxTouchPoints: ${navigator.maxTouchPoints || 0}`,
      `pointer media queries:    ${pointerQuery}`,
      `option click mode:        ${getOptionClickMode()}`,
      `computed --ui-scale:      ${currentScale.toFixed(4)}${_lastScaleInfo.isReduced ? ' [Reduced to fit]' : ''}`,
      `scale mode:               ${_lastScaleInfo.mode}${_lastScaleInfo.requested ? ' (requested: ' + _lastScaleInfo.requested + ')' : ''}`,
      `limited by:               ${_lastScaleInfo.limitedBy || 'none'}`,
      `actual applied zoom:      ${appliedZoom}`,
      `question font-size:       ${qFontSize}`,
      `palette cell width:       ${cellWidth}`,
      `header height:            ${headerHeight}`,
      `JS file versions:         ${jsVersions}`,
      `recent option clicks (last 5):`,
      clickLogLines
    ].join('\n');
  }

  let _reducedToastTimeout = null;
  function showReducedToast() {
    if (typeof document === 'undefined') return;
    const isExamPage = document.body && document.body.classList.contains('exam-page');
    if (!isExamPage) return;
    let toast = document.getElementById('bmt-scale-reduced-toast');

    if (!_lastScaleInfo.isReduced) {
      if (toast) toast.style.display = 'none';
      return;
    }

    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bmt-scale-reduced-toast';
      toast.setAttribute('role', 'alert');
      toast.setAttribute('aria-live', 'polite');
      toast.title = 'Click to dismiss';
      document.body.appendChild(toast);
    }

    toast.style.cssText = [
      'position: fixed',
      'bottom: 52px',
      'left: 16px',
      'z-index: 99999',
      'background: #fff3cd',
      'color: #856404',
      'border: 1px solid #ffeeba',
      'border-radius: 4px',
      'padding: 8px 14px',
      'font-size: 12px',
      'font-weight: 500',
      'font-family: Arial, sans-serif',
      'box-shadow: 0 2px 10px rgba(0,0,0,0.18)',
      'cursor: pointer',
      'display: flex',
      'align-items: center',
      'gap: 10px',
      'max-width: 520px',
      'line-height: 1.4',
      'transition: opacity 0.3s ease'
    ].join(' !important;');

    const expl = formatPhysicalExplanation(_lastScaleInfo);
    toast.innerHTML = `<span style="font-weight:bold; color:#d9534f; margin-right:4px; white-space:nowrap;">Reduced to fit:</span> <span>${expl}</span> <span style="font-size:16px; font-weight:bold; margin-left:auto; opacity:0.7; cursor:pointer;" title="Dismiss">&times;</span>`;

    if (!toast._listenerAttached) {
      toast.addEventListener('click', () => {
        toast.style.opacity = '0';
        setTimeout(() => { if (toast) toast.style.display = 'none'; }, 300);
      });
      toast._listenerAttached = true;
    }

    toast.style.display = 'flex';
    toast.style.opacity = '1';

    if (_reducedToastTimeout) clearTimeout(_reducedToastTimeout);
    _reducedToastTimeout = setTimeout(() => {
      if (toast) {
        toast.style.opacity = '0';
        setTimeout(() => { if (toast) toast.style.display = 'none'; }, 300);
      }
    }, 8000);
  }

  function applyUiScale() {
    if (typeof document === 'undefined') return 1.0;
    let scale = computeUiScale();
    document.documentElement.style.setProperty('--ui-scale', scale.toFixed(4));
    if (document.body) {
      document.body.style.zoom = scale.toFixed(4);
    }

    const winW = (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const winH = (typeof window !== 'undefined' ? window.innerHeight : 720);
    const zoomedH = winH / scale;
    const zoomedW = winW / scale;
    document.documentElement.style.setProperty('--bmt-viewport-height', zoomedH.toFixed(2) + 'px');
    document.documentElement.style.setProperty('--bmt-viewport-width', zoomedW.toFixed(2) + 'px');

    // Ensure header never contains any stale scale banners or badges
    const subHeader = document.getElementById('sub-header');
    if (subHeader) {
      const staleBadges = subHeader.querySelectorAll('#bmt-scale-reduced-banner, .bmt-reduced-badge, [id*="bmt-scale"]');
      staleBadges.forEach(el => el.remove());
    }

    // Trigger toast if on exam page and reduced
    if (_lastScaleInfo.isReduced) {
      const screenExam = document.getElementById('screen-exam');
      if (screenExam && screenExam.style.display !== 'none') {
        showReducedToast();
      }
    } else {
      const toast = document.getElementById('bmt-scale-reduced-toast');
      if (toast) toast.style.display = 'none';
    }
    updateOptionClickMode();
    updateDebugOverlay(scale);
    return scale;
  }

  let _resizeDebounceTimer = null;
  function setupUiScaleListener() {
    applyUiScale();
    const handleRecompute = () => {
      clearTimeout(_resizeDebounceTimer);
      _resizeDebounceTimer = setTimeout(() => {
        applyUiScale();
      }, 50);
    };
    window.addEventListener('resize', handleRecompute);
    document.addEventListener('fullscreenchange', handleRecompute);
    document.addEventListener('webkitfullscreenchange', handleRecompute);
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1') {
      setInterval(() => {
        updateDebugOverlay();
      }, 500);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupUiScaleListener);
    } else {
      setupUiScaleListener();
    }
  }

  const STATUS_TO_CLASS = {
    'not-visited': 'not_visited',
    'not-answered': 'not_answered',
    'answered': 'answered',
    'marked': 'review',
    'answered-marked': 'review_answered'
  };

  const STATUS_LABELS = {
    'not-visited': 'Not Visited',
    'not-answered': 'Not Answered',
    'answered': 'Answered',
    'marked': 'Marked for Review',
    'answered-marked': 'Answered & Marked for Review (will also be evaluated)'
  };

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

  // ── Header ─────────────────────────────────────────────────────────────────
  function renderHeader(el, { examName, testName, candidateName, isReview }) {
    const fullTitle = isReview
      ? `Analysis – ${testName || examName || 'Mock Examination'}`
      : `${examName || 'Mock Examination'} – ${testName || ''}`;
    
    const h1 = document.getElementById('exam_name_h1');
    if (h1) h1.textContent = fullTitle;

    const mockNames = document.querySelectorAll('.mockName');
    mockNames.forEach(mn => mn.textContent = fullTitle);

    const candOriginalNames = document.querySelectorAll('.candOrigName, .candOriginalName, #Username, .userName1');
    candOriginalNames.forEach(cn => {
      cn.textContent = candidateName || 'Candidate';
      cn.setAttribute('title', candidateName || 'Candidate');
    });

    const declName = document.getElementById('decl-cand-name');
    if (declName) declName.textContent = candidateName || 'Candidate';

    const groupNames = document.querySelectorAll('#groups span.groupName, .groupHead');
    groupNames.forEach(gn => {
      gn.textContent = examName || fullTitle;
      gn.setAttribute('title', examName || fullTitle);
    });
    const subjGrp0 = document.querySelector('#subject_info_grp0 .subject_name span b');
    if (subjGrp0) subjGrp0.textContent = examName || fullTitle;
    const grupHead = document.querySelector('#groupsResp .grup_head');
    if (grupHead) {
      grupHead.innerHTML = `${_esc(examName || fullTitle)}<div class="arw_drpdown"></div> <span class="crumb">/</span>`;
    }
  }

  // ── Section Tabs ───────────────────────────────────────────────────────────
  function renderSectionTabs(el, { sections, currentSectionIndex, sectionCompleted, isSectional, timerText, isReview, sectionTimed }) {
    const secContainer = document.getElementById('sections');
    const currentSecName = sections[currentSectionIndex]?.name || 'Section 1';

    // Section banner above palette
    const palSecHeader = document.querySelector('#rightSectionDiv2 .header b');
    if (palSecHeader) palSecHeader.textContent = currentSecName;
    const typingHeader = document.querySelector('#typingInstDiv .viewSection b');
    if (typingHeader) typingHeader.textContent = currentSecName;

    // Section tabs in subheader
    if (secContainer) {
      const tabsHtml = sections.map((sec, i) => {
        const isActive = i === currentSectionIndex;
        let cls = isActive ? 'subject-name selectedsubject' : 'subject-name';
        let lockStyle = 'cursor:pointer;';
        let title = _esc(sec.name);
        let badge = '';

        if (!isReview && !isSectional && sectionTimed) {
          if (isActive) {
            lockStyle = 'cursor:pointer;';
            title = _esc(sec.name);
          } else if (i < currentSectionIndex || (sectionCompleted && sectionCompleted[i])) {
            cls = 'subject-name section-tab-submitted section-tab-disabled';
            lockStyle = 'opacity:0.7; cursor:not-allowed; pointer-events:none; background:#e9ecef; color:#495057;';
            title = `${_esc(sec.name)} (Submitted)`;
            badge = `<span class="tab-sub-badge" style="font-size:10px; background:#6c757d; color:#fff; padding:1px 5px; border-radius:3px; margin-left:4px; font-weight:normal;">Submitted</span>`;
          } else {
            cls = 'subject-name section-tab-disabled';
            lockStyle = 'opacity:0.6; cursor:not-allowed; pointer-events:none; background:#f4f5f7; color:#8c959f;';
            title = 'Sections open one at a time';
          }
        } else if (!isReview && !isSectional && sectionCompleted && sectionCompleted[i] && !isActive) {
          cls = 'subject-name section-tab-disabled';
          lockStyle = 'pointer-events:none; opacity:0.5;';
        }

        return `
          <div class="${cls}" id="s${i}" tabindex="0" role="tab" data-section="${i}" aria-selected="${isActive ? 'true' : 'false'}" style="${lockStyle}" title="${title}">
            <span style="vertical-align:middle" class="sectionName">${_esc(sec.name)}</span>${badge}
          </div>
        `;
      }).join('');
      secContainer.innerHTML = tabsHtml;
    }

    // Timer display
    renderTimer(timerText);
  }

  // ── Question Meta Row ──────────────────────────────────────────────────────
  function renderQuestionMeta(el, { marks, negative }) {
    const m = (marks !== undefined && marks !== null) ? marks : 1;
    const n = (negative !== undefined && negative !== null) ? negative : 0.25;
    const correctEl = document.querySelector('.marking-details font[style*="green"], .marking-details font:first-of-type');
    if (correctEl) correctEl.textContent = `${m}`;

    const negEl = document.querySelector('.marking-details font[style*="#A80000"], .marking-details font:last-of-type');
    if (negEl) negEl.textContent = `${n}`;
  }

  // ── Images & Lightbox Markup Helper ─────────────────────────────────────────
  function buildImageMarkup(imageRef, alt = 'Diagram') {
    if (!imageRef || typeof imageRef !== 'string') return '';
    const cleanRef = imageRef.trim();
    const resolvedSrc = Storage.resolveImageSrc(cleanRef);
    const fileName = cleanRef.split('/').pop().split('\\').pop();

    if (!resolvedSrc) {
      return `
        <div class="bmt-image-missing-placeholder" style="display:block; padding:12px 16px; background:#fff3cd; border:1px solid #ffeeba; color:#856404; font-size:13px; border-radius:4px; text-align:left; margin:8px 0;">
          <strong>Image not found:</strong> ${Sanitiser.sanitise(fileName)}. Attach it with the Add images button.
        </div>
      `;
    }

    return `
      <div class="bmt-image-container" style="margin:10px 0; text-align:center; max-width:100%;">
        <img src="${_esc(resolvedSrc)}" alt="${_esc(alt)}" class="bmt-zoomable-image" draggable="false" style="max-width:100%; height:auto; cursor:zoom-in; user-select:none; -webkit-user-drag:none; display:block; margin:0 auto; border-radius:2px;" title="Click to enlarge" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='block';" />
        <div class="bmt-image-missing-placeholder" style="display:none; padding:12px 16px; background:#fff3cd; border:1px solid #ffeeba; color:#856404; font-size:13px; border-radius:4px; text-align:left; margin:8px 0;">
          <strong>Image not found:</strong> ${Sanitiser.sanitise(fileName)}. Attach it with the Add images button.
        </div>
      </div>
    `;
  }

  // ── Question Content & Options ─────────────────────────────────────────────
  function renderQuestion(el, { qData, qState, questionNumber, isReview, isReattempt, reattemptAnswer, qElapsed, originalTimeSpent }) {
    updateOptionClickMode();
    const hasGroup = !!qData.groupId;
    const hasPassage = !!(qData.passage || qData.groupImage || (hasGroup && qData.image));
    const groupImg = qData.groupImage || (hasGroup && !qData.passage ? qData.image : null);
    const questionImg = (qData.image && qData.image !== groupImg) ? qData.image : (!hasPassage && qData.image ? qData.image : null);

    let timerHtml = `<span id="q-timer" class="q-timer-badge">Time on this question: ${qElapsed || 0}s</span>`;
    if (isReview && !isReattempt) {
      const isAnswered = qState.status === 'answered' || qState.status === 'answered-marked';
      const isCorrect = isAnswered && qState.selectedOption === qData.correct;
      const isWrong = isAnswered && qState.selectedOption !== qData.correct;
      const marksVal = isCorrect ? (qData.marks ?? 1) : (isWrong ? -(qData.negative ?? 0.25) : 0);
      const marksStr = marksVal > 0 ? `+${marksVal}` : `${marksVal}`;
      const timeSpentSec = qState.timeSpent || 0;
      timerHtml = `<span id="q-timer" class="q-timer-badge" style="display:inline-block;">Time spent: ${Timer.formatDuration(timeSpentSec)} | Marks: ${marksStr}</span>`;
    } else if (isReattempt) {
      if (reattemptAnswer) {
        const isCorrect = reattemptAnswer.isCorrect;
        const marksVal = isCorrect ? (qData.marks ?? 1) : -(qData.negative ?? 0.25);
        const marksStr = marksVal > 0 ? `+${marksVal}` : `${marksVal}`;
        const timeSpentSec = reattemptAnswer.timeSpent || 0;
        timerHtml = `<span id="q-timer" class="q-timer-badge" style="display:inline-block;">Time spent: ${Timer.formatDuration(timeSpentSec)} | Marks: ${marksStr}</span>`;
      } else {
        timerHtml = `<span id="q-timer" class="q-timer-badge" style="display:inline-block;">Re-attempt Time: ${Timer.formatDuration(qElapsed || 0)} | Original: ${Timer.formatDuration(qState.timeSpent || 0)}</span>`;
      }
    }

    const showQNo = (typeof window !== 'undefined' && window.SHOW_QUESTION_NO_LABEL !== undefined)
      ? window.SHOW_QUESTION_NO_LABEL
      : SHOW_QUESTION_NO_LABEL;

    const qNoHtml = showQNo
      ? `<b><span aria-label="question number" class="questionNumber langLabel" lang="en">Question No</span>. ${questionNumber}</b>`
      : '';

    const headerHtml = `
      <div role="heading" aria-level="3" class="divHeader" id="divHeader_id" tabindex="0">
        ${qNoHtml}
        ${timerHtml}
      </div>
    `;

    const questionImgHtml = questionImg ? buildImageMarkup(questionImg, 'Question diagram') : '';

    const optionsHtml = qData.options.map((opt, i) => {
      const optNum = i + 1;
      let isSelected = false;
      let checked = '';
      let optClass = 'optionLabel';
      let disabled = '';

      if (isReattempt) {
        if (reattemptAnswer) {
          disabled = 'disabled';
          isSelected = reattemptAnswer.selectedOption === optNum;
          if (isSelected) checked = 'checked';
          if (optNum === qData.correct) optClass += ' option-correct';
          if (isSelected && optNum !== qData.correct) optClass += ' option-wrong';
        }
      } else if (isReview) {
        disabled = 'disabled';
        isSelected = qState.selectedOption === optNum;
        if (isSelected) checked = 'checked';
        if (optNum === qData.correct) optClass += ' option-correct';
        if (isSelected && optNum !== qData.correct) optClass += ' option-wrong';
      } else {
        isSelected = qState.selectedOption === optNum;
        if (isSelected) checked = 'checked';
      }

      if (disabled) optClass += ' option-disabled';

      return `
        <label for="Group1Section1Question${questionNumber}Option${optNum}" class="${optClass}">
          <span class="opt-radio-wrap">
            <input id="Group1Section1Question${questionNumber}Option${optNum}" type="radio" class="answer MCQanswer radioBtnClass" name="answers" value="${optNum}" ${checked} ${disabled}>
          </span>
          <span class="labelForOptText">
            <span class="opt-prefix">${optNum}.</span>
            <span class="opt-text-wrap"><span class="opt-text">${Sanitiser.sanitise(opt)}</span></span>
          </span>
        </label>
      `;
    }).join('');

    let reviewInfoHtml = '';

    let solutionHtml = '';
    const showSolution = (isReview && !isReattempt) || (isReattempt && reattemptAnswer);
    if (showSolution && qData.explanation && typeof qData.explanation === 'string' && qData.explanation.trim() !== '') {
      const sanitisedExpl = Sanitiser.sanitise(qData.explanation);
      solutionHtml = `
        <div class="solution-box">
          <div class="solution-title">Solution</div>
          <div class="solution-content">${sanitisedExpl}</div>
        </div>
      `;
    }

    const leftDiv = document.querySelector('.leftDiv') || document.getElementById('quesOuterDiv');
    if (!leftDiv) return;

    if (hasPassage) {
      let leftPaneDirections = '';
      let leftPaneTable = '';
      if (qData.passage) {
        const rawP = qData.passage;
        const tIdx = rawP.toLowerCase().indexOf('<table');
        if (tIdx >= 0) {
          leftPaneDirections = rawP.substring(0, tIdx);
          leftPaneTable = rawP.substring(tIdx);
        } else {
          leftPaneDirections = rawP;
        }
      }

      let leftPaneHtml = '';
      if (leftPaneDirections.trim()) {
        leftPaneHtml += `<div class="passage-content">${Sanitiser.sanitise(leftPaneDirections)}</div>`;
      }
      if (groupImg) {
        leftPaneHtml += buildImageMarkup(groupImg, 'Directions diagram');
      }
      if (leftPaneTable.trim()) {
        leftPaneHtml += `<div class="passage-content">${Sanitiser.sanitise(leftPaneTable)}</div>`;
      }

      leftDiv.className = 'leftDiv has-passage';
      leftDiv.innerHTML = `
        ${headerHtml}
        <div id="quesAnsContent" class="Ans_Area" style="height:calc(100% - 30px);">
          <div class="groupInstructionsContextBlk" id="groupInstructionContextOverflow">
            <div style="font-weight:bold; margin-bottom:8px; color:#222; border-bottom:1px solid #e0e0e0; padding-bottom:4px;">Directions / Context:</div>
            ${leftPaneHtml}
          </div>
          <div class="bmt-column-resizer" id="passageResizer" role="separator" aria-orientation="vertical" tabindex="0" aria-label="Resize columns" title="Drag to resize columns (Double click to reset)"></div>
          <div class="question-panel-split">
            <div class="textHighlighter" id="Group1Section1Question${questionNumber}">
              ${questionImgHtml}
              ${Sanitiser.sanitise(qData.question)}
            </div>
            <div role="radiogroup" class="removeAria">
              ${optionsHtml}
            </div>
            ${reviewInfoHtml}
            ${solutionHtml}
          </div>
        </div>
      `;
      setupPassageResizer();
    } else {
      leftDiv.className = 'leftDiv';
      leftDiv.innerHTML = `
        ${headerHtml}
        <div id="quesAnsContent" class="Ans_Area">
          <div class="textHighlighter" id="Group1Section1Question${questionNumber}">
            ${questionImgHtml}
            ${Sanitiser.sanitise(qData.question)}
          </div>
          <div role="radiogroup" class="removeAria">
            <div>${optionsHtml}</div>
          </div>
          ${reviewInfoHtml}
          ${solutionHtml}
        </div>
      `;
    }
    updateDebugOverlay();
  }

  // ── Palette Panel ──────────────────────────────────────────────────────────
  function renderPalette(el, { sections, questions, currentSectionIndex, currentFlatIndex, isReview, isReattempt, reattemptAnswers, reattemptQueue, filter, avgTime }) {
    const currentSection = sections[currentSectionIndex];
    const sectionQs = questions.filter(q => q.sectionIndex === currentSectionIndex);
    const isAnalyse = Boolean(isReview || isReattempt);

    // Track counts for the 5 sprite shapes
    const counts = {
      answered: 0,
      not_answered: 0,
      not_visited: 0,
      review: 0,
      review_answered: 0
    };

    // Calculate status for each question in sectionQs
    const questionStatuses = sectionQs.map((q, i) => {
      const flatIndex = questions.indexOf(q);
      const qData = sections[q.sectionIndex]?.questions[q.questionIndex];

      let stCls = 'not_visited';
      let stLabel = 'Not Visited';

      if (isReattempt) {
        // Re-attempt mode: follows same convention for re-attempt answers while keeping original purple marks
        const origMarkedAnswered = q.status === 'answered-marked';
        const origMarkedOnly = q.status === 'marked';
        const reAns = reattemptAnswers && reattemptAnswers[flatIndex];

        if (origMarkedAnswered || (origMarkedOnly && reAns)) {
          // Precedence 1: Marked for review AND answered
          stCls = 'review_answered';
          stLabel = 'Answered & Marked for Review';
        } else if (origMarkedOnly) {
          // Precedence 2: Marked for review, not answered
          stCls = 'review';
          stLabel = 'Marked for Review';
        } else if (reAns) {
          if (reAns.isCorrect) {
            // Precedence 3: Not marked, answered correctly
            stCls = 'answered';
            stLabel = 'Correct';
          } else {
            // Precedence 4: Not marked, answered wrong
            stCls = 'not_answered';
            stLabel = 'Wrong';
          }
        } else {
          // Precedence 5: Not marked, skipped/unseen
          stCls = 'not_visited';
          stLabel = 'Not Attempted';
        }
      } else if (isReview) {
        // Analyse Review mode: 5-level precedence (Item F)
        const isMarked = q.status === 'marked' || q.status === 'answered-marked';
        const isAns = q.status === 'answered' || q.status === 'answered-marked' || (q.selectedOption != null && q.selectedOption !== '');

        if (isMarked && isAns) {
          // 1. Marked for review AND answered -> Answered & Marked for Review shape (whether right or wrong)
          stCls = 'review_answered';
          stLabel = 'Answered & Marked for Review';
        } else if (isMarked && !isAns) {
          // 2. Marked for review, not answered -> Marked for Review shape
          stCls = 'review';
          stLabel = 'Marked for Review';
        } else if (isAns) {
          const isCorr = Boolean(qData && q.selectedOption === qData.correct);
          if (isCorr) {
            // 3. Not marked, answered correctly -> green Answered shape
            stCls = 'answered';
            stLabel = 'Correct';
          } else {
            // 4. Not marked, answered wrong -> red Not Answered shape
            stCls = 'not_answered';
            stLabel = 'Wrong';
          }
        } else {
          // 5. Not marked, skipped/unseen -> grey Not Visited shape
          stCls = 'not_visited';
          stLabel = 'Not Attempted';
        }
      } else {
        // Live Exam mode: standard status mapping
        stCls = STATUS_TO_CLASS[q.status] || 'not_visited';
        stLabel = STATUS_LABELS[q.status] || 'Not Visited';
      }

      if (counts[stCls] !== undefined) {
        counts[stCls]++;
      }

      return { q, flatIndex, stCls, stLabel, qData };
    });

    // Update legend counts & labels (Item F)
    document.querySelectorAll('.answeredCount').forEach(el => el.textContent = counts.answered);
    document.querySelectorAll('.answeredLabel').forEach(el => el.textContent = isAnalyse ? 'Correct' : 'Answered');

    document.querySelectorAll('.notAnsweredCount').forEach(el => el.textContent = counts.not_answered);
    document.querySelectorAll('.notAnsweredLabel').forEach(el => el.textContent = isAnalyse ? 'Wrong' : 'Not Answered');

    document.querySelectorAll('.notVisitedCount').forEach(el => el.textContent = counts.not_visited);
    document.querySelectorAll('.notVisitedLabel').forEach(el => el.textContent = isAnalyse ? 'Not Attempted' : 'Not Visited');

    document.querySelectorAll('.markedCount').forEach(el => el.textContent = counts.review);
    document.querySelectorAll('.markedLabel').forEach(el => el.textContent = 'Marked for Review');

    document.querySelectorAll('.markedAnsweredCount').forEach(el => el.textContent = counts.review_answered);
    document.querySelectorAll('.markedAndAnsweredLabel').forEach(el => el.textContent = 'Answered & Marked for Review (will also be evaluated)');

    // Build palette grid in #numberpanelQues
    const numPanel = document.getElementById('numberpanelQues');
    if (numPanel) {
      const gridHtml = questionStatuses.map((item, i) => {
        const displayNum = i + 1;
        const isCurrent = item.flatIndex === currentFlatIndex;
        let isDimmed = false;

        if (isReattempt && reattemptQueue && !reattemptQueue.includes(item.flatIndex)) {
          isDimmed = true;
        } else if (filter && filter !== 'all') {
          // Check filter matching
          let matches = false;
          if (isReattempt && reattemptAnswers && reattemptAnswers[item.flatIndex]) {
            const reAns = reattemptAnswers[item.flatIndex];
            if (filter === 'correct') matches = reAns.isCorrect;
            else if (filter === 'wrong' || filter === 'incorrect') matches = !reAns.isCorrect;
          } else {
            const isAns = item.q.status === 'answered' || item.q.status === 'answered-marked' || (item.q.selectedOption != null && item.q.selectedOption !== '');
            const isCorr = isAns && item.qData && item.q.selectedOption === item.qData.correct;
            const isWrong = isAns && item.qData && item.q.selectedOption !== item.qData.correct;
            const isSkipped = item.q.status === 'not-answered' || item.q.status === 'not_answered';
            const isUnseen = item.q.status === 'not-visited' || item.q.status === 'not_visited';
            const isMarked = item.q.status === 'marked' || item.q.status === 'answered-marked';
            const isSlow = avgTime !== undefined && (item.q.timeSpent || 0) > avgTime;

            if (filter === 'correct') matches = isCorr;
            else if (filter === 'wrong' || filter === 'incorrect') matches = isWrong;
            else if (filter === 'skipped') matches = isSkipped;
            else if (filter === 'unseen') matches = isUnseen;
            else if (filter === 'marked') matches = isMarked;
            else if (filter === 'slow') matches = isSlow;
          }

          if (!matches) isDimmed = true;
        }

        const dimClass = isDimmed ? ' palette-dimmed' : '';

        return `
          <div id="qtd${i}">
            <span id="${item.flatIndex}" objid="${item.stLabel}" class="tipIcon numpan ${item.stCls} auditlog ${i}${dimClass}" tabindex="${isCurrent ? '0' : '-1'}" role="tab" aria-controls="currentQues" aria-selected="${isCurrent ? 'true' : 'false'}" aria-label="Question ${displayNum}, ${item.stLabel}, " style="pointer-events: ${isDimmed ? 'none' : 'auto'};"> ${displayNum}</span>
          </div>
        `;
      }).join('');

      numPanel.innerHTML = `<div>${gridHtml}</div>`;
    }
    updateDebugOverlay();
  }

  // ── Timer Displays ─────────────────────────────────────────────────────────
  function renderTimer(timerText) {
    const formatted = timerText || '00:00';
    document.querySelectorAll('#timeInMins, .timebx').forEach(el => {
      el.textContent = formatted;
    });

    const parts = formatted.split(':');
    if (parts.length === 2) {
      const minEl = document.getElementById('min_val');
      if (minEl) minEl.textContent = parts[0];
      const secEl = document.getElementById('sec01_val');
      if (secEl) secEl.textContent = parts[1];
    }

  }

  function renderQTimer(elOrSec, maybeSec) {
    const sec = typeof elOrSec === 'number' ? elOrSec : maybeSec;
    const qTimer = document.getElementById('q-timer');
    if (qTimer) qTimer.textContent = `Time on this question: ${Timer.formatDuration(sec || 0)}`;
  }

  // ── Submit Summary Modal Table ─────────────────────────────────────────────
  function renderSubmitSummary(el, { sections, questions }, targetSectionIndex = null) {
    const targetSections = (targetSectionIndex !== null && targetSectionIndex !== undefined)
      ? sections.map((sec, si) => ({ sec, si })).filter(item => item.si === targetSectionIndex)
      : sections.map((sec, si) => ({ sec, si }));

    const rows = targetSections.map(({ sec, si }) => {
      const secQs = questions.filter(q => q.sectionIndex === si);
      const total = secQs.length;
      const ans = secQs.filter(q => q.status === 'answered').length;
      const notAns = secQs.filter(q => q.status === 'not-answered').length;
      const marked = secQs.filter(q => q.status === 'marked').length;
      const ansMarked = secQs.filter(q => q.status === 'answered-marked').length;
      const notVis = secQs.filter(q => q.status === 'not-visited').length;
      return `
        <tr style="border-bottom:1px solid #ddd; text-align:center;">
          <td style="padding:8px; text-align:left; font-weight:bold;">${_esc(sec.name)}</td>
          <td style="padding:8px;">${total}</td>
          <td style="padding:8px; color:green; font-weight:bold;">${ans}</td>
          <td style="padding:8px; color:#d9534f; font-weight:bold;">${notAns}</td>
          <td style="padding:8px; color:#800080; font-weight:bold;">${marked}</td>
          <td style="padding:8px; color:#4a148c; font-weight:bold;">${ansMarked}</td>
          <td style="padding:8px; color:#666;">${notVis}</td>
        </tr>
      `;
    }).join('');

    el.innerHTML = `
      <table class="submit-summary-table" style="width:100%; border-collapse:collapse; margin-top:10px; font-size:12px; border:1px solid #ddd;">
        <thead>
          <tr style="background:#e5f6fd; border-bottom:2px solid #147eb3; text-align:center;">
            <th style="padding:8px; text-align:left;">Section Name</th>
            <th style="padding:8px;">No. of Questions</th>
            <th style="padding:8px;">Answered</th>
            <th style="padding:8px;">Not Answered</th>
            <th style="padding:8px;">Marked</th>
            <th style="padding:8px;">Answered &amp; Marked</th>
            <th style="padding:8px;">Not Visited</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // ── Draggable Split Resizer for Two-Column Layout ──────────────────────────
  const DEFAULT_SPLIT_RATIO = 0.58;

  function getStoredSplitRatio() {
    try {
      const val = parseFloat(localStorage.getItem('bmt_split_ratio'));
      if (!isNaN(val) && val >= 0.25 && val <= 0.75) {
        return val;
      }
    } catch (e) {}
    return DEFAULT_SPLIT_RATIO;
  }

  function setStoredSplitRatio(ratio) {
    try {
      localStorage.setItem('bmt_split_ratio', ratio.toFixed(4));
    } catch (e) {}
  }

  function applySplitRatio(ratio) {
    const container = document.getElementById('quesAnsContent');
    if (!container) return;
    const clamped = Math.max(0.25, Math.min(0.75, ratio));
    container.style.setProperty('--split-left', `${(clamped * 100).toFixed(2)}%`);
  }

  function setupPassageResizer() {
    const resizer = document.getElementById('passageResizer');
    const container = document.getElementById('quesAnsContent');
    if (!resizer || !container) return;

    // Apply stored ratio immediately
    const initialRatio = getStoredSplitRatio();
    applySplitRatio(initialRatio);

    let isDragging = false;
    let hasMoved = false;

    function handlePointerDown(e) {
      if (window.innerWidth <= 900) return;
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();

      isDragging = true;
      hasMoved = false;
      try {
        resizer.setPointerCapture(e.pointerId);
      } catch (err) {}

      resizer.classList.add('is-dragging');
      document.body.classList.add('is-resizing-columns');
    }

    function handlePointerMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      hasMoved = true;

      const rect = container.getBoundingClientRect();
      const totalW = rect.width;
      if (totalW <= 0) return;

      const minLeft = Math.max(totalW * 0.25, 220) + 5;
      const minRight = Math.max(totalW * 0.25, 220) + 5;
      const maxLeft = Math.min(totalW * 0.75 + 5, (totalW - 10) - minRight + 10);

      const pointerOffset = e.clientX - rect.left - 5;
      const clampedLeftPx = Math.max(minLeft, Math.min(maxLeft, pointerOffset));
      const newRatio = clampedLeftPx / totalW;

      applySplitRatio(newRatio);
    }

    function handlePointerUp(e) {
      if (!isDragging) return;
      const didMove = hasMoved;
      isDragging = false;
      hasMoved = false;

      try {
        resizer.releasePointerCapture(e.pointerId);
      } catch (err) {}

      resizer.classList.remove('is-dragging');
      document.body.classList.remove('is-resizing-columns');

      if (didMove) {
        const rect = container.getBoundingClientRect();
        const totalW = rect.width;
        if (totalW > 0) {
          const minLeft = Math.max(totalW * 0.25, 220) + 5;
          const minRight = Math.max(totalW * 0.25, 220) + 5;
          const maxLeft = Math.min(totalW * 0.75 + 5, (totalW - 10) - minRight + 10);
          const pointerOffset = e.clientX - rect.left - 5;
          const clampedLeftPx = Math.max(minLeft, Math.min(maxLeft, pointerOffset));
          const finalRatio = clampedLeftPx / totalW;
          applySplitRatio(finalRatio);
          setStoredSplitRatio(finalRatio);
        }
      }
    }

    resizer.addEventListener('pointerdown', handlePointerDown);
    resizer.addEventListener('pointermove', handlePointerMove);
    resizer.addEventListener('pointerup', handlePointerUp);
    resizer.addEventListener('pointercancel', handlePointerUp);

    // Document-level safety net
    document.addEventListener('mousemove', e => {
      if (!isDragging) return;
      handlePointerMove(e);
    });
    document.addEventListener('mouseup', e => {
      if (!isDragging) return;
      handlePointerUp(e);
    });

    // Double-click resets to default 58%
    resizer.addEventListener('dblclick', e => {
      e.preventDefault();
      applySplitRatio(DEFAULT_SPLIT_RATIO);
      setStoredSplitRatio(DEFAULT_SPLIT_RATIO);
    });

    // Keyboard accessibility: Left / Right arrow keys move by 20px
    resizer.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        const rect = container.getBoundingClientRect();
        const totalW = rect.width;
        if (totalW <= 0) return;

        const currentRatio = getStoredSplitRatio();
        const currentLeftPx = currentRatio * totalW;
        const delta = e.key === 'ArrowLeft' ? -20 : 20;
        const targetPx = currentLeftPx + delta;

        const minLeft = Math.max(totalW * 0.25, 220);
        const minRight = Math.max(totalW * 0.25, 220);
        const maxLeft = Math.min(totalW * 0.75, (totalW - 10) - minRight);
        const clampedLeftPx = Math.max(minLeft, Math.min(maxLeft, targetPx));
        const newRatio = clampedLeftPx / totalW;

        applySplitRatio(newRatio);
        setStoredSplitRatio(newRatio);
      }
    });
  }

  return {
    renderHeader,
    renderSectionTabs,
    renderQuestionMeta,
    renderQuestion,
    renderPalette,
    renderTimer,
    renderQTimer,
    renderSubmitSummary,
    buildImageMarkup,
    setupPassageResizer,
    getStoredSplitRatio,
    applySplitRatio,
    DEFAULT_SPLIT_RATIO,
    SHOW_QUESTION_NO_LABEL,
    OPTION_CLICK_MODE,
    getOptionClickMode,
    setupOptionClickGeometryGuard,
    getOptionAllowedRects,
    updateOptionClickMode,
    computeUiScale,
    applyUiScale,
    updateDebugOverlay,
    showReducedToast,
    formatPhysicalExplanation,
    getScaleInfo: () => _lastScaleInfo,
    BASE_WIDTH,
    BASE_HEIGHT,
    MIN_LAYOUT_WIDTH,
    MIN_LAYOUT_HEIGHT,
    MIN_SCALE,
    MAX_SCALE,
    EXTRA_BOOST
  };

})();

if (typeof window !== 'undefined') {
  window.BMT_FILE_VERSIONS = window.BMT_FILE_VERSIONS || {};
  window.BMT_FILE_VERSIONS['renderer.js'] = '20261018_125625';
  window.OPTION_CLICK_MODE = window.OPTION_CLICK_MODE || Renderer.OPTION_CLICK_MODE;
  if (Renderer.setupOptionClickGeometryGuard) {
    Renderer.setupOptionClickGeometryGuard();
  }
}
