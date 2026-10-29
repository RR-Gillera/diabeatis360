// Account rules (DECISIONS.md D37). Passwords: at least 8 characters, the usual minimum for an app that holds health data
// (Firebase's own default is 6). Checked on the sign-up form; the Firebase console's password policy can enforce it on
// the server too.
export const PASSWORD_MIN_LENGTH = 8;
