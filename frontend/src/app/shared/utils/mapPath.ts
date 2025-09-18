export function relPathBetweenMapIds(fromId: string, toId: string): string {
  const fromSegs = (fromId.split('/') as string[]);
  fromSegs.pop();
  const toSegs = toId.split('/');
  let i = 0;
  while (i < fromSegs.length && i < toSegs.length && fromSegs[i] === toSegs[i]) i++;
  const up = new Array(fromSegs.length - i).fill('..');
  const down = toSegs.slice(i);
  const joined = [...up, ...down].join('/');
  return joined.length ? `${joined}.md` : `${toId.split('/').pop()}.md`;
}

export function relFilePathFromMap(fromMapId: string, filePath: string): string {
  const fromSegs = (fromMapId.split('/') as string[]);
  fromSegs.pop();
  const toSegs = filePath.split('/');
  let i = 0;
  while (i < fromSegs.length && i < toSegs.length && fromSegs[i] === toSegs[i]) i++;
  const up = new Array(fromSegs.length - i).fill('..');
  const down = toSegs.slice(i);
  const joined = [...up, ...down].join('/');
  return joined || filePath;
}

