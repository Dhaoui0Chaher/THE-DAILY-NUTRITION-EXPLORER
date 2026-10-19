# NutriAtlas 4 — Daily Nutrition Explorer

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

> **Deployment status (2026-10-19):** GitHub Pages deployment [succeeded on attempt 2](https://github.com/Dhaoui0Chaher/THE-DAILY-NUTRITION-EXPLORER/actions/runs/39247883358). The migration for Supabase project `ksddpaamsvmwfipymtyq` has **not** been executed: the connected Supabase account lacks access and only lists a different project. Cloud synchronization remains inactive until the correct account is authorized, the SQL applied, and email Auth configured.

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
