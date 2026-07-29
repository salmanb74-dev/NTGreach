# Phase 4 Setup Guide — Mailjet Inbound + Webhooks

## What this enables
- Lead replies to emails are automatically captured in the timeline
- Email status (delivered, opened, clicked) updates in real time

---

## Step 1 — Add new environment variables

Add these to your `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=your-secret-key-here
WEBHOOK_SECRET=any-random-string-you-choose
INBOUND_DOMAIN=mail.ntgclarity.com
MAILJET_FROM_EMAIL=resto@ntgclarity.com
MAILJET_FROM_NAME=Umair Khan — NTG Reach
```

**Where to get them:**
- `SUPABASE_SERVICE_ROLE_KEY` → Supabase Dashboard → Project Settings → API → Secret key
- `WEBHOOK_SECRET` → make up any random string, e.g. `xK9mP2qR7nL4wT8v` — just keep it secret

Also add these to Netlify → Site Settings → Environment Variables when deploying.

---

## Step 2 — Verify Mailjet sender domain

Since outbound emails go out from **resto@ntgclarity.com**, Mailjet needs to verify that you own ntgclarity.com.

1. Mailjet Dashboard → **Account Settings** → **Sender domains & addresses**
2. Click **Add a domain** → enter `ntgclarity.com`
3. Mailjet will give you a TXT DNS record to add — something like:
   ```
   Type: TXT
   Host: @  (or ntgclarity.com)
   Value: mailjet-verify=xxxxxxxxxxxxxxxx
   ```
4. Add that record in your domain registrar's DNS settings
5. Come back to Mailjet and click **Verify** — can take up to 30 minutes

Once verified, emails sent from `resto@ntgclarity.com` will pass spam checks properly.

---

## Step 3 — DNS record for inbound routing

Log in to wherever **ntgclarity.com** DNS is managed (GoDaddy, Cloudflare, or your registrar).

Add this MX record:

| Type | Host/Name            | Value/Points to   | Priority |
|------|----------------------|-------------------|----------|
| MX   | mail.ntgclarity.com  | in-v3.mailjet.com | 10       |

This tells the internet: "emails sent to anything@mail.ntgclarity.com → deliver to Mailjet."

> ⏱ DNS propagation takes 15 minutes to 24 hours.
> Check propagation status at: https://mxtoolbox.com/SuperTool.aspx?action=mx%3amail.ntgclarity.com

---

## Step 4 — Configure Mailjet Inbound Parsing

1. Mailjet Dashboard → **Account Settings** → **Inbound Emails**
   (or go to: app.mailjet.com/account/email-forward/parsing)
2. Click **Add inbound domain**
3. Enter: `mail.ntgclarity.com`
4. Set the **Parse URL** to:
   ```
   https://your-netlify-url.netlify.app/api/webhooks/mailjet-inbound?secret=YOUR_WEBHOOK_SECRET
   ```
   Replace `your-netlify-url` with your actual Netlify domain and `YOUR_WEBHOOK_SECRET` with the value you set in Step 1.
5. Select **Parse all emails**
6. Save

**Testing locally with ngrok:**
```bash
npx ngrok http 3000
```
Copy the ngrok URL (e.g. `https://abc123.ngrok.io`) and use it as the Parse URL temporarily while testing.

---

## Step 5 — Configure Mailjet Event Webhooks (open/click tracking)

1. Mailjet Dashboard → **Account Settings** → **Event Notifications**
2. For each of these events: `sent`, `delivered`, `open`, `click`, `bounce`, `blocked`
3. Set the URL to:
   ```
   https://your-netlify-url.netlify.app/api/webhooks/mailjet-status?secret=YOUR_WEBHOOK_SECRET
   ```
4. Save each one

---

## How it all works end to end

```
Umair sends email from NTG Reach (resto@ntgclarity.com)
  → Reply-To set to lead-{uuid}@mail.ntgclarity.com
  → Lead hits Reply in their inbox
  → Email arrives at mail.ntgclarity.com
  → Mailjet receives it via MX record
  → Mailjet POSTs to /api/webhooks/mailjet-inbound
  → Webhook extracts lead UUID from the address
  → Saves to activities table as email_inbound
  → Appears in lead timeline automatically
```

---

## Summary of DNS records needed on ntgclarity.com

| Type | Host                 | Value                              | Purpose                    |
|------|----------------------|------------------------------------|----------------------------|
| TXT  | ntgclarity.com       | mailjet-verify=xxxx (from Mailjet) | Sender domain verification |
| MX   | mail.ntgclarity.com  | in-v3.mailjet.com (priority 10)    | Inbound email routing      |

Both records go on **ntgclarity.com** — ask whoever manages the domain DNS to add them.
