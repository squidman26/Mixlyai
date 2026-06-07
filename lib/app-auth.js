import { authenticateAppAccount, createAppAccount } from "./accounts.js";

export async function signUp({ email, username, password }) {
  const account = await createAppAccount({ email, username, password });
  return buildAppSession(account);
}

export async function signIn({ login, password }) {
  const account = await authenticateAppAccount({ login, password });
  if (!account) return null;
  return buildAppSession(account);
}

export function buildAppSession(account) {
  return {
    accountId: account.id,
    username: account.username,
    email: account.email,
    displayName: account.display_name || account.username,
  };
}

export function isAppAuthenticated(session) {
  return Boolean(session?.accountId);
}
