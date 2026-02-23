type ToastType = 'success' | 'error' | 'info';

type ToastListener = (message: string, type: ToastType) => void;

let listener: ToastListener | null = null;

export function onToast(fn: ToastListener): () => void {
  listener = fn;
  return () => {
    listener = null;
  };
}

export function showToast(message: string, type: ToastType = 'success'): void {
  listener?.(message, type);
}
