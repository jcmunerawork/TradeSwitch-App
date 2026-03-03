/**
 * Helpers de cifrado AES-256-GCM con Web Crypto API.
 * Usado para cifrar/descifrar bodies en las peticiones al backend.
 */

import type { EncryptedEnvelope } from '../models/encryption.model';

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

async function importAesKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(base64Key);
  return crypto.subtle.importKey('raw', raw, { name: ALGORITHM }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Cifra un objeto para enviarlo como body.
 * Devuelve el sobre listo para JSON.stringify y enviar en el body.
 */
export async function encryptRequestBody(
  body: unknown,
  sessionKeyBase64: string,
  keyId: string,
): Promise<EncryptedEnvelope> {
  const key = await importAesKey(sessionKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = new TextEncoder().encode(JSON.stringify(body));

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    key,
    plaintext,
  );

  // WebCrypto devuelve ciphertext || tag
  const ciphertext = new Uint8Array(ciphertextBuf);
  const tag = ciphertext.slice(-TAG_LENGTH);
  const ciphertextOnly = ciphertext.slice(0, -TAG_LENGTH);

  return {
    keyId,
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextOnly),
    tag: arrayBufferToBase64(tag),
  };
}

/**
 * Descifra la respuesta del backend (sobre con iv, ciphertext, tag).
 */
export async function decryptResponseBody(
  envelope: EncryptedEnvelope,
  sessionKeyBase64: string,
): Promise<unknown> {
  const key = await importAesKey(sessionKeyBase64);
  const iv = base64ToArrayBuffer(envelope.iv);
  const ciphertext = base64ToArrayBuffer(envelope.ciphertext);
  const tag = envelope.tag ? base64ToArrayBuffer(envelope.tag) : null;

  if (!tag) {
    throw new Error('Missing tag in encrypted response');
  }

  const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
  combined.set(new Uint8Array(ciphertext), 0);
  combined.set(new Uint8Array(tag), ciphertext.byteLength);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    key,
    combined,
  );

  const json = new TextDecoder().decode(decrypted);
  return JSON.parse(json);
}

/**
 * Comprueba si un objeto parece un EncryptedEnvelope (respuesta cifrada del backend).
 */
export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o['keyId'] === 'string' &&
    typeof o['iv'] === 'string' &&
    typeof o['ciphertext'] === 'string'
  );
}
