# Security Specification: Insta Mocks Firestore Security

## 1. Data Invariants
- **Quiz Ownership**: A quiz can be created by any authenticated and email-verified user. Its `userId` field must match `request.auth.uid`. Quizzes can only be read by the owner who created them (to ensure privacy of their personal materials) or updated by the owner. Quizzes are immutable in terms of `userId` and `createdAt`.
- **Performance Integrity**: Performance records can only be created by authenticated and email-verified users. The `userId` must match `request.auth.uid`. They are read-restricted exclusively to the owning user. Performance records are immutable after creation (preventing a user or attacker from tampering with historic scores).

## 2. The "Dirty Dozen" Malicious Payloads (Forbidden Actions)
1. **Quiz Identity Spoofing**: Attempt to create a quiz with `userId` of another user (`auth.uid` is `user_A` but `userId` is `user_B`).
2. **Quiz Anonymous Creation**: Attempt to create a quiz without being authenticated.
3. **Quiz Unverified Email Creation**: Attempt to create a quiz with `email_verified` as `false` when it is mandated to be `true`.
4. **Quiz Ghost Field (Shadow Update)**: Attempt to update/create a quiz with extra undeclared fields (e.g. `isAdmin: true` or `flagged: true`) to bypass key-size integrity.
5. **Quiz Temporal Spoofing**: Attempt to set `createdAt` to a client-specified future or past timestamp instead of `request.time`.
6. **Quiz Path Poisoning**: Attempt to target a Quiz with a document ID that is 2KB in size or contains wild character injection (`../` or similar).
7. **Performance Score Tampering**: Attempt to update an existing performance document to artificially increase the score from 2 to 10.
8. **Performance Cross-Read**: Authenticated `user_A` attempts to fetch a list of `user_B`'s performance scores.
9. **Performance Relational Orphan**: Attempt to create a performance record referencing a `quizId` which doesn't exist.
10. **Performance Negative Score**: Attempt to log a performance score of `-5` or `999` on a 5-question quiz.
11. **Performance Mode Bypass**: Attempt to create a performance with an unlisted mode like `cheat_mode` (only `practice` or `exam` are allowed).
12. **Blanket Query List Attack**: Retreiving all performances in a single collection list query without specifying the security query filter (`where('userId', '==', uid)`).

## 3. Rules Implementation Strategy
We will construct standard functions including:
- `isSignedIn()`
- `isEmailVerified()`
- `isValidId(id)`
- `isValidQuiz(quiz)`
- `isValidPerformance(perf)`
- `isOwner(userId)`
- Default catch-all `allow read, write: if false;`
