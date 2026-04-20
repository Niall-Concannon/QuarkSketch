const path = require("path");
const express = require("express");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 8080);
const ROUND_DURATION_SECONDS = 30;
const MATCH_TOTAL_ROUNDS = 3;
const FALLBACK_PROMPT = { subject: "robot", action: "dancing in the rain", text: "Draw a robot dancing in the rain" };

const app = express();
app.use(express.static(path.resolve(__dirname)));

app.get("/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

const httpServer = app.listen(PORT, () => {
  console.log(`QuarkSketch server running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server: httpServer });

const clients = new Map();
const rooms = new Map();

function id(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function sanitizeName(name, fallback = "Player") {
  const value = String(name || "").trim();
  if (!value) return fallback;
  return value.slice(0, 24);
}

function sanitizePromptData(promptData) {
  if (!promptData || typeof promptData !== "object") return null;
  const subject = String(promptData.subject || "").trim() || "subject";
  const action = String(promptData.action || "").trim() || "doing something";
  const text = String(promptData.text || "").trim() || `Draw ${subject} ${action}`;
  return { subject, action, text };
}

function getPlayerPromptEntriesFromPayload(room, promptEntries) {
  const entries = new Map();
  if (!promptEntries || typeof promptEntries !== "object") return entries;

  for (const player of room.players.values()) {
    const rawPrompt = promptEntries[player.id];
    const promptData = sanitizePromptData(rawPrompt);
    if (promptData) entries.set(player.id, promptData);
  }

  return entries;
}

function buildFinishSketchAssignments(room, explicitPromptEntries) {
  const assignments = new Map();
  const players = Array.from(room.players.values());
  if (!players.length) return assignments;

  const previousResults = Array.isArray(room.lastResults?.results) ? room.lastResults.results : [];
  const canUseCarryover = previousResults.length >= players.length;

  if (canUseCarryover) {
    const previousByPlayer = new Map(previousResults.map((entry) => [entry.playerId, entry]));
    const playerIds = players.map((player) => player.id);
    const count = playerIds.length;

    playerIds.forEach((playerId, index) => {
      const sourceId = playerIds[(index - 1 + count) % count];
      const source = previousByPlayer.get(sourceId) || previousResults[(index - 1 + count) % previousResults.length];
      assignments.set(playerId, {
        promptData: sanitizePromptData(source?.promptData) || FALLBACK_PROMPT,
        baseDrawingData: source?.drawingData || null,
        sourcePlayerId: source?.playerId || null,
        sourcePlayerName: source?.playerName || "Player",
      });
    });

    return assignments;
  }

  const playerPromptEntries = getPlayerPromptEntriesFromPayload(room, explicitPromptEntries);
  players.forEach((player) => {
    assignments.set(player.id, {
      promptData: playerPromptEntries.get(player.id) || FALLBACK_PROMPT,
      baseDrawingData: null,
      sourcePlayerId: null,
      sourcePlayerName: null,
    });
  });
  return assignments;
}

function safeSend(ws, message) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(message));
}

function serializeRoom(room) {
  const gameSession = room.gameSession || { inProgress: false, currentRound: 0, totalRounds: MATCH_TOTAL_ROUNDS };
  return {
    code: room.code,
    hostId: room.hostId,
    round: room.round,
    hasActiveRound: Boolean(room.activeRound),
    selectedTopic: room.selectedTopic || "any", // show selected topic by host on guest's side
    selectedGameMode: room.selectedGameMode || "hard",
    gameRound: Number(gameSession.currentRound) || 0,
    gameTotalRounds: Number(gameSession.totalRounds) || MATCH_TOTAL_ROUNDS,
    gameInProgress: Boolean(gameSession.inProgress),
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.id === room.hostId,
    })),
  };
}

function buildGameLeaderboard(rounds) {
  const totals = new Map();

  for (const roundEntry of rounds || []) {
    const results = Array.isArray(roundEntry?.results) ? roundEntry.results : [];
    for (const result of results) {
      const key = result.playerId;
      if (!totals.has(key)) {
        totals.set(key, {
          playerId: key,
          playerName: result.playerName || "Player",
          totalOverall: 0,
          rounds: 0,
          bestOverall: 0,
        });
      }
      const entry = totals.get(key);
      const overall = Number(result?.aiScores?.overall || 0);
      entry.totalOverall += overall;
      entry.rounds += 1;
      if (overall > entry.bestOverall) entry.bestOverall = overall;
    }
  }

  return Array.from(totals.values())
    .map((entry) => ({
      playerId: entry.playerId,
      playerName: entry.playerName,
      averageOverall: entry.rounds ? Math.round(entry.totalOverall / entry.rounds) : 0,
      bestOverall: entry.bestOverall,
    }))
    .sort((a, b) => b.averageOverall - a.averageOverall);
}

function closeRoomForAll(room) {
  const players = Array.from(room.players.values());
  for (const player of players) {
    const client = clients.get(player.id);
    if (client) client.roomCode = null;
    safeSend(player.ws, { type: "lobby_closed" });
  }
  rooms.delete(room.code);
}

function reactionKey(round, targetPlayerId) {
  return `${round}:${targetPlayerId}`;
}

function ensureReaction(room, round, targetPlayerId) {
  if (!room.reactions) room.reactions = new Map();
  const key = reactionKey(round, targetPlayerId);
  if (!room.reactions.has(key)) {
    room.reactions.set(key, { up: new Set(), down: new Set() });
  }
  return room.reactions.get(key);
}

function serializeReactions(room, round, viewerId) {
  const results = room.lastResults?.results || [];
  const out = {};
  for (const result of results) {
    const record = ensureReaction(room, round, result.playerId);
    out[result.playerId] = {
      up: record.up.size,
      down: record.down.size,
      myVote: record.up.has(viewerId) ? "up" : (record.down.has(viewerId) ? "down" : null),
    };
  }
  return out;
}

function broadcastRoom(room) {
  const payload = { type: "room_update", payload: { room: serializeRoom(room) } };
  for (const player of room.players.values()) {
    safeSend(player.ws, payload);
  }
}

function removeFromCurrentRoom(client) {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (!room) {
    client.roomCode = null;
    return;
  }

  room.players.delete(client.id);
  client.roomCode = null;

  if (room.activeRound) {
    room.activeRound.submissions.delete(client.id);
  }

  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === client.id) {
    const nextHost = room.players.values().next().value;
    room.hostId = nextHost.id;
  }

  broadcastRoom(room);
}

function finishRound(room) {
  const activeRound = room.activeRound;
  if (!activeRound) return;

  const results = Array.from(room.players.values()).map((player) => {
    const assignment = activeRound.assignments?.get(player.id);
    const submitted = activeRound.submissions.get(player.id);
    if (!submitted) {
      return {
        playerId: player.id,
        playerName: player.name,
        promptData: assignment?.promptData || activeRound.promptData || FALLBACK_PROMPT,
        drawingData: null,
        aiScores: { overall: 0, resemblance: 0, color: 0, accuracy: 0 },
        endReason: "left-or-timeout",
        drawDurationSeconds: activeRound.duration,
      };
    }
    return {
      playerId: player.id,
      playerName: player.name,
      promptData: assignment?.promptData || activeRound.promptData || FALLBACK_PROMPT,
      drawingData: submitted.drawingData,
      aiScores: submitted.aiScores,
      endReason: submitted.endReason || "submit",
      drawDurationSeconds: submitted.drawDurationSeconds,
    };
  }).sort((a, b) => (b.aiScores?.overall || 0) - (a.aiScores?.overall || 0));

  room.round = activeRound.round;
  room.activeRound = null;
  room.lastResults = {
    round: room.round,
    promptData: activeRound.promptData || { text: activeRound.gameMode === "finish_sketch" ? "Finish The Sketch" : FALLBACK_PROMPT.text },
    gameMode: activeRound.gameMode || "hard",
    results,
  };

  if (!room.gameSession) {
    room.gameSession = {
      inProgress: true,
      currentRound: 0,
      totalRounds: MATCH_TOTAL_ROUNDS,
      mode: activeRound.gameMode || "hard",
      duration: activeRound.duration || ROUND_DURATION_SECONDS,
      rounds: [],
    };
  }

  room.gameSession.currentRound = activeRound.round;
  room.gameSession.rounds = Array.isArray(room.gameSession.rounds) ? room.gameSession.rounds : [];
  room.gameSession.rounds.push({
    round: activeRound.round,
    promptData: activeRound.promptData,
    gameMode: activeRound.gameMode || "hard",
    results,
  });

  const gameOver = room.gameSession.currentRound >= room.gameSession.totalRounds;

  room.reactions = new Map();
  for (const result of results) {
    ensureReaction(room, room.round, result.playerId);
  }
  if (gameOver) {
    room.gameSession.inProgress = false;
    const rounds = room.gameSession.rounds;
    const leaderboard = buildGameLeaderboard(rounds);
    for (const player of room.players.values()) {
      safeSend(player.ws, {
        type: "game_over",
        payload: {
          gameMode: room.selectedGameMode || activeRound.gameMode || "hard",
          totalRounds: room.gameSession.totalRounds,
          rounds,
          leaderboard,
        },
      });
    }
  } else {
    for (const player of room.players.values()) {
      safeSend(player.ws, {
        type: "round_results",
        payload: {
          round: room.round,
          promptData: activeRound.promptData,
          gameMode: activeRound.gameMode || "hard",
          results,
          reactions: serializeReactions(room, room.round, player.id),
        },
      });
    }
  }

  broadcastRoom(room);
}

wss.on("connection", (ws) => {
  const client = {
    id: id("p"),
    name: "Player",
    ws,
    roomCode: null,
  };
  clients.set(client.id, client);

  safeSend(ws, { type: "welcome", payload: { playerId: client.id } });

  ws.on("message", (raw) => {
    let incoming;
    try {
      incoming = JSON.parse(String(raw));
    } catch {
      safeSend(ws, { type: "error", payload: { message: "Invalid JSON message." } });
      return;
    }

    const type = incoming?.type;
    const payload = incoming?.payload || {};

    if (type === "create_room") {
      removeFromCurrentRoom(client);
      client.name = sanitizeName(payload.name, "Host");

      let code = roomCode();
      while (rooms.has(code)) code = roomCode();

      const room = {
        code,
        hostId: client.id,
        round: 0,
        players: new Map(),
        activeRound: null,
        selectedTopic: "any",
        selectedGameMode: "hard",
        gameSession: {
          inProgress: false,
          currentRound: 0,
          totalRounds: MATCH_TOTAL_ROUNDS,
          mode: "hard",
          duration: ROUND_DURATION_SECONDS,
          rounds: [],
        },
      };
      room.players.set(client.id, { id: client.id, name: client.name, ws });
      client.roomCode = code;
      rooms.set(code, room);

      safeSend(ws, { type: "room_created", payload: { room: serializeRoom(room), playerId: client.id } });
      broadcastRoom(room);
      return;
    }

    if (type === "join_room") {
      const code = String(payload.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      const room = rooms.get(code);
      if (!room) {
        safeSend(ws, { type: "error", payload: { message: "Room not found." } });
        return;
      }

      removeFromCurrentRoom(client);
      client.name = sanitizeName(payload.name, "Guest");
      room.players.set(client.id, { id: client.id, name: client.name, ws });
      client.roomCode = room.code;

      safeSend(ws, { type: "room_joined", payload: { room: serializeRoom(room), playerId: client.id } });
      broadcastRoom(room);
      return;
    }

    // Allow host to change topic before round starts
  if (type === "set_topic") {
    if (!client.roomCode) {
      safeSend(ws, { type: "error", payload: { message: "Join a room first." } });
      return;
  }

    const room = rooms.get(client.roomCode);
    if (!room) {
      safeSend(ws, { type: "error", payload: { message: "Room not found." } });
      return;
  }

    if (room.hostId !== client.id) {
      safeSend(ws, { type: "error", payload: { message: "Only the host can change the topic." } });
      return;
  }

    if (room.activeRound) {
      safeSend(ws, { type: "error", payload: { message: "Cannot change topic during an active round." } });
      return;
  }

  room.selectedTopic = String(payload.topicKey || "any").trim() || "any";
  broadcastRoom(room);
  return;
}

if (type === "chat_message") {
  const room = rooms.get(client.roomCode);
  if (!room) return;

  const chatPayload = {
    type: "chat_broadcast",
    payload: {
      senderName: client.name,
      text: payload.text,
      senderId: client.id,
      timestamp: Date.now()
    }
  };

  // Send to every player in the room
  for (const player of room.players.values()) {
    safeSend(player.ws, chatPayload);
  }
  return;
}

    if (type === "leave_room") {
      removeFromCurrentRoom(client);
      safeSend(ws, { type: "left_room" });
      return;
    }

    if (type === "start_round") {
      const room = rooms.get(client.roomCode);
      if (!room) {
        safeSend(ws, { type: "error", payload: { message: "Join a room first." } });
        return;
      }
      if (room.hostId !== client.id) {
        safeSend(ws, { type: "error", payload: { message: "Only the host can start a round." } });
        return;
      }
      if (room.players.size < 2) {
        safeSend(ws, { type: "error", payload: { message: "Need at least 2 players in room." } });
        return;
      }
      if (room.activeRound) {
        safeSend(ws, { type: "error", payload: { message: "A round is already active." } });
        return;
      }

      const isNewGame = Boolean(payload.newGame);

      if (isNewGame || !room.gameSession?.inProgress) {
        const gameMode = payload.gameMode === "finish_sketch" ? "finish_sketch" : String(payload.gameMode || "hard");
        const duration = Number(payload.duration) > 0 ? Number(payload.duration) : ROUND_DURATION_SECONDS;
        room.gameSession = {
          inProgress: true,
          currentRound: 0,
          totalRounds: MATCH_TOTAL_ROUNDS,
          mode: gameMode,
          duration,
          rounds: [],
        };
        room.selectedGameMode = gameMode;
      }

      if (!room.gameSession?.inProgress) {
        safeSend(ws, { type: "error", payload: { message: "Start a new game first." } });
        return;
      }

      if (room.gameSession.currentRound >= room.gameSession.totalRounds) {
        safeSend(ws, { type: "error", payload: { message: "Game already completed. Start a new game." } });
        return;
      }

      const gameMode = room.gameSession.mode || "hard";
      const duration = Number(room.gameSession.duration) > 0 ? Number(room.gameSession.duration) : ROUND_DURATION_SECONDS;

      let assignments;
      let roundPromptData;

      if (gameMode === "finish_sketch") {
        const explicitPrompts = room.gameSession.currentRound === 0 ? payload.promptEntries : null;
        assignments = buildFinishSketchAssignments(room, explicitPrompts);
        roundPromptData = { text: "Finish The Sketch" };
      } else {
        const sharedPrompt = sanitizePromptData(payload.promptData) || FALLBACK_PROMPT;
        assignments = new Map();
        for (const player of room.players.values()) {
          assignments.set(player.id, {
            promptData: sharedPrompt,
            baseDrawingData: null,
            sourcePlayerId: null,
            sourcePlayerName: null,
          });
        }
        roundPromptData = sharedPrompt;
      }

      room.activeRound = {
        round: room.gameSession.currentRound + 1,
        promptData: roundPromptData,
        gameMode,
        duration,
        assignments,
        submissions: new Map(),
      };

      for (const player of room.players.values()) {
        const assignment = assignments.get(player.id) || {};
        safeSend(player.ws, {
          type: "round_started",
          payload: {
            round: room.activeRound.round,
            promptData: assignment.promptData || room.activeRound.promptData,
            duration: room.activeRound.duration,
            room: serializeRoom(room),
            gameMode,
            baseDrawingData: assignment.baseDrawingData || null,
            sourcePlayerId: assignment.sourcePlayerId || null,
            sourcePlayerName: assignment.sourcePlayerName || null,
          },
        });
      }
      broadcastRoom(room);
      return;
    }

    if (type === "close_lobby") {
      const room = rooms.get(client.roomCode);
      if (!room) return;
      if (room.hostId !== client.id) {
        safeSend(ws, { type: "error", payload: { message: "Only the host can close the lobby." } });
        return;
      }
      closeRoomForAll(room);
      return;
    }

    if (type === "countdown_pause") {
      const room = rooms.get(client.roomCode);
      if (!room || !room.activeRound) return;
      if (room.hostId !== client.id) return;

      for (const player of room.players.values()) {
        if (player.id === client.id) continue;
        safeSend(player.ws, {
          type: "countdown_pause",
          payload: { paused: Boolean(payload.paused) },
        });
      }
      return;
    }

    if (type === "drawing_preview") {
      const room = rooms.get(client.roomCode);
      if (!room || !room.activeRound) return;
      const currentPlayer = room.players.get(client.id);
      if (!currentPlayer) return;

      const previewData = payload.drawingData || "";
      if (!previewData) return;

      for (const player of room.players.values()) {
        if (player.id === client.id) continue;
        safeSend(player.ws, {
          type: "drawing_preview",
          payload: {
            playerId: client.id,
            playerName: currentPlayer.name,
            drawingData: previewData,
          },
        });
      }
      return;
    }

    if (type === "force_end_round") {
      const room = rooms.get(client.roomCode);
      if (!room || !room.activeRound) {
        safeSend(ws, { type: "error", payload: { message: "No active round to end." } });
        return;
      }
      if (room.hostId !== client.id) {
        safeSend(ws, { type: "error", payload: { message: "Only the host can end the round." } });
        return;
      }
      finishRound(room);
      return;
    }

    if (type === "vote_drawing") {
      const room = rooms.get(client.roomCode);
      if (!room || !room.lastResults) {
        safeSend(ws, { type: "error", payload: { message: "No results available for voting." } });
        return;
      }

      const round = Number(payload.round);
      if (!Number.isFinite(round) || round !== room.lastResults.round) {
        safeSend(ws, { type: "error", payload: { message: "Voting is closed for this round." } });
        return;
      }

      const targetPlayerId = String(payload.targetPlayerId || "").trim();
      const targetExists = room.lastResults.results.some((entry) => entry.playerId === targetPlayerId);
      if (!targetExists) {
        safeSend(ws, { type: "error", payload: { message: "Invalid vote target." } });
        return;
      }

      const vote = payload.vote;
      const record = ensureReaction(room, round, targetPlayerId);
      record.up.delete(client.id);
      record.down.delete(client.id);
      if (vote === "up") record.up.add(client.id);
      if (vote === "down") record.down.add(client.id);

      for (const player of room.players.values()) {
        safeSend(player.ws, {
          type: "round_reactions",
          payload: {
            round,
            reactions: serializeReactions(room, round, player.id),
          },
        });
      }
      return;
    }

    if (type === "submit_round") {
      const room = rooms.get(client.roomCode);
      if (!room || !room.activeRound) {
        safeSend(ws, { type: "error", payload: { message: "No active round to submit." } });
        return;
      }

      room.activeRound.submissions.set(client.id, {
        drawingData: payload.drawingData || null,
        aiScores: payload.aiScores || { overall: 0, resemblance: 0, color: 0, accuracy: 0 },
        endReason: payload.endReason || "submit",
        drawDurationSeconds: Number(payload.drawDurationSeconds) || room.activeRound.duration,
      });

      const submittedCount = room.activeRound.submissions.size;
      const totalPlayers = room.players.size;
      for (const player of room.players.values()) {
        safeSend(player.ws, {
          type: "submission_status",
          payload: {
            submittedCount,
            totalPlayers,
            roomCode: room.code,
          },
        });
      }

      if (submittedCount >= totalPlayers) {
        finishRound(room);
      }
      return;
    }

    safeSend(ws, { type: "error", payload: { message: "Unknown message type." } });
  });

  ws.on("close", () => {
    removeFromCurrentRoom(client);
    clients.delete(client.id);
  });
});
