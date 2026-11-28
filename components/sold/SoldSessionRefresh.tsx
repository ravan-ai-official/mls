"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * After sign-in on a sold detail page, re-run the server load so close prices
 * arrive with the JWT. Client query invalidation alone cannot refresh SSR props.
 */
export function SoldSessionRefresh({ active }: { active: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const neededRefresh = useRef(active);

  useEffect(() => {
    if (active) neededRefresh.current = true;
  }, [active]);

  useEffect(() => {
    if (!user || !neededRefresh.current) return;
    neededRefresh.current = false;
    router.refresh();
  }, [user, router]);

  return null;
}
