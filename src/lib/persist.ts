import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "sct.";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable — ignore */
  }
}

/**
 * useState được đồng bộ với localStorage: dữ liệu thao tác (thêm/sửa/xóa)
 * sẽ được lưu lại và không bị mất khi reload trang.
 */
export function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    const resolved = typeof initial === "function" ? (initial as () => T)() : initial;
    return read(key, resolved);
  });
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    write(key, value);
  }, [key, value]);

  const reset = useCallback(() => {
    const resolved = typeof initial === "function" ? (initial as () => T)() : initial;
    setValue(resolved);
  }, [initial]);

  return [value, setValue, reset] as const;
}

/** Xóa toàn bộ dữ liệu đã lưu trong localStorage của ứng dụng (dùng cho nút "Khôi phục mặc định"). */
export function clearPersistentState(): void {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => window.localStorage.removeItem(k));
}
