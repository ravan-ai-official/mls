"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ListingView = "grid" | "list";

const STORAGE_KEY = "ha.listings.view";

const listeners = new Set<() => void>();
let memory: ListingView | null = null;

function readStored(): ListingView {
  try {
    return localStorage.getItem(STORAGE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function getClientSnapshot(): ListingView {
  if (memory === null) memory = readStored();
  return memory;
}

function getServerSnapshot(): ListingView {
  return "grid";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener());
}

/**
 * Grid / list preference for /listings — client-only so switching views never
 * hits the router or refetches. Persisted in localStorage across visits.
 */
export function useListingView() {
  const view = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  const setView = useCallback((next: ListingView) => {
    if (next === memory) return;
    memory = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
    emit();
  }, []);

  return [view, setView] as const;
}
