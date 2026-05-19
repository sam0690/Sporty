export type AuthInvalidationReason = "refresh_failed" | "unauthorized";

const AUTH_INVALIDATED_EVENT = "auth:invalidated";

export type AuthInvalidatedDetail = {
  reason: AuthInvalidationReason;
};

export const emitAuthInvalidated = (reason: AuthInvalidationReason): void => {
  if (typeof window === "undefined") {
    return;
  }

  const event = new CustomEvent<AuthInvalidatedDetail>(AUTH_INVALIDATED_EVENT, {
    detail: { reason },
  });

  window.dispatchEvent(event);
};

export const subscribeAuthInvalidated = (
  handler: (detail: AuthInvalidatedDetail) => void,
): (() => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event): void => {
    const customEvent = event as CustomEvent<AuthInvalidatedDetail>;
    handler(customEvent.detail);
  };

  window.addEventListener(AUTH_INVALIDATED_EVENT, listener);
  return () => window.removeEventListener(AUTH_INVALIDATED_EVENT, listener);
};
