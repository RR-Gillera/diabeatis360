// Use with:  node --import ./scripts/register-ts-alias.mjs --test <file>
// Teaches Node the app's "@/..." imports so a test can run the app's real service files (ts-alias-loader.mjs).
import { register } from 'node:module';

register('./ts-alias-loader.mjs', import.meta.url);
