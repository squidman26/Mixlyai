import { authenticateAppAccount, createAppAccount } from "./accounts.js";

export async function signUp({ email, username, password, remember = true }) {
  const account = await createAppAccount({ email, username, password });
  return buildAppSession(account, { remember });
}

export async function signIn({ login, password, remember = true }) {
  const account = await authenticateAppAccount({ login, password });
  if (!account) return null;
  return buildAppSession(account, { remember });
}

export function buildAppSession(account, { remember = true } = {}) {
  return {
    accountId: account.id,
    username: account.username,
    email: account.email,
    displayName: account.display_name || account.username,
    remember: remember !== false,
  };
}

export function isAppAuthenticated(session) {
  return Boolean(session?.accountId);
}
