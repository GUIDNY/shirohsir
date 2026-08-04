"use client";

import { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";

type AccountCredits = {
  balance: number;
  subscription: { plan: string; status: string } | null;
};

export function useAccount() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [credits, setCredits] = useState<AccountCredits | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshCredits = useCallback(async (accessToken: string | undefined) => {
    if (!accessToken) {
      setCredits(null);
      return;
    }

    setCreditsLoading(true);

    try {
      const response = await fetch("/api/account/credits", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load credits");
      }

      const data = await response.json();
      setCredits({ balance: data.balance, subscription: data.subscription });
    } catch {
      setCredits(null);
    } finally {
      setCreditsLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
      void refreshCredits(data.session?.access_token);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      void refreshCredits(nextSession?.access_token);
    });

    return () => listener.subscription.unsubscribe();
  }, [refreshCredits]);

  const signUp = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setAuthError(error.message);
      return { needsEmailConfirmation: false };
    }

    return { needsEmailConfirmation: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthError(error.message);
      return false;
    }

    return true;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    session,
    user,
    authLoading,
    authError,
    credits,
    creditsLoading,
    signUp,
    signIn,
    signOut,
    refreshCredits: () => refreshCredits(session?.access_token),
  };
}
