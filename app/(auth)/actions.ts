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
  console.log('[SERVER ACTION - login] Received request.'); // 日志 1: 操作开始

  const phone = formData.get('phone');
  const code = formData.get('code');
  console.log(`[SERVER ACTION - login] Received data - Phone: ${phone}, Code: ${code}`); // 日志 2: 收到数据

  try {
    console.log('[SERVER ACTION - login] Validating form data with Zod...'); // 日志 3: Zod验证开始
    const validatedData = authFormSchema.parse({ phone, code });
    console.log('[SERVER ACTION - login] Zod validation successful.'); // 日志 4: Zod验证成功

    console.log('[SERVER ACTION - login] Attempting signIn with credentials...'); // 日志 5: 调用signIn开始
    // 注意：signIn 失败时会抛出错误，被下面的 catch 捕获
    await signIn('credentials', {
      phone: validatedData.phone,
      code: validatedData.code,
      redirect: false, // redirect: false 很重要，让 signIn 抛出错误而不是重定向
    });
    console.log('[SERVER ACTION - login] signIn call successful (or did not throw).'); // 日志 6: signIn调用完成(未抛错)

    console.log('[SERVER ACTION - login] Returning status: success'); // 日志 7: 准备返回成功
    return { status: 'success' };

  } catch (error) {
    console.error('[SERVER ACTION - login] Caught an error:', error); // 日志 8: 捕获到错误

    if (error instanceof z.ZodError) {
      console.log('[SERVER ACTION - login] Error is ZodError. Returning status: invalid_data'); // 日志 9: Zod错误
      return { status: 'invalid_data' };
    }

    // 特别检查 NextAuth 的 CredentialsSignin 错误 (可选但推荐)
    // 注意：错误类型可能需要根据你的 NextAuth 版本调整，或者直接检查 error.type
    // if (error.type === 'CredentialsSignin') { // 根据 NextAuth 版本可能需要调整
    //   console.log('[SERVER ACTION - login] Error is CredentialsSignin. Returning status: failed (Auth Error)');
    //   return { status: 'failed' };
    // }

    console.log('[SERVER ACTION - login] Unknown error type. Returning status: failed'); // 日志 10: 其他错误
    return { status: 'failed' };
  }
};

// --- sendVerificationCode Server Action with Added Logging ---
export const sendVerificationCode = async (
  prevState: SendCodeActionState, // 通常第一个参数是前一个状态
  formData: FormData,
): Promise<SendCodeActionState> => {
  console.log('[SERVER ACTION - sendCode] Received request.'); // 日志 1: 操作开始

  const phone = formData.get('phone');
  console.log(`[SERVER ACTION - sendCode] Received data - Phone: ${phone}`); // 日志 2: 收到数据

  try {
    console.log('[SERVER ACTION - sendCode] Validating phone number with Zod...'); // 日志 3: Zod验证开始
    const validatedPhone = phoneSchema.parse(phone);
    console.log('[SERVER ACTION - sendCode] Zod validation successful.'); // 日志 4: Zod验证成功

    console.log(`[SERVER ACTION - sendCode] Sending request to external API for phone: ${validatedPhone}...`); // 日志 5: 请求外部API开始
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
    console.log(`[SERVER ACTION - sendCode] External API response status: ${response.status}`); // 日志 6: API响应状态码

    if (!response.ok) {
       console.error(`[SERVER ACTION - sendCode] External API request failed with status: ${response.status}`);
       // 可以尝试读取 response.text() 来获取更多错误信息
       // const errorText = await response.text();
       // console.error(`[SERVER ACTION - sendCode] External API error response body: ${errorText}`);
       return { status: 'failed' };
    }

    const data = await response.json();
    console.log('[SERVER ACTION - sendCode] External API response data:', JSON.stringify(data)); // 日志 7: API响应数据

    if (data.data?.requestMobilePhoneSms?.isOk) {
      console.log('[SERVER ACTION - sendCode] API indicates success. Returning status: success'); // 日志 8: API成功
      return { status: 'success' };
    } else {
      console.log('[SERVER ACTION - sendCode] API indicates failure or unexpected data. Returning status: failed'); // 日志 9: API失败
      // 可以打印更详细的失败原因，如果 API 返回了的话
      // console.log('[SERVER ACTION - sendCode] Failure reason from API (if any):', data.errors || data.data?.requestMobilePhoneSms);
      return { status: 'failed' };
    }

  } catch (error) {
    console.error('[SERVER ACTION - sendCode] Caught an error:', error); // 日志 10: 捕获到错误

    if (error instanceof z.ZodError) {
      console.log('[SERVER ACTION - sendCode] Error is ZodError. Returning status: invalid_phone'); // 日志 11: Zod错误
      return { status: 'invalid_phone' };
    }
    // 网络错误或其他意外错误
    console.log('[SERVER ACTION - sendCode] Unknown error type. Returning status: failed'); // 日志 12: 其他错误
    return { status: 'failed' };
  }
};