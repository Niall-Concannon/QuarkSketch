// QuarkSketch — Main Game Script
// Handles all screens and logic for the main menu and drawing canvas

// ─────────────────────────────────────────────────────────────────
// HELPER — builds a DOM element with attributes and children
// ─────────────────────────────────────────────────────────────────
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  }
  return node;
}

// ─────────────────────────────────────────────────────────────────
// SHOW — clears the page and mounts a new screen
// ─────────────────────────────────────────────────────────────────
function show(screen) {
  document.body.innerHTML = "";
  document.body.appendChild(rotateMsg());
  document.body.appendChild(screen);
}

// ─────────────────────────────────────────────────────────────────
// ROTATE MESSAGE — shown via CSS when phone is in portrait mode
// ─────────────────────────────────────────────────────────────────
function rotateMsg() {
  return el("div", { class: "rotate-msg" },
    el("p", {}, "Rotate your device to landscape to play QuarkSketch!"),
  );
}

// ─────────────────────────────────────────────────────────────────
// SETTINGS PANEL — toggled from the main menu
// ─────────────────────────────────────────────────────────────────
function settingsPanel(onClose) {
  const darkInput = el("input", { type: "checkbox" });

  if (document.body.classList.contains("dark")) darkInput.checked = true;

  darkInput.addEventListener("change", () => {
    document.body.classList.toggle("dark", darkInput.checked);
  });

  return el("div", { class: "settings-panel" },
    el("h3", {}, "Settings"),
    el("div", { class: "setting-row" },
      el("span", {}, "Dark Mode"),
      el("label", { class: "toggle" }, darkInput, el("span", { class: "toggle-track" })),
    ),
    el("button", { class: "close-btn", onclick: onClose }, "Close"),
  );
}

// ─────────────────────────────────────────────────────────────────
// COUNTDOWN TIMER
// ─────────────────────────────────────────────────────────────────
function countdownTimer(onDone) {
  const counts = ["3", "2", "1", "Draw!"];
  let i = 0;

  const numDisplay = el("div", { class: "countdown-number" }, counts[0]);

  const screen = el("div", { class: "screen countdown-screen" },
    el("p", { class: "countdown-label" }, "Get ready to draw!"),
    numDisplay,
  );

  const interval = setInterval(() => {
    i++;
    if (i >= counts.length) {
      clearInterval(interval);
      onDone();
      return;
    }
    numDisplay.textContent = counts[i];
    numDisplay.classList.remove("pop");
    void numDisplay.offsetWidth;
    numDisplay.classList.add("pop");
  }, 1000);

  return screen;
}

// ─────────────────────────────────────────────────────────────────
// RESULTS SCREEN — shown after drawing is submitted or time runs out
// ─────────────────────────────────────────────────────────────────
const PLACEHOLDER_COMMENTS = [
  "Hmm… a bold interpretation. Picasso would be confused, but impressed.",
  "Was that drawn with your eyes closed? Either way, we respect the commitment!",
  "Somewhere between 'abstract masterpiece' and 'fever dream'. We love it.",
  "The AI is still processing. It may never recover.",
  "10 out of 10 for effort. The other categories are still being evaluated...",
  "Not bad! Not great either, but definitely not bad.",
  "Your art speaks for itself. Unfortunately, we don't know what it's saying.",
  "A true work of art. The art of chaos, but art nonetheless!",
  "The lines! The curves! The complete disregard for the prompt! Stunning.",
  "We've sent this to the Louvre. They haven't responded yet.",
];

function resultsScreen(drawingData, round) {
  const comment = PLACEHOLDER_COMMENTS[Math.floor(Math.random() * PLACEHOLDER_COMMENTS.length)];

  // Drawing thumbnail
  const thumb = el("img", {
    class: "results-thumb",
    src: drawingData,
    alt: "Your drawing",
  });

  // Speech bubble with comment
  const bubble = el("div", { class: "results-bubble" },
    el("div", { class: "results-bubble-tail" }),
    el("p", { class: "results-comment" }, comment),
  );

  // Mascot + bubble side by side
  const feedback = el("div", { class: "results-feedback" },
    el("div", { class: "results-mascot" }, "🤖"),
    bubble,
  );

  // Action buttons
  const exitBtn = el("button", {
    class: "btn-settings results-btn",
    onclick() { show(mainMenu()); }
  }, "🏠 Exit");

  const nextBtn = el("button", {
    class: "btn-play results-btn",
    onclick() { show(countdownTimer(() => show(drawingScreen(round + 1)))); }
  }, "Next Round →");

  const screen = el("div", { class: "screen results-screen" },
    // Logo at the top
    el("img", { class: "logo-img results-logo", src: "quarksketch_logo.png", alt: "QuarkSketch" }),
    el("div", { class: "results-title-row" },
      el("h2", { class: "results-title" }, "Round Over!"),
      el("div", { class: "round-badge" }, `Round ${round}`),
    ),
    el("div", { class: "results-body" },
      // Left: thumbnail
      el("div", { class: "results-left" },
        el("div", { class: "results-thumb-wrap" },
          thumb,
          el("p", { class: "results-thumb-label" }, "Your Masterpiece"),
        ),
      ),
      // Right: placeholder notice + feedback
      el("div", { class: "results-right" },
        el("div", { class: "results-placeholder-notice" },
          "⚠️ NOT AI — TEMPORARY PLACEHOLDER",
        ),
        feedback,
      ),
    ),
    el("div", { class: "results-actions" },
      exitBtn,
      nextBtn,
    ),
  );

  return screen;
}

// ─────────────────────────────────────────────────────────────────
// DRAWING SCREEN — the main canvas where the player draws
// ─────────────────────────────────────────────────────────────────
function drawingScreen(round = 1) {
  const canvas = el("canvas", { class: "draw-canvas" });
  const ctx = canvas.getContext("2d");

  let timeLeft = 30;
  let timeUp = false;

  const timerBox = el("div", { class: "game-timer" }, `Time Remaining: ${timeLeft}s`);

  let currentColor = "#1a1a2e";
  let erasing = false;
  let undoStack = [];
  let redoStack = [];

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width  = rect.width;
    canvas.height = rect.height;
    ctx.putImageData(snapshot, 0, 0);
    ctx.lineCap  = "round";
    ctx.lineJoin = "round";
  }

  let drawing = false;
  let lastX = 0, lastY = 0;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return [src.clientX - rect.left, src.clientY - rect.top];
  }

  function saveState() {
    undoStack.push(canvas.toDataURL());
    redoStack = [];
  }

  function startDraw(e) {
    if (timeUp) return;
    e.preventDefault();
    drawing = true;
    saveState();
    [lastX, lastY] = getPos(e);
  }

  function draw(e) {
    e.preventDefault();
    if (!drawing) return;
    const [x, y] = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = erasing ? "#ffffff" : currentColor;
    ctx.lineWidth   = erasing ? 20 : 4;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();
    [lastX, lastY] = [x, y];
  }

  function stopDraw(e) {
    e.preventDefault();
    drawing = false;
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(canvas.toDataURL());
    const img = new Image();
    img.src = undoStack.pop();
    img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(canvas.toDataURL());
    const img = new Image();
    img.src = redoStack.pop();
    img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
  }

  // ── End round — capture canvas and go to results ──
  function endRound(reason) {
    if (timeUp) return; // guard against double-trigger
    clearInterval(timerInterval);
    timeUp = true;
    drawing = false;
    submitBtn.disabled = true;

    const drawingData = canvas.toDataURL();

    // Brief flash message, then transition to results
    timerBox.textContent = reason === "submit" ? "Submitted! ✔" : "Time's up!";

    setTimeout(() => {
      window.removeEventListener("resize", resizeCanvas);
      show(resultsScreen(drawingData, round));
    }, 600);
  }

  canvas.addEventListener("mousedown",  startDraw);
  canvas.addEventListener("mousemove",  draw);
  canvas.addEventListener("mouseup",    stopDraw);
  canvas.addEventListener("mouseleave", stopDraw);
  canvas.addEventListener("touchstart",  startDraw, { passive: false });
  canvas.addEventListener("touchmove",   draw,      { passive: false });
  canvas.addEventListener("touchend",    stopDraw,  { passive: false });

  const colorPanel = el("div", { style: "display:none; flex-direction:column; gap:6px;" },
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#1a1a2e"; colorPanel.style.display = "none"; } }, "⚫"),
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#ff4d4d"; colorPanel.style.display = "none"; } }, "🔴"),
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#3b82f6"; colorPanel.style.display = "none"; } }, "🔵"),
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#22c55e"; colorPanel.style.display = "none"; } }, "🟢"),
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#facc15"; colorPanel.style.display = "none"; } }, "🟡"),
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#f97316"; colorPanel.style.display = "none"; } }, "🟠"),
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#a855f7"; colorPanel.style.display = "none"; } }, "🟣"),
  );

  const markerBtn = el("button", {
    class: "tool-btn tool-active",
    title: "Marker",
    onclick() {
      erasing = false;
      markerBtn.classList.add("tool-active");
      eraserBtn.classList.remove("tool-active");
      colorPanel.style.display = colorPanel.style.display === "none" ? "flex" : "none";
    }
  }, "✏️");

  const eraserBtn = el("button", {
    class: "tool-btn",
    title: "Eraser",
    onclick() {
      erasing = true;
      eraserBtn.classList.add("tool-active");
      markerBtn.classList.remove("tool-active");
      colorPanel.style.display = "none";
    }
  }, "🧽");

  const clearBtn = el("button", {
    class: "tool-btn",
    title: "Clear Canvas",
    onclick() {
      if (confirm("Clear the entire canvas?")) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, "🗑️");

  const undoBtn = el("button", { class: "tool-btn", title: "Undo", onclick: undo }, "↶");
  const redoBtn = el("button", { class: "tool-btn", title: "Redo", onclick: redo }, "↷");

  const submitBtn = el("button", {
    class: "submit-btn",
    title: "Submit Drawing",
    onclick() { endRound("submit"); }
  }, "✔ Submit");

  const markerGroup = el("div", { style: "display:flex; flex-direction:column; align-items:center;" },
    markerBtn,
    colorPanel,
  );

  const sidebar = el("div", { class: "tool-sidebar" },
    markerGroup,
    eraserBtn,
    undoBtn,
    redoBtn,
    clearBtn,
  );

  const backBtn = el("button", {
    class: "back-btn",
    onclick() { clearInterval(timerInterval); window.removeEventListener("resize", resizeCanvas); show(mainMenu()); }
  }, "←");

  const screen = el("div", { class: "draw-screen" },
    sidebar,
    el("div", { class: "canvas-wrap" }, canvas),
    timerBox,
    el("div", { class: "round-badge draw-round-badge" }, `Round ${round}`),
    backBtn,
    submitBtn,
  );

  requestAnimationFrame(() => resizeCanvas());
  window.addEventListener("resize", resizeCanvas);

  const timerInterval = setInterval(() => {
    timeLeft--;
    timerBox.textContent = `Time Remaining: ${timeLeft}s`;
    if (timeLeft <= 0) {
      timerBox.textContent = "Time Remaining: 0s";
      endRound("timeout");
    }
  }, 1000);

  return screen;
}

// ─────────────────────────────────────────────────────────────────
// MAIN MENU — first thing the player sees
// ─────────────────────────────────────────────────────────────────
function mainMenu() {
  let settingsOpen = false;
  const settingsSlot = el("div", {});
  var bgmTrack = new Audio(); //music
  bgmTrack.normalize('/QuarkSketch/audio/track1.mp3');
  bgmTrack.volume = 0.2;


  function toggleSettings() {
    settingsOpen = !settingsOpen;
    settingsSlot.innerHTML = "";
    if (settingsOpen) settingsSlot.appendChild(settingsPanel(() => {
      settingsOpen = false;
      settingsSlot.innerHTML = "";
    }));
  }

  return el("div", { class: "screen" },
    el("img", { class: "logo-img", src: "quarksketch_logo.png", alt: "QuarkSketch" }),
    el("div", { class: "btn-group" },
      el("button", { class: "btn-play",     onclick() { show(countdownTimer(() => show(drawingScreen(1)))); } }, "Single Player"),
      el("button", { class: "btn-multi",    onclick() { /* TODO: multiplayer lobby */ } }, "Multiplayer"),
      el("button", { class: "btn-leader",   onclick() { /* TODO: leaderboard screen */ } }, "Leaderboard"),
      el("button", { class: "btn-settings", onclick: toggleSettings }, "Settings"),
    ),
    settingsSlot,
  );
}

// kick everything off
show(mainMenu());

module.exports = {el, show, rotateMsg, settingsPanel, countdownTimer, resultsScreen, drawingScreen, mainMenu};