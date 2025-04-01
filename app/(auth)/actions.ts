'use server';

import { z } from 'zod';
import { signIn } from './auth'; // 假设 './auth' 是你 NextAuth 配置导出的 signIn

// Zod Schemas (保持不变)
const authFormSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入正确的手机号'),
  code: z.string().length(6, '验证码必须为6位'),
});

const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/, '请输入正确的手机号');

// Action State Interfaces (保持不变)
export interface LoginActionState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data';
}

export interface SendCodeActionState {
  status: 'idle' | 'success' | 'failed' | 'invalid_phone';
}

// --- login Server Action with Added Logging ---
export const login = async (
  formData: FormData,
): Promise<LoginActionState> => {

  const phone = formData.get('phone');
  const code = formData.get('code');

  try {
    const validatedData = authFormSchema.parse({ phone, code });
    await signIn('credentials', {
      phone: validatedData.phone,
      code: validatedData.code,
      redirect: false, // redirect: false 很重要，让 signIn 抛出错误而不是重定向
    });
    return { status: 'success' };

  } catch (error) {

    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    // 特别检查 NextAuth 的 CredentialsSignin 错误 (可选但推荐)
    // 注意：错误类型可能需要根据你的 NextAuth 版本调整，或者直接检查 error.type
    // if (error.type === 'CredentialsSignin') { // 根据 NextAuth 版本可能需要调整
    //   console.log('[SERVER ACTION - login] Error is CredentialsSignin. Returning status: failed (Auth Error)');
    //   return { status: 'failed' };
    // }

    return { status: 'failed' };
  }
};

// --- sendVerificationCode Server Action with Added Logging ---
export const sendVerificationCode = async (
  prevState: SendCodeActionState, // 通常第一个参数是前一个状态
  formData: FormData,
): Promise<SendCodeActionState> => {

  const phone = formData.get('phone');

  try {
    const validatedPhone = phoneSchema.parse(phone);

    const response = await fetch('https://lcen.xiaote.net/api/graphql/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'app-platform': 'web',
        'app-version': '0.0.1',
      },
      body: JSON.stringify({
        variables: {
          mobilePhoneNumber: validatedPhone, // 使用验证后的手机号
        },
        query: `mutation($mobilePhoneNumber: String!, $validateToken: String) {
          requestMobilePhoneSms(mobilePhoneNumber: $mobilePhoneNumber, validateToken: $validateToken) {
            isOk
          }
        }`,
      }),
    });

    if (!response.ok) {
       console.error(`[SERVER ACTION - sendCode] External API request failed with status: ${response.status}`);
       // 可以尝试读取 response.text() 来获取更多错误信息
       // const errorText = await response.text();
       // console.error(`[SERVER ACTION - sendCode] External API error response body: ${errorText}`);
       return { status: 'failed' };
    }

    const data = await response.json();
    if (data.data?.requestMobilePhoneSms?.isOk) {
      return { status: 'success' };
    } else {
      return { status: 'failed' };
    }

  } catch (error) {

    if (error instanceof z.ZodError) {
      return { status: 'invalid_phone' };
    }
    // 网络错误或其他意外错误
    return { status: 'failed' };
  }
};