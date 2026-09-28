(function () {
  const TASK_STATE_KEY = "attention_behavior_task_state";
  const TASKS = [
    { id: "T01", title: "Εξερεύνηση του e-shop", instruction: "Περιηγήσου για λίγο στο e-shop και εξερεύνησε τα διαθέσιμα προϊόντα και τις κατηγορίες. Δες τι είδους προϊόντα υπάρχουν και εξοικειώσου με την ιστοσελίδα." },
    { id: "T02", title: "Επιλογή laptop", instruction: "Φαντάσου ότι χρειάζεσαι έναν φορητό υπολογιστή για την καθημερινή σου χρήση. Περιηγήσου στα διαθέσιμα laptop και βρες ένα που θα επέλεγες εσύ. Δες τις πληροφορίες του προϊόντος." },
    { id: "T03", title: "Επιλογή ενός προϊόντος τεχνολογίας", instruction: "Φαντάσου ότι θέλεις να αγοράσεις ένα προϊόν τεχνολογίας για τον υπολογιστή σου. Περιηγήσου στις διαθέσιμες κατηγορίες και βρες ένα προϊόν που θα σε ενδιέφερε να αγοράσεις. Εξέτασε τις πληροφορίες του." },
    { id: "T04", title: "Mouse και keyboard", instruction: "Φαντάσου ότι χρειάζεσαι ένα mouse και ένα keyboard για τον υπολογιστή σου. Περιηγήσου στα διαθέσιμα προϊόντα και βρες ένα mouse και ένα keyboard που θα επέλεγες για τη δική σου χρήση." },
    { id: "T05", title: "Σύγκριση δύο laptop", instruction: "Βρες δύο laptop που θα εξέταζες ως πιθανές επιλογές αγοράς. Άνοιξε τις πληροφορίες τους και σύγκρινέ τα. Στο τέλος αποφάσισε ποιο από τα δύο θα προτιμούσες." },
    { id: "T06", title: "Ελεύθερη περιήγηση", instruction: "Τώρα μπορείς να περιηγηθείς ελεύθερα στο e-shop για λίγα λεπτά, σαν να ενδιαφερόσουν πραγματικά να αγοράσεις κάποιο προϊόν. Δες όποιες κατηγορίες και προϊόντα σε ενδιαφέρουν και σταμάτησε όταν θεωρήσεις ότι ολοκλήρωσες την περιήγησή σου." },
  ];

  function getState() {
    try {
      return JSON.parse(sessionStorage.getItem(TASK_STATE_KEY)) || { index: 0, active: false, completed: false };
    } catch (error) {
      return { index: 0, active: false, completed: false };
    }
  }

  function saveState(state) { sessionStorage.setItem(TASK_STATE_KEY, JSON.stringify(state)); }
  function currentTaskId() { const state = getState(); const task = TASKS[state.index]; return state.active && task ? task.id : null; }
  function goToTaskPage() { window.location.href = "/task.html"; }

  function startTask() {
    const state = getState(); const task = TASKS[state.index];
    if (!task || state.completed) return;
    state.active = true; saveState(state);
    window.AttentionTracker.trackEvent({ event_type: "task_start", task_id: task.id, timestamp: new Date().toISOString() });
    window.AttentionTracker.flush().finally(function () { window.location.href = "/"; });
  }

  function finishTask() {
    const state = getState(); const task = TASKS[state.index];
    if (!task || !state.active) return;
    if (task.id === "T05") { finishComparison(); return; }
    window.AttentionTracker.trackEvent({ event_type: "task_end", task_id: task.id, timestamp: new Date().toISOString() });
    state.active = false; state.index += 1; state.completed = state.index >= TASKS.length; saveState(state);
    window.AttentionTracker.flush().finally(goToTaskPage);
  }

  let comparisonDialog = null;
  let decisionSubmitted = false;
  const comparisonApiBase = window.location.port === "5500" ? "http://127.0.0.1:5000" : "";

  async function comparisonEvents() {
    const response = await fetch(comparisonApiBase + "/api/session/" + encodeURIComponent(window.session_id), { cache: "no-store" });
    if (!response.ok) throw new Error("Could not read comparison events");
    const data = await response.json();
    return data.events.filter(function (event) { return event.task_id === "T05"; });
  }

  function comparisonMessage(message) {
    comparisonDialog.querySelector("p").textContent = message;
  }

  function comparisonButton(label, action) {
    const button = document.createElement("button");
    button.className = "task-button";
    button.textContent = label;
    button.addEventListener("click", action);
    comparisonDialog.appendChild(button);
    return button;
  }

  function completeComparison() {
    const state = getState();
    if (currentTaskId() !== "T05") return;
    window.AttentionTracker.trackEvent({ event_type: "task_end", task_id: "T05", timestamp: new Date().toISOString() });
    state.active = false; state.index += 1; state.completed = state.index >= TASKS.length; saveState(state);
    window.AttentionTracker.flush().finally(goToTaskPage);
  }

  async function confirmDecision() {
    // Read back the stored decision before advancing. A retry of this check
    // never queues another decision; the existing tracker owns delivery.
    try {
      await window.AttentionTracker.flush();
      const events = await comparisonEvents();
      if (events.some(function (event) { return event.event_type === "task_decision"; })) {
        completeComparison();
        return;
      }
      comparisonMessage("Η επιλογή σου αποθηκεύεται. Περίμενε χωρίς να κλείσεις τη σελίδα.");
    } catch (error) {
      comparisonMessage("Δεν επιβεβαιώθηκε ακόμη η αποθήκευση. Έλεγξε τη σύνδεση και κράτησε τη σελίδα ανοιχτή.");
    }
    window.setTimeout(confirmDecision, 2000);
  }

  async function finishComparison() {
    if (comparisonDialog) return;
    comparisonDialog = document.createElement("dialog");
    comparisonDialog.className = "task-card";
    comparisonDialog.setAttribute("aria-labelledby", "comparison-title");
    comparisonDialog.innerHTML = '<h1 id="comparison-title">Ποιο από τα δύο laptop θα επέλεγες;</h1><p class="summary" role="status">Έλεγχος των προϊόντων που εξέτασες…</p>';
    comparisonDialog.addEventListener("cancel", function (event) { event.preventDefault(); });
    document.body.appendChild(comparisonDialog);
    comparisonDialog.showModal();
    try {
      // flush() can return while an earlier batch is in flight. Confirm all
      // locally known views in the stored events rather than trusting it.
      const pendingViews = window.events.filter(function (event) {
        return event.task_id === "T05" && event.event_type === "product_view";
      });
      if (comparisonView) pendingViews.push(comparisonView);
      await window.AttentionTracker.flush();
      let events = await comparisonEvents();
      for (let attempt = 0; !pendingViews.every(function (view) {
        return events.some(function (event) {
          return event.event_type === "product_view" && event.product_id === view.product_id &&
            Math.abs(event.timestamp * 1000 - Date.parse(view.timestamp)) < 1;
        });
      }); attempt += 1) {
        if (attempt >= 4) throw new Error("Views not yet stored");
        await new Promise(function (resolve) { window.setTimeout(resolve, 500); });
        await window.AttentionTracker.flush();
        events = await comparisonEvents();
      }
      if (events.some(function (event) { return event.event_type === "task_decision"; })) {
        completeComparison();
        return;
      }
      const response = await fetch(comparisonApiBase + "/data/products.json");
      if (!response.ok) throw new Error("Could not read products");
      const products = await response.json();
      const ids = new Set(events.filter(function (event) {
        return event.event_type === "product_view";
      }).map(function (event) { return event.product_id; }));
      const choices = products.filter(function (product) { return product.category === "laptop" && ids.has(product.id); });
      if (choices.length !== ids.size) throw new Error("Unrecognized viewed product");
      if (choices.length !== 2) {
        comparisonMessage(choices.length < 2
          ? "Για να ολοκληρώσεις την εργασία, πρέπει να εξετάσεις δύο διαφορετικά laptop. Επέστρεψε στο e-shop και άνοιξε τις πληροφορίες τους."
          : "Έχεις εξετάσει περισσότερα από δύο διαφορετικά laptop. Για αυτή την εργασία απαιτούνται ακριβώς δύο. Η ολοκλήρωση σταμάτησε· απευθύνσου στον ερευνητή για να διορθωθεί η διαδικασία.");
        comparisonButton("Επιστροφή στο e-shop", function () { window.location.href = "/"; });
        return;
      }
      comparisonMessage("Επίλεξε το laptop που προτιμάς.");
      choices.forEach(function (product) {
        const button = comparisonButton(product.name, function () {
          if (decisionSubmitted || currentTaskId() !== "T05") return;
          decisionSubmitted = true;
          comparisonDialog.querySelectorAll("button").forEach(function (choice) { choice.disabled = true; });
          window.AttentionTracker.trackEvent({ event_type: "task_decision", task_id: "T05", product_id: product.id, timestamp: new Date().toISOString() });
          comparisonMessage("Η επιλογή σου αποθηκεύεται…");
          confirmDecision();
        });
        button.style.display = "block";
        if (product.image_url) {
          const image = document.createElement("img");
          image.src = product.image_url.charAt(0) === "/" ? comparisonApiBase + product.image_url : product.image_url;
          image.alt = "";
          image.width = 120;
          image.style.display = "block";
          image.addEventListener("error", function () { image.hidden = true; });
          button.prepend(image);
        }
      });
    } catch (error) {
      comparisonMessage("Δεν ήταν δυνατός ο έλεγχος των προϊόντων. Έλεγξε τη σύνδεση και δοκίμασε ξανά.");
      comparisonButton("Δοκιμή ξανά", function () {
        comparisonDialog.close(); comparisonDialog.remove(); comparisonDialog = null;
        finishComparison();
      });
    }
  }

  function generalInstructions() {
    return [
      '<section class="participant-instructions">', '<h2>Γενικές οδηγίες</h2>', "<ul>",
      "<li>Χρησιμοποίησε την ιστοσελίδα όπως θα χρησιμοποιούσες ένα πραγματικό e-shop.</li>",
      "<li>Δεν υπάρχουν σωστές ή λάθος επιλογές προϊόντων.</li>",
      "<li>Μην προσπαθείς να κάνεις συγκεκριμένες κινήσεις με το mouse.</li>",
      "<li>Χρησιμοποίησε το mouse με τον φυσικό τρόπο που το χρησιμοποιείς συνήθως.</li>",
      "<li>Είσαι ελεύθερος να επιλέξεις τη διαδρομή που θεωρείς κατάλληλη.</li>",
      "<li>Αν δεν καταλαβαίνεις κάποια οδηγία, μπορείς να ρωτήσεις τον ερευνητή.</li>",
      "<li>Δεν απαιτούνται ειδικές γνώσεις σχετικά με υπολογιστές ή τεχνολογία.</li>",
      "</ul>", "</section>",
    ].join("");
  }

  function renderTaskPage() {
    const container = document.getElementById("task-interface");
    if (!container) return;
    const state = getState();
    if (state.completed) {
      container.innerHTML = '<p class="eyebrow">Το πείραμα ολοκληρώθηκε</p><h1>Ευχαριστούμε</h1><p class="summary">Έχεις ολοκληρώσει όλες τις εργασίες.</p>';
      return;
    }
    const task = TASKS[state.index];
    container.innerHTML = [
      '<p class="eyebrow">Εργασία ' + (state.index + 1) + " από " + TASKS.length + "</p>",
      "<h1>" + task.title + "</h1>", '<p class="summary">' + task.instruction + "</p>",
      state.index === 0 && !state.active ? generalInstructions() : "",
      state.active
        ? '<p class="task-status">Η εργασία είναι σε εξέλιξη</p><button class="task-button" id="finish-task">Ολοκλήρωση εργασίας</button>'
        : '<button class="task-button" id="start-task">Έναρξη εργασίας</button>',
    ].join("");
    const startButton = document.getElementById("start-task");
    const finishButton = document.getElementById("finish-task");
    if (startButton) startButton.addEventListener("click", startTask);
    if (finishButton) finishButton.addEventListener("click", finishTask);
  }

  function addActiveTaskPanel() {
    if (document.getElementById("task-interface") || !currentTaskId()) return;
    const state = getState(); const panel = document.createElement("aside");
    panel.className = "active-task-panel";
    panel.innerHTML = "<span>Εργασία " + (state.index + 1) + " από " + TASKS.length + " σε εξέλιξη</span><button id=\"finish-task\">Ολοκλήρωση εργασίας</button>";
    document.body.appendChild(panel);
    document.getElementById("finish-task").addEventListener("click", finishTask);
  }

  window.AttentionTasks = { getCurrentTaskId: currentTaskId };
  // product.js has already rendered the detail page before this script runs.
  // List cards never count as visits, even if they receive clicks or hovers.
  let comparisonView = null;
  const detail = document.getElementById("product-detail");
  const laptop = detail && (window.PRODUCTS || []).find(function (product) {
    return product.id && product.id === detail.dataset.productId && product.category === "laptop";
  });
  function recordComparisonView() {
    if (currentTaskId() !== "T05" || !laptop) return;
    comparisonView = { event_type: "product_view", task_id: "T05", product_id: laptop.id, timestamp: new Date().toISOString() };
    window.AttentionTracker.trackEvent(comparisonView);
    window.AttentionTracker.flush();
  }
  recordComparisonView();
  // Back/forward cache restores are new visits without another script load.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) recordComparisonView();
  });
  const state = getState();
  if (!document.getElementById("task-interface") && !state.active) { window.location.replace("/task.html"); return; }
  renderTaskPage(); addActiveTaskPanel();
})();
