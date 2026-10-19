# NutriAtlas 5 — AI-assisted Daily Nutrition Explorer

An **offline-first nutrition explorer** with optional Supabase accounts.

The app includes 55 nutrient and dietary reference entries, a starter food-composition library, a component-swapping meal builder, a seven-day meal planner, and consolidated buy-by-weight shopping lists. The sample composition values and cooking-yield conversions are **educational estimates**, not a validated clinical database.

## Run it

Open `index.html` or serve it as a static site. Nutrition calculations work locally without an account. Cloud login and synchronization require internet access.

### Publish using GitHub Pages

In this repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**. The committed [Pages workflow](.github/workflows/pages.yml) publishes only `index.html`. If GitHub Pages has not been enabled, deployment will fail at `Configure Pages` until you select this publishing source. After enabling it, use **Actions → Deploy NutriAtlas to GitHub Pages → Run workflow**.

GitHub Actions reported a **successful deployment** on 2026-10-19: [NutriAtlas public site](https://dhaoui0chaher.github.io/THE-DAILY-NUTRITION-EXPLORER/). Configure this exact URL as the Supabase Authentication Site URL and an allowed redirect URL before testing authentication.

## Connect Supabase project

Intended Supabase project reference: `ksddpaamsvmwfipymtyq` (the browser uses `https://ksddpaamsvmwfipymtyq.supabase.co`).

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/ksddpaamsvmwfipymtyq/sql/new) while signed into the **correct** project.
2. Run [the committed migration](supabase/migrations/202610190001_nutriatlas_cloud.sql). It creates `public.nutriatlas_user_data`, enables row-level security, and limits reads/writes to each authenticated user's own row.
3. Under **Authentication → Providers**, enable Email and choose whether to require email confirmation. The website uses password authentication (8+ characters), not anonymous shared accounts.
4. Under **Authentication → URL Configuration**, set the actual deployed HTTPS site URL and add that URL to allowed redirect URLs for confirmation/password reset links. If you have not yet deployed with Pages, configure URLs after deployment.
5. Confirm **Project Settings → Data API** exposes the `public` schema and the migration's authenticated grants apply. Test sign-up, sign-in, save, sign-out, sign-in again, and load.
6. For production, rotate any previously shared secret/service-role keys. **Do not put secret or service-role credentials in HTML, JS, commits, screenshots or issue descriptions.**

> **Current setup (2026-10-19):** GitHub Pages is deployed. Supabase project `ksddpaamsvmwfipymtyq` is accessible through the connected project account; `nutriatlas_user_data` was verified with RLS and four user-ownership policies, and the AI quota migration was applied. The AI function was deployed with JWT verification. Email confirmation and the live two-account cloud flow still require full end-to-end testing.

## Account and synchronization behavior

- **Create account / Sign in:** Supabase Email authentication. Email verification may be required depending on project settings.
- **Save to cloud:** Uploads current age/sex-based profile, food log, custom meal, weekly plan, shopping checkmarks, yield factors, and recipe preferences. The first save enables auto-sync on that device.
- **Load cloud:** Downloads the saved data only after asking before replacing local work, and then enables auto-sync.
- **Auto-sync:** Changes are debounced and saved while online and authenticated. If offline, local data remain and should be manually saved after reconnecting. Cross-device concurrent editing is last-write-wins; there is no merge or multi-device collaboration protocol yet.
- **Sign out:** Prompts before clearing local nutrition data on that browser. Your remote cloud copy remains.
- **Offline mode:** The calculations and local meal plan remain available even without account sign-in. The third-party Supabase library is loaded from a version-pinned CDN only when online.

## Data model and security

`public.nutriatlas_user_data` holds one JSONB snapshot per Supabase Auth user. Policies for SELECT, INSERT, UPDATE and DELETE check `auth.uid() = user_id`. Anonymous database access is revoked; clients use a **publishable** key and carry their own login sessions. The app never requires or embeds a service-role credential.

The `nutriatlas_user_data` migration is additive to the selected project; it does not modify unrelated tables. Limit: roughly 512 KiB per user's snapshot.

## Research and application caveats

This remains a research/demo prototype, not medical advice or a certified nutrition optimizer. Missing nutrient measurements are **unknown**, not zero. Purchases depend on recipe assumptions and adjustable cooking-to-shopping factors. Generated daily and weekly menus are not guaranteed to meet every individual dietary requirement, allergen restriction, or micronutrient target.

Reference links and methodology are included in the app under **Sources & method**.

## Version 5: Dedicated account screens and AI Kitchen

The current website adds dedicated sign-in, sign-up, confirmation, forgot-password and reset-password routes, a responsive user menu, and the **AI Kitchen** tab. The existing nutrition reference and weekly shopping calculators are retained. A user can generate a full seven-day plan or replace only one dish. Nutrient calculations use only known ingredients and illustrative measured/rounded values; no AI-generated nutrient figures are trusted.

### Free-tier generative AI: GroqCloud (GPT-OSS 20B)

The deployed Supabase Edge Function `nutriatlas-ai` (v2) now uses **GroqCloud's Free tier** with the open-weight `openai/gpt-oss-20b` model. This does **not** require an OpenAI API account or ChatGPT subscription. The **free Groq account still requires its own API key**: a website cannot safely perform anonymous model inference using an owner's key from browser JavaScript.

1. Create a free account at [GroqCloud](https://console.groq.com) and issue an API key in [Groq API Keys](https://console.groq.com/keys). Stay on the Free tier; do not upgrade to paid Developer unless you intend to incur charges.
2. In the [Supabase Edge Function Secrets dashboard](https://supabase.com/dashboard/project/ksddpaamsvmwfipymtyq/settings/functions), create a secret named **`GROQ_API_KEY`** using the Groq key. Do not put this in the browser, HTML or GitHub.
3. Test **AI Kitchen → Generate with free-tier AI** while signed in. The function uses Groq's strict JSON Schema output, accepts only known ingredient IDs and sensible gram quantities, checks diet restrictions and validates 28 distinct meals.
4. The existing `nutriatlas_claim_ai_request` database RPC enforces **8 AI requests per user per UTC day**. Groq's own **organization/model free-tier rate limits** may be lower at times, and API service availability is not guaranteed.
5. Without a Groq key, **Smart Mix** provides algorithmic weekly meal variations offline, and **Explore live recipes** fetches actual public recipes from TheMealDB with no personal API key.

The Groq model name contains `openai/` because that is the **model publisher namespace**, not a paid OpenAI API dependency. No `OPENAI_API_KEY` is required.

### Live recipe exploration — TheMealDB

The free public development endpoint at `https://www.themealdb.com/api/json/v1/1/` supports dish-name search and random meal discovery, including names, instructions, and ingredient measurements. Results display live in AI Kitchen with attribution. These external ingredient descriptions do **not** flow into the precise grocery/nutrient sums without verified gram conversions. A site owner should review [TheMealDB's terms](https://www.themealdb.com/terms_of_use.php) before commercial/public distribution: the development key is meant for educational/testing projects and commercial release may require supporter access.

The AI quota migration in [`supabase/migrations/202610190002_ai_quota.sql`](supabase/migrations/202610190002_ai_quota.sql) was successfully applied to project `ksddpaamsvmwfipymtyq` on 2026-10-19. The prior `nutriatlas_user_data` table was confirmed existing with RLS and four owner policies.

### Email authentication configuration

In [Supabase Authentication URL Configuration](https://supabase.com/dashboard/project/ksddpaamsvmwfipymtyq/auth/url-configuration), allow `https://dhaoui0chaher.github.io/THE-DAILY-NUTRITION-EXPLORER/` for account verification and password resets. Enable and configure Email provider (and verification), and consider a custom SMTP provider for production delivery. Auth provider settings are not automatically managed by this repository.

### Security and limitations

The site is a static GitHub Pages application using a **publishable** Supabase key. It must never contain `sb_secret_`, service-role JWTs, or Groq provider secrets. The server-side function accepts allowed origins, verifies the signed-in Supabase user, has output-size and time limits, applies an atomic quota, and avoids returning unknown ingredient IDs. Review account access policies and test with two separate user accounts before inviting real users. Rotating previously exposed privileged keys remains essential.

The application remains an educational nutrition prototype; menus are **not medically certified** and the food-composition library is not comprehensive. Dietary restrictions are best-effort filters; users with food allergies should independently verify ingredients and manufacturing cross-contamination.
