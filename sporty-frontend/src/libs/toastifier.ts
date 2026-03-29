type ToastType = "success" | "error" | "info" | "warning";

const ROOT_ID = "sporty-toast-root";

function getIcon(type: ToastType): string {
  if (type === "success") return "✓";
  if (type === "error") return "✕";
  if (type === "warning") return "!";
  return "i";
}

function ensureRoot(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  const existing = document.getElementById(ROOT_ID);
  if (existing) {
    return existing;
  }

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.className = "sporty-toast-root";
  document.body.appendChild(root);
  return root;
}

function removeToast(node: HTMLElement): void {
  node.style.opacity = "0";
  node.style.transform = "translateY(-6px)";
  setTimeout(() => {
    node.remove();
  }, 180);
}

function showToast(type: ToastType, message: string): void {
  const root = ensureRoot();
  if (!root) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = `sporty-toast sporty-toast-${type}`;
  toast.innerHTML = `<span class="sporty-toast-icon">${getIcon(type)}</span><span>${message}</span>`;
  root.appendChild(toast);

  setTimeout(() => {
    removeToast(toast);
  }, 3400);
}

export const toastifier = {
  success: (message: string) => showToast("success", message),
  error: (message: string) => showToast("error", message),
  info: (message: string) => showToast("info", message),
  warning: (message: string) => showToast("warning", message),
};
