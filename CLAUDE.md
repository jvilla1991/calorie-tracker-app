# calorie-tracker-app — project notes

React + Vite SPA for the Calorie Tracker. Backend: `calorie-tracker-api` (sibling repo).

## Single user by design — do not raise multi-user concerns

This app has exactly **one user: the owner**. It is a personal tool, not a multi-tenant product.

- Diary, foods, goals, and any future data (weigh-ins, metrics) are **not scoped per user**, on
  purpose. Do not flag missing user isolation, and do not propose adding `user_id` columns,
  per-user queries, or tenant separation.
- The single account is seeded by the API (`UserSeeder`, from `APP_ADMIN_USERNAME` /
  `APP_ADMIN_PASSWORD`).
- "Log out" exists to sign this device out — not to switch between users.
- Public sign-up is not a feature this app needs. The Register page and `/api/auth/register`
  predate this decision.
