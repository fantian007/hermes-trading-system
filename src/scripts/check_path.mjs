console.log("__dirname:", import.meta.url);
// Check CWD
console.log("cwd:", process.cwd());
// Check if we can resolve
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
console.log("resolved dirname:", __dirname);
console.log("parent:", resolve(__dirname, '..'));
console.log("grandparent:", resolve(__dirname, '..', '..'));
