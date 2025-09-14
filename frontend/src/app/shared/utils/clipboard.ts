export async function readClipboardImageAsFile(filenamePrefix = 'pasted-image'): Promise<File> {
  if (!navigator.clipboard || !('read' in navigator.clipboard)) {
    throw new Error('クリップボードAPIが利用できません');
  }
  const items = await (navigator.clipboard as any).read();
  for (const item of items) {
    for (const type of item.types) {
      if (type.startsWith('image/')) {
        const blob = await item.getType(type);
        const ext = type.split('/')[1] || 'png';
        const file = new File([blob], `${filenamePrefix}-${Date.now()}.${ext}`, { type });
        return file;
      }
    }
  }
  throw new Error('クリップボードに画像がありません');
}

