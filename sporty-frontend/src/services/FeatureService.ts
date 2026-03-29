import type { AxiosInstance, AxiosResponse } from "axios";
import type { ApiResponse, PaginatedResponse } from "@/types";

/**
 * Generic CRUD service factory.
 *
 * Creates a typed service object with standard CRUD operations for any
 * resource.  Services built with this factory automatically use the
 * provided Axios client and endpoint path.
 *
 * @example
 * ```ts
 * import { authApi } from "@/api/auth-api-client";
 * import { API_PATHS } from "@/api/apiPath";
 * import { crudServiceFactory } from "@/services/FeatureService";
 *
 * export const BrandService = crudServiceFactory<Brand>(
 *   authApi,
 *   API_PATHS.BRANDS.LIST,
 * );
 * ```
 */

export interface CrudService<T> {
    getAll: (params?: Record<string, unknown>) => Promise<PaginatedResponse<T>>;
    getById: (id: string) => Promise<ApiResponse<T>>;
    create: (data: Partial<T>) => Promise<ApiResponse<T>>;
    update: (id: string, data: Partial<T>) => Promise<ApiResponse<T>>;
    remove: (id: string) => Promise<ApiResponse<T>>;
}

export function crudServiceFactory<T>(
    client: AxiosInstance,
    basePath: string,
): CrudService<T> {
    return {
        async getAll(params) {
            const res: AxiosResponse<PaginatedResponse<T>> = await client.get(
                basePath,
                { params },
            );
            return res.data;
        },

        async getById(id) {
            const res: AxiosResponse<ApiResponse<T>> = await client.get(
                `${basePath}/${id}`,
            );
            return res.data;
        },

        async create(data) {
            const res: AxiosResponse<ApiResponse<T>> = await client.post(
                basePath,
                data,
            );
            return res.data;
        },

        async update(id, data) {
            const res: AxiosResponse<ApiResponse<T>> = await client.patch(
                `${basePath}/${id}`,
                data,
            );
            return res.data;
        },

        async remove(id) {
            const res: AxiosResponse<ApiResponse<T>> = await client.delete(
                `${basePath}/${id}`,
            );
            return res.data;
        },
    };
}
