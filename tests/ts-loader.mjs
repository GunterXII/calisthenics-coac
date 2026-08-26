import { stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !specifier.endsWith('.ts')) {
    try {
      const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
      const candidate = path.resolve(path.dirname(parent), specifier + '.ts');
      await stat(candidate);
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    } catch {}
  }
  return nextResolve(specifier, context);
}
