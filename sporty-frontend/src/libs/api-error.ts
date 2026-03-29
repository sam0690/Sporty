// Re-export from utils/api-Error.ts — moved to libs layer as it's an API concern
export {
    ApiError,
    formatError,
    extractErrorInfo,
    getErrorMessage,
    isApiError,
    isAuthError,
    isNetworkError,
    isValidationError,
} from "@/utils/api-Error";
