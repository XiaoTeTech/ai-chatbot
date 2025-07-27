'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { login } from '@/app/(auth)/actions';
import { useSession } from 'next-auth/react';
import { useLoginDialog } from '@/lib/context';

export function LoginDialog() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { data: session, update } = useSession(); // 提前获取 update 方法
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const { isOpen, close } = useLoginDialog();

  // 关闭弹窗的逻辑（ESC 键、点击遮罩层）
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, close]);

  // 如果已经登录，关闭弹窗
  useEffect(() => {
    if (session?.user) close();
  }, [session, close]);

  // 验证码倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码
  const sendVerificationCode = async () => {
    if (countdown > 0) return;
    if (!phone.replace('+86', '').match(/^1[3-9]\d{9}$/)) {
      toast.error('请输入有效的手机号码');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('https://lcen.xiaote.net/api/graphql/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'app-platform': 'web',
          'app-version': '0.0.1',
        },
        body: JSON.stringify({
          variables: { mobilePhoneNumber: phone },
          query: `
            mutation($mobilePhoneNumber: String!, $validateToken: String) {
              requestMobilePhoneSms(mobilePhoneNumber: $mobilePhoneNumber, validateToken: $validateToken) {
                isOk
              }
            }
          `,
        }),
      });

      const data = await response.json();
      if (data.data?.requestMobilePhoneSms?.isOk) {
        setCountdown(60);
        toast.success('验证码已发送');
      } else {
        toast.error('发送验证码失败，请稍后重试');
      }
    } catch (error) {
      toast.error('网络错误，请检查连接');
    } finally {
      setIsSending(false);
    }
  };

  // 登录逻辑（直接调用 login，不使用 useActionState）
  const handleLogin = async () => {
    if (!phone || !code) {
      toast.error('请输入手机号和验证码');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('phone', phone);
      formData.append('code', code);

      const result = await login(formData); // 直接调用 login
      console.log('登录结果:', result); // 打印登录结果

      if (result.status === 'success') {
        await update(); // 等待 session 更新完成
        toast.success('登录成功');
        close();
        // 不需要跳转，直接刷新当前页面
        router.refresh();
      } else if (result.status === 'failed') {
        toast.error('验证码错误或手机号无效');
      } else if (result.status === 'invalid_data') {
        toast.error('请输入正确的手机号和验证码');
      }
    } catch (error) {
      toast.error('登录失败，请重试');
      console.error('登录错误:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid="login-dialog"
    >
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={close}
      />
      <div className="relative bg-background/80 backdrop-blur-md rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 transition-all border border-white/10">
        <div className="absolute right-4 top-4">
          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="size-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground">欢迎回来</h2>
          <p className="text-sm text-muted-foreground mt-1">登录以继续对话</p>
        </div>
        <div className="flex flex-col gap-4 w-full">
          <div className="space-y-2">
            <label
              htmlFor="phone"
              className="text-sm font-medium text-foreground"
            >
              手机号
            </label>
            <Input
              id="phone"
              type="tel"
              placeholder="请输入手机号"
              autoComplete="tel"
              required
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 bg-background border-input hover:border-input/80 focus:border-primary transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="code"
              className="text-sm font-medium text-foreground"
            >
              验证码
            </label>
            <div className="flex gap-2">
              <Input
                id="code"
                type="text"
                placeholder="请输入验证码"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-11 bg-background border-input hover:border-input/80 focus:border-primary transition-colors flex-1"
              />
              <Button
                type="button"
                onClick={sendVerificationCode}
                disabled={
                  countdown > 0 ||
                  !phone.match(/^(\+86)?1[3-9]\d{9}$/) ||
                  isSending
                }
                variant="outline"
                className="h-11 px-4 whitespace-nowrap border-input hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {isSending
                  ? '发送中...'
                  : countdown > 0
                    ? `${countdown}s`
                    : '发送验证码'}
              </Button>
            </div>
          </div>
          <div className="pt-2">
            <Button
              type="button"
              onClick={handleLogin}
              disabled={isLoading || !phone || !code}
              className="w-full h-11"
            >
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
