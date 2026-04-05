import {
    useQuery,
    type UseQueryOptions,
    type UseQueryResult,
    type QueryKey,
} from "@tanstack/react-query";

/**
 * Generic wrapper around TanStack Query's useQuery.
 *
 * Provides a consistent API for all service-based queries across the app.
 *
 * @example
 * ```ts
 * const { data, isLoading } = useApiQuery(
 *   ["users"],
 *   () => UserService.getAll(),
 * );
 * ```
 */
export function useApiQuery<TData>(
    queryKey: QueryKey,
    queryFn: () => Promise<TData>,
    options?: Omit<UseQueryOptions<TData, Error>, "queryKey" | "queryFn">,
): UseQueryResult<TData, Error> {
    return useQuery<TData, Error>({
        queryKey,
        queryFn,
        ...options,
    });
}
