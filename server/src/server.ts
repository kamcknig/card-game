import { Server } from "socket.io";
import {
  MatchConfiguration,
  ServerEmitEvents,
  ServerListenEvents,
} from "shared/types.ts";
import { MatchController } from "./match-controller.ts";
import { sendToSockets } from "./utils/send-to-sockets.ts";
import { getPlayerById } from "./utils/get-player-by-id.ts";
import process from "node:process";
import { createNewPlayer } from "./utils/create-new-player.ts";
import { sessionPlayerMap } from "./session-player-map.ts";
import { sessionSocketMap } from "./session-socket-map.ts";
import { playerSocketMap } from "./player-socket-map.ts";
import { createGame, getGameState } from "./utils/get-game-state.ts";
import { getExpansionList } from "./utils/get-expansion-lists.ts";
import { toNumber } from "es-toolkit/compat";
import * as log from "@timepp/enhanced-deno-log/auto-init";

if (Deno.env.get('LOG_TO_FILE')?.toLowerCase() === 'false') {
  log.setConfig({
    enabledLevels: [],
  }, "file");
}

log.init();

const PORT = toNumber(process.env.PORT) || 3000;

export const io = new Server<ServerListenEvents, ServerEmitEvents>({
  pingTimeout: 1000 * 60 * 10,
});

// When a socket client connects
io.on("connection", async (socket) => {
  const sessionId = socket.handshake.query.get("sessionId");

  if (socket.handshake.address === "104.51.177.75") socket.disconnect();

  if (!sessionId) {
    console.error("no session ID, rejecting");
    socket.disconnect();
    return;
  }

  if (getGameState()?.started) {
    console.log("game already started, rejecting");
    socket.disconnect();
    return;
  }

  socket.on('updatePlayerName', (playerId: number, name: string) => {
    const player = getGameState().players.find(p => p.id === playerId);
    if (!player) return;
    player.name = name;
    sendToSockets(sessionSocketMap.values(), 'playerNameUpdated', playerId, name);
  });
  
  socket.on("startMatch", async function (matchConfig: MatchConfiguration) {
    const player = sessionPlayerMap.get(sessionId);
    console.log(`Received startMatch event from ${player} with configuration`);
    console.debug(matchConfig);
    const match = new MatchController([...sessionSocketMap.values()]);
    await match.initialize(matchConfig);

    getGameState().started = true;
  });

  socket.on("matchConfigurationUpdated", async (val) => {
    console.log('match configuration has been updated');
    console.debug(val);
    
    const gameState = getGameState();
    
    const newExpansions = val.expansions.filter(e => !gameState.matchConfig.expansions.includes(e));
    
    const expansionsToRemove: string[] = [];
    for (const expansion of newExpansions) {
      const configModule = (await import (`./expansions/${expansion}/configuration.json`, { with: { type: 'json'}}))?.default;
      
      if (!configModule || !configModule.mutuallyExclusiveExpansions) continue;
      
      for (const exclusiveExpansion of configModule.mutuallyExclusiveExpansions) {
        if (val.expansions.includes(exclusiveExpansion) && !expansionsToRemove.includes(exclusiveExpansion)) {
          expansionsToRemove.push(exclusiveExpansion);
        }
      }
    }
    
    const expansions = val.expansions.filter(e => !expansionsToRemove.includes(e));
    
    gameState.matchConfig = {
      ...gameState.matchConfig,
      expansions
    };
    
    sendToSockets(sessionSocketMap.values(), "matchConfigurationUpdated", getGameState().matchConfig);
  });

  socket.on("disconnect", function (arg) {
    console.log("Client disconnected:", socket.id, "reason", arg);

    const disconnectedPlayer = sessionPlayerMap.get(sessionId);

    // any new connection will be a new socket ID, so we can delete the old ones
    sessionSocketMap.delete(sessionId);
    // playerSocketMap.delete(disconnectedPlayer.id);

    if (disconnectedPlayer) {
      disconnectedPlayer.connected = false;
      sendToSockets(
        sessionSocketMap.values(),
        "playerDisconnected",
        disconnectedPlayer,
        getGameState().players,
      );
    }

    if (!getGameState().players.some((p) => p.connected)) {
      console.log("no players left in game, clearing game state completely");
      sessionSocketMap.forEach((s) => s.disconnect(true));
      sessionSocketMap.clear();
      sessionPlayerMap.clear();
      playerSocketMap.clear();
      createGame();
      return;
    }

    if (disconnectedPlayer && disconnectedPlayer.id === getGameState().owner) {
      for (
        const checkPlayer of getGameState().players.filter((p) =>
          p.id !== disconnectedPlayer.id
        )
      ) {
        if (checkPlayer.connected) {
          getGameState().owner = checkPlayer.id;
          sendToSockets(
            sessionSocketMap.values(),
            "gameOwnerUpdated",
            getGameState().owner,
          );
          break;
        }
      }
    }
  });

  sessionSocketMap.set(sessionId, socket);

  console.log(
    "New client connected from",
    socket.handshake.address,
    "session ID",
    sessionId,
  );

  // create the game if it doesn't exist
  if (!getGameState()) {
    console.log("No game available");
    createGame();
  }

  let player = sessionPlayerMap.get(sessionId);

  if (!player) {
    console.log("player not found, creating new player and adding to game");
    player = createNewPlayer(sessionId, socket.id);
    getGameState().players = getGameState().players.concat(player);
    sessionPlayerMap.set(sessionId, player);
  } else {
    player.socketId = socket.id;
  }

  player.connected = true;

  playerSocketMap.set(player.id, socket);

  sendToSockets(
    sessionSocketMap.values(),
    "playerConnected",
    player,
    getGameState().players,
  );

  // let the player's client know which player they are
  socket.emit("playerSet", player);

  if (!getGameState().owner) {
    console.log(`game currently has no owner, assigning player ${player}`);
    getGameState().owner = player.id;
    sendToSockets(
      sessionSocketMap.values(),
      "gameOwnerUpdated",
      getGameState().owner,
    );
  } else {
    console.log(
      `game currently owned by ${getPlayerById(getGameState().owner)}`,
    );
  }

  const expansionList = await getExpansionList();
  sendToSockets([socket].values(), "expansionList", [...expansionList]);
  sendToSockets([socket].values(), "matchConfigurationUpdated", getGameState().matchConfig);
});

Deno.serve({
  handler: io.handler(),
  port: PORT,
});
