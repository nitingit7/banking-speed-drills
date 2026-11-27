/**
 * js/security.js – Exam Security & Government-Exam Style Watermark
 * Loaded on exam.html and analyse.html.
 * Completely disabled when ?compare= is present.
 */

(function() {
  'use strict';

  // ── Security Configuration ────────────────────────────────────────────────
  const SECURITY = {
    WATERMARK_ENABLED: true,
    WATERMARK_OPACITY: 0.08,
    BLOCK_SHORTCUTS: true,
    BLOCK_CONTEXT_MENU: true,
    BLOCK_CLIPBOARD: true,
    BLOCK_DRAG: true,
    BLOCK_DEVTOOLS: true,
    LOCK_WHEEL_SCROLL: true,
    WATERMARK_SHOW_TIME: false,
    TRACK_TAB_SWITCHES: true,
    TRACK_WINDOW_BLUR: true,
    TRACK_FULLSCREEN_EXITS: true,
    PREVENT_MULTI_TAB: true,
    PREVENT_BACK_BUTTON: true,
    MAX_VIOLATIONS_AUTOSUBMIT: 0, // 0 = off; N > 0 auto-submits on N total violations
  };

  // Expose configuration globally for inspection or developer overrides
  window.BMT_SECURITY = SECURITY;

  // Immediately exit if compare flag is present
  if (window.location.search.includes('compare=')) {
    return;
  }

  // ── Integrity State ────────────────────────────────────────────────────────
  const integrity = {
    tabSwitches: 0,
    fullscreenExits: 0,
    tamperEvents: 0,
    blockedKeyAttempts: 0,
    totalViolations: 0,
  };

  function loadIntegrity() {
    try {
      if (typeof Storage !== 'undefined' && Storage.loadActiveAttempt) {
        const att = Storage.loadActiveAttempt();
        if (att && att.integrity) {
          Object.assign(integrity, att.integrity);
        }
      }
    } catch(e) {}
  }

  function saveIntegrity() {
    try {
      integrity.totalViolations = (integrity.tabSwitches || 0) +
                                  (integrity.fullscreenExits || 0) +
                                  (integrity.tamperEvents || 0) +
                                  (integrity.blockedKeyAttempts || 0);
      if (typeof Storage !== 'undefined' && Storage.loadActiveAttempt && Storage.saveActiveAttempt) {
        const att = Storage.loadActiveAttempt();
        if (att) {
          att.integrity = Object.assign({}, integrity);
          Storage.saveActiveAttempt(att);
        }
      }
    } catch(e) {}
  }

  SECURITY.integrity = integrity;
  SECURITY.getIntegrity = function() {
    saveIntegrity();
    return Object.assign({}, integrity);
  };
  SECURITY.verifyTabLock = function(tabId) {
    return verifyTabLock(tabId || getSessionTabId());
  };
  SECURITY.getSessionTabId = function() {
    return getSessionTabId();
  };
  SECURITY.showMultiTabBlockOverlay = function() {
    showMultiTabBlockOverlay();
  };

  // ── In-page Warning Banner (No alert/confirm/prompt) ────────────────────────
  function showSecurityWarning(message) {
    let banner = document.getElementById('security-warning-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'security-warning-banner';
      banner.className = 'security-warning-banner';
      banner.style.cssText = [
        'position: fixed !important',
        'top: 0 !important',
        'left: 0 !important',
        'width: 100% !important',
        'z-index: 10000000 !important',
        'background: #c0392b !important',
        'color: #ffffff !important',
        'font-size: 13.5px !important',
        'font-weight: bold !important',
        'text-align: center !important',
        'padding: 10px 16px !important',
        'box-shadow: 0 2px 10px rgba(0,0,0,0.4) !important',
        'transition: opacity 0.3s ease !important',
        'font-family: Arial, Helvetica, sans-serif !important',
        'box-sizing: border-box !important',
        'pointer-events: none !important',
      ].join(';');
      document.body.appendChild(banner);
    }
    banner.textContent = message;
    banner.style.display = 'block';
    banner.style.opacity = '1';
    clearTimeout(banner._hideTimer);
    banner._hideTimer = setTimeout(() => {
      banner.style.opacity = '0';
      setTimeout(() => { banner.style.display = 'none'; }, 300);
    }, 3500);
  }

  function checkAutoSubmit() {
    if (SECURITY.MAX_VIOLATIONS_AUTOSUBMIT > 0 && integrity.totalViolations >= SECURITY.MAX_VIOLATIONS_AUTOSUBMIT) {
      showSecurityWarning(`Maximum security violations reached (${integrity.totalViolations}). Auto-submitting assessment...`);
      setTimeout(() => {
        const submitBtn = document.getElementById('finalSubmit') || document.getElementById('btn-submit');
        if (submitBtn) submitBtn.click();
      }, 1500);
    }
  }

  // ── Candidate Mobile Number Retrieval ──────────────────────────────────────
  function getCandidateMobile() {
    return '9345******';
  }

  // ── Watermark Implementation (B1 + B2) ────────────────────────────────────
  let watermarkEl = null;
  let expectedItemCount = 0;
  let bodyObserver = null;
  let watermarkObserver = null;
  let integrityTimer = null;
  let resizeTimer = null;
  let isBuilding = false;

  // ── Target Element Locator (Item G) ────────────────────────────────────────
  function getWatermarkTarget() {
    // 1. Question paper modal (if open and visible)
    const qpaper = document.getElementById('modal-qpaper');
    if (qpaper && window.getComputedStyle(qpaper).display !== 'none') {
      const qb = document.getElementById('modal-qpaper-body');
      if (qb) {
        const r = qb.getBoundingClientRect();
        if (r.width > 50 && r.height > 50) return qb;
      }
    }
    // 2. Exam screen question outer div (holds both panes in passage view, single pane in normal view)
    const outer = document.getElementById('quesOuterDiv');
    if (outer) {
      const r = outer.getBoundingClientRect();
      if (r.width > 50 && r.height > 50) return outer;
    }
    // 3. Fallback to currentQues
    const curr = document.getElementById('currentQues');
    if (curr) {
      const r = curr.getBoundingClientRect();
      if (r.width > 50 && r.height > 50) return curr;
    }
    return null;
  }

  function getWatermarkTargetRect() {
    const target = getWatermarkTarget();
    if (target) {
      const r = target.getBoundingClientRect();
      const zoom = (document.body && parseFloat(document.body.style.zoom)) ? parseFloat(document.body.style.zoom) : 1.0;
      if (r.width > 50 && r.height > 50) {
        return {
          top: Math.round(r.top / zoom),
          left: Math.round(r.left / zoom),
          width: Math.round(r.width / zoom),
          height: Math.round(r.height / zoom),
        };
      }
    }
    return null;
  }

  function buildWatermark() {
    if (!SECURITY.WATERMARK_ENABLED) return;
    if (isBuilding) return;
    isBuilding = true;

    // Disconnect previous observer
    if (watermarkObserver) {
      watermarkObserver.disconnect();
      watermarkObserver = null;
    }

    // Remove any existing watermark
    if (watermarkEl && watermarkEl.parentNode) {
      watermarkEl.parentNode.removeChild(watermarkEl);
    }

    const targetRect = getWatermarkTargetRect();
    if (!targetRect) {
      isBuilding = false;
      return;
    }

    const mobileNumber = getCandidateMobile();
    const container = document.createElement('div');
    const randomId = 'wm_' + Math.random().toString(36).substring(2, 10);
    const randomCls = 'wm_layer_' + Math.random().toString(36).substring(2, 8);
    container.id = randomId;
    container.className = randomCls;
    container.setAttribute('data-watermark', '1');
    SECURITY.getWatermark = () => watermarkEl;

    container.style.cssText = [
      'position: fixed !important',
      `top: ${targetRect.top}px !important`,
      `left: ${targetRect.left}px !important`,
      `width: ${targetRect.width}px !important`,
      `height: ${targetRect.height}px !important`,
      'z-index: 9999999 !important',
      'pointer-events: none !important',
      'user-select: none !important',
      '-webkit-user-select: none !important',
      'overflow: hidden !important',
      'display: block !important',
      'visibility: visible !important',
      'opacity: 1 !important',
      'margin: 0 !important',
      'padding: 0 !important',
      'background: transparent !important',
      'border: none !important',
    ].join(';');

    const colWidth = 260;
    const rowHeight = 110;
    const shiftOdd = 120;
    const w = targetRect.width;
    const h = targetRect.height;

    const fragment = document.createDocumentFragment();
    let count = 0;

    for (let y = -60; y < h + 100; y += rowHeight) {
      const rowIndex = Math.floor((y + 60) / rowHeight);
      const xOffset = (rowIndex % 2 === 1) ? shiftOdd : 0;
      for (let x = -80; x < w + 150; x += colWidth) {
        const item = document.createElement('span');
        let wmText = mobileNumber;
        if (SECURITY.WATERMARK_SHOW_TIME) {
          const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          wmText = `${mobileNumber} ${ts}`;
        }
        item.textContent = wmText;
        item.style.cssText = [
          'position: absolute !important',
          `left: ${x + xOffset}px !important`,
          `top: ${y}px !important`,
          'transform: rotate(-30deg) !important',
          'transform-origin: center center !important',
          'font-family: Arial, Helvetica, sans-serif !important',
          'font-size: 24px !important',
          'font-weight: 600 !important',
          `color: rgba(0, 0, 0, ${SECURITY.WATERMARK_OPACITY}) !important`,
          'white-space: nowrap !important',
          'pointer-events: none !important',
          'user-select: none !important',
          '-webkit-user-select: none !important',
          'line-height: 1 !important',
          'display: inline-block !important',
          'visibility: visible !important',
        ].join(';');
        fragment.appendChild(item);
        count++;
      }
    }

    expectedItemCount = count;
    container.appendChild(fragment);
    document.body.appendChild(container);
    watermarkEl = container;

    // Attach container observer to detect changes to children or styles
    watermarkObserver = new MutationObserver(() => {
      onWatermarkTamper();
    });
    watermarkObserver.observe(container, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true,
    });

    isBuilding = false;
  }

  function onWatermarkTamper() {
    if (isBuilding) return;
    integrity.tamperEvents++;
    saveIntegrity();
    showSecurityWarning(`⚠️ Watermark integrity violation detected! (Count: ${integrity.tamperEvents}).`);
    checkAutoSubmit();
    setTimeout(() => {
      buildWatermark();
    }, 50);
  }

  function checkWatermarkIntegrity() {
    if (!SECURITY.WATERMARK_ENABLED) return;
    if (isBuilding) return;

    const targetRect = getWatermarkTargetRect();
    if (!targetRect) return;

    const mobileNumber = getCandidateMobile();
    let failed = false;

    if (!watermarkEl || !document.body.contains(watermarkEl)) {
      failed = true;
    } else {
      const cs = window.getComputedStyle(watermarkEl);
      if (cs.display === 'none' || cs.visibility !== 'visible') {
        failed = true;
      }
      const op = parseFloat(cs.opacity);
      if (isNaN(op) || op < 0.5) {
        failed = true;
      }
      if (watermarkEl.children.length !== expectedItemCount) {
        failed = true;
      }
      if (Math.abs(watermarkEl.offsetWidth - targetRect.width) > 30 || Math.abs(watermarkEl.offsetHeight - targetRect.height) > 30) {
        buildWatermark();
        return;
      }
      // Spot check first and last child text
      if (watermarkEl.children.length > 0) {
        const first = watermarkEl.children[0];
        const last = watermarkEl.children[watermarkEl.children.length - 1];
        if (!first.textContent.startsWith(mobileNumber) || !last.textContent.startsWith(mobileNumber)) {
          failed = true;
        }
      }
    }

    if (failed) {
      onWatermarkTamper();
    }
  }

  let resizeObserver = null;
  function setupWatermarkWatchdog() {
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        buildWatermark();
      }, 100);
    };

    // Body observer to detect if the container is removed or class toggles
    if (!bodyObserver) {
      bodyObserver = new MutationObserver(mutations => {
        if (isBuilding) return;
        for (const m of mutations) {
          if (m.type === 'childList') {
            for (const r of m.removedNodes) {
              if (r === watermarkEl) {
                onWatermarkTamper();
                return;
              }
            }
          } else if (m.type === 'attributes') {
            if (m.target === document.body && (m.attributeName === 'class' || m.attributeName === 'className')) {
              onResize();
            }
          }
        }
      });
      bodyObserver.observe(document.body, { childList: true, attributes: true, attributeFilter: ['class'] });
    }

    // Modal observer for #modal-qpaper open/close
    const qpModal = document.getElementById('modal-qpaper');
    if (qpModal) {
      const qpObserver = new MutationObserver(() => {
        onResize();
      });
      qpObserver.observe(qpModal, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    // ResizeObserver on question containers
    if (window.ResizeObserver && !resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        onResize();
      });
      const elOuter = document.getElementById('quesOuterDiv');
      if (elOuter) resizeObserver.observe(elOuter);
      const elCurr = document.getElementById('currentQues');
      if (elCurr) resizeObserver.observe(elCurr);
      const elQp = document.getElementById('modal-qpaper-body');
      if (elQp) resizeObserver.observe(elQp);
    }

    // 1.5s interval integrity check
    if (!integrityTimer) {
      integrityTimer = setInterval(checkWatermarkIntegrity, 1500);
    }

    // Debounced resize & orientation handling
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('fullscreenchange', onResize);
  }

  // ── Keyboard & Shortcut Security ──────────────────────────────────────────
  function setupKeyboardBlocker() {
    window.addEventListener('keydown', e => {
      if (!SECURITY.BLOCK_SHORTCUTS) return;
      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // DevTools: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      const isDevTools = key === 'F12' || (ctrl && shift && ['I', 'i', 'J', 'j', 'C', 'c'].includes(key));
      // View Source / Save: Ctrl+U, Ctrl+S
      const isViewOrSave = ctrl && ['u', 'U', 's', 'S'].includes(key);
      // Print: Ctrl+P
      const isPrint = ctrl && ['p', 'P'].includes(key);

      if (isDevTools || isViewOrSave || isPrint) {
        e.preventDefault();
        e.stopPropagation();
        integrity.blockedKeyAttempts++;
        saveIntegrity();
        showSecurityWarning('⚠️ Keyboard shortcut is disabled during the examination.');
        checkAutoSubmit();
        return false;
      }
    }, true);
  }

  // ── Clipboard, Context Menu & Drag Blocking ───────────────────────────────
  function setupClipboardBlocker() {
    if (SECURITY.BLOCK_CONTEXT_MENU) {
      document.addEventListener('contextmenu', e => {
        e.preventDefault();
        showSecurityWarning('⚠️ Right-click context menu is disabled.');
      }, true);
    }

    if (SECURITY.BLOCK_CLIPBOARD) {
      ['copy', 'cut', 'paste'].forEach(evt => {
        document.addEventListener(evt, e => {
          e.preventDefault();
          showSecurityWarning(`⚠️ ${evt.toUpperCase()} action is disabled during the examination.`);
        }, true);
      });
    }

    if (SECURITY.BLOCK_DRAG) {
      document.addEventListener('dragstart', e => {
        e.preventDefault();
      }, true);
    }

    // Inject print block CSS
    const printStyle = document.createElement('style');
    printStyle.id = 'bmt-print-block-style';
    printStyle.textContent = '@media print { body { display: none !important; } }';
    document.head.appendChild(printStyle);

    window.addEventListener('beforeprint', () => {
      showSecurityWarning('⚠️ Printing is disabled during the examination.');
    });
  }

  // ── Tab Switch & Window Blur Tracking ─────────────────────────────────────
  function setupTabTracking() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && SECURITY.TRACK_TAB_SWITCHES) {
        integrity.tabSwitches++;
        saveIntegrity();
        showSecurityWarning(`⚠️ Tab switch detected! (Count: ${integrity.tabSwitches}). All tab switches are logged.`);
        checkAutoSubmit();
      }
    });

    window.addEventListener('blur', () => {
      if (SECURITY.TRACK_WINDOW_BLUR && !document.hidden) {
        integrity.tabSwitches++;
        saveIntegrity();
        showSecurityWarning(`⚠️ Focus lost from examination window! (Count: ${integrity.tabSwitches}).`);
        checkAutoSubmit();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && SECURITY.TRACK_FULLSCREEN_EXITS) {
        // Only count if exam is active and fullscreen warning was not already dismissed
        const screenExam = document.getElementById('screen-exam');
        if (screenExam && screenExam.style.display !== 'none') {
          integrity.fullscreenExits++;
          saveIntegrity();
          showSecurityWarning(`⚠️ Fullscreen exit detected! (Count: ${integrity.fullscreenExits}). Please return to fullscreen.`);
          checkAutoSubmit();
        }
      }
    });
  }

  // ── Back Button Lock ──────────────────────────────────────────────────────
  function setupBackButtonLock() {
    if (!SECURITY.PREVENT_BACK_BUTTON) return;
    try {
      history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', () => {
        history.pushState(null, '', window.location.href);
        showSecurityWarning('⚠️ Navigating away is not permitted. Please submit your test to exit.');
      });
    } catch(e) {}
  }

  // ── Single Active Exam Tab Lock (C3.1) ────────────────────────────────────
  const LOCK_KEY = 'bmt_exam_active_tab_lock';
  const STALE_TIMEOUT_MS = 10000; // 10 seconds stale heartbeat expiry

  function getSessionTabId() {
    try {
      let tid = sessionStorage.getItem('bmt_tab_id');
      if (!tid) {
        tid = 'tab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('bmt_tab_id', tid);
      }
      return tid;
    } catch(e) {
      return 'tab_' + Date.now();
    }
  }

  let singleTabHeartbeat = null;

  function verifyTabLock(currentTabId) {
    const now = Date.now();
    try {
      const raw = localStorage.getItem(LOCK_KEY);
      if (raw) {
        const lock = JSON.parse(raw);
        // Same tab refreshed -> Allowed! (Never block self on reload)
        if (lock.tabId === currentTabId) {
          localStorage.setItem(LOCK_KEY, JSON.stringify({ tabId: currentTabId, heartbeat: now }));
          return { allowed: true, reason: 'same_tab_refresh' };
        }
        // Older than 10 seconds (crashed or closed tab) -> Stale lock expired, claim it!
        if (now - lock.heartbeat > STALE_TIMEOUT_MS) {
          localStorage.setItem(LOCK_KEY, JSON.stringify({ tabId: currentTabId, heartbeat: now }));
          return { allowed: true, reason: 'stale_lock_expired' };
        }
        // Fresh lock belonging to another active tab
        return { allowed: false, reason: 'active_other_tab', lock };
      }
      // No active lock -> Claim initial lock
      localStorage.setItem(LOCK_KEY, JSON.stringify({ tabId: currentTabId, heartbeat: now }));
      return { allowed: true, reason: 'initial_lock_acquired' };
    } catch(e) {
      return { allowed: true, reason: 'error_fallback' };
    }
  }

  function setupSingleTabEnforcement() {
    if (!SECURITY.PREVENT_MULTI_TAB) return;
    const isTest = new URLSearchParams(window.location.search).get('test') === '1';
    const tabId = getSessionTabId();

    const lockStatus = verifyTabLock(tabId);
    if (!lockStatus.allowed && !isTest) {
      showMultiTabBlockOverlay();
      return;
    }

    // Refresh heartbeat every 2.5s to keep lock valid
    if (singleTabHeartbeat) clearInterval(singleTabHeartbeat);
    singleTabHeartbeat = setInterval(() => {
      try {
        const raw = localStorage.getItem(LOCK_KEY);
        if (raw) {
          const lock = JSON.parse(raw);
          if (lock.tabId === tabId) {
            localStorage.setItem(LOCK_KEY, JSON.stringify({ tabId, heartbeat: Date.now() }));
          }
        }
      } catch(e) {}
    }, 2500);

    // Clean up lock when tab closes gracefully
    window.addEventListener('beforeunload', () => {
      clearInterval(singleTabHeartbeat);
      try {
        const raw = localStorage.getItem(LOCK_KEY);
        if (raw && JSON.parse(raw).tabId === tabId) {
          localStorage.removeItem(LOCK_KEY);
        }
      } catch(e) {}
    });

    // Real-time broadcast channel detection
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('bmt_exam_single_tab_channel');
      channel.postMessage({ type: 'PING', tabId });

      channel.onmessage = e => {
        if (!e.data) return;
        if (e.data.type === 'PING' && e.data.tabId !== tabId) {
          try {
            const raw = localStorage.getItem(LOCK_KEY);
            if (raw && JSON.parse(raw).tabId === tabId) {
              channel.postMessage({ type: 'PONG', tabId });
            }
          } catch(err) {}
        } else if (e.data.type === 'PONG' && e.data.tabId !== tabId) {
          if (!isTest) showMultiTabBlockOverlay();
        }
      };
    }
  }

  function showMultiTabBlockOverlay() {
    let overlay = document.getElementById('bmt-multi-tab-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bmt-multi-tab-overlay';
      overlay.style.cssText = [
        'position: fixed !important',
        'top: 0 !important',
        'left: 0 !important',
        'width: 100vw !important',
        'height: 100vh !important',
        'background: rgba(15, 23, 42, 0.96) !important',
        'z-index: 100000000 !important',
        'display: flex !important',
        'align-items: center !important',
        'justify-content: center !important',
        'color: #ffffff !important',
        'font-family: Arial, sans-serif !important',
        'text-align: center !important',
        'padding: 20px !important',
        'box-sizing: border-box !important',
      ].join(';');

      overlay.innerHTML = `
        <div style="max-width: 500px; background: #1e293b; padding: 30px; border-radius: 8px; border: 1px solid #ef4444; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <div style="font-size: 40px; margin-bottom: 15px;">🚫</div>
          <h2 style="color: #ef4444; font-size: 20px; margin-bottom: 12px; font-weight: bold;">Exam Already Open</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 20px;">
            The examination is already active in another window or tab. Multiple active tabs are strictly prohibited for exam integrity.
          </p>
          <p style="font-size: 13px; color: #94a3b8;">
            Please close this tab and continue in your original examination window.
          </p>
        </div>
      `;
      document.body.appendChild(overlay);
    }
  }

  // ── D2: Desktop Wheel & Scroll Key Lock with Red Banner ───────────────────
  let scrollBannerTimer = null;
  function showScrollDisabledBanner() {
    const banner = document.getElementById('scroll-warning-banner');
    if (!banner) return;
    banner.style.display = 'block';
    clearTimeout(scrollBannerTimer);
    scrollBannerTimer = setTimeout(() => {
      banner.style.display = 'none';
    }, 2000);
  }

  function isExamScreenActive() {
    // Only active during actual exam, not landing, instructions, declaration, result, or analyse
    if (typeof window !== 'undefined' && window.ANALYSE_MODE) return false;
    if (window.location.search.includes('mode=analyse')) return false;
    if (window.location.pathname.includes('analyse.html')) return false;
    const examScreen = document.getElementById('screen-exam');
    if (!examScreen) return false;
    const style = window.getComputedStyle(examScreen);
    return style.display !== 'none';
  }

  function isInsideScrollableModal(el) {
    if (!el || !el.closest) return false;
    return !!(
      el.closest('#modal-instructions-body') ||
      el.closest('#modal-qpaper-body') ||
      el.closest('.bmt-modal-box') ||
      el.closest('.bmt-modal-body') ||
      el.closest('.pop-up-content') ||
      el.closest('.pop-up-body') ||
      el.closest('.pop-up')
    );
  }

  function setupWheelScrollLock() {
    // Desktop only: screen width > 900px
    window.addEventListener('wheel', function onExamWheel(e) {
      if (!SECURITY.LOCK_WHEEL_SCROLL) return;
      if (window.innerWidth <= 900) return; // Touch screens allow panel touch scrolling
      if (!isExamScreenActive()) return;

      if (isInsideScrollableModal(e.target)) {
        return; // Instructions and Question Paper modal body are exempt
      }

      e.preventDefault();
      showScrollDisabledBanner();
    }, { passive: false });

    // Block middle-click autoscroll
    window.addEventListener('mousedown', function onExamMiddleMouseDown(e) {
      if (!SECURITY.LOCK_WHEEL_SCROLL) return;
      if (window.innerWidth <= 900) return;
      if (!isExamScreenActive()) return;
      if (isInsideScrollableModal(e.target)) return;

      if (e.button === 1) { // Middle click
        e.preventDefault();
        showScrollDisabledBanner();
      }
    }, { passive: false });

    // Scroll-key lock: Space, PageUp, PageDown, Home, End
    const scrollKeys = ['Space', ' ', 'PageUp', 'PageDown', 'Home', 'End'];
    window.addEventListener('keydown', function onExamScrollKey(e) {
      if (!SECURITY.LOCK_WHEEL_SCROLL) return;
      if (window.innerWidth <= 900) return;
      if (!isExamScreenActive()) return;
      if (isInsideScrollableModal(e.target)) return;

      const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (scrollKeys.includes(e.key) || scrollKeys.includes(e.code)) {
        e.preventDefault();
        showScrollDisabledBanner();
      }
    }, { passive: false });
  }

  // ── Lifecycle Initialization ──────────────────────────────────────────────
  function initSecurity() {
    loadIntegrity();
    buildWatermark();
    setupWatermarkWatchdog();
    setupKeyboardBlocker();
    setupClipboardBlocker();
    setupTabTracking();
    setupBackButtonLock();
    setupSingleTabEnforcement();
    setupWheelScrollLock();
  }

  // In exam.html: only start security when #screen-exam is visible
  function startWhenExamScreenActive() {
    const isAnalyse = window.ANALYSE_MODE === true || window.location.pathname.includes('analyse.html') || window.location.search.includes('mode=analyse');
    if (isAnalyse) {
      loadIntegrity();
      buildWatermark();
      setupWatermarkWatchdog();
      document.body.classList.add('exam-selection-locked');
      return;
    }

    const screenExam = document.getElementById('screen-exam');
    if (screenExam && screenExam.style.display !== 'none') {
      initSecurity();
      return;
    }

    // Observe when screen-exam becomes visible
    let started = false;
    const checkStart = () => {
      if (started) return;
      const se = document.getElementById('screen-exam');
      if (se && se.style.display !== 'none') {
        started = true;
        initSecurity();
      }
    };

    // Listen for begin button click
    const btnBegin = document.getElementById('readylink') || document.getElementById('btn-begin');
    if (btnBegin) {
      btnBegin.addEventListener('click', () => {
        setTimeout(checkStart, 500);
      });
    }

    // Mutation observer fallback on screen-exam style
    if (screenExam) {
      const screenObserver = new MutationObserver(() => {
        checkStart();
        if (started) screenObserver.disconnect();
      });
      screenObserver.observe(screenExam, { attributes: true, attributeFilter: ['style', 'class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startWhenExamScreenActive);
  } else {
    startWhenExamScreenActive();
  }

})();
