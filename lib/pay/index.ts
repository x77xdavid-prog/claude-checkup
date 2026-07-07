// 결제 어댑터 인터페이스 + stub (스펙 §3, axpay 어댑터 패턴 재사용).
// stub(오늘, P1) → stripe test(P3) → 실결제(P4). 인터페이스만 안정적으로 유지.
//
// ponytail: 오늘은 결제 UI가 "대기자 등록"까지만이라 stub이 실제로 호출되진 않는다.
//           인터페이스를 미리 못 박아 두어 프라이싱/구독 로직이 결제 세부에 물들지 않게 함.
//           승급 경로 = lib/pay/stripe.ts 추가 후 여기서 교체.

export interface CheckoutInput {
  plan: string; // 예: "pro-monthly"
  email?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  ok: boolean;
  // stub: 결제 미구현이라 checkout URL 대신 대기자 안내로 폴백.
  url: string | null;
  provider: string;
  message: string;
}

export interface WebhookVerifyResult {
  ok: boolean;
  event: string | null;
  message: string;
}

export interface PayAdapter {
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyWebhook(payload: string, signature: string): Promise<WebhookVerifyResult>;
}

const stubPay: PayAdapter = {
  async createCheckout(_input: CheckoutInput): Promise<CheckoutResult> {
    return {
      ok: false,
      url: null,
      provider: "stub",
      message: "결제는 준비 중입니다. 대기자로 등록하시면 오픈 시 안내드립니다.",
    };
  },
  async verifyWebhook(_payload: string, _signature: string): Promise<WebhookVerifyResult> {
    return { ok: false, event: null, message: "stub: 웹훅 미구현" };
  },
};

// 단일 export 지점. P3: process.env.STRIPE_SECRET_KEY 있으면 stripePay 반환.
export const pay: PayAdapter = stubPay;
