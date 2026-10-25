# WP-13: Dependency Supply-Chain Security Audit

**Work Package:** WP-13 ("Close Application and Supply-Chain Risks", Handover Pages 30–31)  
**Baseline Commit:** `d4605327b523a11d362afc45620dd759c601a5bf`  
**Execution Date:** 2026-10-25  
**Harness Tests:** `server/src/__tests__/unit/application-and-supply-chain.test.ts`

---

## 1. Supply-Chain Vulnerability Remediations

An initial production audit (`npm audit --omit=dev`) revealed 4 vulnerabilities (1 critical, 2 high, 1 moderate) in transitive dependencies. All were remediated via non-breaking semver patch updates:

| Package | Original Version | Fixed Version | Severity | Advisory ID & Description |
| :--- | :--- | :--- | :--- | :--- |
| **proxy-addr** | `2.0.7` | `2.0.8` | **Critical** | GHSA-jqcg-44mw-7w3h: IP spoofing via IPv4-mapped IPv6 trust subnet |
| **body-parser** | `2.3.0` | `2.4.0` | **High** | GHSA-27r3-jxmh-p828: DoS via trailing bytes after compressed request body |
| **zod** | `4.5.4` | `4.6.7` | **High** | GHSA-mrhx-c7xc-m3w5: Memory exhaustion while validating oversized collections |
| **ip-address** | `10.7.0` | `10.7.5` | **Moderate** | GHSA-j6r3-76f7-8jcv: Subnet check address family confusion |

---

## 2. Post-Remediation Verification

Following the remediation pass:
```bash
npm audit --omit=dev
# Output:
# found 0 vulnerabilities
```
Production runtime dependencies contain **0 vulnerabilities**.

---

## 3. Supply-Chain Governance Invariants

1. **Lockfile Integrity:** `server/package-lock.json` and `client/package-lock.json` lock exact package hashes (`integrity` sha512).
2. **Deterministic CI Installation:** All build workflows use `npm ci` rather than `npm install` to enforce exact lockfile matches.
3. **No Script Injection:** Untrusted postinstall scripts are blocked via npm configuration.
