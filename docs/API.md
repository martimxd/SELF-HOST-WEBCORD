# API

All authenticated routes use the `webcord_session` cookie.

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `POST /auth/initial-change`
- `GET|POST /admin/users`, `PATCH|DELETE /admin/users/:id`
- `GET|POST /admin/registration-invites`, `DELETE /admin/registration-invites/:id`
- `GET /registration-invites/:token`, `POST /registration-invites/:token/register`
- `GET /admin/stats`, `GET|PUT /admin/settings`
- `GET|POST /friends`, `POST /friends/:id/accept`
- `POST /friends/link`, `POST /invites/friend/:token`
- `DELETE /friends/:id`, `DELETE /friends/user/:userId`
- `POST|DELETE /blocks/:userId`
- `GET|POST /direct-conversations`
- `POST /direct-groups`
- `GET|POST /direct-conversations/:id/messages`
- `GET /direct-conversations/:id/search`
- `POST /direct-conversations/:id/uploads`
- `POST /direct-conversations/:id/call-token`
- `POST /direct-conversations/:id/members`
- `DELETE /direct-conversations/:id/members/:userId`
- `GET|POST /servers`, `DELETE /servers/:id`
- `POST /servers/:id/invites`, `POST /invites/server/:token`
- `POST /servers/:id/channels`
- `POST|DELETE /servers/:id/image`
- `GET|POST /channels/:id/messages`
- `GET /channels/:id/search`
- `POST /channels/:id/uploads`, `GET /uploads/:id`
- `GET /cdn/:token`
- `POST /channels/:id/call-token`
- `GET|POST /stickers`, `DELETE /stickers/:id`, `GET /stickers/content/:token`
- `GET /giphy/search`, `POST /giphy/analytics`
- `GET /forward-targets`, `POST /messages/forward`
- `PATCH /users/me`, `POST|DELETE /users/me/avatar`, `PUT /users/me/presence`
- `GET /health`

Socket.IO events: `server:join`, `channel:join`, `dm:join`, `message:new`, `dm:message:new`, `dm:conversation:update`, `dm:member:removed`, `friend:update`, `presence:update`, `typing`, `channel:created`.
