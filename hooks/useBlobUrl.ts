"use client";

import { useCallback, useRef } from "react";

/**
 * Manages Blob URLs with automatic cleanup.
 * Pass a Blob (or Uint8Array) → returns a stable URL.
 * Calling revoke() or the next create() call cleans up the previous URL.
 */
export function useBlobUrl() {
  const urlRef = useRef<string | null>(null);

  const create = useCallback((data: Uint8Array | Blob): string => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
    }
    const blob = data instanceof Blob ? data : new Blob([new Uint8Array(data)], { type: "application/pdf" });
    urlRef.current = URL.createObjectURL(blob);
    return urlRef.current;
  }, []);

  const revoke = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  return { create, revoke };
}