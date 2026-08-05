# Reach Support API — contract for Resto (Nest BFF)

Server-to-server HTTP API. **Never** call these routes from the browser with `SUPPORT_API_KEY`.

| Side | Env |
|---|---|
| Reach | `SUPPORT_API_KEY`, `SUPPORT_API_ACTOR_USER_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` |
| Resto Nest | `REACH_API_KEY` (= Reach’s `SUPPORT_API_KEY`), `REACH_BASE_URL` |

---

## Auth

Every request:

```http
x-api-key: <SUPPORT_API_KEY>
Content-Type: application/json   # except multipart upload
```

- Missing/invalid key → `401 { "error": "Unauthorized" }`
- Reach trusts the key + Nest-supplied `tenant_id`. **Nest must bind `tenant_id` from its own session JWT** (do not trust the Resto browser alone).
- CORS: Nest → Reach only (no browser origin required).

### Actor user

`SUPPORT_API_ACTOR_USER_ID` is a dedicated Supabase Auth user UUID used as:

- `support_conversations.created_by`
- `support_messages.sender_id` for customer messages from this API

Create once in Supabase Auth (e.g. `resto-support-api@ntgclarity.com`) and set the profile `full_name` to something like `Resto customer` if you want a default label in the agent UI. Optional per-message `sender_display_name` overrides that in Reach chat.

---

## Error shape

```json
{ "error": "Human-readable message" }
```

| Status | When |
|---|---|
| 400 | Validation / bad input |
| 401 | Bad or missing API key |
| 403 | Conversation not in tenant / forbidden delete |
| 404 | Not found |
| 413 | Upload too large |
| 500 | Unexpected server / DB error |

---

## 1. List conversations

`GET /api/support/conversations?tenant_id={id}&status={open|closed}&limit={n}`

| Query | Required | Notes |
|---|---|---|
| `tenant_id` | yes | Nest-bound restaurant id |
| `status` | no | `open` \| `closed` |
| `limit` | no | Default `50`, max `200` |

**Response `200`:**

```json
{
  "conversations": [
    {
      "id": "uuid",
      "tenant_id": "string",
      "tenant_name": "string",
      "title": null,
      "status": "open",
      "created_by": "uuid",
      "assigned_to": null,
      "created_at": "ISO-8601",
      "closed_at": null,
      "last_message_at": "ISO-8601",
      "product": "resto",
      "support_category": "platform",
      "logged_minutes": 0
    }
  ]
}
```

- Ordered by `last_message_at` desc.
- `support_category` and `logged_minutes` are **read-only** for Resto (agents set them in Reach).
- Many open conversations per tenant are allowed; **no** “return active” behaviour.

---

## 2. Create conversation

`POST /api/support/conversations`

```json
{
  "tenant_id": "clay_handi",
  "tenant_name": "Clay Handi",
  "title": null,
  "product": "resto"
}
```

| Field | Required | Notes |
|---|---|---|
| `tenant_id` | yes | |
| `tenant_name` | yes | Display name for agents |
| `title` | no | |
| `product` | no | Default `resto` |

**Always creates a new conversation** (`status: open`).

**Response `201`:** `{ "conversation": { ...same fields as list item... } }`

---

## 3. List messages

`GET /api/support/conversations/{conversationId}/messages?tenant_id={id}&limit={n}&before={iso}`

Nested under conversations so it does not collide with agent `DELETE /api/support/messages/{messageId}`.

| Query | Required | Notes |
|---|---|---|
| `tenant_id` | yes | Must own the conversation |
| `limit` | no | Default `100`, max `200` |
| `after` | no | ISO — messages with `created_at` **strictly after** (poll for new) |
| `before` | no | ISO — messages with `created_at` **strictly before** (page older) |

**Response `200`:**

```json
{
  "messages": [
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "sender_id": "uuid",
      "sender_type": "customer",
      "sender_display_name": "Ayesha — Clay Handi",
      "message_type": "text",
      "content": "Hello",
      "file_url": null,
      "created_at": "ISO-8601",
      "read_at": null,
      "expires_at": null
    }
  ]
}
```

- Ordered `created_at` **ascending**.
- `sender_type`: `customer` \| `agent`.
- `message_type`: `text` \| `image` \| `voice` \| `video`.

---

## 4. Send message

`POST /api/support/messages`

```json
{
  "tenant_id": "clay_handi",
  "conversation_id": "uuid",
  "message_type": "text",
  "content": "Hello",
  "file_url": null,
  "sender_display_name": "Ayesha",
  "expires_at": null
}
```

| Field | Required | Notes |
|---|---|---|
| `tenant_id` | yes | |
| `conversation_id` | yes | Must belong to tenant |
| `message_type` | yes | `text` \| `image` \| `voice` \| `video` |
| `content` | for `text` | Non-empty string |
| `file_url` | for media | Public URL from upload endpoint |
| `sender_display_name` | no | Shown in Reach agent UI for customer messages |
| `expires_at` | no | ISO; for `video`, defaults to now + **7 days** if omitted |

`sender_type` is always `customer` on this route.

**Response `201`:** `{ "message": { ... } }`

---

## 5. Upload media

`POST /api/support/uploads`  
`Content-Type: multipart/form-data`

| Part | Required | Notes |
|---|---|---|
| `tenant_id` | yes | |
| `conversation_id` | yes | Must belong to tenant |
| `message_type` | yes | `image` \| `voice` \| `video` |
| `file` | yes | Binary |

**Limits**

| Type | Max size | Notes |
|---|---|---|
| `image` | 5 MB | Screenshots/photos |
| `voice` | 2 MB | Prefer short Opus/WebM |
| `video` | 12 MB | Max **15s** client-side; **7-day** retention |

**Response `201`:**

```json
{
  "file_url": "https://….supabase.co/storage/v1/object/public/support-files/…",
  "expires_at": "ISO-8601 or null",
  "message_type": "video"
}
```

Then call `POST /api/support/messages` with `file_url` (+ `expires_at` for video).

Screen recordings: Reach stores `expires_at`; a Netlify scheduled function removes expired video files. UI hides expired media even before cleanup.

---

## 6. Delete own customer message

`DELETE /api/support/messages/{messageId}?tenant_id={id}`

With `x-api-key`: allowed only if the message’s `sender_id` is the API actor and the conversation belongs to `tenant_id`. Removes Storage object when present.

(Agent browser delete uses the same path with a session cookie instead of the API key.)

**Response `200`:** `{ "ok": true }`

---

## 7. Monthly minutes summary

`GET /api/support/minutes-summary?tenant_id={id}&month={YYYY-MM}`

| Query | Required | Notes |
|---|---|---|
| `tenant_id` | yes | |
| `month` | no | Default = current month in **Asia/Karachi** |

Rules (same as Reach reports):

- Conversation counts in the month of `created_at` (Asia/Karachi).
- Minutes use the chat’s **current** `support_category`.

**Response `200`:**

```json
{
  "tenant_id": "clay_handi",
  "month": "2026-07",
  "platform_minutes": 40,
  "operational_minutes": 15,
  "chat_count": 3
}
```

---

## 8. Coverage (optional — Resto may use a static banner)

`GET /api/support/coverage`

**Response `200`:**

```json
{
  "on_duty": true,
  "offline_message": "Our support team is currently offline. …",
  "next_available_at": null,
  "coverage_ends_at": "2026-07-30T12:00:00.000Z"
}
```

| Field | When | Notes |
|-------|------|--------|
| `on_duty` | always | `true` when any support shift covers “now” |
| `offline_message` | always | Configurable fallback copy for offline banner |
| `next_available_at` | offline | ISO start of next shift within ~7 days, else `null` |
| `coverage_ends_at` | on duty | ISO end of the continuous on-duty block (≤1 min gaps merge), else `null` |

Resto may show a short “back at …” when offline, and “ends in N min” when `coverage_ends_at` is within 30 minutes.

---

## 9. Realtime

**Anon table access is not supported.** Nest obtains a short-lived,
conversation-scoped token and passes only that token to the Resto browser.

### Obtain token

`POST /api/support/realtime-token`

```json
{
  "tenant_id": "clay_handi",
  "conversation_id": "uuid"
}
```

- Nest calls this route with `x-api-key`; the browser must not call it directly.
- Reach verifies that the conversation belongs to `tenant_id`.
- Wrong tenant → `403`; missing conversation → `404`.
- Token TTL: **10 minutes**. Nest should refresh after **5 minutes** while the
  conversation remains open.

**Response `200`:**

```json
{
  "mode": "realtime",
  "access_token": "<short-lived JWT>",
  "expires_at": "2026-07-30T03:20:00.000Z",
  "supabase_url": "https://<project>.supabase.co",
  "supabase_anon_key": "<public project bootstrap key>",
  "refresh_after_seconds": 300
}
```

The JWT uses the dedicated `support_realtime` database role. RLS permits SELECT
only where `support_messages.conversation_id` equals the signed
`support_conversation_id` claim. It has no write access and no grants on other
Reach/CRM tables.

### Browser subscription

Resto may use its normal Supabase JS dependency and Reach's public anon key only
to initialize the socket. The scoped token—not the anon key—is what authorizes
the table subscription:

```ts
const reach = createClient(supabaseUrl, supabaseAnonKey)
await reach.realtime.setAuth(accessToken)

const channel = reach
  .channel(`resto-support:${conversationId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'support_messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    ({ new: message }) => {
      // Add agent/customer message to the open chat.
    }
  )
  .subscribe()
```

The anon key is public project metadata; it grants no support-table reads by
itself. Do not put `SUPPORT_API_KEY`, `SUPABASE_JWT_SECRET`, or a service-role
key in the browser.

### Poll fallback

If `SUPABASE_JWT_SECRET` is not configured, the endpoint retains the existing
fallback:


```json
{
  "mode": "poll",
  "poll_interval_ms": 3000,
  "message": "Scoped Realtime JWT is not configured; poll GET /api/support/conversations/{id}/messages"
}
```

Resto should also fall back to polling when token retrieval or the Realtime
subscription fails:

`GET /api/support/conversations/{id}/messages?tenant_id={id}&after={lastCreatedAt}`

---

## Suggested Nest flow

1. User opens Support → Nest `POST /conversations` (always new) with JWT-derived `tenant_id` / name.
2. Nest lists messages and obtains a scoped Realtime token; poll as fallback.
3. Text: Nest `POST /messages`.
4. Media: Nest `POST /uploads` → `POST /messages` with `file_url`.
5. Optional: Nest caches `GET /minutes-summary` and `GET /coverage` for the tab chrome.
