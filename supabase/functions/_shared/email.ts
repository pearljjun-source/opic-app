// _shared/email.ts
// Edge Function 공통: Resend 기반 이메일 발송 + email_logs 기록
//
// 사용법:
//   import { sendEmail, emailTemplates } from '../_shared/email.ts';
//   const { subject, html } = emailTemplates.paymentConfirmation({ ... });
//   await sendEmail(supabaseAdmin, { to, subject, html, templateType: 'payment_confirmation' });

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logger } from './logger.ts';

// ============================================================================
// 이메일 발송
// ============================================================================

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  templateType: string;
  metadata?: Record<string, unknown>;
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: SendEmailParams
): Promise<SendEmailResult> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!resendApiKey) {
    logger.warn('RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Speaky <noreply@speaky.co.kr>',
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      const errorMsg = result.message || `Resend API error: ${res.status}`;
      // 로그 기록 (실패)
      await logEmail(supabaseAdmin, {
        to_email: params.to,
        template_type: params.templateType,
        subject: params.subject,
        status: 'failed',
        error_message: errorMsg,
        metadata: params.metadata,
      });
      return { success: false, error: errorMsg };
    }

    // 로그 기록 (성공)
    await logEmail(supabaseAdmin, {
      to_email: params.to,
      template_type: params.templateType,
      subject: params.subject,
      provider_id: result.id,
      status: 'sent',
      metadata: params.metadata,
    });

    return { success: true, id: result.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('sendEmail failed', err);

    await logEmail(supabaseAdmin, {
      to_email: params.to,
      template_type: params.templateType,
      subject: params.subject,
      status: 'failed',
      error_message: errorMsg,
      metadata: params.metadata,
    });

    return { success: false, error: errorMsg };
  }
}

// email_logs 테이블에 기록
async function logEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    to_email: string;
    template_type: string;
    subject: string;
    provider_id?: string;
    status: string;
    error_message?: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await supabaseAdmin.from('email_logs').insert({
      to_email: params.to_email,
      template_type: params.template_type,
      subject: params.subject,
      provider_id: params.provider_id || null,
      status: params.status,
      error_message: params.error_message || null,
      metadata: params.metadata || {},
    });
  } catch (err) {
    logger.error('Failed to log email', err);
  }
}

// ============================================================================
// 이메일 템플릿
// ============================================================================

const BRAND_COLOR = '#D4707F';
const BRAND_NAME = 'Speaky';

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function wrapTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
  <!-- Header -->
  <tr><td style="background-color:${BRAND_COLOR};padding:24px 32px;">
    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${BRAND_NAME}</h1>
  </td></tr>
  <!-- Content -->
  <tr><td style="padding:32px;">
    ${content}
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:16px 32px;border-top:1px solid #e5e5e5;background-color:#fafafa;">
    <p style="margin:0;font-size:12px;color:#a3a3a3;text-align:center;">
      © ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.<br>
      문의: support@speaky.co.kr
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export const emailTemplates = {
  /** 결제 확인 영수증 */
  paymentConfirmation(params: {
    orgName: string;
    planName: string;
    amount: number;
    cardLast4: string;
    receiptUrl: string | null;
    paidAt: string;
  }): { subject: string; html: string } {
    const receiptLink = params.receiptUrl
      ? `<p style="margin:16px 0 0;"><a href="${params.receiptUrl}" style="color:${BRAND_COLOR};text-decoration:underline;">영수증 보기</a></p>`
      : '';

    return {
      subject: `[Speaky] ${params.planName} 플랜 결제가 완료되었습니다`,
      html: wrapTemplate(`
        <h2 style="margin:0 0 16px;font-size:18px;color:#171717;">결제가 완료되었습니다</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#525252;">안녕하세요, ${params.orgName} 관리자님.</p>
        <table width="100%" style="border:1px solid #e5e5e5;border-radius:8px;border-collapse:separate;overflow:hidden;">
          <tr style="background-color:#fafafa;">
            <td style="padding:12px 16px;font-size:13px;color:#737373;">플랜</td>
            <td style="padding:12px 16px;font-size:14px;color:#171717;font-weight:600;text-align:right;">${params.planName}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-size:13px;color:#737373;border-top:1px solid #e5e5e5;">결제 금액</td>
            <td style="padding:12px 16px;font-size:14px;color:#171717;font-weight:600;text-align:right;border-top:1px solid #e5e5e5;">${formatAmount(params.amount)}</td>
          </tr>
          <tr style="background-color:#fafafa;">
            <td style="padding:12px 16px;font-size:13px;color:#737373;border-top:1px solid #e5e5e5;">결제 수단</td>
            <td style="padding:12px 16px;font-size:14px;color:#171717;text-align:right;border-top:1px solid #e5e5e5;">카드 (****${params.cardLast4})</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-size:13px;color:#737373;border-top:1px solid #e5e5e5;">결제일</td>
            <td style="padding:12px 16px;font-size:14px;color:#171717;text-align:right;border-top:1px solid #e5e5e5;">${formatDate(params.paidAt)}</td>
          </tr>
        </table>
        ${receiptLink}
      `),
    };
  },

  /** 트라이얼 만료 경고 (3일 전) */
  trialExpiryWarning(params: {
    orgName: string;
    daysLeft: number;
    trialEndsAt: string;
  }): { subject: string; html: string } {
    return {
      subject: `[Speaky] 무료 체험이 ${params.daysLeft}일 후 종료됩니다`,
      html: wrapTemplate(`
        <h2 style="margin:0 0 16px;font-size:18px;color:#171717;">무료 체험 종료 안내</h2>
        <p style="margin:0 0 16px;font-size:14px;color:#525252;">
          안녕하세요, ${params.orgName} 관리자님.<br>
          현재 이용 중인 무료 체험이 <strong>${formatDate(params.trialEndsAt)}</strong>에 종료됩니다.
        </p>
        <p style="margin:0 0 24px;font-size:14px;color:#525252;">
          체험 종료 후에는 무료 플랜으로 자동 전환되며, AI 피드백 등 일부 기능이 제한됩니다.
          계속 이용하시려면 유료 플랜으로 업그레이드해 주세요.
        </p>
        <a href="https://speaky.co.kr" style="display:inline-block;background-color:${BRAND_COLOR};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">플랜 업그레이드</a>
      `),
    };
  },

  /** 결제 실패 (Dunning) */
  paymentFailure(params: {
    orgName: string;
    day: number;
    failureReason?: string;
  }): { subject: string; html: string } {
    const urgency = params.day >= 7 ? '긴급' : '안내';
    const remainingDays = 14 - params.day;

    return {
      subject: `[Speaky] [${urgency}] 구독 결제가 실패했습니다`,
      html: wrapTemplate(`
        <h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">결제 실패 안내</h2>
        <p style="margin:0 0 16px;font-size:14px;color:#525252;">
          안녕하세요, ${params.orgName} 관리자님.<br>
          구독 갱신 결제가 실패했습니다.
        </p>
        ${params.failureReason ? `<p style="margin:0 0 16px;font-size:13px;color:#737373;">사유: ${params.failureReason}</p>` : ''}
        <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 24px;">
          <p style="margin:0;font-size:14px;color:#dc2626;font-weight:600;">
            ${remainingDays > 0
              ? `${remainingDays}일 내에 결제 수단을 변경하지 않으면 서비스가 중단됩니다.`
              : '결제 실패로 인해 구독이 만료되었습니다.'}
          </p>
        </div>
        <a href="https://speaky.co.kr" style="display:inline-block;background-color:${BRAND_COLOR};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">결제 수단 변경</a>
      `),
    };
  },

  /** 구독 취소 확인 */
  cancellationConfirmation(params: {
    orgName: string;
    planName: string;
    periodEnd: string;
  }): { subject: string; html: string } {
    return {
      subject: '[Speaky] 구독 취소가 처리되었습니다',
      html: wrapTemplate(`
        <h2 style="margin:0 0 16px;font-size:18px;color:#171717;">구독 취소 안내</h2>
        <p style="margin:0 0 16px;font-size:14px;color:#525252;">
          안녕하세요, ${params.orgName} 관리자님.<br>
          ${params.planName} 플랜 구독 취소가 처리되었습니다.
        </p>
        <div style="background-color:#f5f5f5;border-radius:8px;padding:16px;margin:0 0 24px;">
          <p style="margin:0;font-size:14px;color:#525252;">
            <strong>${formatDate(params.periodEnd)}</strong>까지 현재 플랜의 모든 기능을 계속 이용하실 수 있습니다.<br>
            이후에는 무료 플랜으로 전환됩니다.
          </p>
        </div>
        <p style="margin:0;font-size:13px;color:#737373;">
          마음이 바뀌시면 언제든 구독을 다시 시작할 수 있습니다.
        </p>
      `),
    };
  },

  /** 환불 완료 */
  refundCompletion(params: {
    orgName: string;
    amount: number;
    refundDate: string;
  }): { subject: string; html: string } {
    return {
      subject: '[Speaky] 환불이 완료되었습니다',
      html: wrapTemplate(`
        <h2 style="margin:0 0 16px;font-size:18px;color:#171717;">환불 완료 안내</h2>
        <p style="margin:0 0 16px;font-size:14px;color:#525252;">
          안녕하세요, ${params.orgName} 관리자님.<br>
          요청하신 환불이 처리되었습니다.
        </p>
        <table width="100%" style="border:1px solid #e5e5e5;border-radius:8px;border-collapse:separate;overflow:hidden;">
          <tr style="background-color:#fafafa;">
            <td style="padding:12px 16px;font-size:13px;color:#737373;">환불 금액</td>
            <td style="padding:12px 16px;font-size:14px;color:#171717;font-weight:600;text-align:right;">${formatAmount(params.amount)}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-size:13px;color:#737373;border-top:1px solid #e5e5e5;">처리일</td>
            <td style="padding:12px 16px;font-size:14px;color:#171717;text-align:right;border-top:1px solid #e5e5e5;">${formatDate(params.refundDate)}</td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:13px;color:#737373;">
          환불 금액은 결제 수단에 따라 3~5영업일 내에 반영됩니다.
        </p>
      `),
    };
  },
};
