import { WebView } from 'react-native-webview';

/**
 * The video call itself: the private Daily room (DECISIONS.md D27) loaded INSIDE the app (native), so nothing looks like
 * a raw link and it works in Expo Go. The .web.tsx twin of this file uses an iframe. The camera and microphone must
 * already be allowed (ensureCallPermissions in video-room.ts): on Android the WebView can only pass on what the app has.
 * Needs a real phone to test camera/microphone.
 */
export function CallFrame({ url }: { url: string }) {
  return (
    <WebView
      source={{ uri: url }}
      style={{ flex: 1, backgroundColor: '#000' }}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      startInLoadingState
    />
  );
}
