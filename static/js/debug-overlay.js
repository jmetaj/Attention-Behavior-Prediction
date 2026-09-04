const DEBUG_MODE = false;

(function () {
  if (!DEBUG_MODE) {
    return;
  }

  const state = {
    x: null,
    y: null,
    productId: null,
    category: null,
    eventType: "None",
    mousemoveTimestamps: [],
  };

  const overlay = document.createElement("pre");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText = [
    "position: fixed",
    "top: 12px",
    "right: 12px",
    "z-index: 2147483647",
    "margin: 0",
    "padding: 10px 12px",
    "background: rgba(0, 0, 0, 0.72)",
    "color: #fff",
    "font: 12px/1.5 monospace",
    "white-space: pre",
    "pointer-events: none",
    "border-radius: 4px",
  ].join(";");

  function valueOrNone(value) {
    return value == null || value === "" ? "None" : value;
  }

  function currentMousemoveRate() {
    const currentTime = performance.now();
    state.mousemoveTimestamps = state.mousemoveTimestamps.filter(function (timestamp) {
      return currentTime - timestamp < 1000;
    });
    return state.mousemoveTimestamps.length;
  }

  function updateOverlay() {
    overlay.textContent = [
      "Mouse: (" + valueOrNone(state.x) + ", " + valueOrNone(state.y) + ")",
      "Product: " + valueOrNone(state.productId),
      "Category: " + valueOrNone(state.category),
      "Scroll: " + window.scrollY + "px",
      "Session: " + valueOrNone(window.session_id),
      "Event: " + state.eventType,
      "FPS: " + currentMousemoveRate() + " events/sec",
    ].join("\n");
  }

  function updateHoveredProduct(target) {
    const product = target && target.closest ? target.closest("[data-product-id]") : null;
    state.productId = product ? product.dataset.productId : null;
    state.category = product ? product.dataset.category : null;
  }

  document.addEventListener("mousemove", function (event) {
    const currentTime = performance.now();
    state.mousemoveTimestamps.push(currentTime);
    state.x = event.clientX;
    state.y = event.clientY;
    state.eventType = "mousemove";
    updateHoveredProduct(event.target);
    updateOverlay();
  }, { passive: true });

  document.addEventListener("mouseover", function (event) {
    state.eventType = "mouseover";
    updateHoveredProduct(event.target);
    updateOverlay();
  }, { passive: true });

  window.addEventListener("scroll", function () {
    state.eventType = "scroll";
    updateOverlay();
  }, { passive: true });

  document.body.appendChild(overlay);
  updateOverlay();
  setInterval(updateOverlay, 250);
})();
