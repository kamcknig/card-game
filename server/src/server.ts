import { Server } from 'socket.io';
import { ServerEmitEvents, ServerListenEvents, } from 'shared/shared-types.ts';
import { MatchController } from './match-controller.ts';
import { sendToSockets } from './utils/send-to-sockets.ts';
import { getPlayerById } from './utils/get-player-by-id.ts';
import process from 'node:process';
import { createNewPlayer } from './utils/create-new-player.ts';
import { sessionPlayerMap } from './session-player-map.ts';
import { sessionSocketMap } from './session-socket-map.ts';
import { playerSocketMap } from './player-socket-map.ts';
import { createGame, getGameState } from './utils/get-game-state.ts';
import { getExpansionList } from './utils/get-expansion-lists.ts';
import { toNumber } from 'es-toolkit/compat';
import * as log from '@timepp/enhanced-deno-log/auto-init';
import { getPlayerBySessionId } from './utils/get-player-by-session-id.ts';

if (Deno.env.get('LOG_TO_FILE')?.toLowerCase() === 'false') {
  log.setConfig({
    enabledLevels: [],
  }, 'file');
}

log.init();

const PORT = toNumber(process.env.PORT) || 3000;

let matchController: MatchController | undefined;

export const io = new Server<ServerListenEvents, ServerEmitEvents>({
  pingTimeout: 1000 * 60 * 10,
});

// When a socket client connects
io.on('connection', async (socket) => {
  console.log('new client connected');
  const sessionId = socket.handshake.query.get('sessionId');
  console.debug(`connection from ${socket.handshake.address} - session ID ${sessionId}`);
  
  if (!sessionId) {
    console.error('no session ID, rejecting');
    socket.disconnect();
    return;
  }
  
  const onPlayerReady = (playerId: number) => {
    const player = getPlayerById(playerId);
    if (!player) {
      console.debug(`received player ready event from ${playerId} but could not find Player object`);
      return;
    }
    
    console.log(`received ready event from ${player}`);
    
    const ready = !player?.ready;
    player.ready = ready;
    sendToSockets(sessionSocketMap.values().filter(s => s !== socket), 'playerReady', playerId, ready);
    
    if (getGameState().players.some(p => !p.ready)) {
      console.log(`not all players ready yet`);
      return;
    }
    
    console.log(`all players ready, proceeding to start match`);
    
    const config = getGameState().matchConfig;
    console.debug(config);
    getGameState().started = true;
    matchController = new MatchController([...sessionSocketMap.values()]);
    matchController.initialize(config);
    
    getGameState().players.forEach(p => p.ready = false);
    sessionSocketMap.values().forEach(s => s.off('playerReady', onPlayerReady));
  };
  const onSocketDisconnect = (arg: any) => {
    console.log('Client disconnected:', socket.id, 'reason', arg);
    
    const disconnectedPlayer = sessionPlayerMap.get(sessionId);
    
    // any new connection will be a new socket ID, so we can delete the old ones
    sessionSocketMap.delete(sessionId);
    
    if (disconnectedPlayer) {
      playerSocketMap.delete(disconnectedPlayer.id);
      disconnectedPlayer.connected = false;
      
      matchController?.playerDisconnected(disconnectedPlayer);
      
      sendToSockets(
        sessionSocketMap.values(),
        'playerDisconnected',
        disconnectedPlayer,
        getGameState().players,
      );
    }
    
    if (!getGameState().players.some((p) => p.connected)) {
      console.log('no players left in game, clearing game state completely');
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
            'gameOwnerUpdated',
            getGameState().owner,
          );
          break;
        }
      }
    }
  };
  
  if (getGameState()?.started) {
    console.log(`client reconnected with sessio`)
    console.log('game already started');
    
    const player = getPlayerBySessionId(sessionId);
    
    if (!player) {
      console.debug('player not already in game, rejecting');
      socket.disconnect();
      return;
    }
    
    console.debug(`${player} belongs to running game, reconnecting`);
    
    sessionSocketMap.set(sessionId, socket);
    playerSocketMap.set(player.id, socket);
    player.connected = true;
    player.socketId = socket.id;
    socket.on('disconnect', onSocketDisconnect)
    
    await matchController?.playerReconnected(player);
    sendToSockets(sessionSocketMap.values(), 'playerConnected', player, getGameState().players);
    return;
  }

  socket.on('updatePlayerName', (playerId: number, name: string) => {
    const player = getGameState().players.find(p => p.id === playerId);
    if (!player) return;
    player.name = name;
    sendToSockets(sessionSocketMap.values(), 'playerNameUpdated', playerId, name);
  });
  socket.on('playerReady', onPlayerReady);
  socket.on('matchConfigurationUpdated', async (val) => {
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
    
    sendToSockets(sessionSocketMap.values(), 'matchConfigurationUpdated', getGameState().matchConfig);
  });
  socket.on('disconnect', onSocketDisconnect);

  sessionSocketMap.set(sessionId, socket);

  // create the game if it doesn't exist
  if (!getGameState()) {
    console.log('No game available');
    createGame();
  }

  let player = sessionPlayerMap.get(sessionId);

  if (!player) {
    console.log('player not found, creating new player and adding to game');
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
    'playerConnected',
    player,
    getGameState().players,
  );

  // let the player's client know which player they are
  socket.emit('playerSet', player);

  if (!getGameState().owner) {
    console.log(`game currently has no owner, assigning player ${player}`);
    getGameState().owner = player.id;
    sendToSockets(
      sessionSocketMap.values(),
      'gameOwnerUpdated',
      getGameState().owner,
    );
  } else {
    console.log(
      `game currently owned by ${getPlayerById(getGameState().owner)}`,
    );
  }

  const expansionList = await getExpansionList();
  sendToSockets([socket].values(), 'expansionList', [...expansionList]);
  sendToSockets([socket].values(), 'matchConfigurationUpdated', getGameState().matchConfig);
  sendToSockets([socket].values(), 'displayMatchConfiguration');
});

Deno.serve({
  handler: io.handler(),
  port: PORT,
});
