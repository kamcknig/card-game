import {Server} from 'socket.io';
import {MatchConfiguration, ServerEmitEvents, ServerListenEvents} from "shared/types.ts";
import {MatchController} from "./match-controller.ts";
import {sendToSockets} from "./utils/send-to-sockets.ts";
import {getPlayerById} from "./utils/get-player-by-id.ts";
import process from 'node:process';
import {createNewPlayer} from './utils/create-new-player.ts';
import {sessionPlayerMap} from './session-player-map.ts';
import {sessionSocketMap} from './session-socket-map.ts';
import {playerSocketMap} from './player-socket-map.ts';
import {createGame, getGameState} from "./utils/get-game-state.ts";
import {getExpansionList} from "./utils/get-expansion-lists.ts";
import { toNumber } from 'es-toolkit/compat';

const PORT = toNumber(process.env.PORT) || 3000;

export const io = new Server<ServerListenEvents, ServerEmitEvents>({ pingTimeout: 1000 * 60 * 10 });

// When a socket client connects
io.on('connection', async (socket) => {
  const sessionId = socket.handshake.query.get('sessionId');
  
  if (!sessionId) {
    console.error('no session ID, rejecting');
    socket.disconnect();
    return;
  }

  socket.on('startMatch', async function (matchConfig: MatchConfiguration) {
    const player = sessionPlayerMap.get(sessionId);
    console.log(`Received startMatch event from ${player} with configuration`);
    console.log(matchConfig)
    const match = new MatchController([...sessionSocketMap.values()]);
    await match.initialize(matchConfig);
    
    getGameState().started = true;
  });

  socket.on('expansionSelected', (val) => {
    sendToSockets(sessionSocketMap.values(), 'expansionSelected', val);
  })

  socket.on('disconnect', function (arg) {
    console.log('Client disconnected:', socket.id, 'reason', arg);
    
    const disconnectedPlayer = sessionPlayerMap.get(sessionId);
    
    // any new connection will be a new socket ID, so we can delete the old ones
    sessionSocketMap.delete(sessionId);
    // playerSocketMap.delete(disconnectedPlayer.id);

    if (disconnectedPlayer) {
      disconnectedPlayer.connected = false;
      sendToSockets(sessionSocketMap.values(), 'playerDisconnected', disconnectedPlayer, getGameState().players);
    }

    if (!getGameState().players.some(p => p.connected)) {
      console.log('no players left in game, clearing game state completely');
      sessionSocketMap.forEach(s => s.disconnect(true));
      sessionSocketMap.clear();
      sessionPlayerMap.clear();
      playerSocketMap.clear();
      createGame();
      return;
    }

    if (disconnectedPlayer && disconnectedPlayer.id === getGameState().owner) {
      for (const checkPlayer of getGameState().players.filter(p => p.id !== disconnectedPlayer.id)) {
        if (checkPlayer.connected) {
          getGameState().owner = checkPlayer.id;
          sendToSockets(sessionSocketMap.values(), 'gameOwnerUpdated', getGameState().owner);
          break;
        }
      }
    }
  });
  
  sessionSocketMap.set(sessionId, socket);
  
  console.log('New client connected from', socket.handshake.address, 'session ID', sessionId);
  
  // create the game if it doesn't exist
  if (!getGameState()) {
    console.log('No game available');
    createGame();
  }

  let player = sessionPlayerMap.get(sessionId);

  if (!player) {
    console.log('player not found, creating new player and adding to game')
    player = createNewPlayer(sessionId, socket.id);
    getGameState().players = getGameState().players.concat(player);
    sessionPlayerMap.set(sessionId, player);
  } else {
    player.socketId = socket.id;
  }

  player.connected = true;
  
  playerSocketMap.set(player.id, socket);
  
  sendToSockets(sessionSocketMap.values(), 'playerConnected', player, getGameState().players);
  
  // let the player's client know which player they are
  socket.emit('playerSet', player);
  
  if (!getGameState().owner) {
    console.log(`game currently has no owner, assigning player ${player}`);
    getGameState().owner = player.id;
    sendToSockets(sessionSocketMap.values(), 'gameOwnerUpdated', getGameState().owner);
  } else {
    console.log(`game currently owned by ${getPlayerById(getGameState().owner)}`);
  }
  
  const expansionList = await getExpansionList();
  sendToSockets(sessionSocketMap.values(), 'expansionList', [...expansionList]);
});

Deno.serve({
  handler: io.handler(),
  port: PORT,
})