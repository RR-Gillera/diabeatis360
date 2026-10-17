// Expo reads this file on top of app.json. app.json holds the plain settings; this file adds only what depends on IDs
// that are not committed (they live in the EAS environment, docs/GO_LIVE.md A10).
//
// Facebook sign-in needs the Meta app's ID and client token inside the installed app. Both are public identifiers, not
// secrets (the app secret goes only into the Firebase console), but they only exist once the Meta app has been created.
// Until then the plugin is left out, so every build still works and the Facebook button says it is not set up yet.
// Google needs no entry here: its ID (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) is read by the app's own code.
module.exports = ({ config }) => {
  const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  const facebookClientToken = process.env.FACEBOOK_CLIENT_TOKEN;

  if (!facebookAppId) return config;
  if (!facebookClientToken) {
    // Stop the build with a clear reason instead of shipping a half-configured Facebook button.
    throw new Error('EXPO_PUBLIC_FACEBOOK_APP_ID is set but FACEBOOK_CLIENT_TOKEN is not. Set both (docs/GO_LIVE.md A10).');
  }

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      [
        'react-native-fbsdk-next',
        {
          appID: facebookAppId,
          clientToken: facebookClientToken,
          displayName: 'Diabeatis360',
          scheme: `fb${facebookAppId}`,
          // Nothing is sent to Facebook unless someone taps the Facebook button: the SDK does not start by itself (the app
          // starts it just before login), logs no app events and collects no advertising ID.
          isAutoInitEnabled: false,
          autoLogAppEventsEnabled: false,
          advertiserIDCollectionEnabled: false,
        },
      ],
    ],
  };
};
