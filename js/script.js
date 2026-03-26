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
  let paused = false;

  const numDisplay = el("div", { class: "countdown-number" }, counts[0]);
  const pauseMsg = el("div", { class: "countdown-pause-msg" }, "Paused — tap to resume");

  const screen = el("div", {
    class: "screen countdown-screen",
    onclick() {
      paused = !paused;
      pauseMsg.style.display = paused ? "block" : "none";
      numDisplay.style.opacity = paused ? "0.3" : "1";
    }
  },
    el("p", { class: "countdown-label" }, "Get ready to draw!"),
    el("p", { class: "countdown-tap-hint" }, "Tap to pause"),
    numDisplay,
    pauseMsg,
  );

  const interval = setInterval(() => {
    if (paused) return;
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
// ROUND PROMPTS — two-part randomized drawing prompt
// ─────────────────────────────────────────────────────────────────
function getRoundPrompt() {
  if (window.PROMPTS && typeof window.PROMPTS.getRandomPrompt === "function") {
    return window.PROMPTS.getRandomPrompt();
  }

  // Fallback in case prompt file is unavailable.
  return {
    subject: "robot",
    action: "dancing in the rain",
    text: "Draw a robot dancing in the rain"
  };
}

const HISTORY_STORAGE_KEY = "quarkSketchHistory";
const HISTORY_MAX_ENTRIES = 40;

function loadHistoryEntries() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistoryEntry(entry) {
  try {
    const current = loadHistoryEntries();
    current.unshift(entry);
    const trimmed = current.slice(0, HISTORY_MAX_ENTRIES);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage failures so gameplay is never blocked.
  }
}

function clearHistoryEntries() {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // Ignore storage failures so UI remains responsive.
  }
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(totalSeconds) {
  const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(secs / 60);
  const seconds = secs % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function historyScreen() {
  const entries = loadHistoryEntries();

  const list = entries.length > 0
    ? el("div", { class: "history-list" },
        ...entries.map((entry, index) =>
          el("article", { class: "history-card" },
            el("img", {
              class: "history-thumb",
              src: entry.drawingData,
              alt: `Drawing ${index + 1}`,
            }),
            el("div", { class: "history-meta" },
              el("p", { class: "history-prompt" }, entry.promptText || "No prompt saved"),
              el("div", { class: "history-stats" },
                el("span", { class: "history-chip" }, `Date: ${formatDateTime(entry.createdAt)}`),
                el("span", { class: "history-chip" }, `Draw time: ${formatDuration(entry.drawDurationSeconds)}`),
              ),
            ),
          ),
        ),
      )
    : el("div", { class: "history-empty" },
        el("p", {}, "No drawing history yet."),
        el("p", { class: "history-empty-sub" }, "Finish a round and your drawings will appear here."),
      );

  return el("div", { class: "screen history-screen" },
    el("img", { class: "logo-img history-logo", src: "quarksketch_logo.png", alt: "QuarkSketch" }),
    el("div", { class: "history-head" },
      el("h2", { class: "history-title" }, "Drawing History"),
      el("div", { class: "history-controls" },
        el("button", {
          class: "history-clear-btn",
          onclick() {
            if (!entries.length) return;
            if (!confirm("Clear all drawing history?")) return;
            clearHistoryEntries();
            show(historyScreen());
          }
        }, "Clear History"),
        el("button", { class: "btn-settings history-back-btn", onclick() { show(mainMenu()); } }, "Back"),
      ),
    ),
    list,
  );
}

function promptScreen(promptData, onStart) {
  return el("div", { class: "screen prompt-screen" },
    el("div", { class: "prompt-card" },
      el("h2", { class: "prompt-title" }, "Draw This Round!"),
      el("p", { class: "prompt-full" }, promptData.text),
      el("button", { class: "btn-play prompt-start-btn", onclick: onStart }, "Start Drawing"),
    ),
  );
}

function startRound(round = 1) {
  show(countdownTimer(() => {
    const promptData = getRoundPrompt();
    show(promptScreen(promptData, () => show(drawingScreen(round, promptData))));
  }));
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

function resultsScreen(drawingData, round, promptData) {
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
    onclick() { startRound(round + 1); }
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
          el("p", { class: "results-prompt-chip" }, promptData.text),
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
function drawingScreen(round = 1, promptData = getRoundPrompt()) {
  const canvas = el("canvas", { class: "draw-canvas" });
  const ctx = canvas.getContext("2d");

  const drawStartedAt = Date.now();
  let timeLeft = 30;
  let timeUp = false;

  const timerBox = el("div", { class: "game-timer" }, `Time Remaining: ${timeLeft}s`);
  const drawPrompt = el("div", { class: "draw-prompt" }, promptData.text);

  let currentColor = "#1a1a2e";
  let brushSize = 6; // default = medium
  let erasing = false;
  let lineMode = false;
  let lineStart = null;
  let lineSnapshot = null;
  let shapeMode = false;
let shapeType = null; // — "rect", "circle", "triangle"
let shapeStart = null;
let shapeSnapshot = null;
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
    if (lineMode) {
    lineStart = [lastX, lastY];
    lineSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    if (shapeMode) {
      shapeStart = [lastX, lastY];
      shapeSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  }

  function draw(e) {
  e.preventDefault();
  if (!drawing) return;
  const [x, y] = getPos(e);
  if (lineMode) {
    ctx.putImageData(lineSnapshot, 0, 0);
    ctx.beginPath();
    ctx.moveTo(lineStart[0], lineStart[1]);
    ctx.lineTo(x, y);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.stroke();
    return;
  }

   if (shapeMode) {
      ctx.putImageData(shapeSnapshot, 0, 0);
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      if (shapeType === "rect") {
        ctx.strokeRect(shapeStart[0], shapeStart[1], x - shapeStart[0], y - shapeStart[1]);
      } else if (shapeType === "circle") {
        const rx = (x - shapeStart[0]) / 2;
        const ry = (y - shapeStart[1]) / 2;
        ctx.ellipse(shapeStart[0] + rx, shapeStart[1] + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shapeType === "triangle") {
        const midX = (shapeStart[0] + x) / 2;
        ctx.moveTo(midX, shapeStart[1]);
        ctx.lineTo(x, y);
        ctx.lineTo(shapeStart[0], y);
        ctx.closePath();
        ctx.stroke();
      }
      return;
    }
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.strokeStyle = erasing ? "#ffffff" : currentColor;
  ctx.lineWidth = erasing ? 20 : brushSize;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  [lastX, lastY] = [x, y];
}

  function stopDraw(e) {
  e.preventDefault();
  if (!drawing) return;
  drawing = false;
  if (lineMode && lineStart) {
    const [x, y] = getPos(e);
    ctx.putImageData(lineSnapshot, 0, 0);
    ctx.beginPath();
    ctx.moveTo(lineStart[0], lineStart[1]);
    ctx.lineTo(x, y);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.stroke();
    lineStart = null;
    lineSnapshot = null;
  }

  if (shapeMode && shapeStart) {
      const [x, y] = getPos(e);
      ctx.putImageData(shapeSnapshot, 0, 0);
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      if (shapeType === "rect") {
        ctx.strokeRect(shapeStart[0], shapeStart[1], x - shapeStart[0], y - shapeStart[1]);
      } else if (shapeType === "circle") {
        const rx = (x - shapeStart[0]) / 2;
        const ry = (y - shapeStart[1]) / 2;
        ctx.ellipse(shapeStart[0] + rx, shapeStart[1] + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shapeType === "triangle") {
        const midX = (shapeStart[0] + x) / 2;
        ctx.moveTo(midX, shapeStart[1]);
        ctx.lineTo(x, y);
        ctx.lineTo(shapeStart[0], y);
        ctx.closePath();
        ctx.stroke();
      }
      shapeStart = null;
      shapeSnapshot = null;
    }
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
    const drawDurationSeconds = Math.floor((Date.now() - drawStartedAt) / 1000);

    saveHistoryEntry({
      promptText: promptData.text,
      drawingData,
      createdAt: new Date().toISOString(),
      drawDurationSeconds,
      round,
      endReason: reason,
    });

    // Brief flash message, then transition to results
    timerBox.textContent = reason === "submit" ? "Submitted! ✔" : "Time's up!";

    setTimeout(() => {
      window.removeEventListener("resize", resizeCanvas);
      show(resultsScreen(drawingData, round, promptData));
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
      lineMode = false;
      shapeMode = false;
      markerBtn.classList.add("tool-active");
      eraserBtn.classList.remove("tool-active");
      lineBtn.classList.remove("tool-active");
      shapeBtn.classList.remove("tool-active");
      colorPanel.style.display = colorPanel.style.display === "none" ? "flex" : "none";
    }
  }, "✏️");

  const eraserBtn = el("button", {
    class: "tool-btn",
    title: "Eraser",
    onclick() {
      erasing = true;
      lineMode = false;
      shapeMode = false;
      eraserBtn.classList.add("tool-active");
      markerBtn.classList.remove("tool-active");
      lineBtn.classList.remove("tool-active");
      shapeBtn.classList.remove("tool-active");
      colorPanel.style.display = "none";
    }
  }, "🧽");

  const lineBtn = el("button", {
  class: "tool-btn",
  title: "Line Tool",
  onclick() {
    lineMode = true;
    erasing = false;
    shapeMode = false;
    lineBtn.classList.add("tool-active");
    shapeBtn.classList.remove("tool-active");
    markerBtn.classList.remove("tool-active");
    eraserBtn.classList.remove("tool-active");
    colorPanel.style.display = "none";
  }
}, "📏");

const shapePanel = el("div", { style: "display:none; flex-direction:column; gap:4px;" },
    el("button", { class: "tool-btn", title: "Rectangle", onclick() { shapeType = "rect"; shapePanel.style.display = "none"; shapeBtn.textContent = "▭"; } }, "▭"),
    el("button", { class: "tool-btn", title: "Circle",    onclick() { shapeType = "circle"; shapePanel.style.display = "none"; shapeBtn.textContent = "⬤"; } }, "⬤"),
    el("button", { class: "tool-btn", title: "Triangle",  onclick() { shapeType = "triangle"; shapePanel.style.display = "none"; shapeBtn.textContent = "△"; } }, "△"),
  );

  const shapeBtn = el("button", {
    class: "tool-btn",
    title: "Shape Tool",
    onclick() {
      shapeMode = true;
      shapeType = shapeType || "rect";
      erasing = false;
      lineMode = false;
      shapeBtn.classList.add("tool-active");
      markerBtn.classList.remove("tool-active");
      eraserBtn.classList.remove("tool-active");
      lineBtn.classList.remove("tool-active");
      colorPanel.style.display = "none";
      shapePanel.style.display = shapePanel.style.display === "none" ? "flex" : "none";
    }
  }, "▭");

  const clearBtn = el("button", {
    class: "tool-btn",
    title: "Clear Canvas",
    onclick() {
      if (confirm("Clear the entire canvas?")) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, "🗑️");

  const sizeSlider = el("input", {
    type: "range",
    min: 1,
    max: 20,
    value: brushSize,
    class: "brush-slider",
    oninput(e) {
      brushSize = Number(e.target.value);
      sizePreview.style.width = brushSize + "px";
      sizePreview.style.height = brushSize + "px";
    }
  });

  const sizePreview = el("div", { class: "brush-preview" });
  
  const sizeGroup = el("div", { class: "size-group" },
    sizePreview,
    sizeSlider
  );

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
    sizeGroup,
    eraserBtn,
    lineBtn,
    el("div", { style: "display:flex; flex-direction:column; align-items:center;" },
      shapeBtn,
      shapePanel,
    ),
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
    drawPrompt,
    el("div", { class: "round-badge draw-round-badge" }, `Round ${round}`),
    backBtn,
    submitBtn,
  );

  requestAnimationFrame(() => resizeCanvas());
  window.addEventListener("resize", resizeCanvas);

  const timerInterval = setInterval(() => {
    timeLeft--;
    timerBox.textContent = `Time Remaining: ${timeLeft}s`;

    // ⚠️ LAST 5 SECONDS WARNING
    if (timeLeft <= 5) {
      timerBox.classList.add("timer-warning");
    }

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
if (bgmTrack) { // stop any existing music before starting fresh
  bgmTrack.pause();
  bgmTrack.currentTime = 0;
}

  var bgmTrack = new Audio(); //music
  bgmTrack.src = './audio/track1.mp3';
  bgmTrack.volume = 0.2;
  bgmTrack.loop = true;
  document.addEventListener("click" , () => bgmTrack.play(), {once: true});


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
      el("button", { class: "btn-play",     onclick() { startRound(1); } }, "Single Player"),
      el("button", { class: "btn-multi",    onclick() { /* TODO: multiplayer lobby */ } }, "Multiplayer"),
      el("button", { class: "btn-history",  onclick() { show(historyScreen()); } }, "History"),
      el("button", { class: "btn-settings", onclick: toggleSettings }, "Settings"),
    ),
    settingsSlot,
  );
}

// kick everything off
show(mainMenu());