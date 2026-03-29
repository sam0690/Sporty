"use client";

import { useCallback, useEffect, useState } from "react";
import {
    getLocalStorage,
    setLocalStorage,
    removeLocalStorage,
} from "@/libs/storage.local";

/**
 * React hook for reading / writing a value to localStorage.
 *
 * The value is kept in sync across re-renders.
 */
export function useLocalStorage<T>(
    key: string,
    initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        const raw = getLocalStorage(key);
        if (raw === null) return initialValue;

        try {
            return JSON.parse(raw) as T;
        } catch {
            return raw as unknown as T;
        }
    });

    // Persist to localStorage whenever storedValue changes
    useEffect(() => {
        setLocalStorage(key, JSON.stringify(storedValue));
    }, [key, storedValue]);

    const setValue = useCallback(
        (value: T | ((prev: T) => T)) => {
            setStoredValue((prev) =>
                typeof value === "function" ? (value as (p: T) => T)(prev) : value,
            );
        },
        [],
    );

    const removeValue = useCallback(() => {
        removeLocalStorage(key);
        setStoredValue(initialValue);
    }, [key, initialValue]);

    return [storedValue, setValue, removeValue];
}
