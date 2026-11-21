export async function readFirstStreamText(iterator) {
  let firstText = '';
  while (!firstText) {
    const { value, done } = await iterator.next();
    if (done) break;
    firstText = value.text();
  }
  if (!firstText) throw new Error('Empty reply');
  return firstText;
}
