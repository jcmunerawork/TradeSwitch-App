/**
 * AES-256-GCM encryption helpers using the Web Crypto API.
 * Used to encrypt/decrypt request and response bodies when talking to the backend.
 * Also includes RSA-OAEP helpers for public-key encryption of temporary session keys.
 */

import type { EncryptedEnvelope } from '../models/encryption.model';

const AES_ALGORITHM = 'AES-GCM';
const RSA_ALGORITHM = 'RSA-OAEP';
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
  return crypto.subtle.importKey('raw', raw, { name: AES_ALGORITHM }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Genera una clave AES-256-GCM aleatoria.
 * @returns [CryptoKey, base64] - La clave como objeto para cifrar y su versión string para persistir/enviar.
 */
export async function generateTempAesKey(): Promise<{ key: CryptoKey; base64: string }> {
  const key = await crypto.subtle.generateKey(
    { name: AES_ALGORITHM, length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  return { key, base64: arrayBufferToBase64(exported) };
}

/**
 * Importa una clave pública RSA desde una cadena PEM.
 */
async function importRsaPublicKey(pem: string): Promise<CryptoKey> {
  // Limpiar el formato PEM para obtener solo el base64
  const pemHeader = '-----BEGIN PUBLIC KEY-----';
  const pemFooter = '-----END PUBLIC KEY-----';
  const pemContents = pem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  const binaryDer = base64ToArrayBuffer(pemContents);

  return crypto.subtle.importKey(
    'spki',
    binaryDer,
    {
      name: RSA_ALGORITHM,
      hash: 'SHA-256',
    },
    false,
    ['encrypt']
  );
}

/**
 * Cifra la clave AES (en base64) usando la clave pública RSA del servidor.
 * Devuelve el resultado en base64 para enviarlo en el header X-Temp-Key.
 */
export async function encryptKeyWithRsa(
  aesKeyBase64: string,
  rsaPublicKeyPem: string
): Promise<string> {
  const publicKey = await importRsaPublicKey(rsaPublicKeyPem);
  const data = new TextEncoder().encode(aesKeyBase64);
  const encrypted = await crypto.subtle.encrypt(
    { name: RSA_ALGORITHM },
    publicKey,
    data
  );
  return arrayBufferToBase64(encrypted);
}

/**
 * Encrypts an object to send as the request body.
 * Returns the envelope ready for JSON.stringify and to send in the body.
 */
export async function encryptRequestBody(
  body: unknown,
  sessionKeyBase64OrKey: string | CryptoKey,
  keyId: string,
): Promise<EncryptedEnvelope> {
  const key = typeof sessionKeyBase64OrKey === 'string' 
    ? await importAesKey(sessionKeyBase64OrKey)
    : sessionKeyBase64OrKey;
  
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = new TextEncoder().encode(JSON.stringify(body));

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    key,
    plaintext,
  );

  // WebCrypto returns ciphertext || tag
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
 * Decrypts the backend response (envelope with iv, ciphertext, tag).
 */
export async function decryptResponseBody(
  envelope: EncryptedEnvelope,
  sessionKeyBase64OrKey: string | CryptoKey,
): Promise<unknown> {
  const key = typeof sessionKeyBase64OrKey === 'string'
    ? await importAesKey(sessionKeyBase64OrKey)
    : sessionKeyBase64OrKey;
    
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
    { name: AES_ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    key,
    combined,
  );

  const json = new TextDecoder().decode(decrypted);
  const parsed = JSON.parse(json);
  return parsed;
}

/**
 * Checks whether a value looks like an EncryptedEnvelope (encrypted response from the backend).
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
