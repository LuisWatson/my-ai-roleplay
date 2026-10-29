export async function resolve(specifier, context, nextResolve) {
  let result;
  try {
    result = await nextResolve(specifier, context);
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.')) throw error;
    result = await nextResolve(`${specifier}.js`, context);
  }
  const lib = new URL('../lib/', import.meta.url).href;
  const constants = new URL('../constants/', import.meta.url).href;
  if (result.url.endsWith('.js') && (result.url.startsWith(lib) || result.url.startsWith(constants))) {
    return { ...result, format: 'module' };
  }
  return result;
}
