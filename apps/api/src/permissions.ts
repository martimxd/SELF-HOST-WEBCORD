import type { FastifyReply, FastifyRequest } from 'fastify';

export function isSuperAdmin(user: { isSuperAdmin: boolean } | undefined) {
  return user?.isSuperAdmin === true;
}

export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!isSuperAdmin(request.user)) {
    return reply.code(403).send({ error: 'Apenas o super-admin pode gerir utilizadores' });
  }
}
