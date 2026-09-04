(function () {
  const SEND_INTERVAL_MS = 2000;
  const MOUSEMOVE_THROTTLE_MS = 50;
  const API_BASE =
    window.location.port === "5500" ? "http://127.0.0.1:5000" : "";
  const ENDPOINT = API_BASE + "/api/events";
  const SESSION_STORAGE_KEY = "attention_behavior_session_id";
  // sessionStorage is origin-scoped.  window.name is scoped to the browser
  // tab and survives a document navigation, including one that changes the
  // origin (for example, between the local static server and Flask).
  const SESSION_WINDOW_NAME_PREFIX = "__attention_behavior_session_id__:";

  const sessionId = getOrCreateSessionId();
  const events = [];
  let lastMouseMoveTime = 0;
  let isSending = false;
  let lastMousePosition = { x: null, y: null };

  window.session_id = sessionId;
  window.events = events;

  function createSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "session-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function getOrCreateSessionId() {
    const windowSessionId = getWindowSessionId();
    if (windowSessionId) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, windowSessionId);
      return windowSessionId;
    }

    // A newly opened tab can inherit sessionStorage from its opener.  An
    // absent tab marker therefore means this is a new visit, even if that
    // storage entry exists.
    const newSessionId = createSessionId();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
    setWindowSessionId(newSessionId);
    return newSessionId;
  }

  function getWindowSessionId() {
    const windowName = window.name || "";
    if (!windowName.startsWith(SESSION_WINDOW_NAME_PREFIX)) {
      return null;
    }

    return windowName.slice(SESSION_WINDOW_NAME_PREFIX.length) || null;
  }

  function setWindowSessionId(sessionId) {
    window.name = SESSION_WINDOW_NAME_PREFIX + sessionId;
  }

  function nowTimestamp() {
    return new Date().toISOString();
  }

  function getProductId(target) {
    const product = target.closest("[data-product-id]");
    return product ? product.dataset.productId : null;
  }

  function getCategory(target) {
    const product = target && target.closest ? target.closest("[data-category]") : null;
    return product ? product.dataset.category : null;
  }

  function getMouseDetails(event) {
    if (event && typeof event.clientX === "number") {
      lastMousePosition = { x: event.clientX, y: event.clientY };
    }

    return {
      mouse_x: lastMousePosition.x,
      mouse_y: lastMousePosition.y,
    };
  }

  function describeTarget(target) {
    if (!target) {
      return null;
    }

    const tag = target.tagName ? target.tagName.toLowerCase() : "unknown";
    const id = target.id ? "#" + target.id : "";
    const className =
      typeof target.className === "string" && target.className.trim()
        ? "." + target.className.trim().split(/\s+/).join(".")
        : "";

    return tag + id + className;
  }

  function addEvent(eventData) {
    events.push({
      session_id: sessionId,
      ...eventData,
    });
  }

  function trackMouseMove(event) {
    const currentTime = performance.now();
    if (currentTime - lastMouseMoveTime < MOUSEMOVE_THROTTLE_MS) {
      return;
    }

    lastMouseMoveTime = currentTime;
    addEvent({
      event_type: "mousemove",
      ...getMouseDetails(event),
      x: event.clientX,
      y: event.clientY,
      timestamp: nowTimestamp(),
      product_id: getProductId(event.target),
      category: getCategory(event.target),
      scroll_position: window.scrollY,
    });
  }

  function trackHover(event) {
    const product = event.target.closest && event.target.closest("[data-product-id]");
    if (!product || product.contains(event.relatedTarget)) {
      return;
    }

    addEvent({
      event_type: "hover",
      ...getMouseDetails(event),
      x: event.clientX,
      y: event.clientY,
      timestamp: nowTimestamp(),
      product_id: product.dataset.productId,
      category: product.dataset.category || null,
      scroll_position: window.scrollY,
    });
  }

  function trackClick(event) {
    addEvent({
      event_type: "click",
      ...getMouseDetails(event),
      x: event.clientX,
      y: event.clientY,
      target: describeTarget(event.target),
      timestamp: nowTimestamp(),
      product_id: getProductId(event.target),
      category: getCategory(event.target),
      scroll_position: window.scrollY,
    });
  }

  function trackScroll() {
    addEvent({
      event_type: "scroll",
      ...getMouseDetails(),
      scrollY: window.scrollY,
      scroll_position: window.scrollY,
      timestamp: nowTimestamp(),
      product_id: null,
      category: null,
    });
  }

  async function sendEvents() {
    if (isSending || events.length === 0) {
      return;
    }

    isSending = true;
    const batch = events.splice(0, events.length);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          events: batch,
        }),
        keepalive: true,
      });

      if (!response.ok) {
        events.unshift(...batch);
      }
    } catch (error) {
      events.unshift(...batch);
    } finally {
      isSending = false;
    }
  }

  function flushBeforeUnload() {
    if (events.length === 0) {
      return;
    }

    const batch = events.splice(0, events.length);
    const payload = JSON.stringify({
      session_id: sessionId,
      events: batch,
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      const queued = navigator.sendBeacon(ENDPOINT, blob);
      if (!queued) {
        events.unshift(...batch);
      }
      return;
    }

    fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
      keepalive: true,
    }).catch(function () {
      events.unshift(...batch);
    });
  }

  document.addEventListener("mousemove", trackMouseMove, { passive: true });
  document.addEventListener("mouseover", trackHover, { passive: true });
  document.addEventListener("click", trackClick, { passive: true });
  window.addEventListener("scroll", trackScroll, { passive: true });
  window.addEventListener("beforeunload", flushBeforeUnload);

  setInterval(sendEvents, SEND_INTERVAL_MS);
})();
