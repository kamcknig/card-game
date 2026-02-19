import { cardStore } from '../../../../state/card-state';
import { openCardDetailDialog } from '../../../../state/card-detail-dialog-state';

export async function displayCardDetail(arg: number | { detailImagePath: string; }) {
  let detailImagePath: string | undefined;
  if (typeof arg === 'number') {
    detailImagePath = cardStore.get()[arg]?.detailImagePath;
  }
  else {
    detailImagePath = arg.detailImagePath;
  }

  if (!detailImagePath) {
    return;
  }

  openCardDetailDialog(detailImagePath);
}
