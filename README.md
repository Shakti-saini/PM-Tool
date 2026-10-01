# Orbit — real-time project and task management

Orbit is a MERN workspace for assigning projects and tasks to teams, tracking progress, and sharing comments and notifications in real time. MongoDB is the source of truth; Express REST endpoints validate and persist changes; authenticated Socket.IO rooms deliver saved changes to the relevant users. Redis's Socket.IO adapter supports broadcasts across backend instances.

## Roles and access

- **Admin:** creates, edits, and deletes projects and tasks; sets project start/deadline dates; assigns users to projects and tasks; sets task status, priority, deadline, and assignee; and views every project and task on the Admin Dashboard.
- **User:** sees only projects assigned to them and only tasks assigned to them within those projects. Users can change the status of their tasks and post comments or attachments. They cannot use admin APIs to edit project metadata or task assignments.
- New self-registered accounts always receive the `user` role. Registration never accepts a role from the client. Promote an account to admin with the controlled command below.

The backend enforces these rules on every protected API route. Socket handshakes require a valid JWT, and project-room joins require admin access or project membership. Do not treat hidden frontend controls as a security boundary.

## Real-time behavior

After a successful database write, the server emits project metadata to membership-checked project rooms. Task details are sent only to administrator and relevant assignee private rooms, so another project member cannot inspect an unassigned task through socket payloads. A shared authenticated browser socket joins the current user's projects. Newly assigned projects are added immediately, removed projects leave the workspace, and task changes update open boards without refresh. Clients read and write through the API; sockets carry updates and notifications, never unauthenticated mutations.

Persisted in-app notifications cover project/task assignment, task reassignment or changes, status/deadline/priority updates, comments, and user activity reported to admins. The app shows an unread count and marks notifications read when the Notifications page opens (individual notification read endpoints are also available).

## Frontend structure

```text
frontend/src/
  components/       navigation, task cards/details, modal, shared UI and forms
    forms/          Formik/Yup authentication, project, task and member forms
  context/          auth, project workspace, socket and notification state
  layouts/          authenticated application shell
  pages/            login, role-aware dashboards, project board, team, notifications
  App.jsx           React Router routes and auth guard
  api.js            authenticated REST client
  socket.js         Socket.IO connection factory
```

Project and task content loads from backend APIs. The React forms use Formik and Yup, and React Router separates login, dashboards, project details, team management, and notifications.

## Architecture and design

See [Functional requirements](docs/functional-requirements.md) and [System design](docs/system-design.md) for the product requirements, architecture, data model, API, socket lifecycle, and trade-offs.

### Data and attachment storage

Users have `admin` or `user` roles. Projects retain an owner, assigned member references, start date, and deadline. Tasks include status, priority, assignee, deadline, and comments. Small attachments are stored as base64 data on task comments in MongoDB, with a 900 KB per-file limit in the browser and a maximum of three files per comment. This simple approach avoids a separate object-storage service for the assignment; production systems with larger files should move binary data to durable object storage and retain metadata in MongoDB.

## Requirements

- Node.js 22 or later and npm
- Docker Desktop / Docker Engine for local MongoDB and Redis, or accessible MongoDB and Redis services

## Local setup

1. Copy `backend/.env.example` to `backend/.env` and set `JWT_SECRET` to a random value of at least 32 characters. Copy `frontend/.env.example` to `frontend/.env` if you need non-default API URLs.
2. Start local data services: `docker compose up -d mongo redis`.
3. Install dependencies from the repository root: `npm install` (`npm.cmd install` in Windows PowerShell if script execution policy blocks `npm.ps1`).
4. Start both applications: `npm run dev` (`npm.cmd run dev` in Windows PowerShell when needed).
5. Create the admin with `npm run create-admin -w backend` (`npm.cmd run create-admin -w backend` in PowerShell). Set `ADMIN_EMAIL`, `ADMIN_NAME`, and a strong `ADMIN_PASSWORD` in `backend/.env`, or run the command in an interactive terminal to enter the email/name and type the password without displaying it. `MONGODB_URI` must be configured in `backend/.env`. The command creates a new account and fails without changing anything if the email is already registered.
6. Register additional accounts normally. They remain users and can be assigned from the admin project/task forms. To grant admin access to an existing account instead, use the separate `promote-admin` command.

The backend listens on `http://localhost:4000`; `GET /api/health` is its liveness endpoint. The frontend uses `VITE_API_URL` for REST and `VITE_SOCKET_URL` for Socket.IO. Defaults are in `frontend/src/api.js` and `frontend/src/socket.js`. Backend REST and socket CORS use comma-separated `CLIENT_ORIGIN` values.

### Environment variables

| Variable | Service | Purpose |
|---|---|---|
| `PORT` | Backend | HTTP port, default `4000` |
| `NODE_ENV` | Backend | Set `production` for production safeguards |
| `MONGODB_URI` | Backend | MongoDB connection string |
| `REDIS_URL` | Backend | Redis connection string; required in production |
| `JWT_SECRET` | Backend | JWT signing key; at least 32 characters in production |
| `JWT_EXPIRES_IN` | Backend | Token lifetime, default `1d` |
| `CLIENT_ORIGIN` | Backend | Allowed browser origin(s), comma-separated |
| `ADMIN_EMAIL` | Backend command | Account email created/promoted by admin setup commands |
| `ADMIN_NAME` | Backend command | Name for an admin account created with `create-admin` |
| `ADMIN_PASSWORD` | Backend command | Password for the new admin account, hashed with bcrypt before storage |
| `VITE_API_URL` | Frontend build | REST base URL, such as `https://api.example.com/api` |
| `VITE_SOCKET_URL` | Frontend build | Socket.IO origin, such as `https://api.example.com` |

## API and socket contracts

All API paths below are prefixed with `/api`. Register/login/health are public; all other routes require a bearer token. Admin-only routes are marked **Admin**. Users can only read tasks assigned to them and can only change the status of those tasks.

```text
POST   /auth/register                                      Create user account (role is always user)
POST   /auth/login                                         Login
GET    /auth/me                                            Current user and role
GET    /users                                              List users (Admin)
GET    /projects                                           Admin: all; User: assigned projects
GET    /tasks                                              Admin: all recent tasks; User: assigned tasks for dashboard
POST   /projects                                           Create project with start/deadline and assigned members (Admin)
GET    /projects/:projectId                               Read assigned project (Admin: any)
PATCH  /projects/:projectId                               Edit project and assignments (Admin)
DELETE /projects/:projectId                               Delete project and tasks (Admin)
POST   /projects/:projectId/members                       Assign an existing user by email (Admin)
DELETE /projects/:projectId/members/:userId               Unassign a user (Admin)
GET    /projects/:projectId/tasks                         Admin: all project tasks; User: assigned tasks
POST   /projects/:projectId/tasks                         Create task and assign user (Admin)
PATCH  /projects/:projectId/tasks/:taskId                 Admin: edit; User: status only
PATCH  /projects/:projectId/tasks/:taskId/status          Change task status (Admin or assignee)
POST   /projects/:projectId/tasks/:taskId/comments        Add comment and up to 3 small attachments
DELETE /projects/:projectId/tasks/:taskId                 Delete task (Admin)
GET    /notifications                                      List latest 50 and unread count
PATCH  /notifications/:notificationId/read                Mark one notification read
PATCH  /notifications/read-all                             Mark all notifications read
```

REST writes emit the corresponding events after persistence:

- Projects: `project:created`, `project:updated`, `project:deleted`, `project:members-updated`, `project:added`, and `project:removed`.
- Tasks: `task:created`, `task:updated`, `task:status-updated`, `task:deleted`, and `task:comment-added`.
- Private user room `user:<userId>`: `notification:new` carries the newly persisted notification.
- Client socket events: authenticated handshake with `auth.token`, `project:join { projectId }` (membership checked with acknowledgement), and `project:leave { projectId }`.

Errors use `{ error, details? }` with an appropriate HTTP status. Notifications are durable in MongoDB; socket delivery is immediate, and REST is used to load them after reconnect.

## Deployment (VM with Nginx)

1. Provision a Linux VM, DNS records for `app.example.com` and `api.example.com`, and MongoDB/Redis services with private network access and authentication.
2. Build and run the backend image from `backend/Dockerfile`; provide `NODE_ENV=production`, `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN=https://app.example.com`, and `PORT=4000` via the VM's secret/environment manager. Do not commit `.env` files.
3. Build the frontend image with `VITE_API_URL=https://api.example.com/api` and `VITE_SOCKET_URL=https://api.example.com`. Run it on localhost port `4173`.
4. Configure Nginx from [the sample config](deploy/nginx-teamboard.conf), issue TLS certificates, and forward WebSocket upgrade headers to Socket.IO.
5. Restrict MongoDB and Redis to private app networks, enable firewall rules for SSH/HTTP/HTTPS only, and configure backups and persistent storage. The attachment data currently resides in MongoDB.

The included Dockerfiles build the backend and static React client. `docker-compose.yml` provides local development data services; it is not a hardened production database deployment. No VM, DNS, credentials, or deployed URLs were supplied, so this repository is not deployed.

## Branching and CI

Use short-lived feature branches from `develop`, open pull requests into `develop`, and promote reviewed release commits from `develop` to `main`. Protect `main` with required review and CI checks; tag release commits. GitHub Actions in `.github/workflows/ci.yml` installs dependencies, runs lint, and builds the frontend on pull requests to `main` and pushes to `main`/`develop`.

## AI usage declaration

AI assistance (OpenAI Codex) was used to interpret the assignment, draft requirements/design documents, and implement the application and API integration. A maintainer should review security configuration, operational setup, and storage choices before production use.

## Current deployment URLs

Not deployed. Set these after deployment:

- Frontend: `https://app.example.com`
- Backend: `https://api.example.com`
- Loom video: not recorded
- Repository: this repository
