# Backend Reference

This README focuses on the backend services in this repository: the User Service (authentication, TOTP, user management) and the Notification Service (email invites).  

Contents
- Overview
- Quick dev commands
- Common environment variables
- User Service (detailed APIs)
- Notification Service (detailed APIs & MQ worker)
- Auth and role model
- Troubleshooting and debugging
- Production notes

## Overview

- User Service: auth, users, TOTP, roles. Runs on port 4000 by default.
- Notification Service: invite/email workflows, RabbitMQ-based job queue with a direct-mail fallback. Runs on port 5001 by default.

Both services are small Express apps and communicate over HTTP. The Notification Service calls the User Service endpoint `/api/users/invite-upsert` to create or update users when sending invites. JWTs issued by the User Service are trusted by the Notification Service; tokens must contain a `roles` claim.

## Quick dev commands

Run User Service (from repo root):
```powershell
cd User_Service
npm install
npm run dev
```

Run Notification Service (from repo root):
```powershell
cd Notification_Service
npm install
npm run dev   # runs node src/index.js
```

Run the email worker (separate terminal):
```powershell
cd Notification_Service
npm run worker:email
```

Run frontend (if needed):
```powershell
cd Frontend
npm install
npm run dev
```

## Common environment variables

These are the most relevant env vars for backend services. Many are defined in `Notification_Service/src/lib/config.js`.

- Shared/auth:
	- `JWT_SECRET` (required) — signing key used to verify tokens.
	- `JWT_AUD` (optional) — JWT audience.
	- `JWT_ISS` (optional) — JWT issuer.
- User Service:
	- `PORT` (default 4000)
	- `MONGO_URI` — MongoDB connection string
	- `JWT_EXPIRES_IN` — token expiration
	- rate limiting settings (optional)
- Notification Service:
	- `NOTIFICATION_PORT` (default 5001)
	- `ROLE_HIERARCHY` — comma-separated ordered list (lowest index = highest privilege)
	- `USER_SERVICE_URL` — URL of User Service (default `http://localhost:4000`)
	- Mail settings: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
	- MQ: `RABBITMQ_URL` (default `amqp://localhost`), `EMAIL_QUEUE` (default `email.invites`)

## Auth and role model

- JWTs: the Notification Service expects a Bearer token with a payload containing at least:

```json
{
	"sub": "<user-id>",
	"email": "admin@example.com",
	"roles": ["site_admin"]
}
```

- Role hierarchy is an ordered list (string array). Permission to assign a role is determined by index: an inviter may assign a role only if the inviter's role index in `ROLE_HIERARCHY` is less than the target role's index. See `Notification_Service/src/utils/roles.js`.

## User Service — API reference (port 4000)

Base path: `/api/users`

Authentication: login endpoints issue JWTs used across services.

Auth endpoints
- POST /api/users/auth/signup
	- Description: Register a new user.
	- Body: { email, password, name }
	- Response: 201 Created with user profile (or error)

- POST /api/users/auth/login
	- Description: Authenticate and get JWT.
	- Body: { email, password }
	- Response: { token: '<JWT>' }

- POST /api/users/auth/change-password
	- Description: Change a user's password. Intended for two use-cases:
	  1) First-login password change when the user was created with a temporary password (invite flow). In this case the client will receive a short-lived tempToken from the login response and must send it to this endpoint.
	  2) A logged-in user changing their own password (authenticated request).
	- Body:
	  - { newPassword: string, tempToken?: string }
	    - If `tempToken` is provided it must be the short-lived token returned by `POST /api/users/auth/login` when the server signals `PASSWORD_RESET_REQUIRED`.
	    - If `tempToken` is omitted, the request must include `Authorization: Bearer <JWT>` for the currently authenticated user.
	- Response: 200 OK with { message: 'Password changed successfully', user: <sanitized user> } on success. After changing a temporary password clients should re-authenticate with the new password.

	 

TOTP endpoints
- POST /api/users/auth/totp/setup
	- Generates TOTP secret for user; returns provisioning URI or QR data.
- POST /api/users/auth/totp/verify
	- Verify TOTP code during setup.
- POST /api/users/auth/login/totp
	Email OTP endpoints
	- POST /api/users/auth/email/setup
		- Generate a short-lived OTP and email it to the user (authenticated call).
	- POST /api/users/auth/email/verify
		- Verify email OTP during setup.
	- POST /api/users/auth/login/email
		- Verify email OTP during login flow (if Email OTP is enabled).
	- POST /api/users/auth/email/disable
	- POST /api/users/auth/email/resend
		- Resend the setup Email OTP (authenticated). Subject to rate-limiting.
	- POST /api/users/auth/login/email/resend
		- Resend a login Email OTP using the temporary login token (tempToken) returned by `POST /api/users/auth/login`.
		- Disable Email OTP for the account (authenticated call).
	- Verify TOTP during login flow (if TOTP is enabled).

User profile and management
- GET /api/users/users/me
	- Auth: Bearer
	- Response: current user profile

- PATCH /api/users/users/me
	- Auth: Bearer
	- Body: partial fields to update (name, password, etc.)

- GET /api/users/users
	- Auth: Bearer (admin)
	- Query: pagination/search params
	- Response: paginated list of users

Role and invite APIs
- POST /api/users/users/assign-role/:id
	- Auth: Bearer
	- Description: Assign a role to an existing user by id.
	- Body: { role: 'client_admin' }

- POST /api/users/users/invite-upsert
	- Auth: Bearer (inviter)
	- Description: Upsert a user by email when an invite is sent. If the user doesn't exist, the User Service will create the account with the provided `tempPassword`; if it exists, it will append the role if missing.
	- Body: { email, role, tempPassword, name }
	- Response: { created: true|false, user: { ... } }
	- Notes: This endpoint is called by the Notification Service during invite flows.

Errors and status codes
- 400 Bad Request — missing required fields
- 401 Unauthorized — missing/invalid token
- 403 Forbidden — insufficient permissions
- 404 Not Found — resource not found
- 500 Internal Server Error — unexpected failures

Implementation notes
- User models, TOTP, and JWT handling are implemented inside `User_Service/src` (controllers and services). When adjusting token contents, coordinate changes with `Notification_Service/src/middlewares/auth.js`.

## Notification Service — API & worker (port 5001)

Base path: `/api`

Auth: All invite routes require `Authorization: Bearer <JWT>` containing `roles` claim.

Invite endpoint
- POST /api/invites/send
	- Auth: Bearer
	- Body: { inviteeEmail, role, name }
	- Description: Request to invite a user and assign them a role.
	- Flow:
		1. `inviteService.sendInvite` normalizes the role and calls `utils/roles.canAssignRole(inviterRoles, targetRole)`.
		2. If allowed, it generates a temporary password and calls the User Service `/api/users/invite-upsert` with `{ email, role, tempPassword, name }`.
		3. Builds email content with `templates/invite.js`.
		4. Attempts to enqueue an email job via RabbitMQ (`lib/rabbit.publishEmailJob`). If this fails (no MQ), falls back to `lib/mailer.sendMail` which either sends via SMTP or logs in dev.
	- Response: 200 { message: 'Invitation email sent' } on success.
	- Errors: 403 when inviter lacks permission; 4xx/5xx when User Service or MQ fail.

Health
- GET /health
	- Returns { status: 'ok' }

Message queue & worker
- The Notification Service uses RabbitMQ to queue email jobs. Configurable by `RABBITMQ_URL` and `EMAIL_QUEUE` (defaults in `Notification_Service/src/lib/config.js`).
- Worker: `Notification_Service/src/workerEmail.js` consumes the queue and calls `lib/mailer.sendMail` to deliver messages. The worker acks/nacks and will attempt a single requeue for transient failures.

Mail delivery and dev fallback
- `lib/mailer.js` creates a nodemailer transport when `SMTP_HOST` is set. When not configured, a small dev transporter logs mail content instead of throwing — this is intentional for local development.

 