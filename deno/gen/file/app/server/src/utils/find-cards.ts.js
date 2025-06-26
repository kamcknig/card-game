import { castArray } from 'es-toolkit/compat';
import { validateCostSpec } from '../shared/validate-cost-spec.ts';
import { isCardDataFindCardsFilter, isCostFindCardsFilter, isSourceFindCardsFilter } from '../types.ts';
const findCardsByLocation = (locations, cardSourceController, playerId)=>{
  let cardIds = [];
  for (const location of locations){
    let source = cardSourceController.getSource(location, playerId);
    if (!source) {
      source = cardSourceController.getSource(location);
    }
    if (source) {
      cardIds = cardIds.concat(source);
    }
  }
  return cardIds;
};
export const findCardsFactory = (cardSourceController, cardCostController, cardLibrary)=>(filters)=>{
    let cardIds = [];
    let locationFilter = undefined;
    let otherFilters = [];
    if (!Array.isArray(filters)) {
      if (isSourceFindCardsFilter(filters)) {
        locationFilter = filters;
      } else {
        otherFilters = [
          filters
        ];
      }
    } else {
      if (isSourceFindCardsFilter(filters[0])) {
        locationFilter = filters.shift();
        otherFilters = [
          ...filters
        ];
      } else {
        otherFilters = [
          ...filters
        ];
      }
    }
    if (locationFilter) {
      locationFilter.location = castArray(locationFilter.location);
      cardIds = findCardsByLocation(locationFilter.location, cardSourceController, locationFilter.playerId);
    } else {
      cardIds = cardLibrary.getAllCardsAsArray().map((card)=>card.id);
    }
    let sourceCards = cardIds.map(cardLibrary.getCard);
    for (const otherFilter of otherFilters){
      if (isCardDataFindCardsFilter(otherFilter)) {
        if (otherFilter.tags) {
          sourceCards = sourceCards.filter((card)=>card.tags?.some((t)=>otherFilter.tags.includes(t)));
        }
        if (otherFilter.kingdom) {
          sourceCards = sourceCards.filter((card)=>card.kingdom === otherFilter.kingdom);
        }
        if (otherFilter.cardKeys) {
          sourceCards = sourceCards.filter((card)=>otherFilter.cardKeys.includes(card.cardKey));
        }
        if (otherFilter.owner) {
          sourceCards = sourceCards.filter((card)=>card.owner === otherFilter.owner);
        }
        if (otherFilter.cardType) {
          sourceCards = sourceCards.filter((card)=>card.type.some((t)=>otherFilter.cardType.includes(t)));
        }
      } else if (isCostFindCardsFilter(otherFilter)) {
        sourceCards = sourceCards.filter((card)=>{
          const { cost: effectiveCost } = cardCostController.applyRules(card, {
            playerId: otherFilter.playerId
          });
          return validateCostSpec(otherFilter, effectiveCost);
        });
      }
    }
    return sourceCards;
  };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvdXRpbHMvZmluZC1jYXJkcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjYXN0QXJyYXkgfSBmcm9tICdlcy10b29sa2l0L2NvbXBhdCc7XG5pbXBvcnQgeyBDYXJkSWQsIENhcmRMb2NhdGlvbiwgUGxheWVySWQgfSBmcm9tICdzaGFyZWQvc2hhcmVkLXR5cGVzLnRzJztcblxuaW1wb3J0IHsgdmFsaWRhdGVDb3N0U3BlYyB9IGZyb20gJy4uL3NoYXJlZC92YWxpZGF0ZS1jb3N0LXNwZWMudHMnO1xuaW1wb3J0IHtcbiAgRmluZENhcmRzRm5GYWN0b3J5LFxuICBpc0NhcmREYXRhRmluZENhcmRzRmlsdGVyLFxuICBpc0Nvc3RGaW5kQ2FyZHNGaWx0ZXIsXG4gIGlzU291cmNlRmluZENhcmRzRmlsdGVyLFxuICBOb25Mb2NhdGlvbkZpbHRlcnMsXG4gIFNvdXJjZUZpbmRDYXJkc0ZpbHRlclxufSBmcm9tICcuLi90eXBlcy50cyc7XG5pbXBvcnQgeyBDYXJkU291cmNlQ29udHJvbGxlciB9IGZyb20gJy4uL2NvcmUvY2FyZC1zb3VyY2UtY29udHJvbGxlci50cyc7XG5cbmNvbnN0IGZpbmRDYXJkc0J5TG9jYXRpb24gPSAobG9jYXRpb25zOiBDYXJkTG9jYXRpb25bXSwgY2FyZFNvdXJjZUNvbnRyb2xsZXI6IENhcmRTb3VyY2VDb250cm9sbGVyLCBwbGF5ZXJJZD86IFBsYXllcklkKSA9PiB7XG4gIGxldCBjYXJkSWRzOiBDYXJkSWRbXSA9IFtdO1xuICBcbiAgZm9yIChjb25zdCBsb2NhdGlvbiBvZiBsb2NhdGlvbnMpIHtcbiAgICBsZXQgc291cmNlID0gY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKGxvY2F0aW9uLCBwbGF5ZXJJZCk7XG4gICAgaWYgKCFzb3VyY2UpIHtcbiAgICAgIHNvdXJjZSA9IGNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZShsb2NhdGlvbik7XG4gICAgfVxuICAgIFxuICAgIGlmIChzb3VyY2UpIHtcbiAgICAgIGNhcmRJZHMgPSBjYXJkSWRzLmNvbmNhdChzb3VyY2UpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gY2FyZElkcztcbn1cblxuZXhwb3J0IGNvbnN0IGZpbmRDYXJkc0ZhY3Rvcnk6IEZpbmRDYXJkc0ZuRmFjdG9yeSA9IChjYXJkU291cmNlQ29udHJvbGxlciwgY2FyZENvc3RDb250cm9sbGVyLCBjYXJkTGlicmFyeSkgPT4gZmlsdGVycyA9PiB7XG4gIGxldCBjYXJkSWRzOiBDYXJkSWRbXSA9IFtdO1xuICBsZXQgbG9jYXRpb25GaWx0ZXI6IFNvdXJjZUZpbmRDYXJkc0ZpbHRlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgbGV0IG90aGVyRmlsdGVyczogTm9uTG9jYXRpb25GaWx0ZXJzW10gPSBbXTtcbiAgXG4gIGlmICghQXJyYXkuaXNBcnJheShmaWx0ZXJzKSkge1xuICAgIGlmIChpc1NvdXJjZUZpbmRDYXJkc0ZpbHRlcihmaWx0ZXJzKSkge1xuICAgICAgbG9jYXRpb25GaWx0ZXIgPSBmaWx0ZXJzO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIG90aGVyRmlsdGVycyA9IFtmaWx0ZXJzXTtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgaWYgKGlzU291cmNlRmluZENhcmRzRmlsdGVyKGZpbHRlcnNbMF0pKSB7XG4gICAgICBsb2NhdGlvbkZpbHRlciA9IGZpbHRlcnMuc2hpZnQoKSBhcyBTb3VyY2VGaW5kQ2FyZHNGaWx0ZXI7XG4gICAgICBvdGhlckZpbHRlcnMgPSBbLi4uZmlsdGVycyBhcyBOb25Mb2NhdGlvbkZpbHRlcnNbXV07XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgb3RoZXJGaWx0ZXJzID0gWy4uLmZpbHRlcnMgYXMgTm9uTG9jYXRpb25GaWx0ZXJzW11dO1xuICAgIH1cbiAgfVxuICBcbiAgaWYgKGxvY2F0aW9uRmlsdGVyKSB7XG4gICAgbG9jYXRpb25GaWx0ZXIubG9jYXRpb24gPSBjYXN0QXJyYXkobG9jYXRpb25GaWx0ZXIubG9jYXRpb24pO1xuICAgIGNhcmRJZHMgPSBmaW5kQ2FyZHNCeUxvY2F0aW9uKGxvY2F0aW9uRmlsdGVyLmxvY2F0aW9uLCBjYXJkU291cmNlQ29udHJvbGxlciwgbG9jYXRpb25GaWx0ZXIucGxheWVySWQpO1xuICB9XG4gIGVsc2Uge1xuICAgIGNhcmRJZHMgPSBjYXJkTGlicmFyeS5nZXRBbGxDYXJkc0FzQXJyYXkoKS5tYXAoY2FyZCA9PiBjYXJkLmlkKTtcbiAgfVxuICBcbiAgbGV0IHNvdXJjZUNhcmRzID0gY2FyZElkcy5tYXAoY2FyZExpYnJhcnkuZ2V0Q2FyZCk7XG4gIFxuICBmb3IgKGNvbnN0IG90aGVyRmlsdGVyIG9mIG90aGVyRmlsdGVycykge1xuICAgIGlmIChpc0NhcmREYXRhRmluZENhcmRzRmlsdGVyKG90aGVyRmlsdGVyKSkge1xuICAgICAgaWYgKG90aGVyRmlsdGVyLnRhZ3MpIHtcbiAgICAgICAgc291cmNlQ2FyZHMgPSBzb3VyY2VDYXJkcy5maWx0ZXIoY2FyZCA9PiBjYXJkLnRhZ3M/LnNvbWUodCA9PiBvdGhlckZpbHRlci50YWdzIS5pbmNsdWRlcyh0KSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAob3RoZXJGaWx0ZXIua2luZ2RvbSkge1xuICAgICAgICBzb3VyY2VDYXJkcyA9IHNvdXJjZUNhcmRzLmZpbHRlcihjYXJkID0+IGNhcmQua2luZ2RvbSA9PT0gb3RoZXJGaWx0ZXIua2luZ2RvbSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChvdGhlckZpbHRlci5jYXJkS2V5cykge1xuICAgICAgICBzb3VyY2VDYXJkcyA9IHNvdXJjZUNhcmRzLmZpbHRlcihjYXJkID0+IG90aGVyRmlsdGVyLmNhcmRLZXlzIS5pbmNsdWRlcyhjYXJkLmNhcmRLZXkpKTtcbiAgICAgIH1cbiAgICAgIGlmIChvdGhlckZpbHRlci5vd25lcikge1xuICAgICAgICBzb3VyY2VDYXJkcyA9IHNvdXJjZUNhcmRzLmZpbHRlcihjYXJkID0+IGNhcmQub3duZXIgPT09IG90aGVyRmlsdGVyLm93bmVyKTtcbiAgICAgIH1cbiAgICAgIGlmIChvdGhlckZpbHRlci5jYXJkVHlwZSkge1xuICAgICAgICBzb3VyY2VDYXJkcyA9IHNvdXJjZUNhcmRzLmZpbHRlcihjYXJkID0+IGNhcmQudHlwZS5zb21lKHQgPT4gb3RoZXJGaWx0ZXIuY2FyZFR5cGUhLmluY2x1ZGVzKHQpKSk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzQ29zdEZpbmRDYXJkc0ZpbHRlcihvdGhlckZpbHRlcikpIHtcbiAgICAgIHNvdXJjZUNhcmRzID0gc291cmNlQ2FyZHMuZmlsdGVyKGNhcmQgPT4ge1xuICAgICAgICBjb25zdCB7IGNvc3Q6IGVmZmVjdGl2ZUNvc3QgfSA9IGNhcmRDb3N0Q29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmQsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogb3RoZXJGaWx0ZXIucGxheWVySWRcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB2YWxpZGF0ZUNvc3RTcGVjKG90aGVyRmlsdGVyLCBlZmZlY3RpdmVDb3N0KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIHNvdXJjZUNhcmRzO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsU0FBUyxRQUFRLG9CQUFvQjtBQUc5QyxTQUFTLGdCQUFnQixRQUFRLGtDQUFrQztBQUNuRSxTQUVFLHlCQUF5QixFQUN6QixxQkFBcUIsRUFDckIsdUJBQXVCLFFBR2xCLGNBQWM7QUFHckIsTUFBTSxzQkFBc0IsQ0FBQyxXQUEyQixzQkFBNEM7RUFDbEcsSUFBSSxVQUFvQixFQUFFO0VBRTFCLEtBQUssTUFBTSxZQUFZLFVBQVc7SUFDaEMsSUFBSSxTQUFTLHFCQUFxQixTQUFTLENBQUMsVUFBVTtJQUN0RCxJQUFJLENBQUMsUUFBUTtNQUNYLFNBQVMscUJBQXFCLFNBQVMsQ0FBQztJQUMxQztJQUVBLElBQUksUUFBUTtNQUNWLFVBQVUsUUFBUSxNQUFNLENBQUM7SUFDM0I7RUFDRjtFQUNBLE9BQU87QUFDVDtBQUVBLE9BQU8sTUFBTSxtQkFBdUMsQ0FBQyxzQkFBc0Isb0JBQW9CLGNBQWdCLENBQUE7SUFDN0csSUFBSSxVQUFvQixFQUFFO0lBQzFCLElBQUksaUJBQW9EO0lBQ3hELElBQUksZUFBcUMsRUFBRTtJQUUzQyxJQUFJLENBQUMsTUFBTSxPQUFPLENBQUMsVUFBVTtNQUMzQixJQUFJLHdCQUF3QixVQUFVO1FBQ3BDLGlCQUFpQjtNQUNuQixPQUNLO1FBQ0gsZUFBZTtVQUFDO1NBQVE7TUFDMUI7SUFDRixPQUNLO01BQ0gsSUFBSSx3QkFBd0IsT0FBTyxDQUFDLEVBQUUsR0FBRztRQUN2QyxpQkFBaUIsUUFBUSxLQUFLO1FBQzlCLGVBQWU7YUFBSTtTQUFnQztNQUNyRCxPQUNLO1FBQ0gsZUFBZTthQUFJO1NBQWdDO01BQ3JEO0lBQ0Y7SUFFQSxJQUFJLGdCQUFnQjtNQUNsQixlQUFlLFFBQVEsR0FBRyxVQUFVLGVBQWUsUUFBUTtNQUMzRCxVQUFVLG9CQUFvQixlQUFlLFFBQVEsRUFBRSxzQkFBc0IsZUFBZSxRQUFRO0lBQ3RHLE9BQ0s7TUFDSCxVQUFVLFlBQVksa0JBQWtCLEdBQUcsR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLEVBQUU7SUFDaEU7SUFFQSxJQUFJLGNBQWMsUUFBUSxHQUFHLENBQUMsWUFBWSxPQUFPO0lBRWpELEtBQUssTUFBTSxlQUFlLGFBQWM7TUFDdEMsSUFBSSwwQkFBMEIsY0FBYztRQUMxQyxJQUFJLFlBQVksSUFBSSxFQUFFO1VBQ3BCLGNBQWMsWUFBWSxNQUFNLENBQUMsQ0FBQSxPQUFRLEtBQUssSUFBSSxFQUFFLEtBQUssQ0FBQSxJQUFLLFlBQVksSUFBSSxDQUFFLFFBQVEsQ0FBQztRQUMzRjtRQUVBLElBQUksWUFBWSxPQUFPLEVBQUU7VUFDdkIsY0FBYyxZQUFZLE1BQU0sQ0FBQyxDQUFBLE9BQVEsS0FBSyxPQUFPLEtBQUssWUFBWSxPQUFPO1FBQy9FO1FBRUEsSUFBSSxZQUFZLFFBQVEsRUFBRTtVQUN4QixjQUFjLFlBQVksTUFBTSxDQUFDLENBQUEsT0FBUSxZQUFZLFFBQVEsQ0FBRSxRQUFRLENBQUMsS0FBSyxPQUFPO1FBQ3RGO1FBQ0EsSUFBSSxZQUFZLEtBQUssRUFBRTtVQUNyQixjQUFjLFlBQVksTUFBTSxDQUFDLENBQUEsT0FBUSxLQUFLLEtBQUssS0FBSyxZQUFZLEtBQUs7UUFDM0U7UUFDQSxJQUFJLFlBQVksUUFBUSxFQUFFO1VBQ3hCLGNBQWMsWUFBWSxNQUFNLENBQUMsQ0FBQSxPQUFRLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBLElBQUssWUFBWSxRQUFRLENBQUUsUUFBUSxDQUFDO1FBQzlGO01BQ0YsT0FDSyxJQUFJLHNCQUFzQixjQUFjO1FBQzNDLGNBQWMsWUFBWSxNQUFNLENBQUMsQ0FBQTtVQUMvQixNQUFNLEVBQUUsTUFBTSxhQUFhLEVBQUUsR0FBRyxtQkFBbUIsVUFBVSxDQUFDLE1BQU07WUFDbEUsVUFBVSxZQUFZLFFBQVE7VUFDaEM7VUFDQSxPQUFPLGlCQUFpQixhQUFhO1FBQ3ZDO01BQ0Y7SUFDRjtJQUVBLE9BQU87RUFDVCxFQUFDIn0=
// denoCacheMetadata=2380015498268675342,1322347709467471540