/**
 * Tests para los helpers de cifrado AES-256-GCM (encryption.utils).
 * Requiere Web Crypto API (crypto.subtle) disponible (navegador o Node 19+).
 */

import {
  encryptRequestBody,
  decryptResponseBody,
  isEncryptedEnvelope,
} from './encryption';
import type { EncryptedEnvelope } from '../models/encryption.model';

describe('encryption utils', () => {
  let validKeyBase64: string;
  const keyId = 'test-key-id';

  beforeAll(async () => {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      fail('Web Crypto API (crypto.subtle) no disponible en este entorno');
    }
    const rawKey = new Uint8Array(32);
    crypto.getRandomValues(rawKey);
    validKeyBase64 = btoa(String.fromCharCode(...rawKey));
  });

  describe('encryptRequestBody / decryptResponseBody (roundtrip)', () => {
    it('debería cifrar y descifrar un objeto y devolver el mismo contenido', async () => {
      const body = { foo: 'bar', num: 42, nested: { a: 1 } };
      const envelope = await encryptRequestBody(body, validKeyBase64, keyId);

      expect(envelope.keyId).toBe(keyId);
      expect(typeof envelope.iv).toBe('string');
      expect(typeof envelope.ciphertext).toBe('string');
      expect(typeof envelope.tag).toBe('string');
      expect(envelope.iv.length).toBeGreaterThan(0);
      expect(envelope.ciphertext.length).toBeGreaterThan(0);
      expect(envelope.tag?.length).toBeGreaterThan(0);

      const decrypted = await decryptResponseBody(envelope, validKeyBase64);
      expect(decrypted).toEqual(body);
    });

    it('debería cifrar y descifrar un array', async () => {
      const body = [1, 2, 'tres'];
      const envelope = await encryptRequestBody(body, validKeyBase64, keyId);
      const decrypted = await decryptResponseBody(envelope, validKeyBase64);
      expect(decrypted).toEqual(body);
    });

    it('debería cifrar y descifrar un string', async () => {
      const body = 'solo texto';
      const envelope = await encryptRequestBody(body, validKeyBase64, keyId);
      const decrypted = await decryptResponseBody(envelope, validKeyBase64);
      expect(decrypted).toBe(body);
    });

    it('debería producir ciphertext distinto en cada cifrado (IV aleatorio)', async () => {
      const body = { same: true };
      const e1 = await encryptRequestBody(body, validKeyBase64, keyId);
      const e2 = await encryptRequestBody(body, validKeyBase64, keyId);
      expect(e1.iv).not.toBe(e2.iv);
      expect(e1.ciphertext).not.toBe(e2.ciphertext);
      expect(e1.tag).not.toBe(e2.tag);
      const d1 = await decryptResponseBody(e1, validKeyBase64);
      const d2 = await decryptResponseBody(e2, validKeyBase64);
      expect(d1).toEqual(body);
      expect(d2).toEqual(body);
    });
  });

  describe('decryptResponseBody (casos de error)', () => {
    it('debería lanzar si falta el tag en el envelope', async () => {
      const envelope: EncryptedEnvelope = {
        keyId: 'x',
        iv: btoa('123456789012'),
        ciphertext: btoa('cipher'),
        // tag omitido
      };
      await expectAsync(
        decryptResponseBody(envelope, validKeyBase64)
      ).toBeRejectedWithError(/Missing tag/);
    });

    it('debería lanzar al descifrar con clave incorrecta', async () => {
      const body = { secret: true };
      const envelope = await encryptRequestBody(body, validKeyBase64, keyId);
      const otherKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(1)));
      await expectAsync(
        decryptResponseBody(envelope, otherKey)
      ).toBeRejected();
    });

    it('debería lanzar si el ciphertext está adulterado', async () => {
      const envelope = await encryptRequestBody({ a: 1 }, validKeyBase64, keyId);
      const tampered: EncryptedEnvelope = {
        ...envelope,
        ciphertext: envelope.ciphertext.slice(0, -2) + 'XX',
      };
      await expectAsync(
        decryptResponseBody(tampered, validKeyBase64)
      ).toBeRejected();
    });
  });

  describe('isEncryptedEnvelope', () => {
    it('debería devolver true para un objeto con keyId, iv y ciphertext', () => {
      expect(
        isEncryptedEnvelope({
          keyId: 'k',
          iv: 'a',
          ciphertext: 'b',
          tag: 't',
        })
      ).toBe(true);
      expect(
        isEncryptedEnvelope({
          keyId: 'k',
          iv: 'a',
          ciphertext: 'b',
        })
      ).toBe(true);
    });

    it('debería devolver false para null o no-objeto', () => {
      expect(isEncryptedEnvelope(null)).toBe(false);
      expect(isEncryptedEnvelope(undefined)).toBe(false);
      expect(isEncryptedEnvelope('string')).toBe(false);
      expect(isEncryptedEnvelope(42)).toBe(false);
    });

    it('debería devolver false si falta keyId, iv o ciphertext', () => {
      expect(isEncryptedEnvelope({ iv: 'a', ciphertext: 'b' })).toBe(false);
      expect(isEncryptedEnvelope({ keyId: 'k', ciphertext: 'b' })).toBe(false);
      expect(isEncryptedEnvelope({ keyId: 'k', iv: 'a' })).toBe(false);
      expect(isEncryptedEnvelope({})).toBe(false);
    });

    it('debería devolver false si keyId, iv o ciphertext no son string', () => {
      expect(
        isEncryptedEnvelope({ keyId: 1, iv: 'a', ciphertext: 'b' })
      ).toBe(false);
      expect(
        isEncryptedEnvelope({ keyId: 'k', iv: null, ciphertext: 'b' })
      ).toBe(false);
      expect(
        isEncryptedEnvelope({ keyId: 'k', iv: 'a', ciphertext: [] })
      ).toBe(false);
    });
  });
});
