// _shared/crypto.ts
// Edge Function 공통: billing_key 등 민감 데이터 암호화/복호화
//
// AES-256-GCM (Web Crypto API) 사용
// 암호화 키: BILLING_ENCRYPTION_KEY 환경변수 (supabase secrets set)
// 형식: base64(iv:ciphertext:tag) — 단일 문자열로 저장

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96-bit IV (GCM 권장)

/** 환경변수에서 암호화 키 로드 (32바이트 hex → CryptoKey) */
async function getKey(): Promise<CryptoKey> {
  const hexKey = Deno.env.get('BILLING_ENCRYPTION_KEY');
  if (!hexKey || hexKey.length !== 64) {
    throw new Error('BILLING_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }

  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(hexKey.substring(i * 2, i * 2 + 2), 16);
  }

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** 평문 → 암호문 (base64 인코딩) */
export async function encryptValue(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );

  // iv + ciphertext를 결합하여 base64 인코딩
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/** 암호문 (base64) → 평문 */
export async function decryptValue(encrypted: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * billing_key가 암호화되었는지 판별
 * 평문 billingKey는 'bill_' 접두사 (Toss 형식)
 * 암호화된 값은 base64 형식
 */
export function isEncrypted(value: string | null): boolean {
  if (!value) return false;
  return !value.startsWith('bill_');
}
