export function authErrorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with that email already exists. Sign in instead.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Use at least 8 characters, with a letter and a number.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match.";
    case "auth/network-request-failed":
      return "Network problem. Check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/missing-password":
      return "Enter a password.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google sign-in was cancelled.";
    case "auth/popup-blocked":
      return "The browser blocked the Google window. Allow popups and try again.";
    case "auth/account-exists-with-different-credential":
      return "That email already uses a password. Sign in with email instead.";
    case "auth/unauthorized-domain":
      return "This site is not allowed to use Google sign-in yet.";
    default:
      return fallback;
  }
}

export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use at least one letter and one number.";
  if (password !== confirm) return "Those passwords don't match.";
  return null;
}

export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  return value;
}
