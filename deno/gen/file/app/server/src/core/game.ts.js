import { MatchBaseConfiguration } from '../types.ts';
import { createNewPlayer } from '../utils/create-new-player.ts';
import { io } from '../server.ts';
import { MatchController } from './match-controller.ts';
import { rawCardLibrary } from '@expansions/expansion-library.ts';
import { applyPatch, compare } from 'https://esm.sh/v123/fast-json-patch@3.1.1/index.js';
import Fuse from 'fuse.js';
import { fisherYatesShuffle } from '../utils/fisher-yates-shuffler.ts';
const defaultMatchConfiguration = {
  expansions: [
    {
      'title': 'Base',
      'name': 'base-v2',
      'order': 1
    },
    {
      'title': 'Intrigue',
      'name': 'intrigue',
      'order': 2
    },
    {
      'title': 'Seaside',
      'name': 'seaside',
      'order': 3
    }
  ],
  preselectedKingdoms: [],
  bannedKingdoms: [],
  players: [],
  basicSupply: [],
  kingdomSupply: [],
  events: [],
  playerStartingHand: {
    ...MatchBaseConfiguration.playerStartingHand
  }
};
export class Game {
  players = [];
  owner;
  matchStarted = false;
  _socketMap = new Map();
  _matchController;
  _matchConfiguration;
  _availableExpansion = [];
  _fuse;
  constructor(){
    console.log(`[game] created`);
    try {
      const bannedKingdoms = JSON.parse(Deno.readTextFileSync('./banned-kingdoms.json'));
      defaultMatchConfiguration.bannedKingdoms = bannedKingdoms;
    } catch (e) {
      console.warn(`Couldn't read banned-kingdoms.json`);
      console.error(e);
    }
    try {
      const preselectedKingdoms = JSON.parse(Deno.readTextFileSync('./preselected-kingdoms.json'));
      console.log(preselectedKingdoms);
      defaultMatchConfiguration.preselectedKingdoms = preselectedKingdoms.map((supply)=>supply.cards[0]);
      console.log(defaultMatchConfiguration.preselectedKingdoms);
    } catch (e) {
      console.warn(`Couldn't read preselected-kingdoms.json`);
      console.error(e);
    }
    this.initializeFuseSearch();
    this.createNewMatch();
  }
  createNewMatch() {
    this._matchController = new MatchController(this._socketMap, (searchTerm)=>this.onSearchCards(searchTerm));
    this._matchConfiguration = {
      ...structuredClone(defaultMatchConfiguration)
    };
  }
  initializeFuseSearch() {
    console.log(`[game] initializing fuse search`);
    if (this._fuse) {
      this._fuse.remove(()=>true);
      this._fuse = undefined;
    }
    const libraryArr = Object.values(rawCardLibrary);
    const index = Fuse.createIndex([
      'cardName'
    ], libraryArr);
    const fuseOptions = {
      ignoreDiacritics: true,
      minMatchCharLength: 1,
      distance: 2,
      keys: [
        'cardName'
      ]
    };
    this._fuse = new Fuse(libraryArr, fuseOptions, index);
  }
  onSearchCards = (searchStr)=>{
    const results = this._fuse?.search(searchStr);
    return results?.map((r)=>r.item) ?? [];
  };
  expansionLoaded(expansion) {
    console.log(`[game] expansion '${expansion.name}' loaded`);
    this._availableExpansion.push(expansion);
    io.in('game').emit('expansionList', this._availableExpansion.sort((a, b)=>b.order - a.order));
    this.initializeFuseSearch();
  }
  addPlayer(sessionId, socket) {
    if (this.players.length >= 6) {
      console.log(`[game] game has 6 players, rejecting`);
      socket.disconnect(true);
      return;
    }
    let player = this.players.find((p)=>p.sessionId === sessionId);
    if (this.matchStarted && !player) {
      console.log(`[game] match has already started, and player not found in game, rejecting`);
      socket.disconnect();
      return;
    }
    if (player) {
      console.log(`[game] ${player} already in match - assigning socket ID`);
      player.socketId = socket.id;
      player.sessionId = sessionId;
    } else {
      player = createNewPlayer(sessionId, socket);
      this.players.push(player);
    }
    socket.join('game');
    player.connected = true;
    this._socketMap.set(player.id, socket);
    socket.emit('setPlayerList', this.players);
    io.in('game').emit('playerConnected', player);
    socket.emit('setPlayer', player);
    if (!this.owner) {
      console.log(`[game] game owner does not exist, setting to ${player}`);
      this.owner = player;
      socket.on('matchConfigurationUpdated', this.onMatchConfigurationUpdated);
      socket.on('searchCards', (playerId, searchTerm)=>{
        this._socketMap.get(playerId)?.emit('searchCardResponse', this.onSearchCards(searchTerm));
      });
    }
    io.in('game').emit('gameOwnerUpdated', this.owner.id);
    console.log(`[game] ${player} added to game`);
    if (this.matchStarted) {
      console.log('[game] game already started');
      this._matchController?.playerReconnected(player.id, socket);
    } else {
      console.log(`[game] not yet started, sending player to match configuration`);
      socket.emit('expansionList', this._availableExpansion.sort((a, b)=>a.order - b.order));
      socket.emit('matchConfigurationUpdated', this._matchConfiguration);
      socket.on('updatePlayerName', this.onUpdatePlayerName);
      socket.on('playerReady', this.onPlayerReady);
    }
    socket.on('disconnect', (arg)=>this.onPlayerDisconnected(player.id, arg.toString()));
  }
  onPlayerDisconnected = (playerId, reason)=>{
    console.log(`[game] ${playerId} disconnected - ${reason}`);
    const player = this.players.find((player)=>player.id === playerId);
    if (!player) {
      this._socketMap.delete(playerId);
      console.warn(`[game] player disconnected, but cannot find player object`);
      return;
    }
    player.connected = false;
    player.ready = false;
    if (!this.players.some((p)=>p.connected)) {
      console.log('[game] no players left in game, clearing game state completely');
      this.clearMatch();
      return;
    }
    if (player.id === this.owner?.id) {
      this._socketMap.get(player.id)?.off('matchConfigurationUpdated');
      this._socketMap.get(player.id)?.off('searchCards');
      const replacement = this.players.find((p)=>p.connected);
      if (replacement) {
        this.owner = replacement;
        io.in('game').emit('gameOwnerUpdated', replacement.id);
        this._socketMap.get(replacement.id)?.on('searchCards', (playerId, searchTerm)=>{
          this._socketMap.get(playerId)?.emit('searchCardResponse', this.onSearchCards(searchTerm));
        });
        this._socketMap.get(replacement.id)?.on('matchConfigurationUpdated', this.onMatchConfigurationUpdated);
      }
    }
    if (this.matchStarted) {
      this._matchController?.playerDisconnected(player.id);
    }
    io.in('game').emit('playerDisconnected', player);
  };
  clearMatch = ()=>{
    console.log(`[game] clearing match`);
    this._socketMap.forEach((socket)=>{
      socket.offAnyIncoming();
      socket.leave('game');
    });
    this._socketMap.clear();
    this.players = [];
    this.owner = undefined;
    this.matchStarted = false;
    this.createNewMatch();
  };
  onMatchConfigurationUpdated = async (newConfig)=>{
    console.log(`[game] received expansionSelected socket event`);
    console.log(newConfig);
    const currentConfig = structuredClone(this._matchConfiguration ?? {});
    const newExpansions = newConfig.expansions.filter((e)=>currentConfig?.expansions?.findIndex((curr)=>curr.name === e.name) === -1);
    const expansionsToRemove = [];
    // go through the new expansions to add, if any are mutually exclusive with some we still have
    // selected, then remove those selected ones as well
    for (const expansion of newExpansions){
      let configModule = undefined;
      try {
        configModule = (await import(`../expansions/${expansion.name}/configuration-${expansion.name}.json`, {
          with: {
            type: 'json'
          }
        }))?.default;
      } catch (e) {
      // nothing
      }
      if (!configModule) {
        console.warn(`[game] could not find config module for expansion '${expansion.name}'`);
        continue;
      }
      if (!configModule.mutuallyExclusiveExpansions) {
        console.log(`[game] module for expansion '${expansion.name}' contains no mutually exclusive expansions`);
        continue;
      }
      console.log(`[game] '${expansion.name}' is mutually exclusive with ${configModule.mutuallyExclusiveExpansions}`);
      for (const exclusiveExpansion of configModule.mutuallyExclusiveExpansions){
        if (currentConfig.expansions.includes(exclusiveExpansion) && !expansionsToRemove.includes(exclusiveExpansion)) {
          console.log(`[game] removing expansion ${exclusiveExpansion} as it is not allowed with ${expansion}`);
          expansionsToRemove.push(exclusiveExpansion);
        }
      }
    }
    const kingdomPatch = compare(currentConfig.kingdomSupply, newConfig.kingdomSupply);
    if (kingdomPatch) {
      Deno.writeTextFileSync('./preselected-kingdoms.json', JSON.stringify(newConfig.kingdomSupply));
      defaultMatchConfiguration.kingdomSupply = structuredClone(newConfig.kingdomSupply);
    }
    const bannedKingdomsPatch = compare(currentConfig.bannedKingdoms, newConfig.bannedKingdoms);
    if (bannedKingdomsPatch) {
      Deno.writeTextFileSync('./banned-kingdoms.json', JSON.stringify(newConfig.bannedKingdoms));
      defaultMatchConfiguration.bannedKingdoms = structuredClone(newConfig.bannedKingdoms);
    }
    const patch = compare(currentConfig, newConfig);
    if (patch.length) {
      applyPatch(this._matchConfiguration, patch);
      defaultMatchConfiguration.preselectedKingdoms = newConfig.kingdomSupply.map((supply)=>supply.cards[0]);
      this._matchConfiguration.preselectedKingdoms = newConfig.kingdomSupply.map((supply)=>supply.cards[0]);
      // lobby phase – raw object still useful for the config screen
      io.in('game').emit('matchConfigurationUpdated', this._matchConfiguration);
    }
  };
  onUpdatePlayerName = (playerId, name)=>{
    console.log(`[game] player ${playerId} request to update name to '${name}'`);
    const player = this.players.find((player)=>player.id === playerId);
    if (player) {
      player.name = name;
      console.log(`[game] ${player} name updated to '${name}'`);
    } else {
      console.log(`[game] player ${playerId} not found`);
    }
    io.in('game').emit('playerNameUpdated', playerId, name);
  };
  onPlayerReady = (playerId)=>{
    const player = this.players.find((player)=>player.id === playerId);
    if (!player) {
      console.log(`[game] received player ready event from ${playerId} but could not find Player object`);
      return;
    }
    console.log(`[game] received ready event from ${player}`);
    player.ready = !player.ready;
    console.log(`[game] marking ${player} as ${player.ready}`);
    io.in('game').except(player.socketId).emit('playerReady', playerId, player.ready);
    if (this.players.some((p)=>!p.ready && p.connected)) {
      console.log(`[game] not all players ready yet`);
      return;
    }
    this.startMatch();
  };
  startMatch() {
    console.log(`[game] all connected players ready, proceeding to start match`);
    this.matchStarted = true;
    this._socketMap.forEach((socket)=>{
      socket.off('updatePlayerName');
      socket.off('playerReady');
      socket.off('matchConfigurationUpdated');
      socket.off('searchCards');
    });
    const colors = [
      '#10FF19',
      '#3c69ff',
      '#FF0BF2',
      '#FFF114',
      '#FF1F11',
      '#FF9900'
    ];
    const players = fisherYatesShuffle(this.players.filter((p)=>p.connected).map((p, idx)=>{
      p.ready = false;
      p.color = colors[idx];
      return p;
    }));
    io.in('game').emit('setPlayerList', players);
    this._matchController?.on('gameOver', this.clearMatch);
    void this._matchController?.initialize({
      ...structuredClone(defaultMatchConfiguration),
      ...this._matchConfiguration,
      players
    });
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvY29yZS9nYW1lLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcFNvY2tldCwgTWF0Y2hCYXNlQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uL3R5cGVzLnRzJztcbmltcG9ydCB7IENhcmROb0lkLCBFeHBhbnNpb25MaXN0RWxlbWVudCwgTWF0Y2hDb25maWd1cmF0aW9uLCBQbGF5ZXIsIFBsYXllcklkLCB9IGZyb20gJ3NoYXJlZC9zaGFyZWQtdHlwZXMudHMnO1xuaW1wb3J0IHsgY3JlYXRlTmV3UGxheWVyIH0gZnJvbSAnLi4vdXRpbHMvY3JlYXRlLW5ldy1wbGF5ZXIudHMnO1xuaW1wb3J0IHsgaW8gfSBmcm9tICcuLi9zZXJ2ZXIudHMnO1xuaW1wb3J0IHsgTWF0Y2hDb250cm9sbGVyIH0gZnJvbSAnLi9tYXRjaC1jb250cm9sbGVyLnRzJztcbmltcG9ydCB7IHJhd0NhcmRMaWJyYXJ5IH0gZnJvbSAnQGV4cGFuc2lvbnMvZXhwYW5zaW9uLWxpYnJhcnkudHMnO1xuaW1wb3J0IHsgYXBwbHlQYXRjaCwgY29tcGFyZSB9IGZyb20gJ2h0dHBzOi8vZXNtLnNoL3YxMjMvZmFzdC1qc29uLXBhdGNoQDMuMS4xL2luZGV4LmpzJztcbmltcG9ydCBGdXNlLCB7IElGdXNlT3B0aW9ucyB9IGZyb20gJ2Z1c2UuanMnO1xuaW1wb3J0IHsgZmlzaGVyWWF0ZXNTaHVmZmxlIH0gZnJvbSAnLi4vdXRpbHMvZmlzaGVyLXlhdGVzLXNodWZmbGVyLnRzJztcblxuY29uc3QgZGVmYXVsdE1hdGNoQ29uZmlndXJhdGlvbjogTWF0Y2hDb25maWd1cmF0aW9uID0ge1xuICBleHBhbnNpb25zOiBbXG4gICAge1xuICAgICAgJ3RpdGxlJzogJ0Jhc2UnLFxuICAgICAgJ25hbWUnOiAnYmFzZS12MicsXG4gICAgICAnb3JkZXInOiAxXG4gICAgfSxcbiAgICB7XG4gICAgICAndGl0bGUnOiAnSW50cmlndWUnLFxuICAgICAgJ25hbWUnOiAnaW50cmlndWUnLFxuICAgICAgJ29yZGVyJzogMlxuICAgIH0sXG4gICAge1xuICAgICAgJ3RpdGxlJzogJ1NlYXNpZGUnLFxuICAgICAgJ25hbWUnOiAnc2Vhc2lkZScsXG4gICAgICAnb3JkZXInOiAzXG4gICAgfVxuICBdLFxuICBwcmVzZWxlY3RlZEtpbmdkb21zOiBbXSxcbiAgYmFubmVkS2luZ2RvbXM6IFtdLFxuICBwbGF5ZXJzOiBbXSxcbiAgYmFzaWNTdXBwbHk6IFtdLFxuICBraW5nZG9tU3VwcGx5OiBbXSxcbiAgZXZlbnRzOiBbXSxcbiAgcGxheWVyU3RhcnRpbmdIYW5kOiB7IC4uLk1hdGNoQmFzZUNvbmZpZ3VyYXRpb24ucGxheWVyU3RhcnRpbmdIYW5kIH1cbn07XG5cbmV4cG9ydCBjbGFzcyBHYW1lIHtcbiAgcHVibGljIHBsYXllcnM6IFBsYXllcltdID0gW107XG4gIHB1YmxpYyBvd25lcjogUGxheWVyIHwgdW5kZWZpbmVkO1xuICBwdWJsaWMgbWF0Y2hTdGFydGVkOiBib29sZWFuID0gZmFsc2U7XG4gIFxuICBwcml2YXRlIF9zb2NrZXRNYXA6IE1hcDxQbGF5ZXJJZCwgQXBwU29ja2V0PiA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBfbWF0Y2hDb250cm9sbGVyOiBNYXRjaENvbnRyb2xsZXIgfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX21hdGNoQ29uZmlndXJhdGlvbjogTWF0Y2hDb25maWd1cmF0aW9uIHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIF9hdmFpbGFibGVFeHBhbnNpb246IEV4cGFuc2lvbkxpc3RFbGVtZW50W10gPSBbXTtcbiAgcHJpdmF0ZSBfZnVzZTogRnVzZTxDYXJkTm9JZD4gfCB1bmRlZmluZWQ7XG4gIFxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBjb25zb2xlLmxvZyhgW2dhbWVdIGNyZWF0ZWRgKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYmFubmVkS2luZ2RvbXMgPSBKU09OLnBhcnNlKERlbm8ucmVhZFRleHRGaWxlU3luYygnLi9iYW5uZWQta2luZ2RvbXMuanNvbicpKSBhcyBDYXJkTm9JZFtdO1xuICAgICAgZGVmYXVsdE1hdGNoQ29uZmlndXJhdGlvbi5iYW5uZWRLaW5nZG9tcyA9IGJhbm5lZEtpbmdkb21zO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUud2FybihgQ291bGRuJ3QgcmVhZCBiYW5uZWQta2luZ2RvbXMuanNvbmApO1xuICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICB9XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHByZXNlbGVjdGVkS2luZ2RvbXMgPSBKU09OLnBhcnNlKERlbm8ucmVhZFRleHRGaWxlU3luYygnLi9wcmVzZWxlY3RlZC1raW5nZG9tcy5qc29uJykpIGFzIHtcbiAgICAgICAgbmFtZTogc3RyaW5nO1xuICAgICAgICBjYXJkczogQ2FyZE5vSWRbXVxuICAgICAgfVtdO1xuICAgICAgY29uc29sZS5sb2cocHJlc2VsZWN0ZWRLaW5nZG9tcyk7XG4gICAgICBkZWZhdWx0TWF0Y2hDb25maWd1cmF0aW9uLnByZXNlbGVjdGVkS2luZ2RvbXMgPSBwcmVzZWxlY3RlZEtpbmdkb21zLm1hcChzdXBwbHkgPT4gc3VwcGx5LmNhcmRzWzBdKTtcbiAgICAgIGNvbnNvbGUubG9nKGRlZmF1bHRNYXRjaENvbmZpZ3VyYXRpb24ucHJlc2VsZWN0ZWRLaW5nZG9tcylcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLndhcm4oYENvdWxkbid0IHJlYWQgcHJlc2VsZWN0ZWQta2luZ2RvbXMuanNvbmApO1xuICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICB9XG4gICAgXG4gICAgdGhpcy5pbml0aWFsaXplRnVzZVNlYXJjaCgpO1xuICAgIFxuICAgIHRoaXMuY3JlYXRlTmV3TWF0Y2goKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBjcmVhdGVOZXdNYXRjaCgpIHtcbiAgICB0aGlzLl9tYXRjaENvbnRyb2xsZXIgPSBuZXcgTWF0Y2hDb250cm9sbGVyKFxuICAgICAgdGhpcy5fc29ja2V0TWFwLFxuICAgICAgKHNlYXJjaFRlcm06IHN0cmluZykgPT4gdGhpcy5vblNlYXJjaENhcmRzKHNlYXJjaFRlcm0pXG4gICAgKTtcbiAgICB0aGlzLl9tYXRjaENvbmZpZ3VyYXRpb24gPSB7IC4uLnN0cnVjdHVyZWRDbG9uZShkZWZhdWx0TWF0Y2hDb25maWd1cmF0aW9uKSB9XG4gIH1cbiAgXG4gIHByaXZhdGUgaW5pdGlhbGl6ZUZ1c2VTZWFyY2goKSB7XG4gICAgY29uc29sZS5sb2coYFtnYW1lXSBpbml0aWFsaXppbmcgZnVzZSBzZWFyY2hgKTtcbiAgICBcbiAgICBpZiAodGhpcy5fZnVzZSkge1xuICAgICAgdGhpcy5fZnVzZS5yZW1vdmUoKCkgPT4gdHJ1ZSk7XG4gICAgICB0aGlzLl9mdXNlID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBsaWJyYXJ5QXJyID0gT2JqZWN0LnZhbHVlcyhyYXdDYXJkTGlicmFyeSk7XG4gICAgY29uc3QgaW5kZXggPSBGdXNlLmNyZWF0ZUluZGV4KFsnY2FyZE5hbWUnXSwgbGlicmFyeUFycik7XG4gICAgXG4gICAgY29uc3QgZnVzZU9wdGlvbnM6IElGdXNlT3B0aW9uczxDYXJkTm9JZD4gPSB7XG4gICAgICBpZ25vcmVEaWFjcml0aWNzOiB0cnVlLFxuICAgICAgbWluTWF0Y2hDaGFyTGVuZ3RoOiAxLFxuICAgICAgZGlzdGFuY2U6IDIsXG4gICAgICBrZXlzOiBbJ2NhcmROYW1lJ11cbiAgICB9O1xuICAgIHRoaXMuX2Z1c2UgPSBuZXcgRnVzZShsaWJyYXJ5QXJyLCBmdXNlT3B0aW9ucywgaW5kZXgpO1xuICB9XG4gIFxuICBwcml2YXRlIG9uU2VhcmNoQ2FyZHMgPSAoc2VhcmNoU3RyOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCByZXN1bHRzID0gdGhpcy5fZnVzZT8uc2VhcmNoKHNlYXJjaFN0cik7XG4gICAgcmV0dXJuIHJlc3VsdHM/Lm1hcChyID0+IHIuaXRlbSkgPz8gW107XG4gIH07XG4gIFxuICBwdWJsaWMgZXhwYW5zaW9uTG9hZGVkKGV4cGFuc2lvbjogRXhwYW5zaW9uTGlzdEVsZW1lbnQpIHtcbiAgICBjb25zb2xlLmxvZyhgW2dhbWVdIGV4cGFuc2lvbiAnJHtleHBhbnNpb24ubmFtZX0nIGxvYWRlZGApO1xuICAgIHRoaXMuX2F2YWlsYWJsZUV4cGFuc2lvbi5wdXNoKGV4cGFuc2lvbik7XG4gICAgaW8uaW4oJ2dhbWUnKS5lbWl0KFxuICAgICAgJ2V4cGFuc2lvbkxpc3QnLFxuICAgICAgdGhpcy5fYXZhaWxhYmxlRXhwYW5zaW9uLnNvcnQoKGEsIGIpID0+IGIub3JkZXIgLSBhLm9yZGVyKSxcbiAgICApO1xuICAgIFxuICAgIHRoaXMuaW5pdGlhbGl6ZUZ1c2VTZWFyY2goKTtcbiAgfVxuICBcbiAgcHVibGljIGFkZFBsYXllcihzZXNzaW9uSWQ6IHN0cmluZywgc29ja2V0OiBBcHBTb2NrZXQpIHtcbiAgICBpZiAodGhpcy5wbGF5ZXJzLmxlbmd0aCA+PSA2KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW2dhbWVdIGdhbWUgaGFzIDYgcGxheWVycywgcmVqZWN0aW5nYCk7XG4gICAgICBzb2NrZXQuZGlzY29ubmVjdCh0cnVlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgbGV0IHBsYXllciA9IHRoaXMucGxheWVycy5maW5kKChwKSA9PiBwLnNlc3Npb25JZCA9PT0gc2Vzc2lvbklkKTtcbiAgICBcbiAgICBpZiAodGhpcy5tYXRjaFN0YXJ0ZWQgJiYgIXBsYXllcikge1xuICAgICAgY29uc29sZS5sb2coYFtnYW1lXSBtYXRjaCBoYXMgYWxyZWFkeSBzdGFydGVkLCBhbmQgcGxheWVyIG5vdCBmb3VuZCBpbiBnYW1lLCByZWplY3RpbmdgLCk7XG4gICAgICBzb2NrZXQuZGlzY29ubmVjdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICBpZiAocGxheWVyKSB7XG4gICAgICBjb25zb2xlLmxvZyhgW2dhbWVdICR7cGxheWVyfSBhbHJlYWR5IGluIG1hdGNoIC0gYXNzaWduaW5nIHNvY2tldCBJRGApO1xuICAgICAgcGxheWVyLnNvY2tldElkID0gc29ja2V0LmlkO1xuICAgICAgcGxheWVyLnNlc3Npb25JZCA9IHNlc3Npb25JZDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBwbGF5ZXIgPSBjcmVhdGVOZXdQbGF5ZXIoc2Vzc2lvbklkLCBzb2NrZXQpO1xuICAgICAgdGhpcy5wbGF5ZXJzLnB1c2gocGxheWVyKTtcbiAgICB9XG4gICAgXG4gICAgc29ja2V0LmpvaW4oJ2dhbWUnKTtcbiAgICBwbGF5ZXIuY29ubmVjdGVkID0gdHJ1ZTtcbiAgICB0aGlzLl9zb2NrZXRNYXAuc2V0KHBsYXllci5pZCwgc29ja2V0KTtcbiAgICBcbiAgICBzb2NrZXQuZW1pdCgnc2V0UGxheWVyTGlzdCcsIHRoaXMucGxheWVycyk7XG4gICAgaW8uaW4oJ2dhbWUnKS5lbWl0KCdwbGF5ZXJDb25uZWN0ZWQnLCBwbGF5ZXIpO1xuICAgIHNvY2tldC5lbWl0KCdzZXRQbGF5ZXInLCBwbGF5ZXIpO1xuICAgIFxuICAgIGlmICghdGhpcy5vd25lcikge1xuICAgICAgY29uc29sZS5sb2coYFtnYW1lXSBnYW1lIG93bmVyIGRvZXMgbm90IGV4aXN0LCBzZXR0aW5nIHRvICR7cGxheWVyfWApO1xuICAgICAgdGhpcy5vd25lciA9IHBsYXllcjtcbiAgICAgIHNvY2tldC5vbignbWF0Y2hDb25maWd1cmF0aW9uVXBkYXRlZCcsIHRoaXMub25NYXRjaENvbmZpZ3VyYXRpb25VcGRhdGVkKTtcbiAgICAgIHNvY2tldC5vbignc2VhcmNoQ2FyZHMnLCAocGxheWVySWQsIHNlYXJjaFRlcm0pID0+IHtcbiAgICAgICAgdGhpcy5fc29ja2V0TWFwLmdldChwbGF5ZXJJZCk/LmVtaXQoJ3NlYXJjaENhcmRSZXNwb25zZScsIHRoaXMub25TZWFyY2hDYXJkcyhzZWFyY2hUZXJtKSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgaW8uaW4oJ2dhbWUnKS5lbWl0KCdnYW1lT3duZXJVcGRhdGVkJywgdGhpcy5vd25lci5pZCk7XG4gICAgXG4gICAgY29uc29sZS5sb2coYFtnYW1lXSAke3BsYXllcn0gYWRkZWQgdG8gZ2FtZWApO1xuICAgIFxuICAgIGlmICh0aGlzLm1hdGNoU3RhcnRlZCkge1xuICAgICAgY29uc29sZS5sb2coJ1tnYW1lXSBnYW1lIGFscmVhZHkgc3RhcnRlZCcpO1xuICAgICAgdGhpcy5fbWF0Y2hDb250cm9sbGVyPy5wbGF5ZXJSZWNvbm5lY3RlZChwbGF5ZXIuaWQsIHNvY2tldCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coYFtnYW1lXSBub3QgeWV0IHN0YXJ0ZWQsIHNlbmRpbmcgcGxheWVyIHRvIG1hdGNoIGNvbmZpZ3VyYXRpb25gLCk7XG4gICAgICBzb2NrZXQuZW1pdChcbiAgICAgICAgJ2V4cGFuc2lvbkxpc3QnLFxuICAgICAgICB0aGlzLl9hdmFpbGFibGVFeHBhbnNpb24uc29ydCgoYSwgYikgPT4gYS5vcmRlciAtIGIub3JkZXIpLFxuICAgICAgKTtcbiAgICAgIFxuICAgICAgc29ja2V0LmVtaXQoJ21hdGNoQ29uZmlndXJhdGlvblVwZGF0ZWQnLCB0aGlzLl9tYXRjaENvbmZpZ3VyYXRpb24hKTtcbiAgICAgIHNvY2tldC5vbigndXBkYXRlUGxheWVyTmFtZScsIHRoaXMub25VcGRhdGVQbGF5ZXJOYW1lKTtcbiAgICAgIHNvY2tldC5vbigncGxheWVyUmVhZHknLCB0aGlzLm9uUGxheWVyUmVhZHkpO1xuICAgIH1cbiAgICBcbiAgICBzb2NrZXQub24oXG4gICAgICAnZGlzY29ubmVjdCcsXG4gICAgICAoYXJnKSA9PiB0aGlzLm9uUGxheWVyRGlzY29ubmVjdGVkKHBsYXllci5pZCwgYXJnLnRvU3RyaW5nKCkpLFxuICAgICk7XG4gIH1cbiAgXG4gIHByaXZhdGUgb25QbGF5ZXJEaXNjb25uZWN0ZWQgPSAocGxheWVySWQ6IG51bWJlciwgcmVhc29uOiBzdHJpbmcpID0+IHtcbiAgICBjb25zb2xlLmxvZyhgW2dhbWVdICR7cGxheWVySWR9IGRpc2Nvbm5lY3RlZCAtICR7cmVhc29ufWApO1xuICAgIFxuICAgIGNvbnN0IHBsYXllciA9IHRoaXMucGxheWVycy5maW5kKChwbGF5ZXIpID0+IHBsYXllci5pZCA9PT0gcGxheWVySWQpO1xuICAgIGlmICghcGxheWVyKSB7XG4gICAgICB0aGlzLl9zb2NrZXRNYXAuZGVsZXRlKHBsYXllcklkKTtcbiAgICAgIGNvbnNvbGUud2FybihgW2dhbWVdIHBsYXllciBkaXNjb25uZWN0ZWQsIGJ1dCBjYW5ub3QgZmluZCBwbGF5ZXIgb2JqZWN0YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIHBsYXllci5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICBwbGF5ZXIucmVhZHkgPSBmYWxzZTtcbiAgICBcbiAgICBpZiAoIXRoaXMucGxheWVycy5zb21lKChwKSA9PiBwLmNvbm5lY3RlZCkpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbZ2FtZV0gbm8gcGxheWVycyBsZWZ0IGluIGdhbWUsIGNsZWFyaW5nIGdhbWUgc3RhdGUgY29tcGxldGVseScsKTtcbiAgICAgIHRoaXMuY2xlYXJNYXRjaCgpXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGlmIChwbGF5ZXIuaWQgPT09IHRoaXMub3duZXI/LmlkKSB7XG4gICAgICB0aGlzLl9zb2NrZXRNYXAuZ2V0KHBsYXllci5pZCk/Lm9mZignbWF0Y2hDb25maWd1cmF0aW9uVXBkYXRlZCcpO1xuICAgICAgdGhpcy5fc29ja2V0TWFwLmdldChwbGF5ZXIuaWQpPy5vZmYoJ3NlYXJjaENhcmRzJyk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlcGxhY2VtZW50ID0gdGhpcy5wbGF5ZXJzLmZpbmQocCA9PiBwLmNvbm5lY3RlZCk7XG4gICAgICBpZiAocmVwbGFjZW1lbnQpIHtcbiAgICAgICAgdGhpcy5vd25lciA9IHJlcGxhY2VtZW50O1xuICAgICAgICBpby5pbignZ2FtZScpLmVtaXQoJ2dhbWVPd25lclVwZGF0ZWQnLCByZXBsYWNlbWVudC5pZCk7XG4gICAgICAgIHRoaXMuX3NvY2tldE1hcC5nZXQocmVwbGFjZW1lbnQuaWQpPy5vbignc2VhcmNoQ2FyZHMnLCAocGxheWVySWQsIHNlYXJjaFRlcm0pID0+IHtcbiAgICAgICAgICB0aGlzLl9zb2NrZXRNYXAuZ2V0KHBsYXllcklkKT8uZW1pdCgnc2VhcmNoQ2FyZFJlc3BvbnNlJywgdGhpcy5vblNlYXJjaENhcmRzKHNlYXJjaFRlcm0pKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3NvY2tldE1hcC5nZXQocmVwbGFjZW1lbnQuaWQpPy5vbignbWF0Y2hDb25maWd1cmF0aW9uVXBkYXRlZCcsIHRoaXMub25NYXRjaENvbmZpZ3VyYXRpb25VcGRhdGVkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYgKHRoaXMubWF0Y2hTdGFydGVkKSB7XG4gICAgICB0aGlzLl9tYXRjaENvbnRyb2xsZXI/LnBsYXllckRpc2Nvbm5lY3RlZChwbGF5ZXIuaWQpO1xuICAgIH1cbiAgICBpby5pbignZ2FtZScpLmVtaXQoJ3BsYXllckRpc2Nvbm5lY3RlZCcsIHBsYXllcik7XG4gIH07XG4gIFxuICBwcml2YXRlIGNsZWFyTWF0Y2ggPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coYFtnYW1lXSBjbGVhcmluZyBtYXRjaGApO1xuICAgIFxuICAgIHRoaXMuX3NvY2tldE1hcC5mb3JFYWNoKChzb2NrZXQpID0+IHtcbiAgICAgIHNvY2tldC5vZmZBbnlJbmNvbWluZygpO1xuICAgICAgc29ja2V0LmxlYXZlKCdnYW1lJyk7XG4gICAgfSk7XG4gICAgXG4gICAgdGhpcy5fc29ja2V0TWFwLmNsZWFyKCk7XG4gICAgdGhpcy5wbGF5ZXJzID0gW107XG4gICAgdGhpcy5vd25lciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLm1hdGNoU3RhcnRlZCA9IGZhbHNlO1xuICAgIHRoaXMuY3JlYXRlTmV3TWF0Y2goKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBvbk1hdGNoQ29uZmlndXJhdGlvblVwZGF0ZWQgPSBhc3luYyAobmV3Q29uZmlnOiBNYXRjaENvbmZpZ3VyYXRpb24pID0+IHtcbiAgICBjb25zb2xlLmxvZyhgW2dhbWVdIHJlY2VpdmVkIGV4cGFuc2lvblNlbGVjdGVkIHNvY2tldCBldmVudGApO1xuICAgIGNvbnNvbGUubG9nKG5ld0NvbmZpZyk7XG4gICAgXG4gICAgY29uc3QgY3VycmVudENvbmZpZyA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLl9tYXRjaENvbmZpZ3VyYXRpb24gPz8ge30pIGFzIE1hdGNoQ29uZmlndXJhdGlvbjtcbiAgICBcbiAgICBjb25zdCBuZXdFeHBhbnNpb25zID0gbmV3Q29uZmlnLmV4cGFuc2lvbnMuZmlsdGVyKFxuICAgICAgKGUpID0+IGN1cnJlbnRDb25maWc/LmV4cGFuc2lvbnM/LmZpbmRJbmRleChjdXJyID0+IGN1cnIubmFtZSA9PT0gZS5uYW1lKSA9PT0gLTEsXG4gICAgKTtcbiAgICBcbiAgICBjb25zdCBleHBhbnNpb25zVG9SZW1vdmU6IEV4cGFuc2lvbkxpc3RFbGVtZW50W10gPSBbXTtcbiAgICBcbiAgICAvLyBnbyB0aHJvdWdoIHRoZSBuZXcgZXhwYW5zaW9ucyB0byBhZGQsIGlmIGFueSBhcmUgbXV0dWFsbHkgZXhjbHVzaXZlIHdpdGggc29tZSB3ZSBzdGlsbCBoYXZlXG4gICAgLy8gc2VsZWN0ZWQsIHRoZW4gcmVtb3ZlIHRob3NlIHNlbGVjdGVkIG9uZXMgYXMgd2VsbFxuICAgIGZvciAoY29uc3QgZXhwYW5zaW9uIG9mIG5ld0V4cGFuc2lvbnMpIHtcbiAgICAgIGxldCBjb25maWdNb2R1bGUgPSB1bmRlZmluZWQ7XG4gICAgICBcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbmZpZ01vZHVsZSA9XG4gICAgICAgICAgKGF3YWl0IGltcG9ydChgLi4vZXhwYW5zaW9ucy8ke2V4cGFuc2lvbi5uYW1lfS9jb25maWd1cmF0aW9uLSR7ZXhwYW5zaW9uLm5hbWV9Lmpzb25gLCB7XG4gICAgICAgICAgICB3aXRoOiB7IHR5cGU6ICdqc29uJyB9LFxuICAgICAgICAgIH0pKT8uZGVmYXVsdDtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gbm90aGluZ1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoIWNvbmZpZ01vZHVsZSkge1xuICAgICAgICBjb25zb2xlLndhcm4oYFtnYW1lXSBjb3VsZCBub3QgZmluZCBjb25maWcgbW9kdWxlIGZvciBleHBhbnNpb24gJyR7ZXhwYW5zaW9uLm5hbWV9J2AsKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmICghY29uZmlnTW9kdWxlLm11dHVhbGx5RXhjbHVzaXZlRXhwYW5zaW9ucykge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2dhbWVdIG1vZHVsZSBmb3IgZXhwYW5zaW9uICcke2V4cGFuc2lvbi5uYW1lfScgY29udGFpbnMgbm8gbXV0dWFsbHkgZXhjbHVzaXZlIGV4cGFuc2lvbnNgLCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2dhbWVdICcke2V4cGFuc2lvbi5uYW1lfScgaXMgbXV0dWFsbHkgZXhjbHVzaXZlIHdpdGggJHtjb25maWdNb2R1bGUubXV0dWFsbHlFeGNsdXNpdmVFeHBhbnNpb25zfWAsKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBleGNsdXNpdmVFeHBhbnNpb24gb2YgY29uZmlnTW9kdWxlLm11dHVhbGx5RXhjbHVzaXZlRXhwYW5zaW9ucykge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgY3VycmVudENvbmZpZy5leHBhbnNpb25zLmluY2x1ZGVzKGV4Y2x1c2l2ZUV4cGFuc2lvbikgJiZcbiAgICAgICAgICAhZXhwYW5zaW9uc1RvUmVtb3ZlLmluY2x1ZGVzKGV4Y2x1c2l2ZUV4cGFuc2lvbilcbiAgICAgICAgKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtnYW1lXSByZW1vdmluZyBleHBhbnNpb24gJHtleGNsdXNpdmVFeHBhbnNpb259IGFzIGl0IGlzIG5vdCBhbGxvd2VkIHdpdGggJHtleHBhbnNpb259YCwpO1xuICAgICAgICAgIGV4cGFuc2lvbnNUb1JlbW92ZS5wdXNoKGV4Y2x1c2l2ZUV4cGFuc2lvbik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgY29uc3Qga2luZ2RvbVBhdGNoID0gY29tcGFyZShjdXJyZW50Q29uZmlnLmtpbmdkb21TdXBwbHksIG5ld0NvbmZpZy5raW5nZG9tU3VwcGx5KTtcbiAgICBpZiAoa2luZ2RvbVBhdGNoKSB7XG4gICAgICBEZW5vLndyaXRlVGV4dEZpbGVTeW5jKCcuL3ByZXNlbGVjdGVkLWtpbmdkb21zLmpzb24nLCBKU09OLnN0cmluZ2lmeShuZXdDb25maWcua2luZ2RvbVN1cHBseSkpO1xuICAgICAgZGVmYXVsdE1hdGNoQ29uZmlndXJhdGlvbi5raW5nZG9tU3VwcGx5ID0gc3RydWN0dXJlZENsb25lKG5ld0NvbmZpZy5raW5nZG9tU3VwcGx5KTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYmFubmVkS2luZ2RvbXNQYXRjaCA9IGNvbXBhcmUoY3VycmVudENvbmZpZy5iYW5uZWRLaW5nZG9tcywgbmV3Q29uZmlnLmJhbm5lZEtpbmdkb21zKTtcbiAgICBpZiAoYmFubmVkS2luZ2RvbXNQYXRjaCkge1xuICAgICAgRGVuby53cml0ZVRleHRGaWxlU3luYygnLi9iYW5uZWQta2luZ2RvbXMuanNvbicsIEpTT04uc3RyaW5naWZ5KG5ld0NvbmZpZy5iYW5uZWRLaW5nZG9tcykpO1xuICAgICAgZGVmYXVsdE1hdGNoQ29uZmlndXJhdGlvbi5iYW5uZWRLaW5nZG9tcyA9IHN0cnVjdHVyZWRDbG9uZShuZXdDb25maWcuYmFubmVkS2luZ2RvbXMpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBwYXRjaCA9IGNvbXBhcmUoY3VycmVudENvbmZpZywgbmV3Q29uZmlnKTtcbiAgICBcbiAgICBpZiAocGF0Y2gubGVuZ3RoKSB7XG4gICAgICBhcHBseVBhdGNoKHRoaXMuX21hdGNoQ29uZmlndXJhdGlvbiwgcGF0Y2gpXG4gICAgICBkZWZhdWx0TWF0Y2hDb25maWd1cmF0aW9uLnByZXNlbGVjdGVkS2luZ2RvbXMgPSBuZXdDb25maWcua2luZ2RvbVN1cHBseS5tYXAoc3VwcGx5ID0+IHN1cHBseS5jYXJkc1swXSk7XG4gICAgICB0aGlzLl9tYXRjaENvbmZpZ3VyYXRpb24hLnByZXNlbGVjdGVkS2luZ2RvbXMgPSBuZXdDb25maWcua2luZ2RvbVN1cHBseS5tYXAoc3VwcGx5ID0+IHN1cHBseS5jYXJkc1swXSlcbiAgICAgIC8vIGxvYmJ5IHBoYXNlIOKAkyByYXcgb2JqZWN0IHN0aWxsIHVzZWZ1bCBmb3IgdGhlIGNvbmZpZyBzY3JlZW5cbiAgICAgIGlvLmluKCdnYW1lJykuZW1pdCgnbWF0Y2hDb25maWd1cmF0aW9uVXBkYXRlZCcsIHRoaXMuX21hdGNoQ29uZmlndXJhdGlvbiEpO1xuICAgIH1cbiAgfTtcbiAgXG4gIHByaXZhdGUgb25VcGRhdGVQbGF5ZXJOYW1lID0gKHBsYXllcklkOiBudW1iZXIsIG5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtnYW1lXSBwbGF5ZXIgJHtwbGF5ZXJJZH0gcmVxdWVzdCB0byB1cGRhdGUgbmFtZSB0byAnJHtuYW1lfSdgLFxuICAgICk7XG4gICAgXG4gICAgY29uc3QgcGxheWVyID0gdGhpcy5wbGF5ZXJzLmZpbmQoKHBsYXllcikgPT4gcGxheWVyLmlkID09PSBwbGF5ZXJJZCk7XG4gICAgXG4gICAgaWYgKHBsYXllcikge1xuICAgICAgcGxheWVyLm5hbWUgPSBuYW1lO1xuICAgICAgY29uc29sZS5sb2coYFtnYW1lXSAke3BsYXllcn0gbmFtZSB1cGRhdGVkIHRvICcke25hbWV9J2ApO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKGBbZ2FtZV0gcGxheWVyICR7cGxheWVySWR9IG5vdCBmb3VuZGApO1xuICAgIH1cbiAgICBcbiAgICBpby5pbignZ2FtZScpLmVtaXQoJ3BsYXllck5hbWVVcGRhdGVkJywgcGxheWVySWQsIG5hbWUpO1xuICB9O1xuICBcbiAgcHJpdmF0ZSBvblBsYXllclJlYWR5ID0gKHBsYXllcklkOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBwbGF5ZXIgPSB0aGlzLnBsYXllcnMuZmluZCgocGxheWVyKSA9PiBwbGF5ZXIuaWQgPT09IHBsYXllcklkKTtcbiAgICBcbiAgICBpZiAoIXBsYXllcikge1xuICAgICAgY29uc29sZS5sb2coYFtnYW1lXSByZWNlaXZlZCBwbGF5ZXIgcmVhZHkgZXZlbnQgZnJvbSAke3BsYXllcklkfSBidXQgY291bGQgbm90IGZpbmQgUGxheWVyIG9iamVjdGAsKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgY29uc29sZS5sb2coYFtnYW1lXSByZWNlaXZlZCByZWFkeSBldmVudCBmcm9tICR7cGxheWVyfWApO1xuICAgIFxuICAgIHBsYXllci5yZWFkeSA9ICFwbGF5ZXIucmVhZHk7XG4gICAgY29uc29sZS5sb2coYFtnYW1lXSBtYXJraW5nICR7cGxheWVyfSBhcyAke3BsYXllci5yZWFkeX1gKTtcbiAgICBpby5pbignZ2FtZScpLmV4Y2VwdChwbGF5ZXIuc29ja2V0SWQpLmVtaXQoJ3BsYXllclJlYWR5JywgcGxheWVySWQsIHBsYXllci5yZWFkeSk7XG4gICAgXG4gICAgaWYgKHRoaXMucGxheWVycy5zb21lKChwKSA9PiAhcC5yZWFkeSAmJiBwLmNvbm5lY3RlZCkpIHtcbiAgICAgIGNvbnNvbGUubG9nKGBbZ2FtZV0gbm90IGFsbCBwbGF5ZXJzIHJlYWR5IHlldGApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICB0aGlzLnN0YXJ0TWF0Y2goKTtcbiAgfTtcbiAgXG4gIHByaXZhdGUgc3RhcnRNYXRjaCgpIHtcbiAgICBjb25zb2xlLmxvZyhgW2dhbWVdIGFsbCBjb25uZWN0ZWQgcGxheWVycyByZWFkeSwgcHJvY2VlZGluZyB0byBzdGFydCBtYXRjaGApO1xuICAgIFxuICAgIHRoaXMubWF0Y2hTdGFydGVkID0gdHJ1ZTtcbiAgICBcbiAgICB0aGlzLl9zb2NrZXRNYXAuZm9yRWFjaCgoc29ja2V0KSA9PiB7XG4gICAgICBzb2NrZXQub2ZmKCd1cGRhdGVQbGF5ZXJOYW1lJyk7XG4gICAgICBzb2NrZXQub2ZmKCdwbGF5ZXJSZWFkeScpO1xuICAgICAgc29ja2V0Lm9mZignbWF0Y2hDb25maWd1cmF0aW9uVXBkYXRlZCcpO1xuICAgICAgc29ja2V0Lm9mZignc2VhcmNoQ2FyZHMnKTtcbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCBjb2xvcnMgPSBbJyMxMEZGMTknLCAnIzNjNjlmZicsICcjRkYwQkYyJywgJyNGRkYxMTQnLCAnI0ZGMUYxMScsICcjRkY5OTAwJ107XG4gICAgY29uc3QgcGxheWVycyA9IGZpc2hlcllhdGVzU2h1ZmZsZShcbiAgICAgIHRoaXMucGxheWVyc1xuICAgICAgICAuZmlsdGVyKHAgPT4gcC5jb25uZWN0ZWQpXG4gICAgICAgIC5tYXAoKHAsIGlkeCkgPT4ge1xuICAgICAgICAgIHAucmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICBwLmNvbG9yID0gY29sb3JzW2lkeF1cbiAgICAgICAgICByZXR1cm4gcDtcbiAgICAgICAgfSlcbiAgICApO1xuICAgIFxuICAgIGlvLmluKCdnYW1lJykuZW1pdCgnc2V0UGxheWVyTGlzdCcsIHBsYXllcnMpO1xuICAgIFxuICAgIHRoaXMuX21hdGNoQ29udHJvbGxlcj8ub24oJ2dhbWVPdmVyJywgdGhpcy5jbGVhck1hdGNoKTtcbiAgICBcbiAgICB2b2lkIHRoaXMuX21hdGNoQ29udHJvbGxlcj8uaW5pdGlhbGl6ZShcbiAgICAgIHtcbiAgICAgICAgLi4uc3RydWN0dXJlZENsb25lKGRlZmF1bHRNYXRjaENvbmZpZ3VyYXRpb24pLFxuICAgICAgICAuLi50aGlzLl9tYXRjaENvbmZpZ3VyYXRpb24sXG4gICAgICAgIHBsYXllcnMsXG4gICAgICB9IGFzIE1hdGNoQ29uZmlndXJhdGlvblxu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
// denoCacheMetadata=10513206656590352536,17430080723649813968