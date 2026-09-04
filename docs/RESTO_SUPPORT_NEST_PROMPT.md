# Resto Nest — Support chat parity with NTG Reach (comprehensive)

Implement these Support changes in **Resto Nest + customer Support UI** to match the current NTG Reach Support API (`docs/SUPPORT_API_CONTRACT.md` in the Reach repo).

Do **not** change tenant_id binding or `x-api-key` auth. Nest still binds `tenant_id` (and branch) from its own session JWT.

---

## A. Attach any file (not images only)

### UI
- Replace “Attach image” with a generic **file picker** (no `accept=` restriction, or allow common types).
- Images still display inline in chat; other files show as a download card (filename + open/download).

### Flow (unchanged pattern)
1. `POST /api/support/uploads` (multipart: `tenant_id`, `conversation_id`, `message_type`, `file`)
2. `POST /api/support/messages` with `file_url` (+ `content` for file attachments)

### `message_type` rules
| User picks | `message_type` | Notes |
|---|---|---|
| `image/*` | `image` | Compress client-side if desired (max edge 1280px, JPEG ~0.72), same idea as Reach agent UI |
| Anything else (PDF, audio, docs, …) | `file` | Upload as-is; put original filename in message `content` |

### Size limits (must match Reach `lib/support/media-limits.ts`)

| Type | Max size | Notes |
|---|---|---|
| `image` | **5 MB** | Limit applies to the **original** file before compression |
| `file` | **3 MB** | No compression |
| `voice` | 2 MB | Unchanged |
| `video` | **12 MB** | Screen recording (see §B) — do **not** raise this |

Reject oversize with a clear error (Reach returns `413`).

Reach DB must allow `message_type = 'file'` (`phase_c_support_file_attachments.sql`). Confirm that migration is applied on Reach Supabase before shipping Resto.

---

## B. Screen recording

- Max duration: **60 seconds** (1 min).
- While recording, show a clear indicator with **elapsed / max** (e.g. `0:42 / 1:00`).
- Allow **Stop & send** before the max; **Cancel** discards.
- Auto-stop at 60s; still use 7-day retention (`expires_at` from upload response).
- Encode so a full minute stays under **12 MB** (~9–10 MB typical):
  - Capture **24 fps**
  - `MediaRecorder`: `videoBitsPerSecond: 1_200_000`, `audioBitsPerSecond: 96_000`
- Apply the same **12 MB** file-size check to video as other media types (no special-case skip).

Constants on Reach (`lib/support/media-limits.ts`):
`SCREEN_MAX_SECONDS = 60`, `SCREEN_MAX_BYTES = 12MB`, `SCREEN_CAPTURE_FPS = 24`,
`SCREEN_VIDEO_BITS_PER_SECOND = 1_200_000`, `SCREEN_AUDIO_BITS_PER_SECOND = 96_000`,
`SCREEN_RETENTION_DAYS = 7`.

---

## C. Branch on every chat

### Product rules (agreed)
- Capture branch **once at conversation create** (first open / first message flow).
- Existing chats: leave `branch_id` / `branch_name` **null** — do **not** backfill. Reach shows them as “No branch”.
- Future chats: always pass branch when the user is in a branch context.
- HQ / no-branch sessions: omit both or send `null` (Reach shows “No branch”).
- Branch is **filterable** on Reach agents (All / No branch / each branch). Nest should also filter the customer list to the current branch.

### Create conversation

`POST /api/support/conversations`

```json
{
  "tenant_id": "<from JWT>",
  "tenant_name": "<restaurant display name>",
  "product": "resto",
  "branch_id": "<Resto branch UUID>",
  "branch_name": "<display label e.g. Gulberg>"
}
```

Snapshot `branch_name` at create — do not rely on live renames later.

### List conversations

`GET /api/support/conversations?tenant_id=…&branch_id=…`

- Pass `branch_id` for branch-scoped users so they only see their chats.
- HQ (if any) may omit `branch_id` to see all.

Response includes `branch_id` and `branch_name` (nullable on old chats).

---

## D. Customer-side unread / notifications (agent → customer)

Reach already notifies **agents** well (unread dots, badge, optional sound/browser notify).  
Customer (Resto) Realtime from Reach is **scoped to one open conversation**. Nest must implement **branch-level unread** for users not currently inside that chat.

### Agreed UX
1. **Floating Support bubble (bottom-right):** red badge with unread count; optional pulse when count goes 0 → ≥1.
2. **Support tab / chat list:** red dot (or count) on each conversation with unread **agent** messages.
3. **Who is notified:** every user of **that branch** who can open the chat — **not** other branches.
4. **Clear unread:** when **any** user of that branch **opens / views** the conversation (shared read). Not per-user personal unread.

### Implementation sketch (Nest / Resto)
- Track per conversation (branch-shared): `last_agent_message_at` and `last_read_at` (or equivalent).
- Unread = `last_agent_message_at > last_read_at`.
- Opening the chat updates `last_read_at` for the branch.
- While Support UI is closed / user is on other pages: Nest maintains an unread summary (poll or Nest websocket) to drive the floating bubble — do not rely only on Reach’s per-conversation Realtime token.
- Optional: browser Notification when tab is backgrounded (permission-gated).

While a chat **is** open, keep using Reach Realtime (scoped JWT) or poll for live messages as today.

---

## E. Nest BFF checklist

- [ ] Proxy uploads with `message_type`: `image` \| `voice` \| `video` \| `file`
- [ ] Enforce / surface 5MB image (original) and 3MB file limits
- [ ] File messages: forward `content` = original filename
- [ ] Screen record UI: 60s max + elapsed timer + early stop; 12 MB video check; 24 fps / 1.2 Mbps encode
- [ ] Create conversation: send `branch_id` + `branch_name` from session
- [ ] List conversations: filter by `branch_id` for branch users
- [ ] Unread badge on Support bubble + list; shared clear on open
- [ ] Do not put `SUPPORT_API_KEY` / service role in the browser

---

## F. Test plan

1. Attach PDF &lt; 3MB → appears as file card; &gt; 3MB rejected.
2. Attach image &lt; 5MB original → image message; &gt; 5MB rejected before upload.
3. Screen record: timer shows elapsed/1:00; Stop early sends; Cancel discards; auto-stop at 60s; full clip &lt; 12 MB (no 413).
4. Open chat from branch A → Reach agent sees branch label; list filter works; branch B users do not see that chat.
5. Old chats (pre-branch) show “No branch” on Reach; still usable.
6. Agent replies while Resto user is on another page → Support bubble badge increments; open chat clears badge for all branch users.

---

## Reference (Reach repo)

- API contract: `docs/SUPPORT_API_CONTRACT.md`
- Limits: `lib/support/media-limits.ts`
- SQL: `supabase/phase_c_support_file_attachments.sql`, `supabase/phase_c_support_branch.sql`
