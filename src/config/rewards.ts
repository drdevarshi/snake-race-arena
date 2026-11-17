/**
 * Default Snake Coin reward amounts. Shown on the landing page only.
 * From Phase 6 the authoritative values live in the database (admin-editable)
 * and are read server-side when coins are awarded.
 */
export const DEFAULT_REWARDS = {
  completion: 10,
  first: 150,
  second: 100,
  third: 50,
} as const;
