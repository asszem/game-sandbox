export function createToastRegion(toastRegion: HTMLElement | null): (message: string) => void {
  return (message: string): void => {
    if (!toastRegion) {
      return;
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastRegion.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add('toast-out');
      window.setTimeout(() => toast.remove(), 220);
    }, 1800);
  };
}
