// Lets plain Node run the app's own TypeScript service files in tests (see register-ts-alias.mjs).
// The app imports "@/features/x" (a path alias) and leaves out file extensions ("./types"), which Metro understands but
// Node does not, so this hook finds the file the way Metro would. "@/firebase" is replaced by firebase-for-node.mjs,
// because the real src/firebase.js needs React Native.
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..', 'src');
const srcUrl = pathToFileURL(src).href.toLowerCase(); // lower-case: Windows drive letters can differ in case ("d:" and "D:")
const firebaseForNode = path.join(here, 'firebase-for-node.mjs');
const extensions = ['.ts', '.tsx', '.js', '.mjs'];

function findFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const extension of extensions) if (existsSync(base + extension)) return base + extension;
  for (const extension of extensions) if (existsSync(path.join(base, `index${extension}`))) return path.join(base, `index${extension}`);
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/firebase') return { url: pathToFileURL(firebaseForNode).href, shortCircuit: true };
  let base = null;
  if (specifier.startsWith('@/')) base = path.join(src, specifier.slice(2));
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.toLowerCase().startsWith(srcUrl)) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  const file = base ? findFile(base) : null;
  return file ? { url: pathToFileURL(file).href, shortCircuit: true } : nextResolve(specifier, context);
}
