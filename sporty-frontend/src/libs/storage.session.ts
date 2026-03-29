export function getSessionStorage(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(key);
}

export function setSessionStorage(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(key, value);
}

export function removeSessionStorage(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(key);
}
