type ToastType = "success" | "error" | "info" | "warning";

const ROOT_ID = "sporty-toast-root";

// Static inline SVGs (lucide paths) — this module is plain DOM, not React,
// so icon components can't be used here. No user input ever goes through
// innerHTML; only these constants do.
const ICONS: Record<ToastType, string> = {
  success:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  error:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  warning:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
};

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
  // Screen readers announce toasts without stealing focus.
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
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

  const icon = document.createElement("span");
  icon.className = "sporty-toast-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = ICONS[type];

  const text = document.createElement("span");
  // textContent, never innerHTML — messages interpolate user-controlled
  // names (league names, usernames). Also strip a legacy leading ✓/✕/!
  // glyph some call sites prepend, since the icon now carries that signal.
  text.textContent = message.replace(/^[✓✕!]\s*/, "");

  toast.append(icon, text);
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
