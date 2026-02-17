/**
 * Auth feature: authentication service re-export.
 *
 * Kept for backward compatibility. The actual implementation lives in
 * shared/services/auth.service (Firebase Auth, user data, accounts, tokens, etc.).
 * Import AuthService from this path or from shared/services/auth.service.
 */
export { AuthService } from '../../../shared/services/auth.service';
