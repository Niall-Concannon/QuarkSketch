// QuarkSketch — Main Game Script
// Handles all screens and logic for the main menu and drawing canvas

let bgmTrack = null;
let sfxEnabled = true;
let musicEnabled = false; // music off by default
const CELEBRATION_SFX_SOURCES = ["audio/win31.mp3", "audio/track1.mp3"];
const UI_CLICK_SFX_SOURCES = ["audio/typewriter.mp3", "audio/track1.mp3"];
const ROUND_COUNTDOWN_SFX_SOURCES = [
  "audio/3-2-1-go-green-screen-footage-2xoehcl8evq.mp3",
  "audio/track1.mp3",
];
const TIME_WARNING_SFX_SOURCES = [
  "audio/countdown-clock-only.mp3",
  "audio/track1.mp3",
];
let uiClickSfx = null;
let uiClickSfxIndex = 0;

function createAudioFromSources(sources, options = {}, onReady, onExhausted) {
  const { volume = 0.7, loop = false } = options;

  function trySource(index) {
    if (index >= sources.length) {
      if (typeof onExhausted === "function") onExhausted();
      return;
    }
    const audio = new Audio(sources[index]);
    audio.volume = volume;
    audio.loop = loop;
    audio.preload = "auto";
    audio.onerror = () => trySource(index + 1);
    onReady(audio, () => trySource(index + 1));
  }

  trySource(0);
}

function playCelebrationSfx() {
  if (!sfxEnabled) return;

  createAudioFromSources(CELEBRATION_SFX_SOURCES, { volume: 0.7 }, (sfx, tryNext) => {
    sfx.play().catch(() => tryNext());
  });
}

function playUiClickSfx() {
  if (!sfxEnabled) return;

  primeUiClickSfx();
  if (!uiClickSfx) return;

  try {
    uiClickSfx.pause();
    uiClickSfx.currentTime = 0;
  } catch {
    // Ignore seek/pause errors and try playing anyway.
  }

  uiClickSfx.play().catch(() => {
    uiClickSfxIndex = Math.min(uiClickSfxIndex + 1, UI_CLICK_SFX_SOURCES.length - 1);
    uiClickSfx = null;
    primeUiClickSfx();
    if (uiClickSfx) {
      uiClickSfx.play().catch(() => {});
    }
  });
}

function primeUiClickSfx() {
  if (!sfxEnabled || uiClickSfx) return;

  const source = UI_CLICK_SFX_SOURCES[Math.min(uiClickSfxIndex, UI_CLICK_SFX_SOURCES.length - 1)];
  uiClickSfx = new Audio(source);
  uiClickSfx.volume = 0.35;
  uiClickSfx.preload = "auto";
  uiClickSfx.load();
  uiClickSfx.onerror = () => {
    if (uiClickSfxIndex < UI_CLICK_SFX_SOURCES.length - 1) {
      uiClickSfxIndex++;
      uiClickSfx = null;
      primeUiClickSfx();
    }
  };
}

function addUiClickSfxToButtons(root) {
  if (!document.__uiClickSfxBound) {
    document.__uiClickSfxBound = true;
    document.addEventListener("pointerdown", (event) => {
      const button = event.target.closest && event.target.closest("button");
      if (!button) return;
      if (button.dataset.noUiSfx === "true") return;
      if (button.closest(".draw-screen")) return;
      playUiClickSfx();
    }, true);
  }
}

primeUiClickSfx();

const ONLINE_SERVER_STORAGE_KEY = "quarkSketchOnlineServer";
const ONLINE_NAME_STORAGE_KEY = "quarkSketchOnlineName";
const THEME_STORAGE_KEY = "quarkSketchTheme";

const onlineState = {
  ws: null,
  connected: false,
  playerId: null,
  room: null,
  role: null,
  serverUrl: "",
  displayName: "",
  selectedTopicKey: "any",
  pendingLobbySettings: null,
  lastError: "",
  submissionStatus: {
    submittedCount: 0,
    totalPlayers: 0,
  },
  startRoundPending: false,
  peerPreviews: new Map(),
  roundReactions: {},
  lastResults: null,
  chatHistory: [],
};

function getStoredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark", isDark);
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
}

function toggleTheme() {
  const next = document.body.classList.contains("dark") ? "light" : "dark";
  applyTheme(next);
  show(mainMenu());
}

function themeToggleBtn() {
  const dark = document.body.classList.contains("dark");
  return el("button", {
    class: "theme-toggle-btn",
    onclick() {
      const next = document.body.classList.contains("dark") ? "light" : "dark";
      applyTheme(next);
      if (document.querySelector(".online-lobby-screen")) {
        show(onlineLobbyScreen());
        return;
      }
      if (document.querySelector(".online-multi-screen")) {
        show(onlineMultiplayerScreen());
        return;
      }
      if (document.querySelector(".online-waiting-screen")) {
        show(onlineWaitingScreen());
        return;
      }
      if (document.querySelector(".online-results-screen")) {
        show(onlineResultsScreen(onlineState.lastResults));
        return;
      }
      show(mainMenu());
    },
  }, dark ? "Light Mode" : "Dark Mode");
}

function fullscreenToggleBtn() {
  return el("button", {
    class: "theme-toggle-btn fullscreen-toggle-btn",
    onclick() {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        return;
      }
      document.documentElement.requestFullscreen().catch(() => {});
    },
  }, "Fullscreen");
}

function onlineTopControls() {
  return el("div", { class: "online-top-controls" },
    themeToggleBtn(),
    fullscreenToggleBtn(),
  );
}

applyTheme(getStoredTheme());

function getDefaultOnlineServerUrl() {
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${window.location.host}`;
  }
  const stored = localStorage.getItem(ONLINE_SERVER_STORAGE_KEY);
  if (stored) return stored;
  return "ws://localhost:8080";
}

function sanitizeRoomCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function toJoinPageUrl(roomCode) {
  const normalizedCode = sanitizeRoomCode(roomCode);
  let baseUrl = "";

  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    baseUrl = `${window.location.origin}${window.location.pathname}`;
  } else {
    const fallback = String(getDefaultOnlineServerUrl() || "ws://localhost:8080").replace(/^ws:/i, "http:").replace(/^wss:/i, "https:");
    baseUrl = `${fallback.replace(/\/$/, "")}/`;
  }

  const url = new URL(baseUrl);
  if (normalizedCode) url.searchParams.set("room", normalizedCode);
  return url.toString();
}

function readJoinParamsFromUrl() {
  if (!window.location.search) return { roomCode: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    roomCode: sanitizeRoomCode(params.get("room") || ""),
  };
}

function isLocalhostPage() {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function isOnlineHost() {
  if (onlineState.role === "host") return true;
  return Boolean(onlineState.room && onlineState.playerId && onlineState.room.hostId === onlineState.playerId);
}

function getOnlinePeerPreviewEntries() {
  return Array.from(onlineState.peerPreviews.values());
}

function emitOnlinePreviewUpdated() {
  window.dispatchEvent(new CustomEvent("quark-online-preview-updated"));
}

function disconnectOnlineSocket() {
  if (onlineState.ws) {
    try {
      onlineState.ws.close();
    } catch {
      // Ignore close failures.
    }
  }
  onlineState.ws = null;
  onlineState.connected = false;
  onlineState.room = null;
  onlineState.role = null;
  onlineState.startRoundPending = false;
  onlineState.peerPreviews.clear();
  onlineState.roundReactions = {};
  onlineState.submissionStatus = { submittedCount: 0, totalPlayers: 0 };
}

function onlineSend(type, payload = {}) {
  if (!onlineState.ws || onlineState.ws.readyState !== WebSocket.OPEN) return false;
  onlineState.ws.send(JSON.stringify({ type, payload }));
  return true;
}

function onOnlineRoundFinished(result) {
  const payload = {
    drawingData: result.drawingData,
    aiScores: {
      overall: result.aiReport.overall,
      resemblance: result.aiReport.resemblance,
      color: result.aiReport.color,
      accuracy: result.aiReport.accuracy,
    },
    endReason: result.reason,
    drawDurationSeconds: result.drawDurationSeconds,
  };

  onlineSend("submit_round", payload);
  onlineState.submissionStatus = {
    submittedCount: 1,
    totalPlayers: onlineState.room?.players?.length || 2,
  };
  show(onlineWaitingScreen());
}

function handleOnlineMessage(message) {
  const { type, payload = {} } = message || {};

  if (type === "welcome") {
    onlineState.playerId = payload.playerId || null;
    if (onlineState.room && onlineState.playerId) {
      onlineState.role = onlineState.room.hostId === onlineState.playerId ? "host" : "guest";
    }
    return;
  }

  if (type === "error") {
    onlineState.startRoundPending = false;
    onlineState.lastError = payload.message || "Online error";
    if (document.querySelector(".online-lobby-screen")) {
      show(onlineLobbyScreen());
      return;
    }
    if (document.querySelector(".online-multi-screen")) {
      show(onlineMultiplayerScreen());
    }
    return;
  }

  if (type === "left_room") {
    onlineState.room = null;
    onlineState.role = null;
    onlineState.startRoundPending = false;
    onlineState.peerPreviews.clear();
    onlineState.roundReactions = {};
    show(onlineMultiplayerScreen());
    return;
  }

  if (type === "room_created" || type === "room_joined" || type === "room_update") {
    if (payload.room) {
      if (payload.playerId) onlineState.playerId = payload.playerId;
      onlineState.room = payload.room;
      if (type === "room_created") {
        onlineState.role = "host";
      } else if (type === "room_joined") {
        onlineState.role = "guest";
      } else if (onlineState.playerId) {
        onlineState.role = payload.room.hostId === onlineState.playerId ? "host" : "guest";
      }
      onlineState.lastError = "";
      onlineState.selectedTopicKey = onlineState.room.selectedTopic || "any";
      if (!onlineState.room.hasActiveRound) {
        onlineState.startRoundPending = false;
      }
      if (!onlineState.room.hasActiveRound) {
        onlineState.peerPreviews.clear();
      }
    }
    if (type !== "room_update" || document.querySelector(".online-lobby-screen")) {
      show(onlineLobbyScreen());
    }
    return;
  }

  if (type === "round_started") {
    onlineState.startRoundPending = false;
    onlineState.peerPreviews.clear();
    onlineState.submissionStatus = { submittedCount: 0, totalPlayers: payload.room?.players?.length || 2 };
    show(countdownTimer(() => {
      show(promptScreen(payload.promptData, () => show(drawingScreen(payload.round, payload.promptData, {
        roundDuration: payload.duration,
        onRoundFinished: onOnlineRoundFinished,
        enablePeerPreview: true,
        isHostController: payload.room?.hostId === onlineState.playerId,
        getPeerPreviews: getOnlinePeerPreviewEntries,
        onPreviewData(drawingData) {
          onlineSend("drawing_preview", { drawingData });
        },
        onForceEndRound() {
          onlineSend("force_end_round");
        },
        onExitRound() {
          onlineSend("leave_room");
          show(onlineMultiplayerScreen());
        },
      })), {
        autoStartDelayMs: 1400,
        showStartButton: false,
      }));
    }, {
      allowLocalToggle: payload.room?.hostId === onlineState.playerId,
      onPauseChange(paused) {
        onlineSend("countdown_pause", { paused });
      },
    }));
    return;
  }

  if (type === "submission_status") {
    onlineState.submissionStatus = {
      submittedCount: payload.submittedCount || 0,
      totalPlayers: payload.totalPlayers || 0,
    };
    if (document.querySelector(".online-waiting-screen")) {
      show(onlineWaitingScreen());
    }
    return;
  }

  if (type === "round_results") {
    onlineState.lastResults = payload;
    onlineState.roundReactions = payload.reactions || {};
    onlineState.peerPreviews.clear();
    show(onlineResultsScreen(payload));
    return;
  }

  if (type === "countdown_pause") {
    window.dispatchEvent(new CustomEvent("quark-online-countdown-pause", {
      detail: { paused: Boolean(payload.paused) },
    }));
    return;
  }

  if (type === "drawing_preview") {
    const playerId = payload.playerId;
    if (!playerId || playerId === onlineState.playerId) return;
    onlineState.peerPreviews.set(playerId, {
      playerId,
      playerName: payload.playerName || "Player",
      drawingData: payload.drawingData || "",
      updatedAt: Date.now(),
    });
    emitOnlinePreviewUpdated();
    if (document.querySelector(".online-waiting-screen")) {
      show(onlineWaitingScreen());
    }
    return;
  }

  if (type === "round_reactions") {
    onlineState.roundReactions = payload.reactions || {};
    if (document.querySelector(".online-results-screen") && onlineState.lastResults) {
      show(onlineResultsScreen(onlineState.lastResults));
    }
  }

    if (type === "chat_broadcast") {
  onlineState.chatHistory.push(payload);
  // Keep only the last 50 messages to save memory
  if (onlineState.chatHistory.length > 50) onlineState.chatHistory.shift();
  
  window.dispatchEvent(new CustomEvent("quark-chat-updated"));
  return;
}
}

function connectOnline(serverUrl) {
  return new Promise((resolve, reject) => {
    const targetUrl = String(serverUrl || "").trim();
    if (!targetUrl) {
      reject(new Error("Server URL is required."));
      return;
    }

    disconnectOnlineSocket();

    let socket;
    try {
      socket = new WebSocket(targetUrl);
    } catch {
      reject(new Error("Could not connect to server."));
      return;
    }

    onlineState.ws = socket;
    onlineState.serverUrl = targetUrl;
    onlineState.connected = false;

    socket.addEventListener("open", () => {
      onlineState.connected = true;
      localStorage.setItem(ONLINE_SERVER_STORAGE_KEY, targetUrl);
      resolve();
    }, { once: true });

    socket.addEventListener("error", () => {
      onlineState.connected = false;
      reject(new Error("WebSocket connection failed."));
    }, { once: true });

    socket.addEventListener("close", () => {
      onlineState.connected = false;
      onlineState.room = null;
      onlineState.role = null;
    });

    socket.addEventListener("message", (event) => {
      let parsed;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }
      handleOnlineMessage(parsed);
    });
  });
}

function onlineMultiplayerScreen() {
  const joinParams = readJoinParamsFromUrl();
  const initialName = localStorage.getItem(ONLINE_NAME_STORAGE_KEY) || "";

  const nameInput = el("input", {
    class: "online-input",
    type: "text",
    placeholder: "Your name",
    value: initialName,
    maxlength: "24",
  });

  const codeInput = el("input", {
    class: "online-input",
    type: "text",
    placeholder: "Room code",
    value: joinParams.roomCode,
    maxlength: "6",
    oninput(event) {
      event.target.value = sanitizeRoomCode(event.target.value);
    },
  });

  const defaultStatus = joinParams.roomCode
    ? "Invite link detected. Enter your name and click Join Room."
    : "Create a room as host or join with a room code.";
  const statusText = el("p", { class: "online-status" }, onlineState.lastError || defaultStatus);

  function getName() {
    const value = String(nameInput.value || "").trim().slice(0, 24);
    const fallback = "Player";
    const name = value || fallback;
    onlineState.displayName = name;
    localStorage.setItem(ONLINE_NAME_STORAGE_KEY, name);
    return name;
  }

  function setBusy(message) {
    statusText.textContent = message;
  }

  const connectUrl = getDefaultOnlineServerUrl();

  const createBtn = el("button", {
    class: "btn-play",
    onclick() {
      setBusy("Connecting and creating room...");
      onlineState.role = "host";
      onlineState.pendingLobbySettings = {
        selectedTopicKey: "any",
      };
      connectOnline(connectUrl)
        .then(() => {
          onlineSend("create_room", { name: getName() });
        })
        .catch((err) => {
          statusText.textContent = err.message || "Could not connect to server.";
        });
    },
  }, "Create Room");

  const joinBtn = el("button", {
    class: "btn-multi",
    onclick() {
      const roomCode = sanitizeRoomCode(codeInput.value);
      if (!roomCode) {
        statusText.textContent = "Enter a valid room code.";
        return;
      }
      setBusy("Connecting and joining room...");
      onlineState.role = "guest";
      onlineState.pendingLobbySettings = null;
      connectOnline(connectUrl)
        .then(() => {
          onlineSend("join_room", { code: roomCode, name: getName() });
        })
        .catch((err) => {
          statusText.textContent = err.message || "Could not connect to server.";
        });
    },
  }, "Join Room");

  const backBtn = el("button", {
    class: "btn-settings",
    onclick() {
      show(mainMenu());
    },
  }, "Back");

  const screen = el("div", { class: "screen online-multi-screen" },
    el("img", { class: "logo-img", src: "quarksketch_logo.png", alt: "QuarkSketch" }),
    el("div", { class: "online-card" },
      onlineTopControls(),
      el("h2", { class: "online-title" }, "Online Rooms"),
      el("p", { class: "online-subtitle" }, "Share one link, then guest joins in one tap."),
      el("label", { class: "online-label" }, "Name"),
      nameInput,
      el("label", { class: "online-label" }, "Room code (for guests)"),
      codeInput,
      el("div", { class: "btn-group online-actions" },
        createBtn,
        joinBtn,
      ),
      isLocalhostPage()
        ? el("p", { class: "online-error" }, "For other devices, open this game using your computer's LAN IP instead of localhost.")
        : null,
      backBtn,
      statusText,
    ),
  );

  if (joinParams.roomCode) {
    setTimeout(() => {
      joinBtn.click();
    }, 0);
  }

  addUiClickSfxToButtons(screen);
  return screen;
}

function onlineLobbyScreen() {
  if (!onlineState.room) return onlineMultiplayerScreen();

  const amHost = isOnlineHost();
  const roleText = amHost ? "Host" : "Guest";
  const shareRoomCode = onlineState.room.code;
  const shareJoinUrl = isLocalhostPage()
    ? `http://YOUR_HOST_IP:8080/?room=${shareRoomCode}`
    : toJoinPageUrl(shareRoomCode);

  const inviteText = [
    "Join my QuarkSketch room",
    `URL: ${shareJoinUrl}`,
    `Room code: ${shareRoomCode}`,
    isLocalhostPage() ? "Host note: replace YOUR_HOST_IP with the host computer LAN IP." : null,
  ].filter(Boolean).join("\n");

  const invitePreview = el("p", { class: "online-invite-preview" }, shareJoinUrl);

  const copyInviteBtn = el("button", {
    class: "btn-history",
    onclick() {
      const fallback = () => {
        const helper = el("textarea", { class: "online-copy-helper" }, inviteText);
        document.body.appendChild(helper);
        helper.select();
        try {
          document.execCommand("copy");
          invitePreview.textContent = "Invite copied. Send it to your friend.";
        } catch {
          invitePreview.textContent = "Copy failed. Manually share the URL shown above.";
        }
        document.body.removeChild(helper);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(inviteText)
          .then(() => {
            invitePreview.textContent = "Invite copied. Send it to your friend.";
          })
          .catch(fallback);
        return;
      }

      fallback();
    },
  }, "Copy Invite");

  const playerRows = onlineState.room.players.map((player) =>
    el("li", { class: "online-player-row" },
      el("span", {}, `${player.name}${player.id === onlineState.playerId ? " (You)" : ""}`),
      el("span", { class: "online-player-role" }, player.id === onlineState.room.hostId ? "Host" : "Guest"),
    ),
  );

  const topicOptions = window.PROMPTS && typeof window.PROMPTS.getPromptTopicOptions === "function"
    ? window.PROMPTS.getPromptTopicOptions()
    : [{ key: "any", label: "Any Topic" }];

  const selectedTopicKey = onlineState.room.selectedTopic || onlineState.selectedTopicKey || "any";
  const selectedTopicLabel = topicOptions.find((option) => option.key === selectedTopicKey)?.label || "Any Topic";

  const topicSelect = amHost
    ? el("select", {
        class: "online-topic-select",
        onchange(event) {
          const nextTopic = event.target.value || "any";
          onlineState.selectedTopicKey = nextTopic;
          onlineSend("set_topic", { topicKey: nextTopic });
        },
      },
        ...topicOptions.map((option) =>
          el("option", {
            value: option.key,
          }, option.label),
        ),
      )
    : null;

    if (topicSelect) {
  topicSelect.value = selectedTopicKey;
}

  const topicSection = amHost
    ? el("div", { class: "online-topic-section" },
        el("label", { class: "online-label" }, "Lobby Topic"),
        topicSelect,
        el("p", { class: "online-topic-help" }, "Host chooses a topic for the room before starting."),
      )
    : el("div", { class: "online-topic-section" },
        el("p", { class: "online-label" }, "Lobby Topic"),
        el("p", { class: "online-topic-badge" }, selectedTopicLabel),
      );

  const startBtn = amHost
    ? el("button", {
        class: "btn-play",
        onclick() {
          if (onlineState.room.players.length < 2) {
            onlineState.lastError = "Need at least 2 players before starting.";
            show(onlineLobbyScreen());
            return;
          }
          if (onlineState.room.hasActiveRound) {
            onlineState.lastError = "Round already active. Finish it before starting another.";
            show(onlineLobbyScreen());
            return;
          }
          if (!onlineState.connected) {
            onlineState.lastError = "Connection lost. Rejoin the room and try again.";
            show(onlineLobbyScreen());
            return;
          }

          const chosenTopic = onlineState.room.selectedTopic || onlineState.selectedTopicKey || "any";
          const promptData = getRoundPrompt(chosenTopic);
          const sent = onlineSend("start_round", { promptData, duration: 30, topicKey: chosenTopic });
          if (!sent) {
            onlineState.lastError = "Could not send start request. Rejoin the room and try again.";
            show(onlineLobbyScreen());
            return;
          }

          onlineState.startRoundPending = true;
          onlineState.lastError = "";
          show(onlineLobbyScreen());
        },
      }, "Start Round")
    : null;

  const leaveBtn = el("button", {
    class: "btn-settings",
    onclick() {
      onlineSend("leave_room");
      disconnectOnlineSocket();
      show(onlineMultiplayerScreen());
    },
  }, "Leave Room");

  const waitingText = amHost
    ? (onlineState.startRoundPending
        ? "Starting round for everyone..."
        : (onlineState.room.players.length < 2 ? "Waiting for at least one guest to join." : "Ready to start the round."))
    : "Waiting for host to start the round.";

  const screen = el("div", { class: "screen online-lobby-screen" },
    el("div", { class: "online-card" },
      onlineTopControls(),
      el("h2", { class: "online-title" }, `Room ${onlineState.room.code}`),
      el("p", { class: "online-subtitle" }, `${roleText} connected. Share this code with your friend.`),
      el("p", { class: "online-status" }, waitingText),
      el("div", { class: "online-invite-wrap" },
        el("p", { class: "online-label" }, "Invite URL"),
        invitePreview,
        copyInviteBtn,
      ),
      topicSection,
      chatComponent(),
      onlineState.lastError ? el("p", { class: "online-error" }, onlineState.lastError) : null,
      el("ul", { class: "online-player-list" }, ...playerRows),
      el("div", { class: "btn-group online-actions" },
        startBtn,
        leaveBtn,
      ),
    ),
  );

  addUiClickSfxToButtons(screen);
  return screen;
}

function onlineWaitingScreen() {
  const submitted = onlineState.submissionStatus.submittedCount || 0;
  const total = onlineState.submissionStatus.totalPlayers || onlineState.room?.players?.length || 2;
  const previews = getOnlinePeerPreviewEntries();

  const previewGallery = previews.length
    ? el("div", { class: "online-wait-gallery" },
        ...previews.map((entry) =>
          el("article", { class: "online-wait-card" },
            el("p", { class: "online-player-name" }, entry.playerName || "Player"),
            entry.drawingData
              ? el("img", { class: "online-wait-image", src: entry.drawingData, alt: `${entry.playerName || "Player"} drawing` })
              : el("div", { class: "online-result-missing" }, "No preview yet"),
          ),
        ),
      )
    : el("p", { class: "online-status" }, "Waiting for other players to draw...");

  const screen = el("div", { class: "screen online-waiting-screen" },
    el("div", { class: "online-card" },
      onlineTopControls(),
      el("h2", { class: "online-title" }, "Waiting For Players"),
      el("p", { class: "online-subtitle" }, "Your drawing is submitted."),
      el("p", { class: "online-progress" }, `Submitted: ${submitted}/${total}`),
      previewGallery,
      el("p", { class: "online-status" }, "Results will appear automatically when everyone is done."),
    ),
  );

  addUiClickSfxToButtons(screen);
  return screen;
}

function onlineResultsScreen(resultPayload) {
  const results = Array.isArray(resultPayload?.results) ? resultPayload.results : [];
  const promptText = resultPayload?.promptData?.text || "Prompt unavailable";
  const round = resultPayload?.round || 1;

  function voteOnDrawing(targetPlayerId, currentVote, nextVote) {
    const vote = currentVote === nextVote ? "clear" : nextVote;
    onlineSend("vote_drawing", {
      round,
      targetPlayerId,
      vote,
    });
  }

  const cards = results.map((entry, index) => {
    const score = Number(entry?.aiScores?.overall || 0);
    const reaction = onlineState.roundReactions[entry.playerId] || { up: 0, down: 0, myVote: null };
    return el("article", { class: "online-result-card" },
      el("p", { class: "online-placement" }, `#${index + 1}`),
      el("p", { class: "online-player-name" }, entry.playerName || "Player"),
      entry.drawingData
        ? el("img", { class: "online-result-thumb", src: entry.drawingData, alt: `${entry.playerName || "Player"} drawing` })
        : el("div", { class: "online-result-missing" }, "No drawing submitted"),
      el("p", { class: "online-score" }, `${score}%`),
      el("div", { class: "online-reactions" },
        el("button", {
          class: `online-reaction-btn ${reaction.myVote === "up" ? "active" : ""}`,
          onclick() {
            voteOnDrawing(entry.playerId, reaction.myVote, "up");
          },
        }, `👍 ${reaction.up || 0}`),
        el("button", {
          class: `online-reaction-btn ${reaction.myVote === "down" ? "active" : ""}`,
          onclick() {
            voteOnDrawing(entry.playerId, reaction.myVote, "down");
          },
        }, `👎 ${reaction.down || 0}`),
      ),
    );
  });

  const nextBtn = isOnlineHost()
    ? el("button", {
        class: "btn-play",
        onclick() {
          onlineState.lastError = "";
          const chosenTopic = onlineState.room?.selectedTopic || onlineState.selectedTopicKey || "any";
          const promptData = getRoundPrompt(chosenTopic); // generate prompt based on selected topic 
          onlineSend("start_round", { promptData, duration: 30, topicKey: chosenTopic });
        },
      }, "Next Round")
    : null;

  const leaveBtn = el("button", {
    class: "btn-settings",
    onclick() {
      onlineSend("leave_room");
      disconnectOnlineSocket();
      show(mainMenu());
    },
  }, "Exit");

  const screen = el("div", { class: "screen online-results-screen" },
    el("div", { class: "online-card online-results-card" },
      onlineTopControls(),
      el("h2", { class: "online-title" }, `Round ${round} Results`),
      el("p", { class: "online-subtitle" }, promptText),
      el("div", { class: "online-results-grid" }, ...cards),
      el("div", { class: "btn-group online-actions" },
        nextBtn,
        leaveBtn,
      ),
    ),
  );

  addUiClickSfxToButtons(screen);
  return screen;
}

// ─────────────────────────────────────────────────────────────────
// HELPER — builds a DOM element with attributes and children
// ─────────────────────────────────────────────────────────────────
function el(tag, attrs, ...children) {
 const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;

    if (k === "class") {
      node.className = v;
    } else if (k.startsWith("on")) {
      node.addEventListener(k.slice(2), v);
    } else if (k === "value") {
      node.value = v;
    } else if (k === "checked") {
      node.checked = Boolean(v);
    } else if (k === "selected") {
      node.selected = Boolean(v);
    } else {
      node.setAttribute(k, v);
    }
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
let currentMountedScreen = null;

function show(screen) {
if (currentMountedScreen && typeof currentMountedScreen.__cleanup === "function") {
  currentMountedScreen.__cleanup();
}

currentMountedScreen = screen || null;

  document.body.innerHTML = "";
  const requiresLandscape = Boolean(
    screen && (
      screen.classList.contains("draw-screen") ||
      screen.classList.contains("countdown-screen") ||
      screen.classList.contains("prompt-screen")
    )
  );
  document.body.classList.toggle("require-landscape", requiresLandscape);
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

  // music toggle
  const musicInput = el("input", { type: "checkbox" });
  musicInput.checked = musicEnabled;
  musicInput.addEventListener("change", () => {
    musicEnabled = musicInput.checked;
    if (bgmTrack) {
      if (musicEnabled) {
        bgmTrack.play().catch(() => {});
      } else {
        bgmTrack.pause();
      }
    }
  });

  // sfx toggle
  const sfxInput = el("input", { type: "checkbox" });
  sfxInput.checked = sfxEnabled;
  sfxInput.addEventListener("change", () => {
    sfxEnabled = sfxInput.checked;
  });

  const panel = el("div", { class: "settings-panel" },
    el("h3", {}, "Settings"),
    el("div", { class: "setting-row" },
      el("span", {}, "Dark Mode"),
      el("label", { class: "toggle" }, darkInput, el("span", { class: "toggle-track" })),
    ),
    el("div", { class: "setting-row" },
      el("span", {}, "Music"),
      el("label", { class: "toggle" }, musicInput, el("span", { class: "toggle-track" })),
    ),
    el("div", { class: "setting-row" },
      el("span", {}, "SFX"),
      el("label", { class: "toggle" }, sfxInput, el("span", { class: "toggle-track" })),
    ),
    el("button", { class: "close-btn", onclick: onClose }, "Close"),
  );

  addUiClickSfxToButtons(panel);
  return panel;
}

// ─────────────────────────────────────────────────────────────────
// COUNTDOWN TIMER
// ─────────────────────────────────────────────────────────────────
function countdownTimer(onDone, options = {}) {
  const counts = ["3", "2", "1", "Draw!"];
  let i = 0;
  let paused = false;
  const allowLocalToggle = options.allowLocalToggle !== false;
  const onPauseChange = typeof options.onPauseChange === "function" ? options.onPauseChange : null;
  let countdownSfx = null;
  let countdownLoop = null;

  const numDisplay = el("div", { class: "countdown-number" }, counts[0]);
  const pauseMsg = el("div", { class: "countdown-pause-msg" }, "Paused — tap to resume");

  function startCountdownLoop() {
    if (countdownLoop) return;
    countdownLoop = setInterval(() => {
      if (paused) return;
      i++;
      if (i >= counts.length) {
        clearInterval(countdownLoop);
        stopCountdownSfx();
        onDone();
        return;
      }
      numDisplay.textContent = counts[i];
      numDisplay.classList.remove("pop");
      void numDisplay.offsetWidth;
      numDisplay.classList.add("pop");
    }, 1000);
  }

  function stopCountdownSfx() {
    if (!countdownSfx) return;
    countdownSfx.pause();
    countdownSfx.currentTime = 0;
  }

  if (sfxEnabled) {
    createAudioFromSources(
      ROUND_COUNTDOWN_SFX_SOURCES,
      { volume: 0.62 },
      (audio, tryNext) => {
        countdownSfx = audio;
        audio.play()
          .then(() => {
            startCountdownLoop();
          })
          .catch(() => {
            countdownSfx = null;
            tryNext();
          });
      },
      startCountdownLoop,
    );
    // Safety fallback so UI never stalls if browser delays media events.
    setTimeout(startCountdownLoop, 250);
  } else {
    startCountdownLoop();
  }

  const screen = el("div", {
    class: "screen countdown-screen",
    onclick() {
      if (!allowLocalToggle) return;
      paused = !paused;
      pauseMsg.style.display = paused ? "block" : "none";
      numDisplay.style.opacity = paused ? "0.3" : "1";
      if (onPauseChange) onPauseChange(paused);
      if (!countdownSfx) return;
      if (paused) {
        countdownSfx.pause();
      } else {
        countdownSfx.play().catch(() => {});
      }
    }
  },
    el("p", { class: "countdown-label" }, "Get ready to draw!"),
    el("p", { class: "countdown-tap-hint" }, allowLocalToggle ? "Tap to pause" : "Host controls pause"),
    numDisplay,
    pauseMsg,
  );

  const syncPauseHandler = (event) => {
    const shouldPause = Boolean(event?.detail?.paused);
    paused = shouldPause;
    pauseMsg.style.display = paused ? "block" : "none";
    numDisplay.style.opacity = paused ? "0.3" : "1";
    if (!countdownSfx) return;
    if (paused) {
      countdownSfx.pause();
    } else {
      countdownSfx.play().catch(() => {});
    }
  };

  window.addEventListener("quark-online-countdown-pause", syncPauseHandler);

  const cleanup = () => {
    window.removeEventListener("quark-online-countdown-pause", syncPauseHandler);
  };

  const originalOnDone = onDone;
  onDone = () => {
    cleanup();
    originalOnDone();
  };

  screen.__cleanup = () => {
    if (countdownLoop) clearInterval(countdownLoop);
    stopCountdownSfx();
    window.removeEventListener("quark-online-countdown-pause", syncPauseHandler);
  }

  return screen;
}

// ─────────────────────────────────────────────────────────────────
// ROUND PROMPTS — two-part randomized drawing prompt
// ─────────────────────────────────────────────────────────────────
function getRoundPrompt(topicKey = "any") {
  if (window.PROMPTS && typeof window.PROMPTS.getRandomPrompt === "function") {
    return window.PROMPTS.getRandomPrompt(topicKey);
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

  function historyAiSummary(entry) {
    if (!entry.aiScores) return null;
    return el("div", { class: "history-ai-summary" },
      el("span", { class: "history-chip history-chip-score" }, `AI: ${entry.aiScores.overall ?? 0}%`),
      el("span", { class: "history-chip history-chip-score" }, `Resemblance: ${entry.aiScores.resemblance ?? 0}%`),
      el("span", { class: "history-chip history-chip-score" }, `Color: ${entry.aiScores.color ?? 0}%`),
      el("span", { class: "history-chip history-chip-score" }, `Accuracy: ${entry.aiScores.accuracy ?? 0}%`),
    );
  }

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
              historyAiSummary(entry),
            ),
          ),
        ),
      )
    : el("div", { class: "history-empty" },
        el("p", {}, "No drawing history yet."),
        el("p", { class: "history-empty-sub" }, "Finish a round and your drawings will appear here."),
      );

  const screen = el("div", { class: "screen history-screen" },
    ...(window.innerWidth > 1000 ? [el("img", { class: "logo-img history-logo", src: "quarksketch_logo.png", alt: "QuarkSketch" })] : []),
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

  addUiClickSfxToButtons(screen);
  return screen;
}

function promptScreen(promptData, onStart, options = {}) {
  const showStartButton = options.showStartButton !== false;
  const autoStartDelayMs = Number(options.autoStartDelayMs) > 0 ? Number(options.autoStartDelayMs) : 0;
  let started = false;
  let autoStartTimer = null;

  function startDrawing() {
    if (started) return;
    started = true;
    if (autoStartTimer) {
      clearTimeout(autoStartTimer);
      autoStartTimer = null;
    }
    onStart();
  }

  const screen = el("div", { class: "screen prompt-screen" },
    el("div", { class: "prompt-card" },
      el("h2", { class: "prompt-title" }, "Draw This Round!"),
      el("p", { class: "prompt-full" }, promptData.text),
      showStartButton
        ? el("button", { class: "btn-play prompt-start-btn", onclick: startDrawing }, "Start Drawing")
        : null,
    ),
  );

  if (autoStartDelayMs) {
    autoStartTimer = setTimeout(startDrawing, autoStartDelayMs);
  }

  addUiClickSfxToButtons(screen);
  return screen;
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
const AI_ANALYSIS_SIZE = 96;
const AI_DRAWN_PIXEL_LIGHTNESS_THRESHOLD = 245;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }

  return { h: h * 360, s, l };
}

function classifyColorGroup(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);
  if (s < 0.12) {
    if (l < 0.2) return "black";
    if (l > 0.84) return "white";
    return "gray";
  }
  if (h < 20 || h >= 345) return "red";
  if (h < 50) return "orange";
  if (h < 72) return "yellow";
  if (h < 165) return "green";
  if (h < 200) return "teal";
  if (h < 260) return "blue";
  if (h < 300) return "purple";
  if (h < 345) return "pink";
  return "red";
}

function toScore(value) {
  return Math.round(clamp01(value) * 100);
}

const SHAPE_LABELS = {
  round: "Round/curved",
  boxy: "Boxy/block",
  angular: "Angular/pointed",
  "line-heavy": "Line-heavy",
  organic: "Organic/character",
};

const COLOR_LABELS = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  teal: "Teal",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
  black: "Black",
  white: "White",
  gray: "Gray",
};

const COLOR_HEX = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  teal: "#14b8a6",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
  black: "#1f2937",
  white: "#f8fafc",
  gray: "#94a3b8",
};

function titleCaseColor(name) {
  return COLOR_LABELS[name] || name;
}

function getTopEntries(obj, count = 3) {
  return Object.entries(obj || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, count);
}

function extractPromptExpectations(promptData) {
  const text = (promptData && promptData.text ? promptData.text : "").toLowerCase();
  const subject = (promptData && promptData.subject ? promptData.subject : "").toLowerCase();
  const action = (promptData && promptData.action ? promptData.action : "").toLowerCase();
  const combined = `${text} ${subject} ${action}`.replace(/\s+/g, " ").trim();
  const expectedColors = new Map();
  const shapeTags = new Set();
  let placement = "center";
  let complexityTarget = 0.48;

  function addColor(color, weight = 1) {
    expectedColors.set(color, (expectedColors.get(color) || 0) + weight);
  }

  function hasAny(words) {
    return words.some((word) => combined.includes(word));
  }

  function applyColorRule(rule, boost = 1) {
    if (!rule || !rule.palette) return;
    Object.entries(rule.palette).forEach(([colorName, weight]) => {
      addColor(colorName, weight * boost);
    });
  }

  const COLOR_RULES = [
    {
      keywords: ["flamingo", "princess", "unicorn", "fairy", "cupcake", "mermaid", "peacock"],
      palette: { pink: 2.2, purple: 0.8 },
    },
    {
      keywords: ["ocean", "sea", "river", "lake", "water", "rain", "cloud", "sky", "whale", "dolphin", "shark", "jellyfish", "octopus", "seahorse", "starfish", "snorkeling", "scuba"],
      palette: { blue: 2.2, teal: 1.2 },
    },
    {
      keywords: ["forest", "tree", "grass", "leaf", "frog", "crocodile", "alligator", "iguana", "chameleon", "dragon", "alien", "cactus", "gardener", "planting"],
      palette: { green: 2.1, yellow: 0.7 },
    },
    {
      keywords: ["fire", "lava", "flaming", "sun", "phoenix", "rocket", "explosion", "sparklers", "candles", "campfire"],
      palette: { orange: 2.2, red: 1.5, yellow: 1.1 },
    },
    {
      keywords: ["night", "space", "moon", "shadow", "vampire", "werewolf", "ghost", "wizard", "ninja", "crow", "raven", "orca"],
      palette: { black: 1.8, purple: 1.2, blue: 0.7 },
    },
    {
      keywords: ["snow", "ice", "polar", "winter", "snowman", "cloud", "ghost", "ice wall"],
      palette: { white: 2.2, blue: 1.0, gray: 0.6 },
    },
    {
      keywords: ["robot", "clockwork", "car", "truck", "bus", "train", "spaceship", "laptop", "phone", "machine", "mechanic", "engineer", "metal"],
      palette: { gray: 1.8, blue: 1.0, black: 0.9 },
    },
    {
      keywords: ["penguin", "zebra", "panda", "chess", "newspaper", "photo", "swan"],
      palette: { white: 1.8, black: 1.6, gray: 0.7 },
    },
    {
      keywords: ["lion", "giraffe", "camel", "bear", "fox", "deer", "boar", "yak", "alpaca", "llama", "gingerbread", "wood"],
      palette: { orange: 1.6, yellow: 0.9, black: 0.5 },
    },
    {
      keywords: ["treehouse", "mountain", "hiker", "camping", "fossils", "archaeologist", "paleontologist", "desert", "sandcastle", "castle"],
      palette: { yellow: 1.4, orange: 1.0, green: 0.8 },
    },
    {
      keywords: ["treasure", "crown", "gold", "trophy", "star", "sunflower"],
      palette: { yellow: 2.1, orange: 1.0 },
    },
    {
      keywords: ["flower", "butterfly", "ladybug", "parrot", "toucan", "paint", "rainbow", "fireworks", "party"],
      palette: { pink: 1.0, yellow: 1.0, blue: 1.0, green: 1.0, red: 1.0 },
    },
  ];

  // Apply matched color rules with a stronger boost for exact subject matches.
  COLOR_RULES.forEach((rule) => {
    const subjectMatch = rule.keywords.some((kw) => subject.includes(kw));
    const generalMatch = rule.keywords.some((kw) => combined.includes(kw));
    if (!subjectMatch && !generalMatch) return;
    applyColorRule(rule, subjectMatch ? 1.25 : 1);
  });

  // If no color expectation was matched, keep a balanced default palette.
  if (!expectedColors.size) {
    addColor("blue", 0.8);
    addColor("green", 0.8);
    addColor("orange", 0.8);
  }

  if (hasAny(["sun", "moon", "planet", "ball", "bubble", "wheel", "eye", "head", "jellyfish"])) shapeTags.add("round");
  if (hasAny(["robot", "house", "castle", "book", "bus", "train", "car", "truck", "building", "laptop", "phone"])) shapeTags.add("boxy");
  if (hasAny(["tree", "mountain", "pyramid", "arrow", "triangle", "crown"])) shapeTags.add("angular");
  if (hasAny(["rain", "ladder", "fence", "skateboard", "sword", "guitar", "bridge", "stairs"])) shapeTags.add("line-heavy");
  if (hasAny(["cat", "dog", "bear", "fox", "lion", "tiger", "rabbit", "otter", "human", "wizard", "pirate", "ninja", "astronaut"])) shapeTags.add("organic");

  if (hasAny(["juggling", "dancing", "surfing", "flying", "building", "fighting", "playing", "driving", "cooking", "time traveling", "teleporting", "exploring", "casting"])) {
    complexityTarget = 0.62;
  } else if (hasAny(["reading", "standing", "holding", "walking"])) {
    complexityTarget = 0.52;
  }

  if (hasAny(["flying", "hovering", "parachuting", "sky", "moonwalking", "jumping", "hang gliding"])) placement = "upper";
  if (hasAny(["swimming", "diving", "snorkeling", "underwater", "fishing", "planting", "digging"])) placement = "lower";

  return {
    expectedColors,
    shapeTags: Array.from(shapeTags),
    placement,
    complexityTarget,
  };
}

function analyzeDrawingPixels(imageData) {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);
  const colorCounts = {};
  let drawnPixels = 0;
  let saturatedPixels = 0;
  let saturationSum = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let xSum = 0;
  let ySum = 0;
  let occupiedCells = 0;
  const occupancyGridSize = 12;
  const occupancyGrid = new Uint8Array(occupancyGridSize * occupancyGridSize);

  function toIndex(x, y) {
    return y * width + x;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = (y * width + x) * 4;
      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];
      const a = data[pixelIdx + 3];
      const isDrawn = a > 5 && !(r > AI_DRAWN_PIXEL_LIGHTNESS_THRESHOLD && g > AI_DRAWN_PIXEL_LIGHTNESS_THRESHOLD && b > AI_DRAWN_PIXEL_LIGHTNESS_THRESHOLD);

      if (!isDrawn) continue;
      const idx = toIndex(x, y);
      mask[idx] = 1;
      drawnPixels++;
      xSum += x;
      ySum += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const colorGroup = classifyColorGroup(r, g, b);
      colorCounts[colorGroup] = (colorCounts[colorGroup] || 0) + 1;

      const gx = Math.min(occupancyGridSize - 1, Math.floor((x / width) * occupancyGridSize));
      const gy = Math.min(occupancyGridSize - 1, Math.floor((y / height) * occupancyGridSize));
      const gridIdx = gy * occupancyGridSize + gx;
      if (!occupancyGrid[gridIdx]) {
        occupancyGrid[gridIdx] = 1;
        occupiedCells++;
      }

      const { s } = rgbToHsl(r, g, b);
      saturationSum += s;
      if (s > 0.32) saturatedPixels++;
    }
  }

  if (drawnPixels === 0) {
    return {
      isBlank: true,
      areaRatio: 0,
      bboxRatio: 0,
      centroidX: 0.5,
      centroidY: 0.5,
      compactness: 0,
      rectangularity: 0,
      edgeDensity: 0,
      componentCount: 0,
      verticalSymmetry: 0,
      horizontalSymmetry: 0,
      colorRatios: {},
      colorDiversity: 0,
      avgSaturation: 0,
      vividRatio: 0,
      occupiedCellsRatio: 0,
      bboxAspectMax: 1,
      largestComponentRatio: 0,
      endpointDensity: 0,
      junctionDensity: 0,
      structuralComplexity: 0,
    };
  }

  const bboxWidth = maxX - minX + 1;
  const bboxHeight = maxY - minY + 1;
  const bboxArea = bboxWidth * bboxHeight;
  const areaRatio = drawnPixels / totalPixels;
  const bboxRatio = bboxArea / totalPixels;
  const bboxAspect = bboxWidth / Math.max(1, bboxHeight);
  const bboxAspectMax = Math.max(bboxAspect, 1 / bboxAspect);
  const centroidX = xSum / drawnPixels / (width - 1 || 1);
  const centroidY = ySum / drawnPixels / (height - 1 || 1);
  const occupiedCellsRatio = occupiedCells / (occupancyGridSize * occupancyGridSize);

  let perimeter = 0;
  let edgeLike = 0;
  const gray = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const p = i * 4;
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = toIndex(x, y);
      if (!mask[idx]) continue;

      const left = x > 0 ? mask[toIndex(x - 1, y)] : 0;
      const right = x < width - 1 ? mask[toIndex(x + 1, y)] : 0;
      const up = y > 0 ? mask[toIndex(x, y - 1)] : 0;
      const down = y < height - 1 ? mask[toIndex(x, y + 1)] : 0;
      const borderCount = 4 - (left + right + up + down);
      perimeter += borderCount;

      const gx = x < width - 1 ? Math.abs(gray[idx] - gray[toIndex(x + 1, y)]) : 0;
      const gy = y < height - 1 ? Math.abs(gray[idx] - gray[toIndex(x, y + 1)]) : 0;
      if (gx + gy > 55) edgeLike++;
    }
  }

  const compactness = clamp01((4 * Math.PI * drawnPixels) / ((perimeter * perimeter) + 1));
  const rectangularity = clamp01(drawnPixels / bboxArea);
  const edgeDensity = clamp01(edgeLike / drawnPixels);

  let verticalMatches = 0;
  let verticalChecks = 0;
  let horizontalMatches = 0;
  let horizontalChecks = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mirrorX = width - 1 - x;
      if (mirrorX > x) {
        verticalChecks++;
        if (mask[toIndex(x, y)] === mask[toIndex(mirrorX, y)]) verticalMatches++;
      }

      const mirrorY = height - 1 - y;
      if (mirrorY > y) {
        horizontalChecks++;
        if (mask[toIndex(x, y)] === mask[toIndex(x, mirrorY)]) horizontalMatches++;
      }
    }
  }

  const verticalSymmetry = verticalChecks ? verticalMatches / verticalChecks : 0;
  const horizontalSymmetry = horizontalChecks ? horizontalMatches / horizontalChecks : 0;

  const visited = new Uint8Array(totalPixels);
  let componentCount = 0;
  let largestComponentPixels = 0;
  const queue = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = toIndex(x, y);
      if (!mask[start] || visited[start]) continue;
      componentCount++;
      visited[start] = 1;
      queue.push(start);
      let componentPixels = 0;

      while (queue.length) {
        const idx = queue.pop();
        componentPixels++;
        const cx = idx % width;
        const cy = Math.floor(idx / width);
        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = toIndex(nx, ny);
          if (!mask[ni] || visited[ni]) continue;
          visited[ni] = 1;
          queue.push(ni);
        }
      }

      largestComponentPixels = Math.max(largestComponentPixels, componentPixels);
    }
  }

  let endpointCount = 0;
  let junctionCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = toIndex(x, y);
      if (!mask[idx]) continue;
      let neighbors = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          if (mask[toIndex(x + ox, y + oy)]) neighbors++;
        }
      }
      if (neighbors <= 1) endpointCount++;
      else if (neighbors >= 3) junctionCount++;
    }
  }

  const colorRatios = {};
  Object.entries(colorCounts).forEach(([name, count]) => {
    colorRatios[name] = count / drawnPixels;
  });

  const colorDiversity = Object.keys(colorRatios).length / 8;
  const avgSaturation = saturationSum / drawnPixels;
  const vividRatio = saturatedPixels / drawnPixels;
  const largestComponentRatio = largestComponentPixels / drawnPixels;
  const endpointDensity = endpointCount / drawnPixels;
  const junctionDensity = junctionCount / drawnPixels;
  const structuralComplexity = clamp01((junctionDensity * 25) - (endpointDensity * 4) + 0.18);

  return {
    isBlank: false,
    areaRatio,
    bboxRatio,
    centroidX,
    centroidY,
    compactness,
    rectangularity,
    edgeDensity,
    componentCount,
    verticalSymmetry,
    horizontalSymmetry,
    colorRatios,
    colorDiversity: clamp01(colorDiversity),
    avgSaturation: clamp01(avgSaturation),
    vividRatio: clamp01(vividRatio),
    occupiedCellsRatio: clamp01(occupiedCellsRatio),
    bboxAspectMax,
    largestComponentRatio: clamp01(largestComponentRatio),
    endpointDensity: clamp01(endpointDensity * 8),
    junctionDensity: clamp01(junctionDensity * 20),
    structuralComplexity,
  };
}

function scoreFromFeatures(features, expectations) {
  if (features.isBlank) {
    return {
      resemblance: 0,
      color: 0,
      accuracy: 0,
      overall: 0,
      explanation: "I could not detect any visible strokes yet. Add clear lines or filled shapes to be scored.",
      breakdown: {
        resemblance: "No subject silhouette detected yet.",
        color: "Add visible color strokes to unlock color analysis.",
        accuracy: "Place the subject clearly on the canvas to improve accuracy.",
      },
      expectationReport: {
        expectedShapes: expectations.shapeTags.map((tag) => SHAPE_LABELS[tag] || tag),
        detectedShapes: [],
        expectedPalette: Array.from(expectations.expectedColors.keys()),
        detectedPalette: [],
        missingExpectedColors: Array.from(expectations.expectedColors.keys()),
      },
    };
  }

  const shapeSignals = {
    round: clamp01(features.compactness * 1.25),
    boxy: clamp01((features.rectangularity * 0.72) + (features.verticalSymmetry * 0.18) + (features.horizontalSymmetry * 0.1)),
    angular: clamp01((features.edgeDensity * 0.75) + (features.componentCount / 32)),
    "line-heavy": clamp01((features.edgeDensity * 0.68) + ((1 - features.rectangularity) * 0.32)),
    organic: clamp01(((1 - features.rectangularity) * 0.45) + (features.colorDiversity * 0.25) + (features.componentCount / 30)),
  };

  const shapeMatch = expectations.shapeTags.length
    ? average(expectations.shapeTags.map((tag) => shapeSignals[tag] || 0.35))
    : clamp01(0.3 + (features.edgeDensity * 0.22) + (features.structuralComplexity * 0.28) + (features.colorDiversity * 0.2));

  let placementTargetY = 0.5;
  if (expectations.placement === "upper") placementTargetY = 0.35;
  if (expectations.placement === "lower") placementTargetY = 0.65;
  const placementScore = clamp01(1 - Math.abs(features.centroidY - placementTargetY) / 0.35);

  const complexityTarget = expectations.complexityTarget;
  const complexityObserved = clamp01((features.edgeDensity * 0.6) + ((features.componentCount / 28) * 0.4));
  const complexityScore = clamp01(1 - Math.abs(complexityObserved - complexityTarget) / 0.7);

  const silhouetteScore = clamp01((features.bboxRatio * 0.2) + (features.areaRatio * 1.15));

  const rawResemblance = clamp01(
    (shapeMatch * 0.48) +
    (placementScore * 0.2) +
    (complexityScore * 0.18) +
    (silhouetteScore * 0.14)
  );

  let colorMatch = 0;
  if (expectations.expectedColors.size) {
    let weighted = 0;
    let totalWeight = 0;
    expectations.expectedColors.forEach((weight, colorName) => {
      const seenRatio = features.colorRatios[colorName] || 0;
      weighted += clamp01(seenRatio * 3.6) * weight;
      totalWeight += weight;
    });
    colorMatch = totalWeight ? weighted / totalWeight : 0;
  } else {
    colorMatch = clamp01((features.colorDiversity * 0.65) + (features.vividRatio * 0.35));
  }
  const colorQuality = clamp01((features.avgSaturation * 0.45) + (features.colorDiversity * 0.3) + (features.vividRatio * 0.25));
  const color = toScore((colorMatch * 0.65) + (colorQuality * 0.35));

  const coverageScore = clamp01(1 - Math.abs(features.areaRatio - 0.2) / 0.22);
  const centeringScore = clamp01(1 - (Math.abs(features.centroidX - 0.5) + Math.abs(features.centroidY - 0.5)) / 0.8);
  const coherenceScore = clamp01((features.structuralComplexity * 0.55) + ((1 - Math.abs(features.componentCount - 8) / 24) * 0.45));
  const stabilityScore = clamp01((features.verticalSymmetry + features.horizontalSymmetry) / 2);
  const spreadScore = clamp01((features.occupiedCellsRatio - 0.06) / 0.42);
  const nonLinearityScore = expectations.shapeTags.includes("line-heavy")
    ? 1
    : clamp01(1 - ((features.bboxAspectMax - 1.2) / 5.4));

  const subjectPresence = clamp01(
    (clamp01((features.areaRatio - 0.01) / 0.08) * 0.24) +
    (spreadScore * 0.3) +
    (features.structuralComplexity * 0.26) +
    (nonLinearityScore * 0.2)
  );

  // Hard cap for minimal-stroke drawings so random lines cannot score highly.
  const antiCheeseGate = clamp01((subjectPresence - 0.12) / 0.82);
  const resemblance = toScore(rawResemblance * antiCheeseGate);

  const rawAccuracy = clamp01(
    (coverageScore * 0.34) +
    (centeringScore * 0.17) +
    (coherenceScore * 0.25) +
    (stabilityScore * 0.1) +
    (spreadScore * 0.14)
  );
  const accuracy = toScore(rawAccuracy * antiCheeseGate);

  const overall = Math.round((resemblance * 0.5) + (color * 0.22) + (accuracy * 0.28));

  const categoryScores = [
    ["Resemblance", resemblance],
    ["Color", color],
    ["Accuracy", accuracy],
  ].sort((a, b) => b[1] - a[1]);
  const strongest = categoryScores[0];
  const weakest = categoryScores[2];

  let hint = "try adding a clearer main subject silhouette.";
  if (weakest[0] === "Color") hint = "try using more prompt-matching colors with stronger contrast.";
  if (weakest[0] === "Accuracy") hint = "try centering the subject and keeping details connected.";

  const explanation = `${strongest[0]} is your strongest category at ${strongest[1]}%. For an even better score, ${hint}`;
  const breakdown = {
    resemblance: `Shape and silhouette match: ${Math.round(shapeMatch * 100)}%. Subject presence gate: ${Math.round(antiCheeseGate * 100)}%.`,
    color: `Prompt-color match: ${Math.round(colorMatch * 100)}%. Palette quality: ${Math.round(colorQuality * 100)}%.`,
    accuracy: `Coverage/spread: ${Math.round(((coverageScore + spreadScore) / 2) * 100)}%. Structure/centering: ${Math.round(((coherenceScore + centeringScore) / 2) * 100)}%.`,
  };

  const expectedShapeTags = expectations.shapeTags.length
    ? expectations.shapeTags
    : ["organic", "line-heavy"];

  const detectedShapeRows = Object.entries(shapeSignals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, confidence]) => ({
      name,
      label: SHAPE_LABELS[name] || name,
      confidence: toScore(confidence),
    }));

  const expectedPaletteEntries = Array.from(expectations.expectedColors.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const detectedPalette = getTopEntries(features.colorRatios, 4).map(([name, ratio]) => ({
    name,
    label: titleCaseColor(name),
    ratio: toScore(ratio),
  }));

  const missingExpectedColors = expectedPaletteEntries.filter((colorName) => {
    const seen = features.colorRatios[colorName] || 0;
    return seen < 0.08;
  });

  const expectationReport = {
    expectedShapes: expectedShapeTags.map((tag) => SHAPE_LABELS[tag] || tag),
    detectedShapes: detectedShapeRows,
    expectedPalette: expectedPaletteEntries,
    detectedPalette,
    missingExpectedColors,
  };

  return {
    resemblance,
    color,
    accuracy,
    overall,
    explanation,
    breakdown,
    expectationReport,
  };
}

function analyzeDrawingWithAI(drawingData, promptData) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = AI_ANALYSIS_SIZE;
      canvas.height = AI_ANALYSIS_SIZE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve({
          resemblance: 0,
          color: 0,
          accuracy: 0,
          overall: 0,
          explanation: "Scoring engine could not initialize.",
          breakdown: {
            resemblance: "Scoring engine was unavailable.",
            color: "Scoring engine was unavailable.",
            accuracy: "Scoring engine was unavailable.",
          },
          expectationReport: {
            expectedShapes: [],
            detectedShapes: [],
            expectedPalette: [],
            detectedPalette: [],
            missingExpectedColors: [],
          },
        });
        return;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const features = analyzeDrawingPixels(imageData);
      const expectations = extractPromptExpectations(promptData);
      resolve(scoreFromFeatures(features, expectations));
    };
    img.onerror = () => {
      resolve({
        resemblance: 0,
        color: 0,
        accuracy: 0,
        overall: 0,
        explanation: "Could not read the drawing for analysis.",
        breakdown: {
          resemblance: "The submitted image could not be read.",
          color: "The submitted image could not be read.",
          accuracy: "The submitted image could not be read.",
        },
        expectationReport: {
          expectedShapes: [],
          detectedShapes: [],
          expectedPalette: [],
          detectedPalette: [],
          missingExpectedColors: [],
        },
      });
    };
    img.src = drawingData;
  });
}

function resultsScreen(drawingData, round, promptData, aiReport) {
  const expectedShapeText = aiReport.expectationReport.expectedShapes.length
    ? aiReport.expectationReport.expectedShapes.join(", ")
    : "General subject silhouette";

  const detectedShapeText = aiReport.expectationReport.detectedShapes.length
    ? aiReport.expectationReport.detectedShapes
        .map((shape) => `${shape.label} (${shape.confidence}%)`)
        .join(", ")
    : "No shape profile detected";

  const missingPaletteText = aiReport.expectationReport.missingExpectedColors.length
    ? aiReport.expectationReport.missingExpectedColors.map((name) => titleCaseColor(name)).join(", ")
    : "None";

  const expectedPaletteText = aiReport.expectationReport.expectedPalette.length
    ? aiReport.expectationReport.expectedPalette.map((name) => titleCaseColor(name)).join(", ")
    : "No strict palette required";

  const detectedPaletteText = aiReport.expectationReport.detectedPalette.length
    ? aiReport.expectationReport.detectedPalette
        .map((entry) => `${entry.label} (${entry.ratio}%)`)
        .join(", ")
    : "No dominant palette detected";

  // Drawing thumbnail
  const thumb = el("img", {
    class: "results-thumb",
    src: drawingData,
    alt: "Your drawing",
  });

  // Speech bubble with analysis
  const bubble = el("div", { class: "results-bubble" },
    el("div", { class: "results-bubble-tail" }),
    el("p", { class: "results-comment" }, aiReport.explanation),
  );

  const detailCopy = {
    summary: aiReport.explanation,
    resemblance: `Resemblance: ${aiReport.resemblance}%. ${aiReport.breakdown.resemblance}`,
    color: `Color: ${aiReport.color}%. ${aiReport.breakdown.color}`,
    accuracy: `Accuracy: ${aiReport.accuracy}%. ${aiReport.breakdown.accuracy}`,
    shape: `Expected shape profile: ${expectedShapeText}. Detected shape profile: ${detectedShapeText}.`,
    palette: `Expected palette: ${expectedPaletteText}. Detected palette: ${detectedPaletteText}. Missing expected colors: ${missingPaletteText}.`,
  };

  const detailSelect = el("select", { class: "results-detail-select" },
    el("option", { value: "summary" }, "Summary"),
    el("option", { value: "resemblance" }, "Resemblance"),
    el("option", { value: "color" }, "Color"),
    el("option", { value: "accuracy" }, "Accuracy"),
    el("option", { value: "shape" }, "Shape Scan"),
    el("option", { value: "palette" }, "Palette Scan"),
  );

  const detailText = el("p", { class: "results-detail-content" }, detailCopy.summary);
  detailSelect.addEventListener("change", (e) => {
    detailText.textContent = detailCopy[e.target.value] || detailCopy.summary;
  });

  const detailDropdown = el("details", { class: "results-detail-dropdown" },
    el("summary", { class: "results-detail-summary" }, "Detailed Analysis"),
    el("div", { class: "results-detail-wrap" },
      detailSelect,
      detailText,
    ),
  );

  const overallCard = el("div", { class: "results-overall-card" },
    el("p", { class: "results-overall-label" }, "Overall Rating"),
    el("p", { class: "results-overall-value" }, `${aiReport.overall}%`),
    el("div", { class: "results-overall-meter" },
      el("div", { class: "results-overall-meter-fill", style: `width:${Math.max(0, Math.min(100, aiReport.overall))}%;` }),
    ),
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
      // Left: everything except image
      el("div", { class: "results-left" },
        feedback,
        overallCard,
        detailDropdown,
        el("div", { class: "results-actions" },
          exitBtn,
          nextBtn,
        ),
      ),
      // Right: just the image
      el("div", { class: "results-right" },
        el("div", { class: "results-thumb-wrap" },
          el("p", { class: "results-prompt-chip" }, promptData.text),
          thumb,
          el("p", { class: "results-thumb-label" }, "Your Masterpiece"),
        ),
      ),
    ),
  );

  addUiClickSfxToButtons(screen);

  return screen;
}

// ─────────────────────────────────────────────────────────────────
// DRAWING SCREEN — the main canvas where the player draws
// ─────────────────────────────────────────────────────────────────
function drawingScreen(round = 1, promptData = getRoundPrompt(), options = {}) {
  const canvas = el("canvas", { class: "draw-canvas" });
  const ctx = canvas.getContext("2d");

  const drawStartedAt = Date.now();
  const roundDuration = Number(options.roundDuration) > 0 ? Number(options.roundDuration) : 30;
  let timeLeft = roundDuration;
  let timeUp = false;
  const onRoundFinished = typeof options.onRoundFinished === "function" ? options.onRoundFinished : null;
  const onForceEndRound = typeof options.onForceEndRound === "function" ? options.onForceEndRound : null;
  const enablePeerPreview = Boolean(options.enablePeerPreview);
  const isHostController = Boolean(options.isHostController);
  const getPeerPreviews = typeof options.getPeerPreviews === "function" ? options.getPeerPreviews : () => [];
  const onPreviewData = typeof options.onPreviewData === "function" ? options.onPreviewData : null;

  const timerBox = el("div", { class: "game-timer" }, `Time Remaining: ${timeLeft}s`);
  const drawPrompt = el("div", { class: "draw-prompt" }, promptData.text);

  const peerPreviewTitle = el("p", { class: "peer-preview-title" }, "Other Players");
  const peerPreviewList = el("div", { class: "peer-preview-list" });
  const peerPreviewPanel = el("div", { class: "peer-preview-panel", style: enablePeerPreview ? "" : "display:none;" },
    peerPreviewTitle,
    peerPreviewList,
  );

  function renderPeerPreviews() {
    if (!enablePeerPreview) return;
    const entries = getPeerPreviews();
    peerPreviewList.innerHTML = "";

    if (!entries.length) {
      peerPreviewList.appendChild(el("p", { class: "peer-preview-empty" }, "Waiting for other players to draw..."));
      return;
    }

    entries.forEach((entry) => {
      peerPreviewList.appendChild(
        el("article", { class: "peer-preview-card" },
          el("p", { class: "peer-preview-name" }, entry.playerName || "Player"),
          entry.drawingData
            ? el("img", { class: "peer-preview-image", src: entry.drawingData, alt: `${entry.playerName || "Player"} preview` })
            : el("div", { class: "peer-preview-empty-image" }, "No preview yet"),
        ),
      );
    });
  }

  function sendPreviewSnapshot() {
    if (!enablePeerPreview || !onPreviewData || timeUp) return;
    try {
      const snapshot = exportCanvasWithWhiteBackground("image/jpeg", 0.45);
      onPreviewData(snapshot);
    } catch {
      // Ignore preview encoding failures.
    }
  }

  let currentColor = "#1a1a2e";
  let brushSize = 6; // default = medium
  let erasing = false;
  let lineMode = false;
  let lineStart = null;
  let lineSnapshot = null;
  let shapeMode = false;
let shapeType = null; // — "square", "rect", "circle", "triangle"
let shapeStart = null;
let shapeSnapshot = null;
  let undoStack = [];
  let redoStack = [];
  let fillMode = false;
  let warningSfx = null;
  let warningSfxStarted = false;

  function stopWarningSfx() {
    if (!warningSfx) return;
    warningSfx.pause();
    warningSfx.currentTime = 0;
    warningSfx = null;
    warningSfxStarted = false;
  }

  function startWarningSfx() {
    if (warningSfxStarted || !sfxEnabled) return;
    warningSfxStarted = true;

    createAudioFromSources(TIME_WARNING_SFX_SOURCES, { volume: 0.52, loop: true }, (audio, tryNext) => {
      warningSfx = audio;
      audio.play().catch(() => {
        warningSfx = null;
        tryNext();
      });
    });
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width  = rect.width;
    canvas.height = rect.height;
    ctx.putImageData(snapshot, 0, 0);
    paintWhiteBackdrop();
    ctx.lineCap  = "round";
    ctx.lineJoin = "round";
  }

  function paintWhiteBackdrop() {
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function exportCanvasWithWhiteBackground(format = "image/png", quality) {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return canvas.toDataURL(format, quality);
    exportCtx.fillStyle = "#ffffff";
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(canvas, 0, 0);
    if (typeof quality === "number") {
      return exportCanvas.toDataURL(format, quality);
    }
    return exportCanvas.toDataURL(format);
  }

  let drawing = false;
  let lastX = 0, lastY = 0;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return [src.clientX - rect.left, src.clientY - rect.top];
  }

  function saveState() {
    undoStack.push(exportCanvasWithWhiteBackground("image/png"));
    redoStack = [];
  }

function floodfill(ctx,startX, startY, fillColor, canvas){
  const imageData = ctx.getImageData(0,0, canvas.width,canvas.height);
  const data = imageData.data;

  //Hex to RGBA
  const fillR = parseInt(fillColor.slice(1,3),16);
  const fillG = parseInt(fillColor.slice(3,5),16);
  const fillB = parseInt(fillColor.slice(5,7),16);


  const idx = (Math.floor(startY) * canvas.width + Math.floor(startX)) * 4;
  const targetR = data[idx];
  const targetG = data[idx + 1];
  const targetB = data[idx + 2];
  const targetA = data[idx + 3];

//Don't fill the same colour
if(targetR == fillR && targetG == fillG && targetB == fillB)
  return;

function matchesTarget(i){
  return data[i] == targetR && data[i+1] == targetG &&
  data[i + 2] == targetB && data[i+3] == targetA;
}

//BFS flood still
const stack = [idx];
while (stack.length){
  const i = stack.pop();
  if(!matchesTarget(i)) continue;
  data[i] = fillR;
  data[i + 1] = fillG;
  data[i + 2] = fillB;
  data[i + 3] = 255;

  const pos = i / 4;
  const x = pos % canvas.width;
  const y = Math.floor(pos/canvas.width);
  if (x > 0)             
    stack.push(i-4);
  if (x < canvas.width - 1) 
    stack.push(i+4);
  if (y > 0)               
    stack.push(i - canvas.width *4);
  if (y < canvas.height - 1) 
    stack.push(i + canvas.width *4);
}
ctx.putImageData(imageData,0,0);
}



  function startDraw(e) {
    if (timeUp) return;
    e.preventDefault();
    if (fillMode){
      saveState();
      const[x,y] = getPos(e);
      floodfill(ctx, x, y, currentColor,  canvas);
      return;
    }
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
      if (shapeType === "square") {
        const size = Math.min(Math.abs(x - shapeStart[0]), Math.abs(y - shapeStart[1]));
        const signX = x > shapeStart[0] ? 1 : -1;
        const signY = y > shapeStart[1] ? 1 : -1;
        ctx.strokeRect(shapeStart[0], shapeStart[1], size * signX, size * signY);
      } else if (shapeType === "rect") {
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
  ctx.lineWidth = erasing ? brushSize * 3 : brushSize;
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
      if (shapeType === "square") {
        const size = Math.min(Math.abs(x - shapeStart[0]), Math.abs(y - shapeStart[1]));
        const signX = x > shapeStart[0] ? 1 : -1;
        const signY = y > shapeStart[1] ? 1 : -1;
        ctx.strokeRect(shapeStart[0], shapeStart[1], size * signX, size * signY);
      } else if (shapeType === "rect") {
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
    redoStack.push(exportCanvasWithWhiteBackground("image/png"));
    const img = new Image();
    img.src = undoStack.pop();
    img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); paintWhiteBackdrop(); };
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(exportCanvasWithWhiteBackground("image/png"));
    const img = new Image();
    img.src = redoStack.pop();
    img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); paintWhiteBackdrop(); };
  }

  // ── End round — capture canvas and go to results ──
  function endRound(reason) {
    if (timeUp) return; // guard against double-trigger
    clearInterval(timerInterval);
    clearInterval(previewInterval);
    timeUp = true;
    stopWarningSfx();
    drawing = false;
    submitBtn.disabled = true;

    const drawingData = exportCanvasWithWhiteBackground("image/png");
    const drawDurationSeconds = Math.floor((Date.now() - drawStartedAt) / 1000);

    // Brief flash message, then transition to results
    timerBox.textContent = reason === "submit" ? "Submitted! ✔" : "Time's up!";

    setTimeout(() => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("quark-online-preview-updated", renderPeerPreviews);
      analyzeDrawingWithAI(drawingData, promptData).then((aiReport) => {
        if (reason === "submit") {
          playCelebrationSfx();
        }
        saveHistoryEntry({
          promptText: promptData.text,
          drawingData,
          createdAt: new Date().toISOString(),
          drawDurationSeconds,
          round,
          endReason: reason,
          aiScores: {
            overall: aiReport.overall,
            resemblance: aiReport.resemblance,
            color: aiReport.color,
            accuracy: aiReport.accuracy,
          },
          aiBreakdown: aiReport.breakdown,
          aiSummary: aiReport.explanation,
        });

        if (onRoundFinished) {
          onRoundFinished({
            reason,
            drawingData,
            promptData,
            round,
            aiReport,
            drawDurationSeconds,
          });
          return;
        }

        show(resultsScreen(drawingData, round, promptData, aiReport));
      });
    }, 600);
  }

  canvas.addEventListener("mousedown",  startDraw);
  canvas.addEventListener("mousemove",  draw);
  canvas.addEventListener("mouseup",    stopDraw);
  canvas.addEventListener("mouseleave", stopDraw);
  canvas.addEventListener("touchstart",  startDraw, { passive: false });
  canvas.addEventListener("touchmove",   draw,      { passive: false });
  canvas.addEventListener("touchend",    stopDraw,  { passive: false });

  const colorPanel = el("div", { class: "color-panel", style: "display:none;" },
    el("button", { class: "color-btn", style: "background:#1a1a2e;", onclick() { erasing = false; currentColor = "#1a1a2e"; colorPanel.style.display = "none"; } }),
    el("button", { class: "color-btn", style: "background:#ff4d4d;", onclick() { erasing = false; currentColor = "#ff4d4d"; colorPanel.style.display = "none"; } }),
    el("button", { class: "color-btn", style: "background:#3b82f6;", onclick() { erasing = false; currentColor = "#3b82f6"; colorPanel.style.display = "none"; } }),
    el("button", { class: "color-btn", style: "background:#22c55e;", onclick() { erasing = false; currentColor = "#22c55e"; colorPanel.style.display = "none"; } }),
    el("button", { class: "color-btn", style: "background:#facc15;", onclick() { erasing = false; currentColor = "#facc15"; colorPanel.style.display = "none"; } }),
    el("button", { class: "color-btn", style: "background:#f97316;", onclick() { erasing = false; currentColor = "#f97316"; colorPanel.style.display = "none"; } }),
    el("button", { class: "color-btn", style: "background:#a855f7;", onclick() { erasing = false; currentColor = "#a855f7"; colorPanel.style.display = "none"; } }),
    el("button", { class: "color-btn", style: "background:#ec4899;", onclick() { erasing = false; currentColor = "#ec4899"; colorPanel.style.display = "none"; } }),
    el("button", { class: "color-btn", style: "background:#06b6d4;", onclick() { erasing = false; currentColor = "#06b6d4"; colorPanel.style.display = "none"; } }),
    el("button", { class: "color-btn", style: "background:#84cc16;", onclick() { erasing = false; currentColor = "#84cc16"; colorPanel.style.display = "none"; } }),
    el("button", { class: "color-btn", style: "background:#f59e0b;", onclick() { erasing = false; currentColor = "#f59e0b"; colorPanel.style.display = "none"; } }),
  );

  const markerBtn = el("button", {
    class: "tool-btn tool-active",
    title: "Marker",
    onclick() {
      erasing = false;
      lineMode = false;
      shapeMode = false;
      fillMode = false;
      fillBtn.classList.remove("tool-active");
      markerBtn.classList.add("tool-active");
      eraserBtn.classList.remove("tool-active");
      lineBtn.classList.remove("tool-active");
      shapeBtn.classList.remove("tool-active");
      colorPanel.style.display = colorPanel.style.display === "none" ? "flex" : "none";
    }
  }, el("img", {
    src: "ico/pencil.png",
    alt: "Pencil",
    class: "tool-icon",
  })
);

  const eraserBtn = el("button", {
    class: "tool-btn",
    title: "Eraser",
    onclick() {
      erasing = true;
      lineMode = false;
      shapeMode = false;
      fillMode = false;
      fillBtn.classList.remove("tool-active");
      eraserBtn.classList.add("tool-active");
      markerBtn.classList.remove("tool-active");
      lineBtn.classList.remove("tool-active");
      shapeBtn.classList.remove("tool-active");
      colorPanel.style.display = "none";
    }
  }, el("img", {
    src: "ico/erasor.png",
    alt: "Eraser",
    class: "tool-icon",
  })
);
  const lineBtn = el("button", {
  class: "tool-btn",
  title: "Line Tool",
  onclick() {
    lineMode = true;
    erasing = false;
    shapeMode = false;
    fillMode = false;
    fillBtn.classList.remove("tool-active");
    lineBtn.classList.add("tool-active");
    shapeBtn.classList.remove("tool-active");
    markerBtn.classList.remove("tool-active");
    eraserBtn.classList.remove("tool-active");
    colorPanel.style.display = "none";
  }
}, el("img", {
    src: "ico/line.png",
    alt: "Line",
    class: "tool-icon",
  })
);

const shapePanel = el("div", { class: "shape-panel", style: "display:none;" },
    el("button", { class: "tool-btn", title: "Square", onclick() { shapeType = "square"; shapePanel.style.display = "none"; shapeBtn.textContent = "□"; } }, "□"),
    el("button", { class: "tool-btn", title: "Rectangle", onclick() { shapeType = "rect"; shapePanel.style.display = "none"; shapeBtn.textContent = "▭"; } }, "▭"),
    el("button", { class: "tool-btn", title: "Circle",    onclick() { shapeType = "circle"; shapePanel.style.display = "none"; shapeBtn.textContent = "⬤"; } }, "⬤"),
    el("button", { class: "tool-btn", title: "Triangle",  onclick() { shapeType = "triangle"; shapePanel.style.display = "none"; shapeBtn.textContent = "△"; } }, "△"),
  );

  const shapeBtn = el("button", {
    class: "tool-btn",
    title: "Shape Tool",
    onclick() {
      shapeMode = true;
      shapeType = shapeType || "square";
      erasing = false;
      lineMode = false;
      fillMode = false;
      fillBtn.classList.remove("tool-active");
      shapeBtn.classList.add("tool-active");
      markerBtn.classList.remove("tool-active");
      eraserBtn.classList.remove("tool-active");
      lineBtn.classList.remove("tool-active");
      colorPanel.style.display = "none";
      shapePanel.style.display = shapePanel.style.display === "none" ? "flex" : "none";
    }
  }, "□");

  const fillBtn = el ("button", {
    class: "tool-btn",
    title: "Fill Bucket",
    onclick(){
      fillMode = true;
      erasing =  false;
      lineMode = false;
      shapeMode = false;
      fillBtn.classList.add("tool-active");
      shapeBtn.classList.remove("tool-active");
      markerBtn.classList.remove("tool-active");
      eraserBtn.classList.remove("tool-active");
      lineBtn.classList.remove("tool-active");
      colorPanel.style.display = "none";
    }
  }, el("img", {
    src: "ico/bucket.png",
    alt: "Bucket",
    class: "tool-icon",
  })
);

  const clearBtn = el("button", {
    class: "tool-btn",
    title: "Clear Canvas",
    onclick() {
      if (confirm("Clear the entire canvas?")) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        paintWhiteBackdrop();
      }
    }
  }, 
  el("img", {
    src: "ico/trash.png",
    alt: "Trash",
    class: "tool-icon",
  })
);
  

  const sizePanel = el("div", { class: "size-panel", style: "display:none;" },
    el("div", { class: "size-labels" },
      el("span", { class: "size-label-large" }),
      el("span", { class: "size-label-small" }),
    ),
    el("input", { type: "range", min: "2", max: "20", value: brushSize, class: "size-slider", oninput: (e) => { brushSize = parseInt(e.target.value); updateBrushPreview(); } }),
  );

  const sizeBtn = el("button", {
    class: "tool-btn",
    title: "Brush Size",
    onclick() {
      updateBrushPreview();
      sizePanel.style.display = sizePanel.style.display === "none" ? "flex" : "none";
    }
  }, el("div", { class: "brush-size-preview", style: `width:20px; height:20px;` }));

  function updateBrushPreview() {
    // Preview is fixed size for consistency
  }

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
    sizeBtn,
    sizePanel,
    eraserBtn,
    fillBtn,
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
    onclick() {
      clearInterval(timerInterval);
      clearInterval(previewInterval);
      stopWarningSfx();
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("quark-online-preview-updated", renderPeerPreviews);
      if (typeof options.onExitRound === "function") {
        options.onExitRound();
      } else {
        show(mainMenu());
      }
    }
  }, "←");

  const hostEndRoundBtn = isHostController
    ? el("button", {
        class: "host-end-round-btn",
        title: "Host control: end this round for everyone",
        onclick() {
          if (!onForceEndRound) return;
          if (!confirm("End this round for everyone now?")) return;
          onForceEndRound();
        },
      }, "Host End Round")
    : null;

  const screen = el("div", { class: "draw-screen" },
    sidebar,
    el("div", { class: "canvas-wrap" }, canvas),
    peerPreviewPanel,
    timerBox,
    drawPrompt,
    el("div", { class: "round-badge draw-round-badge" }, `Round ${round}`),
    backBtn,
    hostEndRoundBtn,
    submitBtn,
  );

  requestAnimationFrame(() => resizeCanvas());
  renderPeerPreviews();
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("quark-online-preview-updated", renderPeerPreviews);

  const timerInterval = setInterval(() => {
    timeLeft--;
    timerBox.textContent = `Time Remaining: ${timeLeft}s`;

    // ⚠️ LAST 5 SECONDS WARNING
    if (timeLeft <= 5) {
      timerBox.classList.add("timer-warning");
      startWarningSfx();
    }

    if (timeLeft <= 0) {
      timerBox.textContent = "Time Remaining: 0s";
      endRound("timeout");
    }
  }, 1000);

  const previewInterval = setInterval(() => {
    sendPreviewSnapshot();
  }, 1200);

  function cleanupDrawingScreen() {
    clearInterval(timerInterval);
    clearInterval(previewInterval);

    stopWarningSfx && stopWarningSfx();

    drawing = false;

    window.removeEventListener("resize", resizeCanvas);
    window.removeEventListener("quark-online-preview-updated", renderPeerPreviews);
  }

  screen.__cleanup = cleanupDrawingScreen;

  return screen;
}


// ─────────────────────────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────────────────────────
function chatComponent() {
  const history = el("div", { class: "chat-history" });
  const input = el("input", { type: "text", placeholder: "Type to chat...", class: "chat-input" });

  const send = () => {
    const text = input.value.trim();
    if (text) {
      onlineSend("chat_message", { text });
      input.value = "";
    }
  };

  input.onkeydown = (e) => { if (e.key === "Enter") send(); };

  window.addEventListener("quark-chat-updated", () => {
    history.innerHTML = "";
    onlineState.chatHistory.forEach(msg => {
      const isMe = msg.senderName === onlineState.displayName;
      
      // displays "You" instead of nickname if the message is sent by you
      const nameToDisplay = isMe ? "You" : msg.senderName;

      history.appendChild(el("div", { class: `chat-line ${isMe ? 'is-me' : ''}` },
        el("b", {}, `${nameToDisplay}: `),
        el("span", {}, msg.text)
      ));
    });
    history.scrollTop = history.scrollHeight;
  });

  // Refresh history immediately on load
  setTimeout(() => window.dispatchEvent(new CustomEvent("quark-chat-updated")), 0);

  return el("div", { class: "chat-container" },
    history,
    el("div", { class: "chat-input-row" }, input, el("button", { onclick: send }, "Send"))
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN MENU — first thing the player sees
// ─────────────────────────────────────────────────────────────────


function mainMenu() {
  let settingsOpen = false;
  const settingsSlot = el("div", {});
    if (bgmTrack) {
    bgmTrack.pause();
    bgmTrack.currentTime = 0;
    bgmTrack = null;
}

  bgmTrack = new Audio();
  bgmTrack.src = './audio/track1.mp3';
  bgmTrack.volume = 0.2;
  bgmTrack.loop = true;

// only auto-play if music is enabled
  if (musicEnabled) {
    bgmTrack.play().catch(() => {
    document.addEventListener("click", () => {
      if (musicEnabled && bgmTrack) bgmTrack.play().catch(() => {});
    }, { once: true });
  });
}


  function toggleSettings() {
    settingsOpen = !settingsOpen;
    settingsSlot.innerHTML = "";
    if (settingsOpen) settingsSlot.appendChild(settingsPanel(() => {
      settingsOpen = false;
      settingsSlot.innerHTML = "";
    }));
  }

  const screen = el("div", { class: "screen" },
    el("img", { class: "logo-img", src: "quarksketch_logo.png", alt: "QuarkSketch" }),
    el("div", { class: "btn-group" },
      el("button", { class: "btn-play",     onclick() { startRound(1); } }, "Single Player"),
      el("button", { class: "btn-multi",    onclick() { show(onlineMultiplayerScreen()); } }, "Multiplayer"),
      el("button", { class: "btn-history",  onclick() { show(historyScreen()); } }, "History"),
      el("button", { class: "btn-settings", onclick: toggleSettings }, "Settings"),
    ),
    settingsSlot,
  );

  addUiClickSfxToButtons(screen);
  return screen;
}

// kick everything off
show(mainMenu());