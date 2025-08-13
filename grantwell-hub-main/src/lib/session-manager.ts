import { supabase } from '@/integrations/supabase/client';

interface SessionConfig {
  timeoutMinutes: number;
  warningMinutes: number;
}

class SessionManager {
  private timeoutId: NodeJS.Timeout | null = null;
  private warningTimeoutId: NodeJS.Timeout | null = null;
  private config: SessionConfig = {
    timeoutMinutes: 15,
    warningMinutes: 2
  };
  private onSessionExpired?: () => void;
  private onSessionWarning?: (minutesLeft: number) => void;

  constructor() {
    this.loadConfig();
    this.setupActivityListeners();
    this.setupAuthListener();
  }

  private async loadConfig() {
    try {
      const { data } = await supabase
        .from('security_settings')
        .select('setting_value')
        .eq('setting_name', 'session_timeout_minutes')
        .single();

      if (data?.setting_value) {
        this.config.timeoutMinutes = parseInt(data.setting_value as string) || 15;
      }
    } catch (error) {
      console.warn('Could not load session config:', error);
    }
  }

  private setupAuthListener() {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        this.startSessionTimer();
      } else if (event === 'SIGNED_OUT') {
        this.clearTimers();
      }
    });
  }

  private setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, () => {
        this.resetSessionTimer();
      }, { passive: true });
    });
  }

  private startSessionTimer() {
    this.clearTimers();
    
    const timeoutMs = this.config.timeoutMinutes * 60 * 1000;
    const warningMs = (this.config.timeoutMinutes - this.config.warningMinutes) * 60 * 1000;

    // Set warning timer
    this.warningTimeoutId = setTimeout(() => {
      this.onSessionWarning?.(this.config.warningMinutes);
    }, warningMs);

    // Set session timeout
    this.timeoutId = setTimeout(() => {
      this.expireSession();
    }, timeoutMs);
  }

  private resetSessionTimer() {
    const currentSession = supabase.auth.getSession();
    if (currentSession) {
      this.startSessionTimer();
    }
  }

  private clearTimers() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.warningTimeoutId) {
      clearTimeout(this.warningTimeoutId);
      this.warningTimeoutId = null;
    }
  }

  private async expireSession() {
    try {
      await supabase.auth.signOut();
      this.onSessionExpired?.();
    } catch (error) {
      console.error('Error during session expiration:', error);
    }
  }

  public setOnSessionExpired(callback: () => void) {
    this.onSessionExpired = callback;
  }

  public setOnSessionWarning(callback: (minutesLeft: number) => void) {
    this.onSessionWarning = callback;
  }

  public async refreshSession() {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      
      if (data.session) {
        this.startSessionTimer();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return false;
    }
  }

  public getTimeoutMinutes(): number {
    return this.config.timeoutMinutes;
  }
}

export const sessionManager = new SessionManager();