import { useState, useEffect } from 'react';

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
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAppConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          'http://127.0.0.1:3003/api/chat_conf/app_config',
          {
            headers: {
              accept: 'application/json',
              'X-LC-Session': 'rl7aqhfjva102otw0rgq0zlr8',
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
  }, []);

  return { appConfig, loading, error };
};
