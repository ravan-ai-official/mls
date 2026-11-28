"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "@/lib/types/domain";
import {
  authMeQuery,
  loginRequest,
  logoutRequest,
  registerRequest,
} from "@/lib/queries/auth";
import { HttpError } from "@/lib/queries/fetcher";
import { qk } from "@/lib/queries/keys";

export type AuthMode = "login" | "signup";

interface AuthContextValue {
  user: AuthUser | null;
  /** True while a sign-in / sign-up request is in flight. */
  pending: boolean;
  /** Auth dialog state, shared by the navbar, save actions and gated forms. */
  authDialog: { open: boolean; mode: AuthMode };
  /**
   * Opens the sign-in dialog. `afterAuth` runs once, as soon as a user is
   * signed in by any route (password, Google, Facebook) — so a gated action
   * the visitor clicked continues instead of being lost behind the dialog.
   */
  openAuth: (mode?: AuthMode, afterAuth?: () => void) => void;
  closeAuth: () => void;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string; needsVerification?: boolean }>;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    phone: string;
    agreeTerms: boolean;
    emailRecommend?: boolean;
    emailWatchedProperty?: boolean;
    emailWatchedCommunity?: boolean;
    emailWatchedArea?: boolean;
    pushWatchedProperty?: boolean;
  }) => Promise<{ ok: boolean; error?: string; detail?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
  /** Adopts a user returned by a sign-in route handler (e.g. social sign-in). */
  setSignedInUser: (user: AuthUser) => void;
  /** Phone verification dialog; resolves true once the phone is verified. */
  phoneDialogOpen: boolean;
  verifyPhone: () => Promise<boolean>;
  finishPhoneVerification: (verified: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** One auth-recovery attempt per window, however many queries 401 at once. */
const AUTH_RECHECK_MS = 10_000;

export function AuthProvider({
  initialUser,
  children,
}: {
  /** Resolved on the server so the first paint already knows who is signed in. */
  initialUser: AuthUser | null;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();

  /*
   * The user lives in the query cache (qk.auth.me), seeded from the server so
   * the first render never fetches. Everything that changes it — sign-in,
   * social sign-in, sign-out, phone verification — writes the cache.
   */
  const meQuery = useQuery({ ...authMeQuery, initialData: initialUser });
  const user = meQuery.data ?? null;

  const setUser = useCallback(
    (next: AuthUser | null) => queryClient.setQueryData(qk.auth.me, next),
    [queryClient],
  );

  const [authDialog, setAuthDialog] = useState<{ open: boolean; mode: AuthMode }>({
    open: false,
    mode: "signup",
  });
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);

  const afterAuthRef = useRef<(() => void) | null>(null);
  const phoneResolverRef = useRef<((verified: boolean) => void) | null>(null);

  /*
   * Per-user cache hygiene. All per-user data is keyed under ["me", userId],
   * so a different account can't be served stale rows anyway — this also
   * drops the previous account's data from memory on sign-out or a switch,
   * which matters on a shared computer.
   */
  const userId = user?.id ?? null;
  const lastUserId = useRef(userId);
  useEffect(() => {
    if (lastUserId.current === userId) return;
    const previous = lastUserId.current;
    lastUserId.current = userId;
    const keep = (query: Query) => userId !== null && query.queryKey[1] === userId;
    void queryClient.cancelQueries({ queryKey: qk.meRoot, predicate: (q) => !keep(q) });
    queryClient.removeQueries({ queryKey: qk.meRoot, predicate: (q) => !keep(q) });
    // Anonymous sold caches must not stick after sign-in — refetch list/map/rails.
    if (previous === null && userId !== null) {
      void queryClient.invalidateQueries({ queryKey: qk.properties.all });
      void queryClient.invalidateQueries({ queryKey: ["map"] });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
      void queryClient.invalidateQueries({ queryKey: ["property"] });
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
    }
  }, [userId, queryClient]);

  // Run the queued continuation once a user appears. An effect (not the
  // individual sign-in paths) so every route — password, social, a refresh
  // after an OAuth redirect — continues the same way.
  useEffect(() => {
    if (!user || !afterAuthRef.current) return;
    const next = afterAuthRef.current;
    afterAuthRef.current = null;
    next();
  }, [user]);

  const openAuth = useCallback((mode: AuthMode = "signup", afterAuth?: () => void) => {
    afterAuthRef.current = afterAuth ?? null;
    setAuthDialog({ open: true, mode });
  }, []);

  const closeAuth = useCallback(() => {
    setAuthDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      return await queryClient.fetchQuery({ ...authMeQuery, staleTime: 0 });
    } catch {
      // Keep the current user; a transient failure should not sign anyone out.
      return queryClient.getQueryData<AuthUser | null>(qk.auth.me) ?? null;
    }
  }, [queryClient]);

  /*
   * A per-user query answering 401 means the session died mid-visit (expired
   * refresh token, signed out in another tab). Re-check /me once: if the
   * session is really gone the user becomes null, the hygiene effect above
   * clears the cache, and the UI shows signed-out state instead of errors.
   */
  const lastRecheck = useRef(0);
  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "error") return;
      if (event.query.queryKey[0] !== qk.meRoot[0]) return;
      const error = event.action.error;
      if (!(error instanceof HttpError) || !error.isAuth) return;
      const now = Date.now();
      if (now - lastRecheck.current < AUTH_RECHECK_MS) return;
      lastRecheck.current = now;
      void refresh();
    });
  }, [queryClient, refresh]);

  const setSignedInUser = useCallback(
    (next: AuthUser) => {
      setUser(next);
      setAuthDialog((prev) => ({ ...prev, open: false }));
    },
    [setUser],
  );

  const login = useMutation({ mutationFn: loginRequest });
  const register = useMutation({ mutationFn: registerRequest });
  const logout = useMutation({ mutationFn: logoutRequest });

  const { mutateAsync: loginAsync } = login;
  const signIn = useCallback<AuthContextValue["signIn"]>(
    async (email, password) => {
      try {
        const data = await loginAsync({ email, password });
        setUser(data?.user ?? null);
        setAuthDialog((prev) => ({ ...prev, open: false }));
        return { ok: true };
      } catch (error) {
        if (error instanceof HttpError) {
          const payload = (error.payload ?? {}) as { needsVerification?: unknown };
          return {
            ok: false,
            error: error.message,
            needsVerification: Boolean(payload.needsVerification),
          };
        }
        return { ok: false, error: "Network error. Please try again." };
      }
    },
    [loginAsync, setUser],
  );

  const { mutateAsync: registerAsync } = register;
  const signUp = useCallback<AuthContextValue["signUp"]>(
    async (input) => {
      try {
        const data = await registerAsync(input);
        // No tokens here by design — the account needs email verification
        // first, so a queued continuation must wait for the eventual sign-in.
        return { ok: true, detail: data?.detail };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof HttpError ? error.message : "Network error. Please try again.",
        };
      }
    },
    [registerAsync],
  );

  const { mutateAsync: logoutAsync } = logout;
  const signOut = useCallback(async () => {
    try {
      await logoutAsync();
    } catch {
      // Clear locally regardless; the cookies are httpOnly and expire anyway.
    } finally {
      afterAuthRef.current = null;
      setUser(null);
    }
  }, [logoutAsync, setUser]);

  const verifyPhone = useCallback(() => {
    // A second request while the dialog is open supersedes the first.
    phoneResolverRef.current?.(false);
    setPhoneDialogOpen(true);
    return new Promise<boolean>((resolve) => {
      phoneResolverRef.current = resolve;
    });
  }, []);

  const finishPhoneVerification = useCallback((verified: boolean) => {
    setPhoneDialogOpen(false);
    const resolve = phoneResolverRef.current;
    phoneResolverRef.current = null;
    resolve?.(verified);
  }, []);

  const pending = login.isPending || register.isPending;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      pending,
      authDialog,
      openAuth,
      closeAuth,
      signIn,
      signUp,
      signOut,
      refresh,
      setSignedInUser,
      phoneDialogOpen,
      verifyPhone,
      finishPhoneVerification,
    }),
    [
      user,
      pending,
      authDialog,
      openAuth,
      closeAuth,
      signIn,
      signUp,
      signOut,
      refresh,
      setSignedInUser,
      phoneDialogOpen,
      verifyPhone,
      finishPhoneVerification,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within <AuthProvider>");
  return context;
}

/** Per-user query keys for the signed-in user, or null when signed out. */
export function useUserKeys() {
  const { user } = useAuth();
  return useMemo(() => (user ? qk.me(user.id) : null), [user]);
}
