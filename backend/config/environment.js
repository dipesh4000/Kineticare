import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(filename)) process.loadEnvFile(filename);

const groqFilename = fileURLToPath(new URL('../../.env.groq', import.meta.url));
if (existsSync(groqFilename)) process.loadEnvFile(groqFilename);
