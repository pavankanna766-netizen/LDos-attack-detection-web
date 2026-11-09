# Firestore Security Specification — LDoS Attack Detector

## 1. Data Invariants
1. **Strict Ownership (`ownerId`)**: Every document in `/experiments/{experimentId}` must belong to the authenticated, email-verified user (`ownerId == request.auth.uid` and `request.auth.token.email_verified == true`).
2. **Schema & Volumetric Bounds (`isValidExperiment`)**: Every create and update operation must pass `isValidExperiment(incoming())` enforcing exact allowed keys (`hasAll` and `hasOnly`), string length bounds (`maxLength` matching `firebase-blueprint.json`), enum membership for `transform`, `featureSet`, `model`, `splitStrategy`, `overallVerdict`, and numeric range bounds (`[0, 1]` for rate metrics, non-negative counts for window statistics).
3. **Temporal Integrity**: `createdAt` must equal `request.time` on creation and is immutable on update.
4. **Query Enforcer**: `allow list` on `/experiments/{experimentId}` strictly requires `resource.data.ownerId == request.auth.uid` so no user can list another user's experiments.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: Creating an experiment with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Creating an experiment where `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing**: Creating an experiment where `ownerId != request.auth.uid` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection**: Including an undeclared field `isAdmin: true` on create or update -> `PERMISSION_DENIED`.
5. **Path ID Poisoning**: Creating or reading `/experiments/{experimentId}` where `experimentId` exceeds 128 chars or contains invalid characters -> `PERMISSION_DENIED`.
6. **Client Timestamp Forgery**: Creating an experiment where `createdAt != request.time` -> `PERMISSION_DENIED`.
7. **Immutable Field Mutation**: Updating `ownerId`, `jobId`, `accuracy`, or `createdAt` on an existing experiment -> `PERMISSION_DENIED`.
8. **Invalid Enum Value**: Setting `transform: "FFT_FAKE"` or `model: "neural_net"` -> `PERMISSION_DENIED`.
9. **Metric Out of Bounds**: Setting `accuracy: 1.5` or `fpr: -0.2` -> `PERMISSION_DENIED`.
10. **Oversized String**: Setting `experimentName` to a 500-character string (`> 120`) -> `PERMISSION_DENIED`.
11. **Cross-Tenant Read (`get`)**: Reading `/experiments/{experimentId}` owned by another UID -> `PERMISSION_DENIED`.
12. **Blanket List Scraping (`list`)**: Querying `/experiments` without filtering `ownerId == request.auth.uid` -> `PERMISSION_DENIED`.
