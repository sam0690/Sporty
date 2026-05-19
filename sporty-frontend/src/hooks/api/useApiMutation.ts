import {
    useMutation,
    type UseMutationOptions,
    type UseMutationResult,
} from "@tanstack/react-query";
import { toastifier } from "@/lib/toastifier";

/**
 * Generic wrapper around TanStack Query's useMutation.
 *
 * Automatically shows success / error toasts unless suppressed.
 *
 * @example
 * ```ts
 * const mutation = useApiMutation(
 *   (payload) => UserService.login(payload),
 *   { successMessage: "Logged in!" },
 * );
 * ```
 */
export function useApiMutation<TData, TVariables, TContext = unknown>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: Omit<UseMutationOptions<TData, Error, TVariables, TContext>, "mutationFn"> & {
        successMessage?: string;
        errorMessage?: string;
        silent?: boolean;
    },
): UseMutationResult<TData, Error, TVariables, TContext> {
    const { successMessage, errorMessage, silent, onSuccess, onError, ...rest } = options ?? {};

    return useMutation<TData, Error, TVariables, TContext>({
        mutationFn,
        onSuccess: (data, variables, context) => {
            if (!silent && successMessage) {
                toastifier.success(successMessage);
            }
            // TypeScript issue with TanStack Query v5 - callback expects 4 args but we pass 3
            (onSuccess as ((data: TData, variables: TVariables, context: TContext | undefined) => void) | undefined)?.(data, variables, context);
        },
        onError: (error, variables, context) => {
            if (!silent) {
                toastifier.error(errorMessage ?? error.message);
            }
            (onError as ((error: Error, variables: TVariables, context: TContext | undefined) => void) | undefined)?.(error, variables, context);
        },
        ...rest,
    });
}