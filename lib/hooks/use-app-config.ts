import useSWR from 'swr';
import type { AppConfigResponse } from '@/lib/api/external-chat-service';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useAppConfig() {
  const { data, error, isLoading } = useSWR<AppConfigResponse>(
    '/api/app-config',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1分钟内不重复请求
    }
  );

  return {
    config: data,
    isLoading,
    error,
  };
}
