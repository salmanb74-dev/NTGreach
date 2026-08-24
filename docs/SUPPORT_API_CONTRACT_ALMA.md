# Reach Support API — contract for Alma (Nest BFF)

Server-to-server HTTP API. **Never** call these routes from the browser with `SUPPORT_ALMA_API_KEY`.

This contract is **identical** to [`SUPPORT_API_CONTRACT.md`](./SUPPORT_API_CONTRACT.md) (the Resto contract) with the following differences:

| Difference | Resto | Alma |
|---|---|---|
| Reach env var | `SUPPORT_API_KEY` | `SUPPORT_ALMA_API_KEY` |
| Alma Nest env var | — | `REACH_API_KEY` (= Reach's `SUPPORT_ALMA_API_KEY`) |
| `product` field | always `"resto"` (derived from key) | always `"alma"` (derived from key) |
| Conversations shown to | `cs_resto` agents | `cs_alma` agents |

The `product` field is **not** sent in the request body. It is derived server-side from whichever API key authenticated the request. You do not need to pass it.

---

## Environment variables

| Side | Variable | Notes |
|---|---|---|
| Reach | `SUPPORT_ALMA_API_KEY` | Random secret, at least 32 chars |
| Reach | `SUPPORT_API_ACTOR_USER_ID` | Shared with Resto; same Supabase actor user |
| Alma Nest | `REACH_API_KEY` | Set to Reach's `SUPPORT_ALMA_API_KEY` |
| Alma Nest | `REACH_BASE_URL` | Reach production URL |

---

## Auth

Every request:

```http
x-api-key: <SUPPORT_ALMA_API_KEY>
Content-Type: application/json   # except multipart upload
```

- Missing/invalid key → `401 { "error": "Unauthorized" }`
- Reach binds the product (`"alma"`) to the key automatically — no need to pass `product` in body.
- CORS: Alma Nest → Reach only (no browser origin required).

---

## All endpoints

All endpoints are **identical** to the Resto contract. Refer to [`SUPPORT_API_CONTRACT.md`](./SUPPORT_API_CONTRACT.md) for full request/response shapes.

| Method | Path | Description |
|---|---|---|
| GET | `/api/support/conversations` | List open/closed conversations for a tenant |
| POST | `/api/support/conversations` | Create a new conversation |
| GET | `/api/support/conversations/{id}` | Get a single conversation |
| PATCH | `/api/support/conversations/{id}` | Close/reopen a conversation |
| DELETE | `/api/support/conversations/{id}` | Delete a conversation (empty only) |
| DELETE | `/api/support/conversations/by-tenant` | Delete all empty conversations for a tenant |
| GET | `/api/support/conversations/{id}/messages` | List messages |
| POST | `/api/support/messages` | Send a customer message |
| DELETE | `/api/support/messages/{id}` | Delete a message |
| POST | `/api/support/uploads` | Upload a media file |

---

## Create conversation — Alma-specific notes

`POST /api/support/conversations`

The `product` field is **omitted** from the request body — it is set to `"alma"` automatically based on the API key.

For Alma, `branch_id` / `branch_name` refer to the school's branch (e.g. a campus). Same semantics as Resto.

```json
{
  "tenant_id": "alma_school_abc",
  "tenant_name": "ABC International School",
  "title": null,
  "branch_id": "uuid-of-branch",
  "branch_name": "Main Campus"
}
```

---

## Staging note

Alma currently has **production only**. When staging is added, a second pair of keys (`SUPPORT_ALMA_STAGING_API_KEY`) can be introduced and routed to a separate Reach staging environment.
