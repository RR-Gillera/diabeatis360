import { createElement } from 'react';

/** Web build of the call frame: the Daily room in an iframe (react-native-webview does not run on the web). */
export function CallFrame({ url }: { url: string }) {
  return createElement('iframe', {
    src: url,
    title: 'Video call',
    allow: 'camera; microphone; fullscreen; autoplay',
    style: { border: 0, height: '100%', width: '100%', backgroundColor: '#000' },
  });
}
