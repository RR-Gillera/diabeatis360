import { WebView } from 'react-native-webview';

/**
 * The video call itself: Jitsi loaded INSIDE the app (native), so nothing looks like a raw link and it works in
 * Expo Go. The .web.tsx twin of this file uses an iframe. Needs a real phone to test camera/microphone.
 */
export function CallFrame({ url }: { url: string }) {
  return (
    <WebView
      source={{ uri: url }}
      style={{ flex: 1, backgroundColor: '#000' }}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      startInLoadingState
    />
  );
}
