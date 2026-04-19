# CA Guardian
### Enterprise Conditional Access Policy Management Platform

CA Guardian is a production-ready web application that provides centralized governance, lifecycle management, and change-control enforcement for Microsoft Azure Entra ID Conditional Access (CA) policies across one or more tenants.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Azure App Registration Setup](#azure-app-registration-setup)
- [Installation](#installation)
  - [Production (Docker)](#production-docker)
  - [Local Development](#local-development)
- [Configuration Reference](#configuration-reference)
- [Role Reference](#role-reference)
- [Workflow Guide](#workflow-guide)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

---

## Features

| Feature | Description |
|---|---|
| **Multi-tenant Support** | Connect to any number of Azure tenants via App Registration |
| **MFA Enforcement** | All access via Azure Entra ID OAuth 2.0 with MFA |
| **Policy Lockdown** | All CA policies are read-only by default; changes require admin approval |
| **Change Request Workflow** | Submit → Approve → Change → Review → Re-lock |
| **Automated Backups** | Pre- and post-change snapshots created automatically |
| **Version History** | Full versioned history per policy with metadata |
| **One-click Rollback** | Restore any previous version directly to Azure |
| **Change Detection** | Background polling detects policy changes in Azure automatically |
| **Auto Lock Expiry** | Unlocked policies re-lock automatically after 2 hours |
| **Audit Log** | Immutable, exportable log of all platform actions |
| **Email Notifications** | Automated alerts for requests, approvals, detections, and rollbacks |
| **RBAC** | Four roles: Super Admin, CA Admin, Azure Admin, Viewer |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CA Guardian                        │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │   React UI   │  │  Express API │  │ PostgreSQL │  │
│  │  (Vite/TS)  │→ │  (Node/TS)  │→ │  Database  │  │
│  └─────────────┘  └──────┬──────┘  └────────────┘  │
│                          │                          │
│                   ┌──────▼──────┐                   │
│                   │ Graph API   │                   │
│                   │  (MSAL v2)  │                   │
│                   └──────┬──────┘                   │
└──────────────────────────┼──────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Azure Entra │
                    │     ID      │
                    └─────────────┘
```

**Tech Stack:**
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Zustand
- Backend: Node.js 20, Express, TypeScript, MSAL Node
- Database: PostgreSQL 16
- Containerisation: Docker + Docker Compose

---

## Prerequisites

- Docker 24+ and Docker Compose v2
- An Azure subscription with permission to create App Registrations
- SMTP server for email notifications (optional but recommended)

---

## Azure App Registration Setup

1. Go to **Azure Portal → Entra ID → App registrations → New registration**
2. Name: `CA Guardian` | Supported account types: *Single tenant* (or multi-tenant)
3. Redirect URI: **Web** → `https://your-domain.com/api/auth/callback`
4. After creation, go to **Certificates & secrets → New client secret** — copy the value immediately
5. Go to **API permissions → Add a permission → Microsoft Graph → Application permissions**:
   - `Policy.Read.All`
   - `Policy.ReadWrite.ConditionalAccess`
   - `AuditLog.Read.All`
   - `Organization.Read.All`
   - `User.Read.All`
6. Click **Grant admin consent for [your organisation]**
7. Go to **Authentication** and also add a **Delegated** redirect URI for user login:
   - `https://your-domain.com/api/auth/callback`
8. Under **Authentication**, enable **ID tokens** under Implicit grant

Note your:
- **Application (client) ID** → `AZURE_CLIENT_ID`
- **Directory (tenant) ID** → `AZURE_TENANT_ID`
- **Client secret value** → `AZURE_CLIENT_SECRET`

---

## Installation

### Production (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/ca-guardian.git
cd ca-guardian

# 2. Set up environment
cp .env.example .env
# Edit .env with your Azure credentials and other settings
nano .env

# 3. Build and start all services
docker compose up -d --build

# 4. Check logs
docker compose logs -f backend

# 5. Open the app
open http://localhost
```

On first login with your Azure admin account, you'll be registered as a `viewer`. To grant yourself `super_admin` rights, run:

```bash
docker compose exec postgres psql -U ca_guardian_user -d ca_guardian \
  -c "UPDATE users SET role = 'super_admin' WHERE email = 'your@email.com';"
```

Then go to **Tenants** and click **Add Tenant** to connect your first Azure tenant.

---

### Local Development

```bash
# Prerequisites: Node 20+, PostgreSQL 16, running locally

# 1. Set up database
createdb ca_guardian
psql ca_guardian < database/schema.sql

# 2. Backend
cd backend
cp ../.env.example .env  # fill in your values
npm install
npm run dev

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev

# App: http://localhost:5173
# API: http://localhost:3001
```

Or with Docker Compose (hot reload):
```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## Configuration Reference

| Variable | Required | Description |
|---|---|---|
| `AZURE_CLIENT_ID` | ✅ | App Registration client ID |
| `AZURE_CLIENT_SECRET` | ✅ | App Registration client secret |
| `AZURE_TENANT_ID` | ✅ | Your tenant ID, or `common` for multi-tenant |
| `JWT_SECRET` | ✅ | Min 64-char random string for JWT signing |
| `DB_HOST` | ✅ | PostgreSQL host |
| `DB_PASSWORD` | ✅ | PostgreSQL password |
| `API_BASE_URL` | ✅ | Public URL of the API (for OAuth redirect) |
| `FRONTEND_URL` | ✅ | Public URL of the frontend |
| `SMTP_HOST` | ❌ | SMTP server for email notifications |
| `SMTP_USER` | ❌ | SMTP username |
| `SMTP_PASS` | ❌ | SMTP password |
| `ADMIN_EMAILS` | ❌ | Comma-separated admin emails for alerts |
| `POLL_INTERVAL_MINUTES` | ❌ | How often to check for policy changes (default: 5) |

---

## Role Reference

| Role | Capabilities |
|---|---|
| `super_admin` | Full access: manage tenants, users, approve/reject requests, rollback, audit |
| `ca_admin` | Approve/reject requests, view all data, rollback, manage tenants |
| `azure_admin` | Submit change requests, view their own requests and policies |
| `viewer` | Read-only access to policies and audit log |

---

## Workflow Guide

### Standard Change Workflow

```
Azure Admin           CA Guardian Admin          Azure Portal
     │                      │                        │
     │── Submit Request ──▶ │                        │
     │                      │── Review & Approve ──▶ │
     │                      │   (pre-backup created)  │
     │◀── Notification ─────│                        │
     │                      │                        │
     │────── Apply change in Azure ─────────────────▶│
     │                      │                        │
     │                      │◀── Change Detected ────│
     │                      │    (post-backup created)│
     │                      │── Review & Complete ──▶ │
     │                      │   (policy re-locked)    │
```

### Rollback

1. Navigate to **Policies → [Policy Name]**
2. In the **Version History** sidebar, find the target version
3. Click **Restore** next to the version
4. Confirm the rollback in the dialog
5. The rollback is applied to Azure immediately and a new version is created

---

## Security Considerations

- All CA policies are locked by default — no changes can be made without an explicit admin-approved unlock
- Unlock periods auto-expire after 2 hours
- All actions are recorded in the immutable audit log
- JWT tokens expire after 8 hours
- Client secrets are stored encrypted at the application layer (add your own KMS integration for production)
- API rate limiting is enabled (100 requests per 15 minutes per IP)
- All API routes require authentication; sensitive routes require specific roles
- CORS is locked to the configured frontend URL only
- Helmet.js security headers are applied to all responses

---

## Troubleshooting

**"Failed to acquire access token"**
→ Verify your `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and `AZURE_TENANT_ID` in `.env`
→ Ensure admin consent has been granted for all required Graph API permissions

**Policies not appearing after sync**
→ Check the backend logs: `docker compose logs backend`
→ Verify `Policy.Read.All` permission is granted with admin consent

**Email notifications not sending**
→ Check `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` are configured
→ Test SMTP connectivity from the container: `docker compose exec backend sh`

**"Too many requests" errors**
→ Increase `RATE_LIMIT_MAX` in `.env` for high-traffic deployments

**Database connection refused**
→ Ensure `DB_HOST=postgres` when running in Docker (not `localhost`)
→ Check: `docker compose ps` to verify the postgres container is healthy

---

## License

MIT © CA Guardian Contributors
