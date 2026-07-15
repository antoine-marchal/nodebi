# NodeBI

NodeBI is a self-hosted business-intelligence workspace for building, viewing, and securely sharing dashboards. It combines a React dashboard designer with an Express API and supports both embedded NeDB data and MongoDB data sources.

The Windows release is a single `nodebi.exe` containing the server and browser application. Runtime configuration stays in a `.env` file beside the executable; persistent data is written to a separate `data\` directory so upgrades do not overwrite it.

## Features

- Drag-and-drop dashboard design with charts, tables, KPIs, gauges, text, metric groups, and chart groups.
- MongoDB aggregation pipelines and local NeDB data sources.
- Dashboard import/export, revisions, restore, full-screen viewing, and PDF/image export.
- Signed read-only sharing links with optional expiration.
- Password authentication and optional CAS-style proxy authentication.
- `admin`, `operator`, and `viewer` roles, dashboard ownership, namespaces, and per-user namespace access.
- Light, dark, and system themes.
- Windows executable packaging with the web client embedded.
- Health endpoint exposing status, build version, and current server time.

## Requirements

For development or building a release:

- Windows 10/11 or Windows Server 2019 or later.
- Node.js 20 or later and npm 10 or later.
- PowerShell or Command Prompt.
- MongoDB only when dashboards use MongoDB data sources; NodeBI itself uses embedded NeDB files.

Running the packaged `nodebi.exe` does not require a separate Node.js installation.

## Quick start for development

```powershell
git clone <repository-url> nodebi
Set-Location nodebi
Copy-Item .env.example .env
npm run install:all
npm run dev
```

Open `http://localhost:3000`. The Vite development server proxies `/api` to the Express server on `http://localhost:3001`.

Before first start, replace `JWT_SECRET`, `SHARE_SECRET`, and `ADMIN_PASSWORD` in `.env`. Generate each signing secret independently:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The first server start creates the account named by `ADMIN_LOGIN`. `ADMIN_PASSWORD` is only used if that initial administrator does not already exist.

## Build the Windows release

Run:

```bat
build.bat
```

The script performs a reproducible install from all three lockfiles, runs linting and server tests, builds the server and client, packages the client into the executable, and produces:

```text
release\
├── nodebi.exe
└── .env
```

If `release\.env` already exists, the build preserves it. Otherwise the script copies `.env.production` when that private file exists, or creates `.env` from `.env.production.example`. Placeholder secrets deliberately make NodeBI refuse to start; edit them first.

`npm ci` must replace dependency directories, so stop running NodeBI/Vite development processes before invoking the normal build. For an already-installed, unchanged checkout, `build.bat --skip-install` skips only dependency installation and still runs linting, tests, both production builds, and executable packaging.

Start the release from its directory:

```powershell
Set-Location release
.\nodebi.exe
```

On first successful start NodeBI creates `release\data\`. Open the URL configured by `PUBLIC_URL` (for a local test, use `http://localhost:3001`). The executable always enforces production safety checks, even if `NODE_ENV` is accidentally changed.

### Release a new version

Use a semantic version without a leading `v`:

```bat
setversion.bat 1.2.0
build.bat
```

`setversion.bat` validates the version and updates the root, server, and client manifests and lockfiles plus the server runtime constant. The client build reads the root version automatically. The version appears in the application product mark (including the login and main headers), startup log, and `/api/health`.

Review and commit the version changes before publishing the executable. Keep old release artifacts until the upgraded instance has passed its health and login checks.

## Configuration

NodeBI loads `.env` from the repository root in source mode and from the executable directory in packaged mode. Process environment variables can also be used; values already present in the process take precedence over `.env`.

| Variable | Default | Description |
|---|---:|---|
| `NODE_ENV` | `development` | Use `production` for a source-built deployment. Packaged builds always use production behavior. |
| `PORT` | `3001` | HTTP listen port. |
| `DATA_DIR` | See below | Absolute or working-directory-relative runtime data directory. Leave empty for the standard location. |
| `ALLOWED_ORIGIN` | `*` | One origin or a comma-separated list accepted by CORS. Set the public HTTPS origin in production. |
| `PUBLIC_URL` | `http://localhost:<PORT>` | Externally visible base URL used for sharing and proxy-auth service URLs. Do not include a trailing slash. |
| `JWT_SECRET` | Development fallback | Secret signing eight-hour access tokens. Production requires a non-placeholder value. |
| `SHARE_SECRET` | Development fallback | Separate secret signing public share links. Production requires a non-placeholder value. |
| `ADMIN_LOGIN` | `admin` | Login for the administrator created when the user database is empty. Normalized to lowercase. |
| `ADMIN_PASSWORD` | Development fallback | Initial administrator password. Production requires a non-placeholder value. |
| `AUTH_TOKEN` | Empty | Legacy static token with administrator privileges. Leave empty for new deployments. |
| `ENABLE_SEED` | `false` | Enables development seed behavior. Keep `false` in production. |
| `MAX_RESPONSE_ROWS` | `10000` | Maximum rows returned from a query. Use a value appropriate for server memory and browser rendering. |
| `CLIENT_DIST` | Built-in path | Optional external client build path. Normally leave empty, especially for the executable. |
| `NODEBI_PROXYAUTH_NAME` | `ticket` | Query parameter containing the authentication proxy ticket. |
| `NODEBI_PROXYAUTH_URL` | Empty | Server-side ticket validation endpoint. Setting this with a regex enables proxy authentication. |
| `NODEBI_PROXYAUTH_LOGIN_URL` | Derived | Browser login endpoint; defaults by changing a trailing `/validate` to `/login`. |
| `NODEBI_PROXYAUTH_REGEX` | Empty | Validation-response regex; capture group 1 must contain the NodeBI login. |

In source mode, default application databases live under `server\data\`. In packaged mode they live under `data\` beside the executable. Relative `DATA_DIR` values resolve from the process working directory, so an absolute path is recommended for a Windows service.

### Minimal production `.env`

```dotenv
NODE_ENV=production
PORT=3001
ALLOWED_ORIGIN=https://nodebi.example.com
PUBLIC_URL=https://nodebi.example.com
JWT_SECRET=<independent-random-secret>
SHARE_SECRET=<different-independent-random-secret>
ADMIN_LOGIN=admin
ADMIN_PASSWORD=<long-unique-initial-password>
ENABLE_SEED=false
MAX_RESPONSE_ROWS=10000
```

NodeBI refuses to start in production if a required secret is absent or still uses a documented placeholder.

## Authentication and authorization

Password authentication is always available at `/login`. Passwords are stored as bcrypt hashes. The server issues eight-hour JWT access tokens and reloads the user and role on every authenticated request, so deleting or demoting a user takes effect immediately.

Roles are:

- `admin`: unrestricted dashboard and administration access; manages users, namespaces, and access lists.
- `operator`: creates dashboards and edits, deletes, restores, or shares dashboards they own; views other dashboards in accessible namespaces.
- `viewer`: read-only access to dashboards in accessible namespaces.

Every dashboard belongs to a namespace. The built-in `Default` namespace is available to all authenticated users. Admins can create restricted namespaces and grant access by role or individual account. Legacy dashboards without an owner remain visible according to namespace rules, but only an administrator can modify them.

### CAS-style authentication proxy

Set both `NODEBI_PROXYAUTH_URL` and `NODEBI_PROXYAUTH_REGEX` to enable automatic SSO redirection:

```dotenv
PUBLIC_URL=https://nodebi.example.com
NODEBI_PROXYAUTH_NAME=ticket
NODEBI_PROXYAUTH_URL=https://sso.example.com/validate
NODEBI_PROXYAUTH_LOGIN_URL=https://sso.example.com/login
NODEBI_PROXYAUTH_REGEX=<cas:user>([^<]+)</cas:user>
```

Capture group 1 must return the login. The account must already exist in NodeBI; create it without a password for an SSO-only account. The explicit `/login` path remains available as a password-login escape hatch.

## Dashboard data and secrets

Application metadata is stored in NeDB files:

```text
data\
├── dashboards.db
├── namespaces.db
├── revisions.db
├── users.db
├── secrets\       # encrypted/stored connection material managed by the app
└── user\          # local user data sources
```

MongoDB connection configuration can be attached to dashboard data sources. Stored connection secrets are not returned to the browser. Shared links can only query data sources embedded in the shared dashboard.

Treat the complete data directory and `.env` as sensitive. Never commit them or include them in a public release archive.

## Backup, restore, and upgrade

For a consistent backup:

1. Stop NodeBI or prevent writes.
2. Copy the entire `data\` directory and `.env` to protected storage.
3. Record the running version from `/api/health`.
4. Restart NodeBI and confirm the health endpoint.

To restore, stop NodeBI, replace the complete data directory and matching `.env`, then restart. Restore all database files together because dashboards, revisions, namespaces, users, and stored secrets refer to one another.

To upgrade the executable:

1. Back up `.env` and `data\`.
2. Stop the old process.
3. Replace only `nodebi.exe`; do not replace `.env` or `data\`.
4. Start it and verify `/api/health`, administrator login, one dashboard query, and one share link if sharing is used.
5. Keep the previous executable until validation is complete; rollback consists of stopping the new process and restoring the old executable and, if a future release includes a migration, its matching backup.

There is currently no automatic database migration framework. Review release notes and test upgrades against a copied data directory before production rollout.

## Reverse proxy and TLS

NodeBI serves HTTP. Terminate TLS at a reverse proxy and forward requests to `127.0.0.1:3001`. Preserve the host and forwarding headers and allow long enough timeouts for dashboard queries.

Example nginx site:

```nginx
server {
    listen 443 ssl http2;
    server_name nodebi.example.com;

    ssl_certificate     /etc/letsencrypt/live/nodebi.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nodebi.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Set `PUBLIC_URL` and `ALLOWED_ORIGIN` to `https://nodebi.example.com`. Restrict direct access to the NodeBI port with the host firewall.

## Health and operations

The unauthenticated health endpoint is:

```http
GET /api/health
```

Example response:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-07-14T18:00:00.000Z"
}
```

PowerShell check:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
```

The endpoint confirms that Express is accepting requests; it does not currently test every database or external MongoDB connection. Monitor process availability, HTTP status/latency, disk free space, data-directory backup success, and failed login/reverse-proxy logs.

For unattended Windows operation, run the executable under a dedicated low-privilege service account using a service wrapper or your organization’s process manager. Grant that account read access to `nodebi.exe` and `.env`, write access only to `DATA_DIR`, and network access only to required MongoDB/SSO endpoints. Configure the service working directory explicitly and use an absolute `DATA_DIR`.

## Production checklist

- Build from a clean, reviewed commit and retain the lockfiles.
- Run `build.bat` and require all lint, test, and build steps to pass.
- Run `npm audit --omit=dev` in the root, `server`, and `client` packages.
- Use unique high-entropy `JWT_SECRET` and `SHARE_SECRET` values.
- Change the initial administrator password and store it in an approved secret manager.
- Leave `AUTH_TOKEN` empty and `ENABLE_SEED=false` unless explicitly required.
- Set exact `PUBLIC_URL` and `ALLOWED_ORIGIN` HTTPS origins.
- Put NodeBI behind TLS and restrict direct access to its listen port.
- Run under a dedicated non-administrator account.
- Put `DATA_DIR` on persistent storage with monitored, tested backups.
- Test login, role restrictions, namespace access, dashboard queries, exports, and share-link expiration.
- Monitor `/api/health`, logs, disk usage, and backup jobs.

## Repository layout

```text
nodebi\
├── client\                 React, Vite, Material UI, Zustand
│   └── src\
│       ├── components\     Designer controls and widget renderers
│       ├── pages\          Login, home, designer, viewer, sharing, admin
│       ├── services\       API and widget-data clients
│       └── store\          Dashboard/editor state
├── server\                 Express and TypeScript API
│   └── src\
│       ├── db\             NeDB/MongoDB adapters
│       └── routes\         Auth, dashboards, namespaces, query, sharing
├── .env.example            Development configuration template
├── .env.production.example Production configuration template
├── build.bat               Verified Windows executable build
├── setversion.bat          Coordinated semantic-version update
└── package.json            Workspace scripts and executable metadata
```

## npm commands

| Command | Purpose |
|---|---|
| `npm run install:all` | Install root, server, and client dependencies for development. |
| `npm run ci:all` | Reproduce all installs exactly from lockfiles. |
| `npm run dev` | Run Vite and Express concurrently with reload behavior. |
| `npm run lint` | Lint both TypeScript projects. |
| `npm test` | Run server tests once. |
| `npm run build` | Compile the server and create the Vite production bundle. |
| `npm run check` | Run lint, tests, and production builds. |
| `npm run package:win` | Build and package `release\nodebi.exe`. |
| `npm start` | Run the already-built server with Node in production mode. |

## Testing and validation

```powershell
npm run check
npm audit --omit=dev
npm audit --omit=dev --prefix server
npm audit --omit=dev --prefix client
```

Before a release, also launch the packaged executable with a temporary production `.env` and data directory, verify `/api/health`, sign in, create and reopen a dashboard, and test the data-source types used by the target environment.

## Troubleshooting

### The executable exits immediately

Run it from PowerShell to retain the error output. Production startup intentionally fails when `JWT_SECRET`, `SHARE_SECRET`, or `ADMIN_PASSWORD` is absent or still a placeholder. Confirm that the file is named exactly `.env` and is beside `nodebi.exe`.

### The browser shows no application

Check `/api/health`, confirm the configured port is listening, and inspect reverse-proxy logs. The client is embedded in the executable; `CLIENT_DIST` should normally be empty. A wrong non-empty `CLIENT_DIST` overrides the embedded location.

### Login succeeds in development but not behind a proxy

Confirm `PUBLIC_URL` and `ALLOWED_ORIGIN` use the browser-visible HTTPS origin exactly. Verify proxy forwarding headers and ensure the browser is not reaching a different NodeBI instance or stale frontend.

### Data is written to an unexpected directory

Packaged releases default to `data\` beside `nodebi.exe`. A relative `DATA_DIR` follows the service working directory. Use an absolute path for services and scheduled environments.

### MongoDB queries fail

Verify network/DNS access from the NodeBI service account, credentials, database and collection names, and MongoDB authorization. Production errors intentionally suppress sensitive filesystem and connection details; use server logs and a controlled test environment for diagnosis.

### The build cannot replace `nodebi.exe`

Stop the running executable before rebuilding. Windows locks executable files while the process is active. Antivirus scanning can also briefly retain the file; wait for the scan or configure an approved build-directory exception.

## Known limitations

- The embedded NeDB store is suited to a single NodeBI process; do not run multiple instances against the same data directory.
- The health endpoint is a liveness check, not a full dependency-readiness check.
- Rate limiting is process-local and is not shared across multiple instances.
- Large Handsontable and visualization dependencies make the browser bundle sizable; slow clients may benefit from future code splitting.
- Automated database migrations and built-in Windows service installation are not yet provided.

## Contributing

Create a focused branch, keep generated output and runtime data untracked, add or update tests for server behavior, and run `npm run check` before opening a change. Do not commit `.env`, databases, connection secrets, `release\`, or dependency directories. Version changes should be made only with `setversion.bat`.

## License

No open-source license has been granted. The package metadata is marked `UNLICENSED`; obtain permission from the project owner before redistribution.
