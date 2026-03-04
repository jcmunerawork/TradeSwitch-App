/**
 * Models for request/response body encryption (AES-256-GCM) with the backend.
 */

/** Encrypted envelope sent/received by the backend when body encryption is used. */
export interface EncryptedEnvelope {
  keyId: string;
  iv: string;
  ciphertext: string;
  tag?: string;
}

/** Response from the session key endpoint (handshake). */
export interface SessionKeyResponse {
  keyId: string;
  key: string;
  expiresIn: number;
}
