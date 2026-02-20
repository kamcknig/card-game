import { cardStore } from '../../../../state/card-state';
import { openCardDetailDialog } from '../../../../state/card-detail-dialog-state';

export async function displayCardDetail(arg: number | { detailImagePath: string; }) {
  // Suppress the browser context menu triggered by the same right-click that opened this detail dialog.
  const suppressImmediateContextMenu = () => {
    if (typeof window === 'undefined') {
      return;
    }
    const suppressor = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('contextmenu', suppressor, { capture: true, once: true });
  };

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

  suppressImmediateContextMenu();
  openCardDetailDialog(detailImagePath);
}
