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
function show(screen) {
  document.body.innerHTML = "";
  document.body.appendChild(rotateMsg());
  document.body.appendChild(screen);
}
function rotateMsg() {
  return el("div", { class: "rotate-msg" },
    el("p", {}, "Rotate your device to landscape to play QuarkSketch!"),
  );
}
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
    if (i >= counts.length) { clearInterval(interval); onDone(); return; }
    numDisplay.textContent = counts[i];
    numDisplay.classList.remove("pop");
    void numDisplay.offsetWidth;
    numDisplay.classList.add("pop");
  }, 1000);
  screen._test = { numDisplay };
  return screen;
}
function resultsScreen(drawingData, round) {
  const comment = PLACEHOLDER_COMMENTS[Math.floor(Math.random() * PLACEHOLDER_COMMENTS.length)];
  const thumb   = el("img", { class: "results-thumb", src: drawingData, alt: "Your drawing" });
  const bubble  = el("div", { class: "results-bubble" },
    el("div", { class: "results-bubble-tail" }),
    el("p",   { class: "results-comment" }, comment),
  );
  const feedback = el("div", { class: "results-feedback" },
    el("div", { class: "results-mascot" }, "🤖"),
    bubble,
  );
  const exitBtn = el("button", { class: "btn-settings results-btn", onclick() { show(mainMenu()); } }, "🏠 Exit");
  const nextBtn = el("button", { class: "btn-play results-btn",     onclick() { show(countdownTimer(() => show(drawingScreen(round + 1)))); } }, "Next Round →");
  return el("div", { class: "screen results-screen" },
    el("img", { class: "logo-img results-logo", src: "quarksketch_logo.png", alt: "QuarkSketch" }),
    el("div", { class: "results-title-row" },
      el("h2", { class: "results-title" }, "Round Over!"),
      el("div", { class: "round-badge" }, `Round ${round}`),
    ),
    el("div", { class: "results-body" },
      el("div", { class: "results-left" },
        el("div", { class: "results-thumb-wrap" }, thumb, el("p", { class: "results-thumb-label" }, "Your Masterpiece")),
      ),
      el("div", { class: "results-right" },
        el("div", { class: "results-placeholder-notice" }, "⚠️ NOT AI — TEMPORARY PLACEHOLDER"),
        feedback,
      ),
    ),
    el("div", { class: "results-actions" }, exitBtn, nextBtn),
  );
}
function drawingScreen(round = 1) {
  const canvas = el("canvas", { class: "draw-canvas" });
  const ctx    = canvas.getContext("2d");
  let timeLeft = 30, timeUp = false;
  const timerBox = el("div", { class: "game-timer" }, `Time Remaining: ${timeLeft}s`);
  let currentColor = "#1a1a2e", erasing = false;
  let undoStack = [], redoStack = [];
  let drawing = false, lastX = 0, lastY = 0;
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return [src.clientX - rect.left, src.clientY - rect.top];
  }
  function saveState() { undoStack.push(canvas.toDataURL()); redoStack = []; }
  function startDraw(e) { if (timeUp) return; e.preventDefault(); drawing = true; saveState(); [lastX, lastY] = getPos(e); }
  function draw(e) {
    e.preventDefault(); if (!drawing) return;
    const [x, y] = getPos(e);
    ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y);
    ctx.strokeStyle = erasing ? "#ffffff" : currentColor;
    ctx.lineWidth   = erasing ? 20 : 4;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    [lastX, lastY] = [x, y];
  }
  function stopDraw(e) { e.preventDefault(); drawing = false; }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(canvas.toDataURL());
    const img = new Image(); img.src = undoStack.pop();
    img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(canvas.toDataURL());
    const img = new Image(); img.src = redoStack.pop();
    img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
  }
  function endRound(reason) {
    if (timeUp) return;
    clearInterval(timerInterval); timeUp = true; drawing = false; submitBtn.disabled = true;
    timerBox.textContent = reason === "submit" ? "Submitted! ✔" : "Time's up!";
    setTimeout(() => { show(resultsScreen(canvas.toDataURL(), round)); }, 600);
  }
  canvas.addEventListener("mousedown",  startDraw);
  canvas.addEventListener("mousemove",  draw);
  canvas.addEventListener("mouseup",    stopDraw);
  canvas.addEventListener("mouseleave", stopDraw);
  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove",  draw,       { passive: false });
  canvas.addEventListener("touchend",   stopDraw,   { passive: false });
  const colorPanel = el("div", { style: "display:none; flex-direction:column; gap:6px;" },
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#1a1a2e"; colorPanel.style.display = "none"; } }, "⚫"),
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#ff4d4d"; colorPanel.style.display = "none"; } }, "🔴"),
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#3b82f6"; colorPanel.style.display = "none"; } }, "🔵"),
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#22c55e"; colorPanel.style.display = "none"; } }, "🟢"),
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#facc15"; colorPanel.style.display = "none"; } }, "🟡"),
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#f97316"; colorPanel.style.display = "none"; } }, "🟠"),
    el("button", { class: "tool-btn", onclick() { erasing = false; currentColor = "#a855f7"; colorPanel.style.display = "none"; } }, "🟣"),
  );
  const markerBtn = el("button", { class: "tool-btn tool-active", title: "Marker",
    onclick() { erasing = false; markerBtn.classList.add("tool-active"); eraserBtn.classList.remove("tool-active"); colorPanel.style.display = colorPanel.style.display === "none" ? "flex" : "none"; }
  }, "✏️");
  const eraserBtn = el("button", { class: "tool-btn", title: "Eraser",
    onclick() { erasing = true; eraserBtn.classList.add("tool-active"); markerBtn.classList.remove("tool-active"); colorPanel.style.display = "none"; }
  }, "🧽");
  const clearBtn  = el("button", { class: "tool-btn", title: "Clear Canvas",
    onclick() { if (confirm("Clear the entire canvas?")) ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }, "🗑️");
  const undoBtn   = el("button", { class: "tool-btn", title: "Undo", onclick: undo }, "↶");
  const redoBtn   = el("button", { class: "tool-btn", title: "Redo", onclick: redo }, "↷");
  const submitBtn = el("button", { class: "submit-btn", title: "Submit Drawing",
    onclick() { endRound("submit"); }
  }, "✔ Submit");
  const sidebar = el("div", { class: "tool-sidebar" },
    el("div", { style: "display:flex; flex-direction:column; align-items:center;" }, markerBtn, colorPanel),
    eraserBtn, undoBtn, redoBtn, clearBtn,
  );
  const backBtn = el("button", { class: "back-btn",
    onclick() { clearInterval(timerInterval); show(mainMenu()); }
  }, "←");
  const screen = el("div", { class: "draw-screen" },
    sidebar,
    el("div", { class: "canvas-wrap" }, canvas),
    timerBox,
    el("div", { class: "round-badge draw-round-badge" }, `Round ${round}`),
    backBtn, submitBtn,
  );
  const timerInterval = setInterval(() => {
    timeLeft--;
    timerBox.textContent = `Time Remaining: ${timeLeft}s`;
    if (timeLeft <= 0) { timerBox.textContent = "Time Remaining: 0s"; endRound("timeout"); }
  }, 1000);
  screen._test = {
    canvas, ctx, timerBox, submitBtn, markerBtn, eraserBtn,
    clearBtn, undoBtn, redoBtn, colorPanel, timerInterval,
    getDrawing:      () => drawing,
    getTimeUp:       () => timeUp,
    getErasing:      () => erasing,
    getCurrentColor: () => currentColor,
    getUndoStack:    () => undoStack,
    getRedoStack:    () => redoStack,
    getPos, endRound, undo, redo,
  };
  return screen;
}
function mainMenu() {
  let settingsOpen = false;
  const settingsSlot = el("div", {});
  function toggleSettings() {
    settingsOpen = !settingsOpen;
    settingsSlot.innerHTML = "";
    if (settingsOpen) settingsSlot.appendChild(settingsPanel(() => { settingsOpen = false; settingsSlot.innerHTML = ""; }));
  }
  return el("div", { class: "screen" },
    el("img", { class: "logo-img", src: "quarksketch_logo.png", alt: "QuarkSketch" }),
    el("div", { class: "btn-group" },
      el("button", { class: "btn-play",     onclick() { show(countdownTimer(() => show(drawingScreen(1)))); } }, "Single Player"),
      el("button", { class: "btn-multi",    onclick() {} }, "Multiplayer"),
      el("button", { class: "btn-leader",   onclick() {} }, "Leaderboard"),
      el("button", { class: "btn-settings", onclick: toggleSettings }, "Settings"),
    ),
    settingsSlot,
  );
}
 

// Global setup / teardown

beforeEach(() => {
  document.body.innerHTML = "";
  document.body.classList.remove("dark");
  jest.useFakeTimers();
  window.confirm = jest.fn(() => true);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});








//ui - drawing panel
describe("UI — Drawing Screen Layout", () => {
 
  test("canvas is present", () => {
    const s = drawingScreen(1);
    clearInterval(s._test.timerInterval);
    show(s);
 

    expect(document.querySelector("canvas.draw-canvas")).not.toBeNull();
  });
 
  test("timer starts at 30 seconds", () => {
    const s = drawingScreen(1);
    clearInterval(s._test.timerInterval);
    show(s);
 
    expect(document.querySelector(".game-timer").textContent).toBe("Time Remaining: 30s");
  });
 
  test("round badge shows the correct round number", () => {
    const s = drawingScreen(3);
    clearInterval(s._test.timerInterval);
    show(s);
 
    expect(document.querySelector(".draw-round-badge").textContent).toContain("Round 3");
  });
 
  test("all tool buttons are in the sidebar", () => {

    const s = drawingScreen(1);
    clearInterval(s._test.timerInterval);
    show(s);
    expect(document.querySelector("[title='Marker']")).not.toBeNull();
    expect(document.querySelector("[title='Eraser']")).not.toBeNull();
    expect(document.querySelector("[title='Undo']")).not.toBeNull();
    expect(document.querySelector("[title='Redo']")).not.toBeNull();
    expect(document.querySelector("[title='Clear Canvas']")).not.toBeNull();
  });
 
  test("submit button is present and enabled", () => {
    const s = drawingScreen(1);
    clearInterval(s._test.timerInterval);
    show(s);
    const btn = document.querySelector(".submit-btn");
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(false);
  });
 
  test("back button is present", () => {
    const s = drawingScreen(1);
    clearInterval(s._test.timerInterval);
    show(s);
    expect(document.querySelector(".back-btn")).not.toBeNull();
  });

});


describe("UI — Drawing Screen Tools Layout", () => {

test("color panel is hidden on load", () =>{
const s = drawingScreen(1);

clearInterval(s._test.timerInterval);
expect(s._test.colorPanel.style.display).toBe("none");
});


test("clicking the marker color again closes the color panel", () => {
const s = drawingScreen(1);

clearInterval(s._test.timerInterval);
s._test.markerBtn.click();
expect(s._test.colorPanel.style.display).toBe("flex");
});

test("clicking the marker color opens the color panel", () => {
const s = drawingScreen(1);

clearInterval(s._test.timerInterval);
s._test.markerBtn.click();
s._test.markerBtn.click(); //closed
expect(s._test.colorPanel.style.display).toBe("none");
});


test("selecting the color closes the panel and updates the choosen color", () =>{
const s = drawingScreen(1);

clearInterval(s._test.timerInterval);
s._test.markerBtn.click();

s._test.colorPanel.querySelectorAll("button")[1].click();

//assert
expect(s._test.colorPanel.style.display).toBe("none");
expect(s._test.getCurrentColor()).toBe("#ff4d4d");
});

  test("clicking the eraser activates erasing mode", () => {
    
    const s = drawingScreen(1);
    clearInterval(s._test.timerInterval);
 
  
    s._test.eraserBtn.click();
 
    
    expect(s._test.getErasing()).toBe(true);
    expect(s._test.eraserBtn.classList.contains("tool-active")).toBe(true);
    expect(s._test.markerBtn.classList.contains("tool-active")).toBe(false);
  });

  test("clicking the eraser hides the colour panel if it was open", () => {
   
    const s = drawingScreen(1);
    clearInterval(s._test.timerInterval);
    s._test.markerBtn.click(); // open colour panel
 
    
    s._test.eraserBtn.click();
 

    expect(s._test.colorPanel.style.display).toBe("none");
  });


  test("the undo button moves the last stroke onto the redo stack", () => {

    const s = drawingScreen(1);
    clearInterval(s._test.timerInterval);
    s._test.getUndoStack().push("data:fake-stroke");

    //act
    s._test.undoBtn.click();

    //expect
    expect(s._test.getUndoStack().length).toBe(0);
    expect(s._test.getRedoStack().length).toBe(1);

});
   test("the redo button restores the undone stroke", () => {
    const s = drawingScreen(1);
    clearInterval(s._test.timerInterval);

    s._test.getUndoStack().push("data:fake-stroke");
    s._test.undoBtn.click();

    //act
    s._test.redoBtn.click();
    
    //expect
    expect(s._test.getUndoStack().length).toBe(1);
    expect(s._test.getRedoStack().length).toBe(0);

});
});