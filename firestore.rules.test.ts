/**
 * Security Rules Verification Suite — Dirty Dozen Payloads
 * Verifies that all 12 adversarial payloads in security_spec.md are rejected by firestore.rules.
 */

export interface SecurityTestVector {
  id: number;
  name: string;
  authUid: string | null;
  emailVerified: boolean;
  docId: string;
  payload: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const DIRTY_DOZEN_TEST_VECTORS: SecurityTestVector[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    authUid: null,
    emailVerified: false,
    docId: 'exp_valid_1',
    payload: { ownerId: 'user_1', experimentName: 'Exp 1' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    authUid: 'user_1',
    emailVerified: false,
    docId: 'exp_valid_1',
    payload: { ownerId: 'user_1', experimentName: 'Exp 1' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing (ownerId mismatch)',
    authUid: 'user_1',
    emailVerified: true,
    docId: 'exp_valid_1',
    payload: { ownerId: 'victim_uid', experimentName: 'Exp 1' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection',
    authUid: 'user_1',
    emailVerified: true,
    docId: 'exp_valid_1',
    payload: { ownerId: 'user_1', experimentName: 'Exp 1', isAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Path ID Poisoning',
    authUid: 'user_1',
    emailVerified: true,
    docId: 'invalid/id$with*special!chars',
    payload: { ownerId: 'user_1', experimentName: 'Exp 1' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Client Timestamp Forgery',
    authUid: 'user_1',
    emailVerified: true,
    docId: 'exp_valid_1',
    payload: { ownerId: 'user_1', createdAt: '1999-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Immutable Field Mutation on Update',
    authUid: 'user_1',
    emailVerified: true,
    docId: 'exp_valid_1',
    payload: { ownerId: 'user_2', accuracy: 1.0 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Invalid Enum Value for Transform',
    authUid: 'user_1',
    emailVerified: true,
    docId: 'exp_valid_1',
    payload: { ownerId: 'user_1', transform: 'INVALID_TRANSFORM' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Metric Probability Out of Bounds (> 1.0)',
    authUid: 'user_1',
    emailVerified: true,
    docId: 'exp_valid_1',
    payload: { ownerId: 'user_1', accuracy: 1.45, fpr: -0.1 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Oversized String Field (> 120 chars)',
    authUid: 'user_1',
    emailVerified: true,
    docId: 'exp_valid_1',
    payload: { ownerId: 'user_1', experimentName: 'A'.repeat(250) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Cross-Tenant Read (get on another user doc)',
    authUid: 'attacker_uid',
    emailVerified: true,
    docId: 'exp_owned_by_user_1',
    payload: {},
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket List Scraping Without ownerId Filter',
    authUid: 'attacker_uid',
    emailVerified: true,
    docId: '*',
    payload: {},
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
