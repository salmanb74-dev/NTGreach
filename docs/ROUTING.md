# Reach URL routing

Canonical shape:

```
/{module}/{section}/…
```

| Module key | Example home | Example sections |
|---|---|---|
| `crm_resto` | `/crm_resto/dashboard` | `leads`, `pipeline`, `reports`, … |
| `cs_resto` | `/cs_resto/dashboard` | `chats`, `activity`, `time`, … |
| `ops_resto` | `/ops_resto` | `management`, `management/:id` |
| `ops` | `/ops` | `users`, `users/:id` |

Implementation:

1. **Browser URL** uses the module segment (sidebar + module switcher).
2. **`next.config.js` rewrites** map those URLs onto existing page files (`/dashboard`, `/support/…`, `/ops/management`, `/platform/users`).
3. **`middleware`** redirects bare legacy paths (`/leads`, `/support/chats`, `/ops/management`, `/platform/users`) to the module-prefixed form using `ntg-active-module` (defaults: `crm_resto` / `cs_resto` / `ops_resto`).
4. Visiting a module path refreshes the `ntg-active-module` cookie.

API routes stay under `/api/*` (not module-scoped).
