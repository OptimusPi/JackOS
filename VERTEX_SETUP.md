# Vertex AI Setup Guide

This guide walks you step-by-step through connecting **Google Cloud Vertex AI** to this application so your AI requests (Balatro Seed Card lore, bespoke pixel-art card illustrations, ink gesture interpretation, and wallpapers) run on your Google Cloud project and draw from your Google Cloud billing credits.

> **Good to know first:** You do **not** need to configure Vertex AI just to run or publish the app. If Vertex AI variables are left unset, the server automatically falls back to your linked `GEMINI_API_KEY`.

---

## How Provider Selection Works

The backend (`server.ts`) selects the AI provider in this exact priority order:

| Priority | Mode | Required Variables | Returned `provider` | Best For |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Vertex AI Standard (ADC / Cloud Run)** | `GOOGLE_CLOUD_PROJECT` (+ optional `GOOGLE_CLOUD_LOCATION`) | `vertex-adc` | Cloud Run, GCE, GKE, or local dev with `gcloud auth application-default login` |
| **2** | **Vertex AI Express Mode (API Key)** | `VERTEX_AI_API_KEY` *(leave `GOOGLE_CLOUD_PROJECT` unset)* | `vertex-express` | AI Studio hosted apps, Vercel, or any environment where you want a single API key instead of ADC/service account files |
| **3** | **Gemini API Fallback** | `GEMINI_API_KEY` | `gemini-api` | Zero-config default in AI Studio |

> **Important:** Because Priority 1 (`GOOGLE_CLOUD_PROJECT`) takes precedence over Priority 2 (`VERTEX_AI_API_KEY`), only set `GOOGLE_CLOUD_PROJECT` when the server environment has Google Application Default Credentials (ADC) configured (such as Cloud Run or a local machine logged into `gcloud`). If you are deploying on AI Studio Secrets or a non-GCP host and want API-key auth, use **Option A (Vertex AI Express Mode)** below.

---

## Step 1: Select or Create Your Google Cloud Project & Link Billing

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. In the top project picker bar, select your existing project (for example, `gen-lang-client-0792354516`) or click **New Project** to create one.
3. Confirm your **Google Cloud Credits / Billing Account** is linked to this project:
   - Go to **Billing** (`https://console.cloud.google.com/billing`).
   - Click **Account management** → **Link a billing account** (or verify your project appears under your active billing account that holds your credits).
4. Copy your **Project ID** (found on the Cloud Console Dashboard under *Project info* — e.g. `gen-lang-client-0792354516`).

---

## Step 2: Enable the Vertex AI API

1. Make sure your target project is selected in the top bar of the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services → Library** (or open [Vertex AI API directly](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com)).
3. Search for **Vertex AI API** (`aiplatform.googleapis.com`).
4. Click **Enable** and wait a few seconds for provisioning to finish.

---

## Step 3: Create Credentials (Choose Option A or Option B)

### Option A (Easiest for AI Studio & Hosted Apps): Vertex AI API Key (Express Mode)

Use this option if you want to paste a single secret key into `.env` or AI Studio's Environment Variables panel without setting up service account JSON files.

1. In the Google Cloud Console, open **Vertex AI → Vertex AI Studio** (or go to **APIs & Services → Credentials**).
2. Click **Create Credentials → API key** (or click **API Keys** in Vertex AI Studio to generate a Vertex AI Express Mode key).
3. *(Recommended)* Click **Edit API key** → under **API restrictions**, choose **Restrict key** and select **Vertex AI API** so the key can only call Vertex AI.
4. Copy the generated key — you will paste this into `VERTEX_AI_API_KEY`.

### Option B (Recommended for Cloud Run & Local `gcloud` Dev): Application Default Credentials (ADC)

Use this option if you are running on **Google Cloud Run** or locally with the `gcloud` CLI.

- **On Cloud Run:**
  1. Go to **IAM & Admin → IAM** in Google Cloud Console.
  2. Find the service account used by your Cloud Run service (typically `<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`).
  3. Grant it the **Vertex AI User** (`roles/aiplatform.user`) role.
- **Locally on your computer:**
  1. Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install).
  2. Run:
     ```bash
     gcloud auth application-default login
     gcloud config set project YOUR_PROJECT_ID
     ```

---

## Step 4: Populate Your `.env` File (or AI Studio Secrets)

Create or update your local `.env` file in the project root (never commit `.env` to git — it is ignored by `.gitignore`), or enter the same key/value pairs in **AI Studio → Settings → Environment Variables**.

### Configuration for Option A — Vertex AI Express Mode (API Key)

```env
# Enable Vertex AI routing (optional; defaults to true when Vertex vars are present)
GOOGLE_GENAI_USE_VERTEXAI=true

# Paste your Vertex AI API key from Step 3 (Option A)
VERTEX_AI_API_KEY=your-vertex-ai-api-key-here

# Keep GOOGLE_CLOUD_PROJECT unset when using Express Mode API key auth
# GOOGLE_CLOUD_PROJECT=

# Optional model overrides (defaults shown below)
# VERTEX_TEXT_MODEL=gemini-4-hydrogen
# VERTEX_IMAGE_MODEL=gemini-3.1-flash-lite-image

# Optional fallback key
GEMINI_API_KEY=your-gemini-api-key-if-desired
```

### Configuration for Option B — Vertex AI Standard (Project + Location via ADC)

```env
# Enable Vertex AI routing
GOOGLE_GENAI_USE_VERTEXAI=true

# Your Google Cloud Project ID from Step 1
GOOGLE_CLOUD_PROJECT=gen-lang-client-0792354516

# Google Cloud region for Vertex AI endpoints (defaults to us-central1)
GOOGLE_CLOUD_LOCATION=us-central1

# Optional model overrides (defaults shown below)
# VERTEX_TEXT_MODEL=gemini-4-hydrogen
# VERTEX_IMAGE_MODEL=gemini-3.1-flash-lite-image
```

### Environment Variable Reference

| Variable | Required? | Default | Description |
| :--- | :--- | :--- | :--- |
| `GOOGLE_GENAI_USE_VERTEXAI` | Optional | `true` (unless set to `'false'`) | Set to `false` to force the server back to `GEMINI_API_KEY` even if Vertex variables exist. |
| `GOOGLE_CLOUD_PROJECT` | Option B only | *(none)* | Google Cloud Project ID for ADC / Cloud Run Vertex AI requests. |
| `GOOGLE_CLOUD_LOCATION` | Option B only | `us-central1` | Vertex AI region (e.g., `us-central1`, `us-east4`, `europe-west4`, `global`). |
| `VERTEX_AI_API_KEY` | Option A only | *(none)* | Vertex AI Express Mode API key. Used when `GOOGLE_CLOUD_PROJECT` is not set. |
| `VERTEX_TEXT_MODEL` | Optional | `gemini-4-hydrogen` | Model used for Seed Card lore generation and ink/text analysis. |
| `VERTEX_IMAGE_MODEL` | Optional | `gemini-3.1-flash-lite-image` | Model used for bespoke Balatro Seed Card pixel-art and wallpaper generation. |
| `GEMINI_API_KEY` | Fallback | *(none)* | Standard Gemini Developer API key used automatically if Vertex AI variables are not set. |

---

## Step 5: Restart the Server & Verify Vertex AI Is Active

1. Restart the server so it picks up the new environment variables (`npm run dev` locally, or redeploy/restart in AI Studio).
2. Test the Seed Card Lore endpoint with `curl`:

```bash
curl -s -X POST http://localhost:3000/api/vertex/seed-card-lore \
  -H "Content-Type: application/json" \
  -d '{
    "seed": "ALEEB",
    "deck": "Ghost",
    "stake": "White",
    "ante": 1,
    "cardStyle": "joker",
    "boss": "The Hook",
    "voucher": "Overstock",
    "souls": ["Perkeo", "Triboulet"]
  }'
```

3. Check the `"provider"` field in the JSON response:
   - `"provider": "vertex-express"` → Vertex AI Express Mode (`VERTEX_AI_API_KEY`) is active.
   - `"provider": "vertex-adc"` → Vertex AI Standard (`GOOGLE_CLOUD_PROJECT` + ADC) is active.
   - `"provider": "gemini-api"` → Running on the `GEMINI_API_KEY` fallback.

You can also open **seedfinder.app → Analyzer → Seed Card** in the UI and click **Generate AI Lore** or **Generate Pixel Art** to verify live card generation end-to-end.

---

## Troubleshooting

- **`403 Permission Denied` or `API not enabled`:**
  - Verify **Vertex AI API** (`aiplatform.googleapis.com`) is enabled on the exact project matching your key or `GOOGLE_CLOUD_PROJECT`.
  - If using Option B (ADC), confirm your user or service account has the **Vertex AI User** (`roles/aiplatform.user`) IAM role.
- **`Could not load the default credentials`:**
  - `GOOGLE_CLOUD_PROJECT` is set, so the server tried Option B (ADC), but no ADC credentials exist in your environment. Either run `gcloud auth application-default login` locally, or unset `GOOGLE_CLOUD_PROJECT` and use `VERTEX_AI_API_KEY` (Option A) instead.
- **`404 Model not found` in your region:**
  - Some newer Gemini models are available in `global` or `us-central1` first. Set `GOOGLE_CLOUD_LOCATION=us-central1` (or `global`), or override `VERTEX_TEXT_MODEL` / `VERTEX_IMAGE_MODEL` in `.env` with a model ID enabled in your region.
- **Want to quickly revert to `GEMINI_API_KEY` without deleting your keys?**
  - Set `GOOGLE_GENAI_USE_VERTEXAI=false` and restart the server.
