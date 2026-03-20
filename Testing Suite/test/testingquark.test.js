const { TestEnvironment } = require('jest-environment-jsdom');
const {settingsPanel, mainMenu, el, show} = require('../src/game');

describe("el()", () => {
  test("creates an element with the correct tag", () => {
    const div = el("div");
    expect(div.tagName).toBe("DIV");
  });

  test("sets className via the 'class' attribute key", () => {
    const span = el("span", { class: "my-class" });
    expect(span.className).toBe("my-class");
  });

  test("sets arbitrary attributes", () => {
    const img = el("img", { src: "logo.png", alt: "Logo" });
    expect(img.getAttribute("src")).toBe("logo.png");
    expect(img.getAttribute("alt")).toBe("Logo");
  });

  test("attaches event listeners via 'on' prefix keys", () => {
    const handler = jest.fn();
    const btn = el("button", { onclick: handler });
    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("appends string children as text nodes", () => {
    const p = el("p", {}, "Hello World");
    expect(p.textContent).toBe("Hello World");
  });

  test("appends element children", () => {
    const child = el("span", {}, "child text");
    const parent = el("div", {}, child);
    expect(parent.firstChild).toBe(child);
  });

  test("ignores falsy children (null / undefined)", () => {
    const div = el("div", {}, null, undefined, "visible");
    expect(div.childNodes.length).toBe(1);
    expect(div.textContent).toBe("visible");
  });

  test("handles no attrs argument (null / omitted)", () => {
    expect(() => el("div", null)).not.toThrow();
    expect(() => el("div")).not.toThrow();
  });
});

describe("mainMenu()", () => {
  test("renders a screen div", () => {
    const menu = mainMenu();
    expect(menu.className).toBe("screen");
  });

  test("contains a logo image", () => {
    const menu = mainMenu();
    const img = menu.querySelector("img.logo-img");
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("quarksketch_logo.png");
  });

  test("contains Single Player, Multiplayer, Leaderboard, and Settings buttons", () => {
    const menu = mainMenu();
    const text = menu.textContent;
    expect(text).toContain("Single Player");
    expect(text).toContain("Multiplayer");
    expect(text).toContain("Leaderboard");
    expect(text).toContain("Settings");
  });

  test("settings panel is hidden by default", () => {
    const menu = mainMenu();
    expect(menu.querySelector(".settings-panel")).toBeNull();
  });

  test("clicking Settings opens the settings panel", () => {
    const menu = mainMenu();
    menu.querySelector(".btn-settings").click();
    expect(menu.querySelector(".settings-panel")).not.toBeNull();
  });

  test("clicking Settings twice closes the panel (toggle)", () => {
    const menu = mainMenu();
    const btn = menu.querySelector(".btn-settings");
    btn.click();
    btn.click();
    expect(menu.querySelector(".settings-panel")).toBeNull();
  });

  test("closing the settings panel via its Close button removes it", () => {
    const menu = mainMenu();
    menu.querySelector(".btn-settings").click();
    menu.querySelector(".close-btn").click();
    expect(menu.querySelector(".settings-panel")).toBeNull();
  });

  test("clicking Single Player calls show() with a draw-screen", () => {
    show(mainMenu());
    document.querySelector(".btn-play").click();
    expect(document.querySelector(".draw-screen")).not.toBeNull();
  });
});

//settings panel
describe("settingsPanel()", () => {
  test("renders a panel with class 'settings-panel'", () => {
    const panel = settingsPanel(() => {});
    expect(panel.className).toBe("settings-panel");
  });

  test("contains a dark-mode checkbox input", () => {
    const panel = settingsPanel(() => {});
    const checkbox = panel.querySelector("input[type='checkbox']");
    expect(checkbox).not.toBeNull();
  });
});

test("check if the checkbox is unchecked when body does not have have a 'dark' class ", () =>{
  document.body.classList.remove("dark");
    const panel = settingsPanel(() => {});
    const checkbox = panel.querySelector("input[type='checkbox']");
    expect(checkbox.checked).toBe(false);
});


test("check if the checkbox is unchecked when body does have have a 'dark' class ", () =>{
  document.body.classList.add("dark");
    const panel = settingsPanel(() => {});
    const checkbox = panel.querySelector("input[type='checkbox']");
    expect(checkbox.checked).toBe(true);
});

test("toggling the checkbox adds 'dark' class to body", () => {
    const panel = settingsPanel(() => {});
    const checkbox = panel.querySelector("input[type='checkbox']");
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    expect(document.body.classList.contains("dark")).toBe(true);
  });

  test("toggling the checkbox off removes 'dark' class from body", () => {
    document.body.classList.add("dark");
    const panel = settingsPanel(() => {});
    const checkbox = panel.querySelector("input[type='checkbox']");
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));
    expect(document.body.classList.contains("dark")).toBe(false);
  });


  



  //automated cases
  describe("el()", () => {
  test("create a button with the correct text", () => {
    const btn = el("button", { class: "btn-play",}, "Single Player");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.className).toBe("btn-play");
    expect(btn.textContent).toBe("Single Player");
  });
});

test("clicking settings opens the panel", () => {
  const menu = mainMenu();
  menu.querySelector(".btn-settings").click();
  expect(menu.querySelector(".settings-panel")).not.toBeNull();
});





const { TestEnvironment } = require('jest-environment-jsdom');
const {settingsPanel, mainMenu, el} = require('../src/game');
