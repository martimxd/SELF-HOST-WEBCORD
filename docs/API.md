# API

All authenticated routes use the `webcord_session` cookie.

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `POST /auth/initial-change`
- `GET|POST /admin/users`, `PATCH|DELETE /admin/users/:id`
- `GET /admin/stats`, `GET|PUT /admin/settings`
- `GET|POST /friends`, `POST /friends/:id/accept`
- `POST /friends/link`, `POST /invites/friend/:token`
- `DELETE /friends/:id`, `DELETE /friends/user/:userId`
- `GET|POST /direct-conversations`
- `POST /direct-groups`
- `GET|POST /direct-conversations/:id/messages`
- `POST /direct-conversations/:id/uploads`
- `POST /direct-conversations/:id/call-token`
- `POST /direct-conversations/:id/members`
- `DELETE /direct-conversations/:id/members/:userId`
- `GET|POST /servers`, `DELETE /servers/:id`
- `POST /servers/:id/invites`, `POST /invites/server/:token`
- `POST /servers/:id/channels`
- `GET|POST /channels/:id/messages`
- `POST /channels/:id/uploads`, `GET /uploads/:id`
- `GET /cdn/:token`
- `POST /channels/:id/call-token`
- `PATCH /users/me`, `POST|DELETE /users/me/avatar`, `PUT /users/me/presence`
- `GET /health`

Socket.IO events: `server:join`, `channel:join`, `dm:join`, `message:new`, `dm:message:new`, `dm:conversation:update`, `dm:member:removed`, `friend:update`, `presence:update`, `typing`, `channel:created`.
