/**
 * Accessibility-first, nonmodal judge guide for the isolated sandbox.
 * This function is serialized and served to browsers by demo/worker/index.js.
 * No real payment, campaign mutation, or artificial acceptance is initiated.
 */
export function judgeTourClient() {
  "use strict";

  if (window.__ifundJudgeGuideInitialized || location.pathname.startsWith("/embed/")) return;
  window.__ifundJudgeGuideInitialized = true;

  const STORAGE = "ifund:judge-walkthrough:v3";
  const steps = [
    {
      path: "/hackathon", title: "Your judge walkthrough",
      instruction: "Start with the real campaign wizard. The tour follows the same controls judges will use. All people, causes and amounts in this environment are fictional.",
      target: ".feature-grid.walkthrough article:first-child a",
      next: "Open the campaign wizard"
    },
    {
      path: "/create", title: "Build a fictional campaign",
      instruction: "Describe an invented cause, then explore the AI-assisted titles, descriptions and editable story. The wizard saves only to this isolated demo after sign-in.",
      target: ".wizard textarea, .wizard input, .wizard .steps button:first-child, main form textarea, main .panel input",
      next: "Explore campaigns"
    },
    {
      path: "/discover", title: "Choose a campaign",
      instruction: "Browse the fictional campaign cards. The highlighted campaign opens its details, where you can inspect sharing and a sandbox-only donation.",
      target: ".campaign-grid a.campaign-card:first-child, .campaign-grid .campaign-card:first-child, .toolbar .search",
      next: "Open highlighted campaign"
    },
    {
      path: "/campaign/", prefix: true, title: "Inspect the donation panel",
      instruction: "Review the campaign and the clearly labeled sandbox payment control. Click Donate when ready; a separate demo account may be required. No real payment is made.",
      target: ".donation-panel a, .donation-panel button, .donation-panel",
      next: "I will use the highlighted control"
    },
    {
      path: "/checkout", title: "Verify a sandbox payment",
      instruction: "Choose an amount and approve with a PayPal Personal sandbox buyer, not the merchant account. A real PayPal sandbox capture, not approval alone, creates a receipt. You may skip payment to inspect the rest.",
      target: ".checkout .amounts button:first-child, .checkout input, .checkout button",
      next: "Inspect financial receipts"
    },
    {
      path: "/dashboard", title: "Review trusted records",
      instruction: "The donor and organizer views show only recorded sandbox transactions. If no successful sandbox capture exists, the receipt history must remain empty.",
      target: ".tabs button:first-child, .stats article:first-child, .transaction:first-child, main .panel:first-of-type",
      next: "Visit Atlas"
    },
    {
      path: "/map", title: "Explore the Atlas",
      instruction: "Inspect synthetic campaign locations and discovery. This is a fictional sandbox map, not live donor or geographic evidence.",
      target: ".atlas .map-scroll, .atlas svg, .atlas, .map-scroll",
      next: "Finish walkthrough"
    }
  ];

  function readSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORAGE) || "{}");
      return {
        active: value.active === true,
        seen: value.seen === true,
        step: Number.isInteger(value.step) ? Math.max(0, Math.min(steps.length - 1, value.step)) : 0
      };
    } catch {
      return { active: false, seen: false, step: 0 };
    }
  }
  let state = readSession();
  let target = null;
  let lastPath = location.pathname;
  let raf = 0;
  let scrollOnStep = true;
  let observer;
  let initialized = false;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function save() {
    try { sessionStorage.setItem(STORAGE, JSON.stringify(state)); } catch { /* private storage disabled */ }
  }
  function inRoute(step, pathname) {
    return step.prefix ? pathname.startsWith(step.path) : pathname === step.path;
  }
  function findTarget(selectors) {
    if (!selectors) return null;
    for (const selector of selectors.split(",")) {
      const node = document.querySelector(selector.trim());
      if (!node || node.closest("#ifund-judge-guide")) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width > 5 && rect.height > 5 && getComputedStyle(node).visibility !== "hidden") return node;
    }
    return null;
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const launcher = element("button", "ifund-guide-launch", "✦ Judge guide");
  launcher.type = "button";
  launcher.id = "ifund-judge-launch";
  launcher.setAttribute("aria-label", "Open the guided sandbox walkthrough");
  launcher.addEventListener("click", () => start(false));

  const spotlight = element("div", "ifund-guide-spotlight");
  spotlight.id = "ifund-judge-spotlight";
  spotlight.setAttribute("aria-hidden", "true");

  const panel = element("section", "ifund-guide-panel");
  panel.id = "ifund-judge-guide";
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Judge walkthrough instructions");
  const eyebrow = element("div", "ifund-guide-eyebrow");
  const heading = element("h2", "ifund-guide-heading");
  const description = element("p", "ifund-guide-description");
  const status = element("p", "ifund-guide-status");
  status.setAttribute("aria-live", "polite");
  const progress = element("div", "ifund-guide-progress");
  progress.setAttribute("aria-label", "Walkthrough progress");
  const actions = element("div", "ifund-guide-actions");
  const back = element("button", "ifund-guide-secondary", "Back");
  const next = element("button", "ifund-guide-primary", "Continue");
  const close = element("button", "ifund-guide-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss judge guide");
  back.type = "button";
  next.type = "button";
  actions.append(back, next);
  panel.append(close, eyebrow, heading, description, status, progress, actions);

  function stop() {
    state.active = false;
    state.seen = true;
    save();
    panel.hidden = true;
    spotlight.hidden = true;
    launcher.hidden = false;
    target = null;
  }
  function start(restart) {
    state.active = true;
    state.seen = true;
    state.step = restart ? 0 : state.step;
    if (!inRoute(steps[state.step], location.pathname)) {
      const matching = steps.findIndex(s => inRoute(s, location.pathname));
      state.step = matching >= 0 ? matching : 0;
    }
    save();
    panel.hidden = false;
    launcher.hidden = true;
    scrollOnStep = true;
    render();
  }

  close.addEventListener("click", stop);
  back.addEventListener("click", () => {
    state.step = Math.max(0, state.step - 1);
    save();
    scrollOnStep = true;
    navigate(steps[state.step].path);
  });

  function navigate(path) {
    // This guide never calls provider, ledger, account or AI APIs.
    // Navigation uses the actual sandbox routes and leaves payment approval to the judge.
    window.location.assign(path);
  }
  next.addEventListener("click", () => {
    if (state.step === steps.length - 1) {
      stop();
      return;
    }
    const upcoming = state.step + 1;
    if (steps[upcoming].prefix) {
      const link = findTarget(".campaign-grid a.campaign-card:first-child, .campaign-grid a.campaign-card, .campaign-card[href]");
      if (link && link.matches("a[href]")) {
        state.step = upcoming;
        save();
        link.click();
      } else {
        status.textContent = "Select a fictional campaign card to continue. The guide will follow you.";
      }
      return;
    }
    if (state.step === 3) {
      status.textContent = "Click the highlighted Donate control yourself. The guide follows the checkout, and no payment will be initiated automatically.";
      const clickable = target?.closest("a[href], button") || target?.querySelector?.("a[href], button");
      clickable?.focus({preventScroll:true});
      return;
    }
    state.step = upcoming;
    save();
    navigate(steps[upcoming].path);
  });

  function setStage(index) {
    if (state.step === index) return;
    state.step = index;
    save();
    scrollOnStep = true;
  }

  // Non-overlap is a hard rule, not a z-index suggestion. A candidate position
  // is accepted only when the measured card rectangle does NOT intersect
  // the spotlight rectangle (with 10px padding).
  function intersects(a, b, padding) {
    return a.left < b.right + padding && a.right > b.left - padding &&
      a.top < b.bottom + padding && a.bottom > b.top - padding;
  }
  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }
  function safePosition(rect, width, height, viewportWidth, viewportHeight) {
    const margin = 14;
    const gap = 20;
    const availableWidth = viewportWidth - margin * 2;
    const availableHeight = viewportHeight - margin * 2;
    if (width > availableWidth || height > availableHeight) return null;
    const candidates = [
      {left: rect.right + gap, top: clamp(rect.top, margin, viewportHeight - height - margin)},
      {left: rect.left - width - gap, top: clamp(rect.top, margin, viewportHeight - height - margin)},
      {left: clamp(rect.left, margin, viewportWidth - width - margin), top: rect.bottom + gap},
      {left: clamp(rect.left, margin, viewportWidth - width - margin), top: rect.top - height - gap}
    ];
    return candidates.find(candidate => {
      const r = {left:candidate.left, top:candidate.top, right:candidate.left+width, bottom:candidate.top+height};
      return r.left >= margin && r.top >= margin &&
        r.right <= viewportWidth - margin && r.bottom <= viewportHeight - margin &&
        !intersects(r, rect, 10);
    }) || null;
  }

  function position() {
    raf = 0;
    if (!state.active || panel.hidden) return;
    target = findTarget(steps[state.step].target);
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const maxCardWidth = Math.min(348, vw - 28);
    panel.style.width = maxCardWidth + "px";
    panel.classList.remove("ifund-guide-condensed");
    panel.hidden = false;

    if (!target) {
      spotlight.hidden = true;
      panel.style.left = "14px";
      panel.style.top = "max(14px, env(safe-area-inset-top))";
      status.textContent = location.pathname === "/login"
        ? "Sign in with your separate demo account, then continue. Never use your production password."
        : "The highlighted control is not available on this screen. Use the page normally or continue to the next step.";
      return;
    }
    const r = target.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) {
      spotlight.hidden = true;
      panel.style.left = "14px";
      panel.style.top = "14px";
      return;
    }
    const highlight = {
      left: clamp(r.left, 0, vw), top: clamp(r.top, 0, vh),
      right: clamp(r.right, 0, vw), bottom: clamp(r.bottom, 0, vh)
    };
    spotlight.hidden = false;
    spotlight.style.left = (highlight.left - 4) + "px";
    spotlight.style.top = (highlight.top - 4) + "px";
    spotlight.style.width = (highlight.right - highlight.left + 8) + "px";
    spotlight.style.height = (highlight.bottom - highlight.top + 8) + "px";
    const width = panel.getBoundingClientRect().width;
    let height = panel.getBoundingClientRect().height;
    let candidate = safePosition(highlight, width, height, vw, vh);
    if (!candidate) {
      panel.classList.add("ifund-guide-condensed");
      height = panel.getBoundingClientRect().height;
      candidate = safePosition(highlight, width, height, vw, vh);
    }
    if (candidate) {
      panel.hidden = false;
      panel.style.left = Math.round(candidate.left) + "px";
      panel.style.top = Math.round(candidate.top) + "px";
      status.textContent = "";
    } else {
      // On a tiny viewport or unusually large target, never cover the item.
      // Collapse to the small "Judge guide" launcher until a safe position
      // exists (e.g. after scrolling, resizing or rotating).
      panel.hidden = true;
      spotlight.hidden = true;
      launcher.hidden = false;
      launcher.textContent = "✦ Guide " + (state.step+1) + "/" + steps.length;
      const centerY = (highlight.top + highlight.bottom) / 2;
      launcher.classList.toggle("ifund-guide-top", centerY > vh / 2);
      status.textContent = "Guide minimized to keep the highlighted control usable.";
    }
  }
  function schedulePosition() {
    if (!raf) raf = window.requestAnimationFrame(position);
  }
  function render() {
    if (!state.active) return;
    const pathname = location.pathname;
    if (!inRoute(steps[state.step], pathname)) {
      // Allow natural navigation (campaign selection, payment checkout, login).
      const matching = steps.findIndex((step, index) =>
        index >= state.step && inRoute(step, pathname));
      if (matching >= 0) setStage(matching);
      else if (pathname !== "/login") {
        panel.hidden = true;
        spotlight.hidden = true;
        launcher.hidden = false;
        return;
      }
    }
    const step = steps[state.step];
    launcher.hidden = true;
    panel.hidden = false;
    eyebrow.textContent = "IFUND  /  SANDBOX  /  STEP " + (state.step+1) + " OF " + steps.length;
    heading.textContent = pathname === "/login" ? "Sign in to continue" : step.title;
    description.textContent = pathname === "/login"
      ? "This demo uses separate, fictional accounts. Complete sign-in and return to the highlighted action. No real payments or production credentials."
      : step.instruction;
    next.textContent = state.step === steps.length - 1 ? "Finish tour" : step.next;
    back.disabled = state.step === 0;
    progress.replaceChildren();
    for (let i = 0; i < steps.length; i++) {
      const segment = element("span", i <= state.step ? "is-active" : "");
      progress.append(segment);
    }
    target = pathname === "/login"
      ? findTarget('form input[autocomplete="username"]')
      : findTarget(step.target);
    if (scrollOnStep && target) {
      scrollOnStep = false;
      target.scrollIntoView({block:"center", inline:"nearest", behavior:reduceMotion ? "instant" : "smooth"});
    }
    schedulePosition();
  }

  function checkRoute() {
    if (lastPath !== location.pathname) {
      lastPath = location.pathname;
      scrollOnStep = true;
      render();
    } else if (state.active) schedulePosition();
  }

  function boot() {
    if (initialized) return;
    initialized = true;
    document.body.append(spotlight, panel, launcher);
    spotlight.hidden = true;
    panel.hidden = true;
    if (!state.seen && location.pathname === "/hackathon") {
      state = {active:true, seen:true, step:0};
      save();
    }
    launcher.hidden = state.active;
    if (state.active) render();
    observer = new MutationObserver(checkRoute);
    const appRoot = document.getElementById("root");
    if (appRoot) observer.observe(appRoot, {childList:true, subtree:true});
    window.addEventListener("scroll", schedulePosition, {passive:true});
    window.addEventListener("resize", schedulePosition, {passive:true});
    window.addEventListener("popstate", checkRoute);
    window.addEventListener("pageshow", checkRoute);
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && state.active) stop();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {once:true});
  else boot();

  // Read-only diagnostic surface for verifying spotlight/card collision.
  window.__IFUND_JUDGE_GUIDE_CHECK__ = () => {
    const a = panel.getBoundingClientRect();
    const b = spotlight.getBoundingClientRect();
    return {
      active: state.active, step: state.step+1, panelVisible: !panel.hidden,
      spotlightVisible: !spotlight.hidden,
      overlapsHighlightedItem: !panel.hidden && !spotlight.hidden && intersects(a,b,0)
    };
  };
}
