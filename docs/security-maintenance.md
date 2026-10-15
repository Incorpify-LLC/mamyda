# Dependency and verification maintenance (#22, #23)

## Dependency changes

The original lockfile produced 24 audit findings (one critical, two high). Compatible targeted updates replace AWS S3 SDK 3.700.0 with 3.1152.0, brace-expansion 1.1.18/5.0.9 with 1.1.21/5.0.12, and source-map-js 1.2.1 with 1.2.2. The obsolete SDK/XML-parser/UUID dependency chains are removed. No force upgrade, audit exclusion or weakened audit threshold is used. A clean Node 24 install reports zero known audit findings at verification time; this is not a guarantee against future advisories.

## Portable tests

Versioned `scripts/fixtures/asset-cli.json` replaces references to upstream template skill documents that this repository does not ship. Tests exercise real CLI arguments, marker expiry and atomic binary handovers; no tests are skipped and no AGENTS.md or private skill installation is required. A fixture hook now runs unconditionally, and isolated browser servers use a separate Vite optimizer cache. The Chat expiry assertion waits for the state update rather than racing React.

The full-app browser script follows current Clients/Projects, Notes, alert-preference and Vault labels. It refuses non-loopback targets and non-dummy widget keys. CI uses an in-memory OTP sink and Cloudflare's documented public dummy sitekey with a local browser widget fixture; no genuine challenge is solved or bypassed. Strict action/hostname/expiry validation remains covered by server tests and production security smoke. Neither test mode nor a dummy secret is introduced into production configuration.

## Verification

Node 24: clean install, audit, all 423 tests (200 platform + 32 auth/data + 191 app), type checking, full lint (existing nonfatal warnings) and production build pass. Browser checks cover functional saves, account isolation, Vault locking, mobile layout and the six isolated UI suites.

New real-SDK HTTP tests cover signed path-style binary file/Vault operations and XML AccessDenied handling. A separate disposable MinIO instance on pi06, bound only to loopback and using fake credentials and a temporary directory, verified actual checksum/signing behavior, encrypted binary round trip and NoSuchKey parsing. It did not use production bucket data or credentials. The smoke removes its own newly created bucket and object.

Release marker: `security-maintenance-20261015-22`. Full CI, ARM64 candidate and deployment verification are pending. No migration, encryption-format, key or integration-credential change is required.
