interface AxiosErrorShape {
  response?: {
    status?: number;
    data?: unknown;
  };
  code?: string;
  message?: string;
}

function isAxiosError(error: unknown): error is AxiosErrorShape {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as Record<string, unknown>;
  return "response" in maybeError || "code" in maybeError;
}

/**
 * Custom API Error class
 * Extends Error with additional context for better error handling
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    public details?: unknown,
    message?: string,
  ) {
    super(message || code);
    this.name = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Map error codes to user-friendly messages
 * Note: Backend consistency may vary, so fallback to generic message
 */
export function getErrorMessage(code: string, statusCode?: number): string {
  const errorMessages: Record<string, string> = {
    // Validation
    VALIDATION_ERROR: "Please check your input and try again",
    INVALID_INPUT: "Invalid input provided",
    MISSING_FIELD: "Required field is missing",

    // Authentication & Authorization
    UNAUTHORIZED: "Your session has expired. Please log in again",
    INVALID_CREDENTIALS: "Invalid email or password",
    ACCOUNT_LOCKED: "Your account is locked. Please contact support",
    TOKEN_EXPIRED: "Your session has expired. Please log in again",
    FORBIDDEN: "You don't have permission to access this resource",
    ACCESS_DENIED: "Access denied",

    // Resource
    NOT_FOUND: "The resource you're looking for doesn't exist",
    ALREADY_EXISTS: "This resource already exists",
    RESOURCE_DELETED: "This resource has been deleted",
    CONFLICT: "Operation conflicts with existing data",

    // Server & Network
    INTERNAL_ERROR: "Server error. Please try again later",
    SERVICE_UNAVAILABLE: "Service is temporarily unavailable",
    BAD_GATEWAY: "Gateway error. Please try again",
    TIMEOUT: "Request timed out. Please try again",
    NETWORK_ERROR: "Network error. Please check your connection",

    // Business Logic
    INSUFFICIENT_BALANCE: "Insufficient balance for this operation",
    QUOTA_EXCEEDED: "Request limit exceeded",
    RATE_LIMITED: "Too many requests. Please wait and try again",
  };

  // Check for status code based messages if code not found
  if (!errorMessages[code]) {
    if (statusCode === 404) return "Resource not found";
    if (statusCode === 401) return "Please log in to continue";
    if (statusCode === 403) return "You don't have permission for this action";
    if (statusCode === 500) return "Server error. Please try again later";
    if (statusCode === 503) return "Service is temporarily unavailable";
  }

  return (
    errorMessages[code] || "Something unexpected happened. Please try again"
  );
}

/**
 * Extract error information from Axios error
 */
export function extractErrorInfo(error: AxiosErrorShape): {
  code: string;
  statusCode: number;
  userMessage: string;
  details?: unknown;
} {
  const statusCode = error.response?.status || 0;
  const responseData = error.response?.data as
    | Record<string, unknown>
    | undefined;

  // Try to extract error code from various response formats
  let code =
    (responseData?.code as string) ||
    (responseData?.error as string) ||
    error.code ||
    "UNKNOWN_ERROR";

  // If no code found, generate from status
  if (code === "UNKNOWN_ERROR") {
    if (statusCode === 401) code = "UNAUTHORIZED";
    else if (statusCode === 403) code = "FORBIDDEN";
    else if (statusCode === 404) code = "NOT_FOUND";
    else if (statusCode === 409) code = "CONFLICT";
    else if (statusCode >= 500) code = "INTERNAL_ERROR";
    else code = "NETWORK_ERROR";
  }

  const userMessage = getErrorMessage(code, statusCode);

  return {
    code,
    statusCode,
    userMessage,
    details: responseData?.details || responseData?.message,
  };
}

/**
 * Format axios error into standardized ApiError
 */
export function formatError(error: unknown): ApiError {
  if (isAxiosError(error)) {
    const { code, statusCode, userMessage, details } = extractErrorInfo(error);
    return new ApiError(code, statusCode, details, userMessage);
  }

  if (error instanceof Error) {
    return new ApiError(
      "CLIENT_ERROR",
      0,
      undefined,
      error.message || "An unexpected error occurred",
    );
  }

  return new ApiError(
    "UNKNOWN_ERROR",
    0,
    undefined,
    "An unexpected error occurred",
  );
}

/**
 * Check if error is a specific type
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Check if error is an auth error (401, 403)
 */
export function isAuthError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.statusCode === 401 || error.statusCode === 403;
  }
  if (isAxiosError(error)) {
    return error.response?.status === 401 || error.response?.status === 403;
  }
  return false;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (isAxiosError(error)) {
    return !error.response && error.code !== "ERR_CANCELED";
  }
  return false;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code.includes("VALIDATION") || error.statusCode === 422;
  }
  if (isAxiosError(error)) {
    return error.response?.status === 422;
  }
  return false;
}
