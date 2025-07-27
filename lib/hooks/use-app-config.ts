import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import type { AppConfigResponse } from '@/lib/api/external-chat-service';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useAppConfig() {
  const { data: session } = useSession();

  // 只有在用户登录时才请求配置
  const { data, error, isLoading } = useSWR<AppConfigResponse>(
    session?.user ? '/api/app-config' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1分钟内不重复请求
    },
  );

  return {
    config: data,
    isLoading,
    error,
  };
}
