# Functional requirements — Orbit workspace

## Purpose

Orbit is a real-time project and task management workspace with administrator and user roles. MongoDB-backed changes are delivered to authorized connected clients using Socket.IO.

## Admin capabilities

- Create, edit, and delete projects with start dates and deadlines; assign and unassign registered users.
- Create, edit, and delete tasks; assign or reassign users; set status, priority, and deadline.
- View all projects and tasks, team users, task assignees, and current status.
- Receive in-app notifications for user task updates, status changes, completion, and comments.

## User capabilities

- View projects assigned to them and only tasks assigned to them.
- Change the status of assigned tasks and post comments with small file attachments.
- Receive live project/task assignments, reassignment, status/deadline/priority updates, and comments.
- View notifications, unread count, and mark notifications read.

## Real-time and authorization requirements

- Project/task writes use authenticated REST APIs and persist before emitting events.
- Socket.IO uses JWT-authenticated connections, private user rooms, and server-authorized project rooms.
- Newly assigned project/task information appears without manual refresh. Relevant board updates reach admins and task assignees as they occur.
- Every protected API enforces roles and assignment rules; a user cannot access admin-only operations or another user's task data.
- Public signup cannot select an admin role. An existing account must be explicitly promoted by an operator.

## UI requirements

- Role-aware admin and user dashboards, project list/details, task Kanban, task details/comments, notifications, and admin team management.
- Responsive layout, Formik/Yup forms, client-side routing, and API-backed project/task content.

## Assumptions and current implementation limits

- Users register before an admin can assign them; email invitations are not sent.
- Status is `todo`, `in-progress`, or `done`; priority is `low`, `medium`, or `high`.
- Comments support up to three small attachments; current files are stored as base64 in MongoDB and limited to 900 KB each in the UI.
- Redis is used by the Socket.IO adapter when configured and is required by the production startup guard.
- A reverse proxy provides TLS and environment secrets in deployment.

## Out of scope

- Email verification, password reset, SSO, and email delivery.
- Fine-grained organization/project permission hierarchies, audit log export, and durable socket event replay.
- Custom workflows, recurring tasks, billing, multi-tenant organizations, and mobile-native clients.

## Acceptance criteria

1. A new account registers as a user and can refresh a session until token expiry.
2. Admin-only project/task/team APIs reject normal user accounts.
3. Admins can assign users and manage project/task data through persisted APIs.
4. A user can only read assigned project/task records and can only change their own task status or comment on it.
5. Assignment, task, comment, and notification changes synchronize through authenticated sockets without refresh.
6. Unrelated accounts cannot retrieve protected project/task data or join project rooms.
7. Notifications persist, expose unread count, and can be marked read.
8. Invalid input and missing/expired credentials return non-2xx responses without exposing server internals.
