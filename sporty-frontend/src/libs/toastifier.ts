type ToastType = "success" | "error" | "info" | "warning";

function logToast(type: ToastType, message: string): void {
  const prefix = `[${type.toUpperCase()}]`;
  if (type === "error") {
    console.error(prefix, message);
    return;
  }
  if (type === "warning") {
    console.warn(prefix, message);
    return;
  }
  console.log(prefix, message);
}

export const toastifier = {
  success: (message: string) => logToast("success", message),
  error: (message: string) => logToast("error", message),
  info: (message: string) => logToast("info", message),
  warning: (message: string) => logToast("warning", message),
};
