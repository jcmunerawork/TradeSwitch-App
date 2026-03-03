/**
 * Modelos para el cifrado de bodies (AES-256-GCM) con el backend.
 */

/** Sobre cifrado que envía/recibe el backend cuando se usa cifrado de body. */
export interface EncryptedEnvelope {
  keyId: string;
  iv: string;
  ciphertext: string;
  tag?: string;
}

/** Respuesta del endpoint de clave de sesión (handshake). */
export interface SessionKeyResponse {
  keyId: string;
  key: string;
  expiresIn: number;
}
