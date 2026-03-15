// QuarkSketch — Main Game Script
// Handles all screens and logic for the main menu and drawing canvas

// ─────────────────────────────────────────────────────────────────
// HELPER — builds a DOM element with attributes and children
// saves us from writing document.createElement everywhere
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
// also re-adds the rotate warning every time
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
// only has dark mode for now, more options can go here later
// ─────────────────────────────────────────────────────────────────
function settingsPanel(onClose) {
  const darkInput = el("input", { type: "checkbox" });

  // check the box if dark mode is already on
  if (document.body.classList.contains("dark")) darkInput.checked = true;

  // toggle dark class on body when the switch is flipped
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
// DRAWING SCREEN — the main canvas where the player draws
// ─────────────────────────────────────────────────────────────────
function drawingScreen() {
  const canvas = el("canvas", { class: "draw-canvas" });
  const ctx = canvas.getContext("2d");

  let timeLeft = 30;
  let timeUp = false;

  const timerBox = el("div", { class: "game-timer" }, `Time Remaining: ${timeLeft}s`); // Timer shows how much time is left to draw
  const timeUpMsg = el("div", { class: "time-up-msg" }, "Time's up! Game over!"); // Game over message

  let currentColor = "#1a1a2e"; // marker colour — black
  let erasing = false;
  let undoStack = [];
  let redoStack = [];
  
  // fit the canvas to whatever space it has, and keep the drawing if the window resizes
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width  = rect.width;
    canvas.height = rect.height;
    ctx.putImageData(snapshot, 0, 0);
    ctx.lineCap  = "round";
    ctx.lineJoin = "round";
  }

  // track whether the player is holding down to draw
  let drawing = false;
  let lastX = 0, lastY = 0;

  // works for both mouse and touch — returns x/y relative to the canvas
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return [src.clientX - rect.left, src.clientY - rect.top];
  }

  function saveState() {
    undoStack.push(canvas.toDataURL());
    redoStack = []; // clear redo history after new drawing
  }

  // player puts pen/finger down — start drawing from this point
  function startDraw(e) {
    if (timeUp) return;

    e.preventDefault();
    drawing = true;

    saveState(); // store canvas before drawing begins

    [lastX, lastY] = getPos(e);
  }

  // player moves — draw a line from the last point to the current one
  function draw(e) {
    e.preventDefault();
    if (!drawing) return;

    const [x, y] = getPos(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);

    ctx.strokeStyle = erasing ? "#ffffff" : currentColor; // erase with white
    ctx.lineWidth   = erasing ? 20 : 4; // thicker eraser
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";

    ctx.stroke();
    [lastX, lastY] = [x, y];
  }

  // player lifts pen/finger — stop drawing
  function stopDraw(e) {
    e.preventDefault();
    drawing = false;
  }

  function undo() {
    if (undoStack.length === 0) return;

    redoStack.push(canvas.toDataURL());

    const img = new Image();
    img.src = undoStack.pop();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  }

  function redo() {
    if (redoStack.length === 0) return;

    undoStack.push(canvas.toDataURL());

    const img = new Image();
    img.src = redoStack.pop();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  }

  // mouse events
  canvas.addEventListener("mousedown",  startDraw);
  canvas.addEventListener("mousemove",  draw);
  canvas.addEventListener("mouseup",    stopDraw);
  canvas.addEventListener("mouseleave", stopDraw); // stop if cursor leaves canvas

  // touch events — passive false so we can call preventDefault and stop page scrolling
  canvas.addEventListener("touchstart",  startDraw, { passive: false });
  canvas.addEventListener("touchmove",   draw,      { passive: false });
  canvas.addEventListener("touchend",    stopDraw,  { passive: false });

  const colorPanel = el("div", { style: "display:none; flex-direction:column; gap:6px;" },

  el("button", {
    class: "tool-btn",
    onclick() { erasing = false;currentColor = "#1a1a2e"; colorPanel.style.display = "none"; } //Black
  }, "⚫"),

  el("button", {
    class: "tool-btn",
    onclick() { erasing = false;currentColor = "#ff4d4d"; colorPanel.style.display = "none"; } //Red
  }, "🔴"),

  el("button", {
    class: "tool-btn",
    onclick() { erasing = false;currentColor = "#3b82f6"; colorPanel.style.display = "none"; } // Blue
  }, "🔵"),

  el("button", {
    class: "tool-btn",
    onclick() { erasing = false;currentColor = "#22c55e"; colorPanel.style.display = "none"; } // Green
  }, "🟢"),

  el("button", {
  class: "tool-btn",
  onclick() { erasing = false;currentColor = "#facc15"; colorPanel.style.display = "none"; } // Yellow
}, "🟡"),

el("button", {
  class: "tool-btn",
  onclick() { erasing = false;currentColor = "#f97316"; colorPanel.style.display = "none"; } // Orange
}, "🟠"),

el("button", {
  class: "tool-btn",
  onclick() { erasing = false;currentColor = "#a855f7"; colorPanel.style.display = "none"; } // Purple
}, "🟣")
);
  
  // tool sidebar — only the marker for now, more tools get added here later
  // create buttons first so we can control their classes
  // create buttons first
  const markerBtn = el("button", { 
    class: "tool-btn tool-active",
    title: "Marker",
    onclick() {
      erasing = false;

      markerBtn.classList.add("tool-active");
      eraserBtn.classList.remove("tool-active");

      colorPanel.style.display =
        colorPanel.style.display === "none" ? "flex" : "none";
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
      if (confirm("Clear the entire canvas?")) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, "🗑️");

  const undoBtn = el("button", {
    class: "tool-btn",
    title: "Undo",
    onclick: undo
  }, "↶");

  const redoBtn = el("button", {
    class: "tool-btn",
    title: "Redo",
    onclick: redo
  }, "↷");

  // group the marker and colour panel together
  const markerGroup = el("div", {
    style: "display:flex; flex-direction:column; align-items:center;"
  },
    markerBtn,
    colorPanel
  );

  // sidebar
  const sidebar = el("div", { class: "tool-sidebar" },
    markerGroup,
    eraserBtn,
    undoBtn,
    redoBtn,
    clearBtn
  );

  // back button takes the player back to the main menu
  const backBtn = el("button", { class: "back-btn", onclick() { clearInterval(timerInterval); show(mainMenu()); } }, "←");

  const screen = el("div", { class: "draw-screen" },
    sidebar,
    el("div", { class: "canvas-wrap" }, canvas),
    timerBox,
    timeUpMsg,
    backBtn
  );

  // wait one frame before resizing so the layout has settled
  requestAnimationFrame(() => resizeCanvas());

  // re-fit canvas if the window changes size
  window.addEventListener("resize", resizeCanvas);

  const timerInterval = setInterval(() => {
  timeLeft--;
  timerBox.textContent = `Time Remaining: ${timeLeft}s`;

  // end round automatically and disable drawing when the timer reaches 0
  if (timeLeft <= 0) {
    clearInterval(timerInterval);
    timeUp = true;
    drawing = false;
    timerBox.textContent = "Time Remaining: 0s";
    timeUpMsg.style.display = "block";
  }
}, 1000);

  return screen;
}

// ─────────────────────────────────────────────────────────────────
// MAIN MENU — first thing the player sees
// ─────────────────────────────────────────────────────────────────
function mainMenu() {
  let settingsOpen = false;
  const settingsSlot = el("div", {}); // placeholder where settings panel drops in

  // open or close the settings panel in place
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
      el("button", { class: "btn-play",     onclick() {  show(countdownTimer(() => show(drawingScreen()))); } }, "Single Player"),
      el("button", { class: "btn-multi",    onclick() { /* TODO: multiplayer lobby */ } }, "Multiplayer"),
      el("button", { class: "btn-leader",   onclick() { /* TODO: leaderboard screen */ } }, "Leaderboard"),
      el("button", { class: "btn-settings", onclick: toggleSettings }, "Settings"),
    ),
    settingsSlot,
  );
}

// kick everything off
show(mainMenu());