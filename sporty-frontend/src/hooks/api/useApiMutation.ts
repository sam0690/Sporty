import {
    useMutation,
    type UseMutationOptions,
    type UseMutationResult,
} from "@tanstack/react-query";
import { toastifier } from "@/libs/toastifier";

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
export function useApiMutation<TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: Omit<UseMutationOptions<TData, Error, TVariables>, "mutationFn"> & {
        successMessage?: string;
        errorMessage?: string;
        silent?: boolean;
    },
): UseMutationResult<TData, Error, TVariables> {
    const { successMessage, errorMessage, silent, ...rest } = options ?? {};

    return useMutation<TData, Error, TVariables>({
        mutationFn,
        onSuccess(data, variables, context) {
            if (!silent && successMessage) {
                toastifier.success(successMessage);
            }
            rest.onSuccess?.(data, variables, context);
        },
        onError(error, variables, context) {
            if (!silent) {
                toastifier.error(errorMessage ?? error.message);
            }
            rest.onError?.(error, variables, context);
        },
        ...rest,
    });
}
