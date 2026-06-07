import {
  createAccountFromSignup,
  getAccountByEmail,
  getAccountById,
  getAccountByUsername,
} from "./accounts.js";
import {
  hashPassword,
  validateEmail,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "./password.js";

export function buildAppSession(account, spotifySession = null) {
  const session = {
    accountId: account.id,
    username: account.username,
    email: account.email,
    displayName: account.display_name || account.username || account.email,
    authType: "app",
  };

  if (spotifySession?.refresh_token) {
    return {
      ...spotifySession,
      ...session,
      user: spotifySession.user ?? null,
    };
  }

  return session;
}

export async function signupUser({ email, username, password }) {
  const emailError = validateEmail(email);
  if (emailError) throw new Error(emailError);

  const usernameError = validateUsername(username);
  if (usernameError) throw new Error(usernameError);

  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();

  if (await getAccountByEmail(normalizedEmail)) {
    throw new Error("An account with this email already exists");
  }
  if (await getAccountByUsername(normalizedUsername)) {
    throw new Error("This username is already taken");
  }

  const account = await createAccountFromSignup({
    email: normalizedEmail,
    username: normalizedUsername,
    passwordHash: hashPassword(password),
    displayName: normalizedUsername,
  });

  return buildAppSession(account);
}

export async function signinUser({ login, password }) {
  const identifier = login?.trim();
  if (!identifier || !password) {
    throw new Error("Enter your email or username and password");
  }

  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  const lowered = identifier.toLowerCase();
  const account =
    (await getAccountByUsername(lowered)) ||
    (await getAccountByEmail(lowered));

  if (!account?.password_hash) {
    throw new Error("Invalid email/username or password");
  }

  if (!verifyPassword(password, account.password_hash)) {
    throw new Error("Invalid email/username or password");
  }

  return buildAppSession(account);
}

export async function loadAccountSession(session) {
  if (!session?.accountId) return null;
  const account = await getAccountById(session.accountId);
  if (!account) return null;
  return buildAppSession(account, session.refresh_token ? session : null);
}
