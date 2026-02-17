/**
 * Auth feature: link token model.
 *
 * Represents a link token associating an id with a user (e.g. for TradeLocker linking).
 * Used in signup flow when building token objects. Note: not exported; use from
 * tokens-operations.service or cast where needed.
 */
export interface LinkToken {
  id: string;
  userId: string;
}