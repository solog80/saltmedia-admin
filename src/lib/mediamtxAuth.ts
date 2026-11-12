import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { firebaseAdmin } from './firebaseAdmin';

export const MEDIAMTX_USERS_COLLECTION = 'mediamtx_users';
export const MEDIAMTX_MAX_VIEWERS = 10;

const SCRYPT_KEYLEN = 64;
const PREVIEW_TOKEN_LABEL = 'mediamtx-whep-preview';

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function previewToken(): string {
  const secret = process.env.SERVICE_ROLE_KEY || '';
  return createHmac('sha256', secret).update(PREVIEW_TOKEN_LABEL).digest('hex');
}

export function isPreviewToken(token: string | undefined): boolean {
  const expected = previewToken();
  if (!token || !expected) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function findMediaMtxUser(username: string) {
  const snap = await firebaseAdmin
    .firestore()
    .collection(MEDIAMTX_USERS_COLLECTION)
    .where('username', '==', username)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}
