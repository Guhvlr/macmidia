import { supabase } from '@/integrations/supabase/client';

type LogLevel = 'info' | 'warning' | 'error';
type LogCategory = 'performance' | 'error' | 'usage' | 'security';

interface LogOptions {
  level: LogLevel;
  category: LogCategory;
  action: string;
  message?: string;
  durationMs?: number;
  metadata?: any;
}

class MonitoringService {
  private static instance: MonitoringService;
  private currentUserId?: string;
  private currentUserName?: string;

  private constructor() {
    this.initSession();
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  private async initSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      this.currentUserId = session.user.id;
      // Fetch user name from logs or context if possible
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      this.currentUserId = session?.user?.id;
    });
  }

  setUserInfo(id: string, name: string) {
    this.currentUserId = id;
    this.currentUserName = name;
  }

  async log(options: LogOptions) {
    // 1. Console log (always local)
    const logStyle = options.level === 'error' ? 'color: red; font-weight: bold;' : 
                     options.level === 'warning' ? 'color: orange;' : 'color: gray;';
    
    if (import.meta.env.DEV) {
      console.log(`[${options.category.toUpperCase()}] %c${options.action}: ${options.message || ''} (${options.durationMs || 0}ms)`, logStyle, options.metadata || '');
    }

    // 2. Slow operation alert (local only for now to avoid noise)
    if (options.durationMs && options.durationMs > 500 && options.category === 'performance') {
      console.warn(`[PERF ALERT] Operação lenta detectada: ${options.action} levou ${options.durationMs}ms`);
    }

    // 3. Supabase log (async to not block main thread)
    try {
      (supabase as any).from('system_logs').insert({
        level: options.level,
        category: options.category,
        action: options.action,
        message: options.message,
        duration_ms: options.durationMs,
        metadata: options.metadata || {},
        user_id: this.currentUserId,
        user_name: this.currentUserName
      }).then(({ error }: any) => { if (error) console.error('Failed to send log to server:', error); });
    } catch (err) {
      // Fail silently for logging
    }
  }

  // Helper for performance tracking
  async trackPerformance<T>(action: string, fn: () => Promise<T>, metadata?: any): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - start);
      this.log({
        level: 'info',
        category: 'performance',
        action,
        durationMs: duration,
        metadata
      });
      return result;
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      this.log({
        level: 'error',
        category: 'error',
        action: `${action}_FAILED`,
        durationMs: duration,
        message: err.message || 'Erro deconhecido',
        metadata: { ...metadata, error: err }
      });
      throw err;
    }
  }

  trackUsage(action: string, metadata?: any) {
    this.log({ level: 'info', category: 'usage', action, metadata });
  }

  reportError(action: string, error: any, metadata?: any) {
    this.log({
      level: 'error',
      category: 'error',
      action,
      message: error instanceof Error ? error.message : String(error),
      metadata: { ...metadata, stack: error instanceof Error ? error.stack : undefined }
    });
  }
}

export const monitoring = MonitoringService.getInstance();
