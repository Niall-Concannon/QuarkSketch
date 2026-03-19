// QuarkSketch — Main Game Script
// Handles all screens and logic for the main menu and drawing canvas
if (require.main === module) show(mainMenu()); // only runs if executed directly, not when imported
module.exports = { mainMenu, settingsPanel, el, show };

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

// ─────────────────────────────────────────────────────────────────
// DRAWING SCREEN — the main canvas where the player draws
// ─────────────────────────────────────────────────────────────────
function drawingScreen() {
  const canvas = el("canvas", { class: "draw-canvas" });
  const ctx = canvas.getContext("2d");

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

  // player puts pen/finger down — start drawing from this point
  function startDraw(e) {
    e.preventDefault();
    drawing = true;
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
    ctx.strokeStyle = "#1a1a2e"; // marker colour — black
    ctx.lineWidth   = 4;
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

  // mouse events
  canvas.addEventListener("mousedown",  startDraw);
  canvas.addEventListener("mousemove",  draw);
  canvas.addEventListener("mouseup",    stopDraw);
  canvas.addEventListener("mouseleave", stopDraw); // stop if cursor leaves canvas

  // touch events — passive false so we can call preventDefault and stop page scrolling
  canvas.addEventListener("touchstart",  startDraw, { passive: false });
  canvas.addEventListener("touchmove",   draw,      { passive: false });
  canvas.addEventListener("touchend",    stopDraw,  { passive: false });

  // tool sidebar — only the marker for now, more tools get added here later
  const sidebar = el("div", { class: "tool-sidebar" },
    el("button", { class: "tool-btn tool-active", title: "Marker" }, "✏️"),
  );

  // back button takes the player back to the main menu
  const backBtn = el("button", { class: "back-btn", onclick() { show(mainMenu()); } }, "←");

  const screen = el("div", { class: "draw-screen" },
    sidebar,
    el("div", { class: "canvas-wrap" }, canvas),
    backBtn,
  );

  // wait one frame before resizing so the layout has settled
  requestAnimationFrame(() => resizeCanvas());

  // re-fit canvas if the window changes size
  window.addEventListener("resize", resizeCanvas);

  return screen;
}

// ─────────────────────────────────────────────────────────────────
// MAIN MENU — first thing the player sees
// ─────────────────────────────────────────────────────────────────
function mainMenu() {
  let settingsOpen = false;
  const settingsSlot = el("div", {}); // placeholder where settings panel drops in
  var bgmTrack = new Audio(); //music
  bgmTrack.normalize('/QuarkSketch/audio/track1.mp3');
  bgmTrack.volume = 0.2;
  


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
      el("button", { class: "btn-play",     onclick() { show(drawingScreen()); } }, "Single Player"),
      el("button", { class: "btn-multi",    onclick() { /* TODO: multiplayer lobby */ } }, "Multiplayer"),
      el("button", { class: "btn-leader",   onclick() { /* TODO: leaderboard screen */ } }, "Leaderboard"),
      el("button", { class: "btn-settings", onclick: toggleSettings }, "Settings"),
    ),
    settingsSlot,
  );
}


// kick everything off
show(mainMenu());

module.exports = { el, rotateMsg, show, settingsPanel, drawingScreen, mainMenu };
