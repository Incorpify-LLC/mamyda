# LLM writing assistance

## Configuration and use

Settings → LLM configures a personal provider, exact API model ID, key and output
limit. Supported providers are xAI, OpenAI and OpenRouter. Choose a text/chat-capable
API model, not a chat website subscription or login. A fast, economical text model
is appropriate for routine spelling/grammar; choose a stronger model for complex
rewrites. Models must support their provider's chat-completions endpoint.

Saving stores configuration only. **Test saved model** submits a built-in sample
sentence after consent and security verification; it may use API credits and does
not test unsaved form changes. Provider availability and model permissions are not
assumed from a successful settings save.

Minutes offers **Polish with LLM** and spelling correction. Notes offers both;
task descriptions offer spelling correction. All use the shared editing service.
Every call displays its provider/model, requires explicit consent and Turnstile,
and leaves results as drafts for review and manual Save. Failed/truncated responses
never replace drafts. Server validation rejects a changed consent target. Inputs
are limited to 20,000 characters and output to 256–4096 tokens; five attempts per
user per UTC minute limit repeated calls. These limits are not a spending budget.

## Privacy and credentials

Editing sends only the readable current body (not its JSON metadata wrapper) to the
selected external provider. Its privacy/retention policies and API charges apply.
Encrypted content must first be explicitly unlocked, and external processing is
not Vault-private. Results remain in the editor and retain its encryption selection.
Only explicit requests are sent; no background spelling requests or chat history.

API keys are AES-256-GCM protected in the database, bound to the owner and provider.
The browser receives only whether a key exists. Blank keys preserve same-provider
credentials; switching provider requires its key. Removal disables assistance.
Keys are server-decryptable for API calls, not protected by the user's Vault key.
Back up `LLM_CREDENTIAL_ENCRYPTION_KEY` or its fallback `BETTER_AUTH_SECRET` securely;
changing that material requires re-entering saved provider keys.

Existing `XAI_API_KEY`/optional `XAI_MODEL` provide a server default only when no
personal configuration exists. Explicitly disabling assistance never falls back
to the server default. Provider endpoints are HTTPS allowlisted; custom arbitrary
URLs, redirects, prompt/key logging and automatic retries are not enabled.

## Verification and rollout

Feedback release `llm-settings-feedback-20261008-4` is deployed on pi03 with image
`0eca6b28053c`; Git changes remain unpushed for user review. Typecheck, changed-file
lint, container build and all 108 app tests pass. Candidate health and credential/
Turnstile configuration checks pass without exposing keys or calling paid APIs.
Source/database backups and the prior image (`434a6a8103bc`) are preserved under
`/home/sanjayu/mamyda-rollbacks/llm-settings-feedback-20261008-1728/` and image tag
`mamyda-feedback-rollback:20261008-1728`. Prefer fixing forward; never restore the
database snapshot over newer writes without an approved recovery plan.

Migration `0010_llm_settings.sql` adds settings and request-count windows. Existing
workspace content is unchanged. Tests cover protected credentials, ownership and
provider binding, consent, configuration changes, rate limiting, disabled fallback
and sanitized failures. Local browser testing uses a mocked provider and isolated
database; no real provider keys or paid calls are used. Real model access should
be verified using Test saved model after configuring your own account.

API contracts: [OpenAI](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create),
[xAI](https://docs.x.ai/developers/rest-api-reference/inference/chat-completions),
[OpenRouter](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion).
