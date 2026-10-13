import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async (s) => {
    if (!s) {
      setProfile(null);
      return;
    }
    // RLS lets every user read their own employee row.
    const { data, error } = await supabase
      .from("employee")
      .select("emp_id, first_name, last_name, email, app_role, dept_id, desig_id, reports_to, status")
      .eq("auth_user_id", s.user.id)
      .maybeSingle();
    if (error) setProfileError(error.message);
    else if (!data) setProfileError("This login is not linked to any employee record.");
    else setProfileError(null);
    setProfile(data || null);
  }, []);

  useEffect(() => {
    if (session !== undefined) loadProfile(session);
  }, [session, loadProfile]);

  const value = {
    session,
    profile,
    profileError,
    loading: session === undefined || (session && !profile && !profileError),
    role: profile?.app_role,
    isStaff: profile?.app_role === "Admin" || profile?.app_role === "Payroll",
    isAdmin: profile?.app_role === "Admin",
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
    reloadProfile: () => loadProfile(session),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
