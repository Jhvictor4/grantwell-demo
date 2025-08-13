import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { sessionManager } from '@/lib/session-manager';
import { SessionTimeoutModal } from '@/components/SessionTimeoutModal';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, metadata?: { full_name?: string; department?: string; state?: string }) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  userRole: string | null;
  isPending: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [sessionWarningMinutes, setSessionWarningMinutes] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    // Set up session manager callbacks
    sessionManager.setOnSessionExpired(() => {
      setShowSessionWarning(false);
      toast({
        title: "Session Expired",
        description: "Your session has expired for security reasons. Please sign in again.",
        variant: "destructive",
      });
    });

    sessionManager.setOnSessionWarning((minutesLeft) => {
      setSessionWarningMinutes(minutesLeft);
      setShowSessionWarning(true);
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user role and approval status
          setTimeout(async () => {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('role, approval_status')
                .eq('id', session.user.id)
                .single();
              
              if (profile?.approval_status === 'approved') {
                setUserRole(profile?.role || 'viewer');
                // Update last login
                await supabase.rpc('update_last_login', { user_id_param: session.user.id });
              } else {
                setUserRole('pending');
              }
            } catch (error) {
              // Fallback to pending if profile fetch fails
              setUserRole('pending');
            }
          }, 0);
        } else {
          setUserRole(null);
          setShowSessionWarning(false);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [toast]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Successful login - redirect to dashboard with multiple methods
      setTimeout(() => {
        try {
          window.location.href = '/';
        } catch (navError) {
          // Fallback redirect method
          window.location.replace('/');
        }
      }, 100);
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, metadata?: { full_name?: string; department?: string; state?: string }) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: metadata || {}
        }
      });

      if (error) {
        console.error('Sign up error:', error);
        if (error.message.includes('not authorized')) {
          throw new Error('Registration is by invitation only. Please contact an administrator to get access.');
        }
        throw error;
      }
      
      return { error: null };
    } catch (error: any) {
      throw error;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    setShowSessionWarning(false);
    toast({
      title: "Signed Out",
      description: "You have been successfully signed out.",
    });
  };

  const handleExtendSession = async () => {
    const success = await sessionManager.refreshSession();
    if (success) {
      setShowSessionWarning(false);
      toast({
        title: "Session Extended",
        description: "Your session has been extended for another 15 minutes.",
      });
    } else {
      signOut();
    }
  };

  const isPending = userRole === 'pending';

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    userRole,
    isPending,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionTimeoutModal
        isOpen={showSessionWarning}
        onExtendSession={handleExtendSession}
        onSignOut={signOut}
        minutesLeft={sessionWarningMinutes}
      />
    </AuthContext.Provider>
  );
};