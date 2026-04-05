export * from "./league";
export * from "./player";

export type TPagination = {
    total: number;
    totalItems: number;
    currentPage: number;
    totalPages: number;
    limit: number;
};

export type PaginatedResponse<T> = {
    data: T[];
    pagination: TPagination;
};

export type ApiResponse<T> = {
    data: T;
    message: string;
};

export type TUser = {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    role: "user";
    profileImage: string;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
    permissions: {
        id: string;
        name: string;
    }[];
};

export type TUserResponse = ApiResponse<TUser>;
