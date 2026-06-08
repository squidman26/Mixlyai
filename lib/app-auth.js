import {
  authenticateAppAccount,
  createAppAccount,
  getAccountByEmail,
  isEmailVerified,
} from "./accounts.js";
import { createAuthToken, TOKEN_TYPES } from "./email-tokens.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.js";

export async function signUp({ email, username, password }) {
  const account = await createAppAccount({ email, username, password });
  await sendAccountVerificationEmail(account);
  return account;
}

export async function signIn({ login, password, remember = true }) {
  const account = await authenticateAppAccount({ login, password });
  if (!account) return null;
  return buildAppSession(account, { remember });
}

export async function sendAccountVerificationEmail(account) {
  if (!account?.id || !account?.email || isEmailVerified(account)) {
    return { ok: true, skipped: true };
  }

  const { token } = await createAuthToken(account.id, TOKEN_TYPES.VERIFY_EMAIL);
  await sendVerificationEmail({ to: account.email, token });
  return { ok: true };
}

export async function resendVerificationEmail(email) {
  const account = await getAccountByEmail(email);
  if (!account?.id) {
    return { ok: true };
  }

  if (isEmailVerified(account)) {
    return { ok: true, alreadyVerified: true };
  }

  await sendAccountVerificationEmail(account);
  return { ok: true };
}

export async function requestPasswordReset(email) {
  const account = await getAccountByEmail(email);
  if (!account?.id || !account?.email) {
    return { ok: true };
  }

  const { token } = await createAuthToken(account.id, TOKEN_TYPES.RESET_PASSWORD);
  await sendPasswordResetEmail({ to: account.email, token });
  return { ok: true };
}

export function buildAppSession(account, { remember = true } = {}) {
  return {
    accountId: account.id,
    username: account.username,
    email: account.email,
    displayName: account.display_name || account.username,
    emailVerified: isEmailVerified(account),
    remember: remember !== false,
  };
}

export function isAppAuthenticated(session) {
  return Boolean(session?.accountId);
}
