/**
 * Strictly resolves active userId from the authenticated JWT session.
 * Rejects untrusted query/body overrides and prevents leaking other users' data.
 */
export const resolveUserId = async (req: any): Promise<string> => {
  if (req.user?.userId) return req.user.userId;
  if (req.user?.id) return req.user.id;
  return "";
};
