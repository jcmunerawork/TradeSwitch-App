# Encryption in TradeSwitch App

This document describes how request/response encryption works when communicating with the backend API.

## Overview

The app uses **AES-256-GCM** (via the Web Crypto API) to encrypt HTTP request bodies and decrypt response bodies for API calls that go to the configured backend. A session key is obtained from the backend and used for symmetric encryption.

## Components

### 1. Session key (handshake)

- **Endpoint**: `POST /v1/crypto/session-key`
- **Service**: `CryptoSessionService` (`core/services/crypto-session.service.ts`)
- The client requests a session key from the backend (body can be empty). The backend returns:
  - `keyId`: identifier for the key
  - `key`: base64-encoded AES key
  - `expiresIn`: lifetime in seconds
- The key is cached in memory and in `sessionStorage` (key: `ts_crypto_key`). It is renewed about 1 minute before expiry.
- The key is cleared on logout or when the backend indicates it is invalid (e.g. "Invalid or expired session key").

### 2. HTTP interceptor

- **Class**: `CryptoInterceptor` (`core/interceptors/crypto.interceptor.ts`)
- **Scope**: Only requests whose URL starts with the configured API base URL; excluded paths (see below) are not encrypted.

**Outgoing request:**

1. Get the current session key (from cache or by calling `/v1/crypto/session-key`).
2. Add header: `X-Session-Key-Id: <keyId>`.
3. For `POST`, `PUT`, or `PATCH` with a non-null JSON-like body that is **not** already an encrypted envelope:
   - Encrypt the body with the session key (AES-GCM).
   - Replace the body with an **encrypted envelope** (see below).
4. Send the request.

**Incoming response:**

1. If the response body is an encrypted envelope (`keyId`, `iv`, `ciphertext`), decrypt it with the stored session key and replace the body with the decrypted payload.
2. Otherwise leave the response unchanged.

**Excluded paths (no encryption):**

- `crypto/session-key` — session key exchange is in clear.
- `payments/webhook` — webhook payloads are not encrypted by this flow.

**Retry on invalid session key:**

- If the backend returns HTTP 400 with a message indicating the session key is invalid or expired, the interceptor clears the cached key, fetches a new session key, and retries the request once with header `X-Crypto-Retry: 1` to avoid infinite retry loops.

### 3. Encryption utilities

- **File**: `core/utils/encryption.ts`
- **Algorithm**: AES-GCM, 12-byte IV, 16-byte authentication tag.

**Functions:**

- **`encryptRequestBody(body, sessionKeyBase64, keyId)`**  
  Encrypts a plain object for the request body. Returns an `EncryptedEnvelope`: `{ keyId, iv, ciphertext, tag }` (all base64). The envelope is sent as the HTTP body.

- **`decryptResponseBody(envelope, sessionKeyBase64)`**  
  Decrypts an `EncryptedEnvelope` from the response and returns the parsed JSON payload.

- **`isEncryptedEnvelope(value)`**  
  Type guard: returns true if `value` looks like an encrypted envelope (has `keyId`, `iv`, `ciphertext` strings).

### 4. Models

- **File**: `core/models/encryption.model.ts`
- **`EncryptedEnvelope`**: `keyId`, `iv`, `ciphertext`, optional `tag` (all strings, base64).
- **`SessionKeyResponse`**: `keyId`, `key`, `expiresIn` (from the session-key endpoint).

## Flow summary

1. Before the first encrypted API call, the app gets a session key from `POST /v1/crypto/session-key` (or uses the cached one if still valid).
2. For each request to the API (except excluded paths):
   - Session key ID is sent in `X-Session-Key-Id`.
   - Request bodies (POST/PUT/PATCH) are replaced by an encrypted envelope.
3. Responses whose body is an encrypted envelope are decrypted and the decrypted JSON is exposed to the rest of the app.
4. When the backend signals an invalid/expired session key, the key is cleared and the request is retried once with a new key.

## Security notes

- The session key is only used for request/response encryption between the app and your backend; it is not used for user authentication (handled separately, e.g. via tokens).
- The session key endpoint and webhook path are intentionally left unencrypted by this mechanism.
- Keys are stored in memory and in `sessionStorage`; they are cleared on logout or when the backend invalidates them.
