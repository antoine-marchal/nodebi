# NodeBI

NodeBI is a self-hosted dashboard designer built with Express, React, TypeScript, NeDB, and MongoDB.

## Quick start

```powershell
Copy-Item .env.example .env
npm run install:all
npm run dev
```

Before the first start, set strong random values for `JWT_SECRET`, `SHARE_SECRET`, and `ADMIN_PASSWORD`. The first process start creates the account named by `ADMIN_LOGIN` (default `admin`). In production, NodeBI refuses to start while these values are absent or use the documented placeholders.

## Roles and ownership

- `admin`: unrestricted access; manages users, namespaces, and namespace ACLs.
- `operator`: creates dashboards and edits, deletes, restores, or shares dashboards they own; can view other dashboards in accessible namespaces.
- `viewer`: read-only access to dashboards in accessible namespaces.

Every dashboard belongs to a namespace. The built-in `Default` namespace is visible to all authenticated users. Admins can create restricted namespaces and grant access by role or individual user from `/admin`.

Existing dashboards created before RBAC have no owner. They remain visible according to their namespace, but only an admin can modify them.

## Authentication configuration

Password authentication is always available at `/login`. NodeBI stores bcrypt password hashes and issues eight-hour JWT access tokens. User and role state is reloaded on every request, so a deleted or demoted user loses access immediately.

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signs login sessions; use at least 32 random bytes. |
| `ADMIN_LOGIN` | Initial administrator login, default `admin`. |
| `ADMIN_PASSWORD` | Initial administrator password, used only when creating that account. |
| `SHARE_SECRET` | Signs public read-only dashboard URLs. |
| `PUBLIC_URL` | Browser-visible NodeBI base URL used as the proxy-auth service URL. |
| `AUTH_TOKEN` | Optional legacy static token treated as an admin; leave blank for new deployments. |

### Authentication proxy / CAS-style SSO

Set both `NODEBI_PROXYAUTH_URL` and `NODEBI_PROXYAUTH_REGEX` to enable automatic SSO redirection. The explicit `/login` URL remains available as a password-login escape hatch.

```dotenv
PUBLIC_URL=https://nodebi.example.com
NODEBI_PROXYAUTH_NAME=ticket
NODEBI_PROXYAUTH_URL=https://sso.example.com/validate
NODEBI_PROXYAUTH_LOGIN_URL=https://sso.example.com/login
NODEBI_PROXYAUTH_REGEX=<cas:user>([^<]+)</cas:user>
```

Capture group 1 must return the login. The account must already exist in NodeBI; create it without a password for an SSO-only account.

## Dashboard sharing

An admin or operator owner can generate a signed, read-only URL from the dashboard designer. Links may expire after a configured number of days. Shared data queries are restricted to data sources embedded in that dashboard, and stored connection secrets are never returned to the browser.

## Verification

```powershell
npm run build
npm test --prefix server
```
