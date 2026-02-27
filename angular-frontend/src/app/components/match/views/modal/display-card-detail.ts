import { cardStore } from '../../../../state/card-state';
import { matchStore } from '../../../../state/match-state';
import { openCardDetailDialog } from '../../../../state/card-detail-dialog-state';

type CardDetailArg =
  | number
  | { detailImagePath: string; kingdom?: string; }
  | { detailImagePaths: string[]; kingdom?: string; };

export async function displayCardDetail(arg: CardDetailArg) {
  const detailImagePaths: string[] = [];
  let pileKey: string | undefined;
  if (typeof arg === 'number') {
    const card = cardStore.get()[arg];
    if (card?.detailImagePath) {
      detailImagePaths.push(card.detailImagePath);
    }
    pileKey = card?.kingdom;
  }
  else if ('detailImagePaths' in arg) {
    detailImagePaths.push(...arg.detailImagePaths);
    pileKey = arg.kingdom;
  } else {
    detailImagePaths.push(arg.detailImagePath);
    pileKey = arg.kingdom;
  }

  if (pileKey) {
    const traitDetailImagePath = matchStore.get()?.traits?.find((trait) => trait.pileKey === pileKey)?.detailImagePath;
    if (traitDetailImagePath) {
      detailImagePaths.push(traitDetailImagePath);
    }
  }

  const normalizedPaths = [...new Set(detailImagePaths.filter((path) => path?.trim().length > 0))];
  if (normalizedPaths.length < 1) {
    return;
  }

  openCardDetailDialog(normalizedPaths);
}
