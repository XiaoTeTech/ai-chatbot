import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export interface AppConfig {
  store_url: string;
  store_app_scheme: string;
  vehicle_data_polling_interval: number;
  sentence_stop_delay: number;
  support_email: string;
  chat_introduction: string;
  chat_suggestions: string[];
}

export const useAppConfig = () => {
  const { data: session } = useSession();
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAppConfig = async () => {
      // 如果没有 session 或 lcSessionToken，不发送请求
      if (!session?.user?.lcSessionToken) {
        setLoading(false);
        setError('No session token available');
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(
          'https://uther.xiaote.net/api/chat_conf/app_config',
          {
            headers: {
              accept: 'application/json',
              'X-LC-Session': session.user.lcSessionToken,
            },
          },
        );

        if (response.ok) {
          const config = await response.json();
          setAppConfig(config);
          setError(null);
        } else {
          setError(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (err) {
        console.error('Failed to fetch app config:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchAppConfig();
  }, [session?.user?.lcSessionToken]); // 当 session token 变化时重新获取配置

  return { appConfig, loading, error };
};
