/** @type {import('next').NextConfig} */
const CRM_MODS = 'crm_resto|crm_alma'
const CS_MODS = 'cs_resto|cs_alma'
const OPS_PRODUCT = 'ops_resto|ops_alma'

const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        // ── CRM: /crm_resto/leads → /leads ─────────────────────
        {
          source: `/:mod(${CRM_MODS})/dashboard`,
          destination: '/dashboard',
        },
        {
          source: `/:mod(${CRM_MODS})/leads`,
          destination: '/leads',
        },
        {
          source: `/:mod(${CRM_MODS})/leads/:path*`,
          destination: '/leads/:path*',
        },
        {
          source: `/:mod(${CRM_MODS})/pipeline`,
          destination: '/pipeline',
        },
        {
          source: `/:mod(${CRM_MODS})/reports`,
          destination: '/reports',
        },
        {
          source: `/:mod(${CRM_MODS})/reports/:path*`,
          destination: '/reports/:path*',
        },
        {
          source: `/:mod(${CRM_MODS})/activity`,
          destination: '/activity',
        },
        {
          source: `/:mod(${CRM_MODS})/settings`,
          destination: '/settings',
        },
        {
          source: `/:mod(${CRM_MODS})/settings/:path*`,
          destination: '/settings/:path*',
        },
        {
          source: `/:mod(${CRM_MODS})/calendar`,
          destination: '/calendar',
        },
        {
          source: `/:mod(${CRM_MODS})/notifications`,
          destination: '/notifications',
        },
        {
          source: `/:mod(${CRM_MODS})/profile`,
          destination: '/profile',
        },
        {
          source: `/:mod(${CRM_MODS})/contracts/:path*`,
          destination: '/contracts/:path*',
        },
        {
          source: `/:mod(${CRM_MODS})/quotations/:path*`,
          destination: '/quotations/:path*',
        },

        // ── Support: /cs_resto/chats → /support/chats ──────────
        {
          source: `/:mod(${CS_MODS})/dashboard`,
          destination: '/support/dashboard',
        },
        {
          source: `/:mod(${CS_MODS})/chats`,
          destination: '/support/chats',
        },
        {
          source: `/:mod(${CS_MODS})/activity`,
          destination: '/support/activity',
        },
        {
          source: `/:mod(${CS_MODS})/calendar`,
          destination: '/support/calendar',
        },
        {
          source: `/:mod(${CS_MODS})/time`,
          destination: '/support/time',
        },
        {
          source: `/:mod(${CS_MODS})/reports`,
          destination: '/support/reports',
        },
        {
          source: `/:mod(${CS_MODS})/settings`,
          destination: '/support/settings',
        },

        // ── Product Ops: /ops_resto → /ops (home), …/management ─
        {
          source: `/:mod(${OPS_PRODUCT})`,
          destination: '/ops',
        },
        {
          source: `/:mod(${OPS_PRODUCT})/management`,
          destination: '/ops/management',
        },
        {
          source: `/:mod(${OPS_PRODUCT})/management/:path*`,
          destination: '/ops/management/:path*',
        },
        {
          source: `/:mod(${OPS_PRODUCT})/tenants`,
          destination: '/ops/management',
        },
        {
          source: `/:mod(${OPS_PRODUCT})/tenants/:path*`,
          destination: '/ops/management/:path*',
        },
        {
          source: `/:mod(${OPS_PRODUCT})/logs`,
          destination: '/ops/logs',
        },
        {
          source: `/:mod(${OPS_PRODUCT})/reports`,
          destination: '/ops/reports',
        },
        {
          source: `/:mod(${OPS_PRODUCT})/subscription`,
          destination: '/ops/subscription',
        },

        // ── Platform Ops users under /ops/users ────────────────
        {
          source: '/ops/users',
          destination: '/platform/users',
        },
        {
          source: '/ops/users/:path*',
          destination: '/platform/users/:path*',
        },
      ],
    }
  },
}

module.exports = nextConfig
