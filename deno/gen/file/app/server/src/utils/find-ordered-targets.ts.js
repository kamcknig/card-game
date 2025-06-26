import { isNull } from 'es-toolkit';
export const findOrderedTargets = (args)=>{
  const { startingPlayerId: currentPlayerTurnId, match } = args;
  let { appliesTo: target } = args;
  console.log('findEffectTargetIds current player', currentPlayerTurnId, 'target', target);
  const otherCountRegExResult = /(\d+)_OTHER/.exec(target);
  let otherCount;
  if (!isNull(otherCountRegExResult)) {
    target = 'X_OTHER';
    otherCount = otherCountRegExResult[1];
    console.log('X_OTHER count', otherCount);
  }
  let result = [];
  const currentTurnOrder = match.players;
  switch(target){
    case 'ALL':
      {
        console.log('find targets for ALL');
        const startIndex = currentTurnOrder.findIndex((player)=>player.id === currentPlayerTurnId);
        const l = currentTurnOrder.length;
        for(let i = 0; i < l; i++){
          const idx = (startIndex + i) % currentTurnOrder.length;
          result.push(currentTurnOrder[idx]);
        }
        console.log('target players in order starting from current player', result);
        break;
      }
    case 'ANY':
      console.error('find targets for ANY not implemented');
      return [
        1
      ];
    case 'ALL_OTHER':
      {
        console.log('find targets for ALL_OTHER');
        const fullOrder = match.players;
        const currentIndex = fullOrder.findIndex((player)=>player.id === currentPlayerTurnId);
        const reordered = [];
        const l = fullOrder.length;
        for(let i = 1; i < l; i++){
          const idx = (currentIndex + i) % l;
          reordered.push(fullOrder[idx]);
        }
        result = reordered;
        console.log('target players in order (ALL_OTHER)', result);
        break;
      }
    case 'X_OTHER':
      console.error('find targets for X_OTHER not implemented');
      result = [];
      break;
    default:
      result = [];
      break;
  }
  return result.map((player)=>player.id);
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvdXRpbHMvZmluZC1vcmRlcmVkLXRhcmdldHMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRWZmZWN0VGFyZ2V0LCBNYXRjaCwgUGxheWVyLCBQbGF5ZXJJZCB9IGZyb20gJ3NoYXJlZC9zaGFyZWQtdHlwZXMudHMnO1xuaW1wb3J0IHsgaXNOdWxsIH0gZnJvbSAnZXMtdG9vbGtpdCc7XG5cbnR5cGUgRmluZFRhcmdldHNBcmdzID0ge1xuICBtYXRjaDogTWF0Y2g7XG4gIHN0YXJ0aW5nUGxheWVySWQ/OiBQbGF5ZXJJZDtcbiAgYXBwbGllc1RvOiBFZmZlY3RUYXJnZXQ7XG59XG5cbmV4cG9ydCBjb25zdCBmaW5kT3JkZXJlZFRhcmdldHMgPSAoYXJnczogRmluZFRhcmdldHNBcmdzKTogbnVtYmVyW10gPT4ge1xuICBjb25zdCB7IHN0YXJ0aW5nUGxheWVySWQ6IGN1cnJlbnRQbGF5ZXJUdXJuSWQsIG1hdGNoIH0gPSBhcmdzO1xuICBsZXQgeyBhcHBsaWVzVG86IHRhcmdldCB9ID0gYXJncztcbiAgY29uc29sZS5sb2coJ2ZpbmRFZmZlY3RUYXJnZXRJZHMgY3VycmVudCBwbGF5ZXInLCBjdXJyZW50UGxheWVyVHVybklkLCAndGFyZ2V0JywgdGFyZ2V0KTtcbiAgXG4gIGNvbnN0IG90aGVyQ291bnRSZWdFeFJlc3VsdCA9IC8oXFxkKylfT1RIRVIvLmV4ZWModGFyZ2V0KTtcbiAgbGV0IG90aGVyQ291bnQ7XG4gIGlmICghaXNOdWxsKG90aGVyQ291bnRSZWdFeFJlc3VsdCkpIHtcbiAgICB0YXJnZXQgPSAnWF9PVEhFUic7XG4gICAgb3RoZXJDb3VudCA9IG90aGVyQ291bnRSZWdFeFJlc3VsdFsxXTtcbiAgICBjb25zb2xlLmxvZygnWF9PVEhFUiBjb3VudCcsIG90aGVyQ291bnQpO1xuICB9XG4gIFxuICBsZXQgcmVzdWx0OiBQbGF5ZXJbXSA9IFtdO1xuICBjb25zdCBjdXJyZW50VHVybk9yZGVyID0gbWF0Y2gucGxheWVycztcbiAgXG4gIHN3aXRjaCAodGFyZ2V0KSB7XG4gICAgY2FzZSAnQUxMJzoge1xuICAgICAgY29uc29sZS5sb2coJ2ZpbmQgdGFyZ2V0cyBmb3IgQUxMJyk7XG4gICAgICBjb25zdCBzdGFydEluZGV4ID0gY3VycmVudFR1cm5PcmRlci5maW5kSW5kZXgocGxheWVyID0+IHBsYXllci5pZCA9PT0gY3VycmVudFBsYXllclR1cm5JZCk7XG4gICAgICBjb25zdCBsID0gY3VycmVudFR1cm5PcmRlci5sZW5ndGg7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgICBjb25zdCBpZHggPSAoc3RhcnRJbmRleCArIGkpICUgY3VycmVudFR1cm5PcmRlci5sZW5ndGg7XG4gICAgICAgIHJlc3VsdC5wdXNoKGN1cnJlbnRUdXJuT3JkZXJbaWR4XSk7XG4gICAgICB9XG4gICAgICBjb25zb2xlLmxvZygndGFyZ2V0IHBsYXllcnMgaW4gb3JkZXIgc3RhcnRpbmcgZnJvbSBjdXJyZW50IHBsYXllcicsIHJlc3VsdCk7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2FzZSAnQU5ZJzpcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ2ZpbmQgdGFyZ2V0cyBmb3IgQU5ZIG5vdCBpbXBsZW1lbnRlZCcpO1xuICAgICAgcmV0dXJuIFsxXTtcbiAgICBjYXNlICdBTExfT1RIRVInOiB7XG4gICAgICBjb25zb2xlLmxvZygnZmluZCB0YXJnZXRzIGZvciBBTExfT1RIRVInKTtcbiAgICAgIGNvbnN0IGZ1bGxPcmRlciA9IG1hdGNoLnBsYXllcnM7XG4gICAgICBjb25zdCBjdXJyZW50SW5kZXggPSBmdWxsT3JkZXIuZmluZEluZGV4KHBsYXllciA9PiBwbGF5ZXIuaWQgPT09IGN1cnJlbnRQbGF5ZXJUdXJuSWQpO1xuICAgICAgXG4gICAgICBjb25zdCByZW9yZGVyZWQgPSBbXTtcbiAgICAgIGNvbnN0IGwgPSBmdWxsT3JkZXIubGVuZ3RoO1xuICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgY29uc3QgaWR4ID0gKGN1cnJlbnRJbmRleCArIGkpICUgbDtcbiAgICAgICAgcmVvcmRlcmVkLnB1c2goZnVsbE9yZGVyW2lkeF0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXN1bHQgPSByZW9yZGVyZWQ7XG4gICAgICBjb25zb2xlLmxvZygndGFyZ2V0IHBsYXllcnMgaW4gb3JkZXIgKEFMTF9PVEhFUiknLCByZXN1bHQpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgJ1hfT1RIRVInOlxuICAgICAgY29uc29sZS5lcnJvcignZmluZCB0YXJnZXRzIGZvciBYX09USEVSIG5vdCBpbXBsZW1lbnRlZCcpO1xuICAgICAgcmVzdWx0ID0gW107XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgcmVzdWx0ID0gW107XG4gICAgICBicmVhaztcbiAgfVxuICBcbiAgcmV0dXJuIHJlc3VsdC5tYXAocGxheWVyID0+IHBsYXllci5pZCk7XG59Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLFNBQVMsTUFBTSxRQUFRLGFBQWE7QUFRcEMsT0FBTyxNQUFNLHFCQUFxQixDQUFDO0VBQ2pDLE1BQU0sRUFBRSxrQkFBa0IsbUJBQW1CLEVBQUUsS0FBSyxFQUFFLEdBQUc7RUFDekQsSUFBSSxFQUFFLFdBQVcsTUFBTSxFQUFFLEdBQUc7RUFDNUIsUUFBUSxHQUFHLENBQUMsc0NBQXNDLHFCQUFxQixVQUFVO0VBRWpGLE1BQU0sd0JBQXdCLGNBQWMsSUFBSSxDQUFDO0VBQ2pELElBQUk7RUFDSixJQUFJLENBQUMsT0FBTyx3QkFBd0I7SUFDbEMsU0FBUztJQUNULGFBQWEscUJBQXFCLENBQUMsRUFBRTtJQUNyQyxRQUFRLEdBQUcsQ0FBQyxpQkFBaUI7RUFDL0I7RUFFQSxJQUFJLFNBQW1CLEVBQUU7RUFDekIsTUFBTSxtQkFBbUIsTUFBTSxPQUFPO0VBRXRDLE9BQVE7SUFDTixLQUFLO01BQU87UUFDVixRQUFRLEdBQUcsQ0FBQztRQUNaLE1BQU0sYUFBYSxpQkFBaUIsU0FBUyxDQUFDLENBQUEsU0FBVSxPQUFPLEVBQUUsS0FBSztRQUN0RSxNQUFNLElBQUksaUJBQWlCLE1BQU07UUFDakMsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSztVQUMxQixNQUFNLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxpQkFBaUIsTUFBTTtVQUN0RCxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJO1FBQ25DO1FBQ0EsUUFBUSxHQUFHLENBQUMsd0RBQXdEO1FBQ3BFO01BQ0Y7SUFDQSxLQUFLO01BQ0gsUUFBUSxLQUFLLENBQUM7TUFDZCxPQUFPO1FBQUM7T0FBRTtJQUNaLEtBQUs7TUFBYTtRQUNoQixRQUFRLEdBQUcsQ0FBQztRQUNaLE1BQU0sWUFBWSxNQUFNLE9BQU87UUFDL0IsTUFBTSxlQUFlLFVBQVUsU0FBUyxDQUFDLENBQUEsU0FBVSxPQUFPLEVBQUUsS0FBSztRQUVqRSxNQUFNLFlBQVksRUFBRTtRQUNwQixNQUFNLElBQUksVUFBVSxNQUFNO1FBQzFCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUs7VUFDMUIsTUFBTSxNQUFNLENBQUMsZUFBZSxDQUFDLElBQUk7VUFDakMsVUFBVSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUk7UUFDL0I7UUFFQSxTQUFTO1FBQ1QsUUFBUSxHQUFHLENBQUMsdUNBQXVDO1FBQ25EO01BQ0Y7SUFDQSxLQUFLO01BQ0gsUUFBUSxLQUFLLENBQUM7TUFDZCxTQUFTLEVBQUU7TUFDWDtJQUNGO01BQ0UsU0FBUyxFQUFFO01BQ1g7RUFDSjtFQUVBLE9BQU8sT0FBTyxHQUFHLENBQUMsQ0FBQSxTQUFVLE9BQU8sRUFBRTtBQUN2QyxFQUFDIn0=
// denoCacheMetadata=6024809938964869102,1182135857354045141