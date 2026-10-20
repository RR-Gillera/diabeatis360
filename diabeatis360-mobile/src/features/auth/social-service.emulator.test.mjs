// The app's REAL social sign-in service (src/features/auth/social-service.ts, DECISIONS.md D23) run against the Firebase Auth
// emulator, which accepts made-up Google and Facebook credentials (a JSON string standing in for the token). It shows what
// the app does with each kind of account Google or Facebook can send. The real Google/Facebook screens need a phone and are
// tested there (docs/TEST_LOG.md); this covers everything after the token comes back.
//
// Run from the repo root (needs Java for the emulators; touches no real project):
//   npm run test:social-login
// Without the emulators every test here is skipped, so `npm test` in the mobile app never needs them.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const emulators = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST;
const skip = emulators ? false : 'run inside: firebase emulators:exec --only auth,firestore (npm run test:social-login)';

const PROJECT = 'demo-diabeatis360';
const stamp = `${Date.now()}`;

let app, db, auth, authSdk, service, types;

// Stands in for the token Google or Facebook would return: the emulator reads these claims straight out of the string.
const googleToken = (name, extra = {}) => ({
  provider: 'google',
  token: JSON.stringify({ sub: `google-${name}-${stamp}`, email: `${name}.${stamp}@example.com`, email_verified: true, name, ...extra }),
});
const facebookToken = (name, extra = {}) => ({
  provider: 'facebook',
  token: JSON.stringify({ sub: `facebook-${name}-${stamp}`, email: `${name}.${stamp}@example.com`, name, ...extra }),
});
const mailsFor = async (email) => {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/oobCodes`);
  return (await response.json()).oobCodes.filter((code) => code.email === email && code.requestType === 'VERIFY_EMAIL');
};
const codeOf = async (promise) => { try { await promise; return 'ok'; } catch (error) { return error.code ?? error.message; } };

before(async () => {
  if (skip) return;
  ({ app, db, auth } = await import('@/firebase'));
  authSdk = await import('firebase/auth');
  service = await import('@/features/auth/social-service');
  types = await import('@/features/auth/social-types');
});

// Closes the Firebase clients so the process can end (open connections would keep it alive).
after(async () => {
  if (skip) return;
  await (await import('firebase/firestore')).terminate(db);
  await (await import('firebase/app')).deleteApp(app);
});

test('a Google account signs in at once: Firebase makes the login the first time and recognises it after that', { skip }, async () => {
  const token = googleToken('gina');
  const first = await service.signInWithSocialToken(token);
  assert.equal(first.isNewUser, true);
  assert.equal(first.user.email, `gina.${stamp}@example.com`);
  assert.equal(first.user.emailVerified, true, 'Google vouches for its emails, so no "check your email" step');
  assert.equal(first.user.displayName, 'gina');
  assert.equal(first.user.providerData[0].providerId, 'google.com', 'a Google token must become a Google login');
  assert.equal(first.verificationEmailSent, null, 'no email was due');
  assert.equal(auth.currentUser.uid, first.user.uid);
  assert.deepEqual(await mailsFor(first.user.email), [], 'no verification email for a confirmed address');

  await authSdk.signOut(auth);
  const again = await service.signInWithSocialToken(token);
  assert.equal(again.isNewUser, false);
  assert.equal(again.user.uid, first.user.uid, 'the same person gets the same account');
});

test('a new Facebook account whose email Facebook did not confirm is signed in and mailed the link', { skip }, async () => {
  const outcome = await service.signInWithSocialToken(facebookToken('fran', { email_verified: false }));
  assert.equal(outcome.isNewUser, true);
  assert.equal(outcome.user.emailVerified, false, 'the app will show "Check your email"');
  assert.equal(outcome.user.providerData[0].providerId, 'facebook.com', 'a Facebook token must become a Facebook login');
  assert.equal(outcome.verificationEmailSent, true);
  const mails = await mailsFor(outcome.user.email);
  assert.equal(mails.length, 1, 'exactly one verification email went out');
});

test('a Facebook person who comes back before confirming is not mailed a second time (the screen has Resend)', { skip }, async () => {
  const token = facebookToken('felix', { email_verified: false });
  const first = await service.signInWithSocialToken(token);
  assert.equal(first.verificationEmailSent, true);
  await authSdk.signOut(auth);

  const again = await service.signInWithSocialToken(token);
  assert.equal(again.isNewUser, false);
  assert.equal(again.verificationEmailSent, null);
  assert.equal((await mailsFor(first.user.email)).length, 1, 'still just the one email');
});

test('a Facebook account whose email Facebook did confirm needs no email', { skip }, async () => {
  const outcome = await service.signInWithSocialToken(facebookToken('flor', { email_verified: true }));
  assert.equal(outcome.user.emailVerified, true);
  assert.equal(outcome.verificationEmailSent, null);
  assert.deepEqual(await mailsFor(outcome.user.email), []);
});

test('a Facebook account with no email address is refused, and the login Firebase just made is removed again', { skip }, async () => {
  const token = { provider: 'facebook', token: JSON.stringify({ sub: `facebook-phone-only-${stamp}`, name: 'Phone Only' }) };
  const failure = await service.signInWithSocialToken(token).then(() => null, (error) => error);
  assert.ok(failure instanceof types.SocialLoginError);
  assert.equal(failure.failure, 'no-email');
  assert.match(types.socialErrorMessage(failure, 'facebook'), /Facebook did not share an email/);
  assert.equal(auth.currentUser, null, 'nobody is left signed in');

  // If the half-made login had been kept, this second try would find it ("not new"). It is a brand-new login again.
  const credential = authSdk.FacebookAuthProvider.credential(token.token);
  const retry = await authSdk.signInWithCredential(auth, credential);
  assert.equal(authSdk.getAdditionalUserInfo(retry).isNewUser, true, 'the first one really was deleted');
  await authSdk.deleteUser(retry.user);
});

test('a token that Firebase rejects signs nobody in and shows the generic message, not the raw error', { skip }, async () => {
  const code = await codeOf(service.signInWithSocialToken({ provider: 'google', token: 'this is not a token' }));
  assert.match(code, /^auth\//, 'Firebase reports its own error code');
  assert.equal(auth.currentUser, null);
  assert.equal(types.socialErrorMessage({ code }, 'google'), 'We could not sign you in with Google. Please try again.');
});
