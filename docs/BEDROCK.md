# Amazon Bedrock setup

RuraLens uses Amazon Bedrock for two features:

- **AI Copilot**: `POST /api/copilot/chat` (3D twin panel) and `POST /api/rag-query` (the "Ask a question" dialog). A [Strands Agents](https://strandsagents.com/) agent answers through a fixed set of typed, read-only tools: scheme search, scheme details, vendor findings, twin assets, dependencies, GNN predictions, and proposals for simulations the user must confirm.
- **Vendor report comparison**: `POST /api/schemes/:id/vendor-report` and `.../reanalyze`. Budget, date and quantity checks are calculated in code. Bedrock is asked only for an interpretive comparison of relevant excerpts, and its findings are checked against the document text before they are stored.

Bedrock is called **only from the backend**, using the AWS SDK for JavaScript v3 (`@aws-sdk/client-bedrock-runtime`) and the Converse API. The browser never receives AWS credentials and never calls Bedrock.

If Bedrock is not configured, the backend still starts. The Copilot reports `not_configured`, the twin panel falls back to its in-browser keyword interpreter and says so, and vendor reports get only the calculated checks plus a notice.

## 1. Choose a Region and model

1. In the [Amazon Bedrock console](https://console.aws.amazon.com/bedrock/), choose a Region and open the **Model catalog**.
2. Pick a model that supports the **Converse API with tool use and a forced tool choice**. The vendor comparison forces a specific tool to get schema-checked output. According to the [ToolChoice API reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ToolChoice.html), only **Anthropic Claude (3 and later)** and **Amazon Nova** models support that. With other models the comparison fails with an `invalid_request` error rather than producing unchecked output.
3. Use the exact **model ID** or **inference profile ID** shown in the console as `BEDROCK_MODEL_ID`. Many newer models can be invoked only through a cross-Region inference profile, whose ID has a prefix such as `us.` or `global.`.

### Model access

Per [Access Amazon Bedrock foundation models](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html):

- Many models are enabled automatically the first time they are invoked. This needs the `aws-marketplace:Subscribe`, `aws-marketplace:Unsubscribe` and `aws-marketplace:ViewSubscriptions` permissions and a valid payment method on the account.
- **Anthropic models** require a one-time use-case form per account (or organization). Open an Anthropic model in the console and choose **Submit use case details**. Until access is granted, calls return `AccessDeniedException`, which RuraLens reports as `access_denied`.
- An administrator can enable the model once. After that, the RuraLens identity only needs the invoke permission below and no Marketplace permissions.

## 2. IAM policy (least privilege)

The backend calls `Converse` without streaming, which requires only [`bedrock:InvokeModel`](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html).

For a model invoked directly by model ID:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:REGION::foundation-model/MODEL_ID"
    }
  ]
}
```

For a cross-Region inference profile, allow the profile **and** the foundation model in every Region the profile can route to. See [Prerequisites for inference profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-prereq.html).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:REGION:ACCOUNT_ID:inference-profile/PROFILE_ID"
    },
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:*::foundation-model/MODEL_ID",
      "Condition": {
        "StringLike": {
          "bedrock:InferenceProfileArn": "arn:aws:bedrock:REGION:ACCOUNT_ID:inference-profile/PROFILE_ID"
        }
      }
    }
  ]
}
```

Replace the placeholders with your values. Do not attach `AmazonBedrockFullAccess` to the identity used by the backend.

## 3. Credentials

The backend never reads AWS keys itself. The AWS SDK resolves credentials through its [default credential provider chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html): environment variables, shared `~/.aws` config and credentials files (`AWS_PROFILE`), IAM Identity Center (SSO), web identity, and container or instance roles.

### Local development

Prefer a named profile or SSO session over static keys:

```bash
aws configure sso            # or: aws configure --profile ruralens-dev
aws sso login --profile ruralens-dev
```

`backend/.env` (git-ignored):

```bash
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=<model or inference profile ID from the console>
AWS_PROFILE=ruralens-dev
```

### Render

Render services have no AWS role attached, so an IAM role is **not** available automatically. Create a dedicated IAM user with only the policy above, create an access key for it, and set these on the `ruralens-backend` service in the Render dashboard. They are declared with `sync: false` in `render.yaml`, so values never live in the repository.

| Variable | Value |
| --- | --- |
| `AWS_REGION` | Region where model access is enabled |
| `BEDROCK_MODEL_ID` | Model ID or inference profile ID |
| `AWS_ACCESS_KEY_ID` | Access key of the dedicated IAM user |
| `AWS_SECRET_ACCESS_KEY` | Secret of that access key |
| `NODE_VERSION` | `22` (already set in `render.yaml`; required by the Strands SDK) |

### Alternative: Amazon Bedrock API key

Instead of an access key pair, you can use an [Amazon Bedrock API key](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html). Set it as `AWS_BEARER_TOKEN_BEDROCK` (locally in `backend/.env`, on Render in the dashboard). Whenever that variable is present, the AWS SDK for JavaScript sends it as a bearer token to Bedrock Runtime instead of signing with access keys, so the Converse and Strands code works unchanged. Notes:

- Do not add the variable with an empty value. The SDK switches to bearer auth when it merely exists, and the backend reports this as a configuration error.
- API keys work only for Bedrock calls and expire on the date chosen when they were created. Note the expiry and replace the key before then.

### Alternative: the OpenAI-compatible endpoint (`BEDROCK_API=openai`)

Bedrock also serves models through an [OpenAI-compatible Chat Completions endpoint](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-openai.html) (`https://bedrock-mantle.<region>.api.aws/v1`). This is the setup the console shows next to a new API key (`OPENAI_API_KEY`, `OPENAI_BASE_URL`). Use it when Bedrock Runtime is not available to your account, for example when every Converse call returns `account_restricted` but the console playground works.

```bash
AWS_REGION=us-east-1
BEDROCK_API=openai
BEDROCK_MODEL_ID=openai.gpt-oss-120b
AWS_BEARER_TOKEN_BEDROCK=<Bedrock API key>
# Optional; defaults to https://bedrock-mantle.<AWS_REGION>.api.aws/v1
# BEDROCK_OPENAI_BASE_URL=
```

- Authentication is only the API key; IAM access keys are not used in this mode.
- The model must be served on that endpoint through Chat Completions with function calling. `openai.gpt-oss-120b` was verified to return forced tool calls. Anthropic Claude models are listed there but reject Chat Completions, which RuraLens reports as `invalid_request`. List what your key can use with `GET /v1/models` on the endpoint.
- Some model lines (for example `openai.gpt-5.*`) are served under `/openai/v1` instead of `/v1`; set `BEDROCK_OPENAI_BASE_URL` for those. The backend accepts only `bedrock-mantle` or `bedrock-runtime` hosts on `api.aws` or `amazonaws.com`, so a misconfigured URL cannot send the key elsewhere.
- The Copilot uses the Strands `OpenAIModel` (Chat Completions); vendor comparison uses a forced function call. The validation, evidence checks and error codes are the same as with Converse.

Never put AWS values in `VITE_` variables. Those are compiled into the public JavaScript bundle.

### Credential rotation

1. In IAM, create a second access key for the RuraLens user (an IAM user can have two).
2. Update `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in Render and redeploy.
3. Confirm the Copilot works and the startup log shows `[bedrock] Enabled`.
4. Deactivate the old key, wait, then delete it.

Rotate immediately if a key may have been exposed, for example committed to git, pasted in a ticket, or printed in logs.

## 4. Optional tuning

| Variable | Default | Range | Purpose |
| --- | --- | --- | --- |
| `BEDROCK_MAX_TOKENS` | 2048 | 256–8192 | Output token cap per model call |
| `BEDROCK_TIMEOUT_MS` | 30000 | 2000–120000 | Per-request timeout. A Copilot turn, which may make several model calls, is cancelled after 3× this value. |
| `BEDROCK_MAX_ATTEMPTS` | 3 | 1–5 | AWS SDK attempts per call (standard retry mode with backoff for throttling, 5xx and timeouts) |
| `BEDROCK_TEMPERATURE` | 0.2 | 0–1 | Sampling temperature |
| `PDF_MAX_PAGES` | 60 | — | Pages read from each uploaded PDF |

Invalid values are reported at startup and the default is used.

## 5. Cost and rate limits

Bedrock charges per input and output token. See [Amazon Bedrock pricing](https://aws.amazon.com/bedrock/pricing/). Bedrock calls per action:

- **Copilot question:** one model call per agent step. A question can use up to 8 tool calls, so it can take several model calls. Answers to `/api/rag-query` are cached for `RAG_CACHE_TTL_SECONDS` (default 120) per question and role.
- **Vendor report upload or re-analysis:** one model call, plus at most one retry if the output fails schema validation. Re-uploading the same PDF does not call Bedrock again.
- **AWS SDK retries** (up to `BEDROCK_MAX_ATTEMPTS`) can repeat a call that was throttled or failed.

Built-in limits: 10 Copilot questions per minute per user on each endpoint, 20 messages of up to 2,000 characters per conversation, 15 AI findings per report, and selected excerpts rather than whole documents sent for comparison.

Account-level limits are Bedrock **Service Quotas** (requests and tokens per minute, per model and Region). Throttling surfaces as `throttled`. Request a quota increase in the Service Quotas console if needed. To cap spend, set an [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html) alert on the account.

## 6. Privacy and logging

- Questions pass through the PII sanitizer (email, phone, Aadhaar and PAN) before they reach Bedrock.
- The backend logs error codes, model IDs and timings. It does not log credentials, prompts, document text, or model output.
- Vendor and plan PDFs stay in MongoDB (GridFS). Only selected excerpts are sent to Bedrock.

## 7. Troubleshooting

At startup the backend logs one of the following:

- `[bedrock] Enabled: model … in …` and the credential *sources* it found. Names only, never values.
- `[bedrock] AI Copilot and AI vendor-report comparison are disabled:` and the configuration problems.

`GET /api/copilot/status` returns the same status. Administrators also see the configuration problems.

| Error code | Meaning | Fix |
| --- | --- | --- |
| `not_configured` | `AWS_REGION` or `BEDROCK_MODEL_ID` is missing or invalid | Set both and restart |
| `credentials_unavailable` | The SDK found no credentials | Set `AWS_PROFILE` (local) or the access key variables (Render) |
| `access_denied` | The identity lacks `bedrock:InvokeModel` on this model or profile, or model access is not granted | Check the IAM policy (including foundation-model ARNs for inference profiles) and model access |
| `model_not_found` | The model ID is wrong or not offered in this Region | Copy the ID from the console for the same Region, or use an inference profile ID |
| `account_restricted` | Bedrock returned "Operation not allowed": the AWS account itself is not yet allowed to invoke models (common on new accounts), whatever the IAM policy says | Confirm a payment method is on file, then open an **Account and billing** case in AWS Support (free on the Basic plan) asking them to enable Bedrock model invocation. See [Resolve InvokeModel API errors](https://repost.aws/knowledge-center/bedrock-invokemodel-api-error). Meanwhile, the OpenAI-compatible endpoint (`BEDROCK_API=openai`) may still work |
| `invalid_request` | Bedrock rejected the request, for example because the model does not support a forced tool choice | Use a Claude or Nova model |
| `throttled` | Account quota reached | Wait and retry; request a quota increase |
| `timeout` / `unavailable` | Bedrock did not respond in time or had a service error | Retry; raise `BEDROCK_TIMEOUT_MS` if it persists |
| `malformed_output` | The model's output did not match the expected schema after a retry | Retry; consider a more capable model |
| `input_too_large` | The prompt exceeded the model's context | Lower `PDF_MAX_PAGES` or use a model with a larger context |

When the AI step of a vendor comparison fails, the report is still saved with the calculated findings and the error, and an administrator can select **Re-run analysis** later. Earlier AI findings are kept with their original timestamps. They are never presented as new.

## 8. Verifying a deployment

Before starting the app, run `cd backend && npm run check:bedrock`. It sends one small request (a few hundred tokens) to the configured model and prints either the model's reply or the error code from the troubleshooting table. It never prints credentials.

1. Sign in, open **Map**, then the **Ask** tab. The footer should name the model.
2. Ask "Which assets depend on the main pump?" The answer should list its sources.
3. Upload a text-based vendor report PDF on a scheme. The findings should show "Calculated check" and "AI interpretation" labels, with quotes and page numbers.

The automated tests (`cd backend && npm test`) mock Bedrock and make no paid calls.
