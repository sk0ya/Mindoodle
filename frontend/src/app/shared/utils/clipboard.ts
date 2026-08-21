const findClipboardImage = async (items: ClipboardItem[]): Promise<{ blob: Blob; type: string } | null> => {
  for (const item of items) {
    const types: string[] = Array.from((item as unknown as { types?: Iterable<string> }).types || []);
    const imageType = types.find(type => type.startsWith('image/'));
    if (imageType) return { blob: await item.getType(imageType), type: imageType };
  }
  return null;
};

const normalizeClipboardError = (error: unknown): Error => {
  if (error instanceof Error && error.message === 'クリップボードに画像がありません') return error;
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return new Error('クリップボードへのアクセスが拒否されました。ブラウザの権限設定を確認してください。');
  }
  return new Error(`クリップボードの読み取りに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
};

export async function readClipboardImageAsFile(filenamePrefix = 'pasted-image'): Promise<File> {
  // Check if clipboard API is available
  if (!navigator.clipboard || !('read' in navigator.clipboard)) {
    throw new Error('クリップボードAPIが利用できません。HTTPSまたはlocalhostでアクセスしてください。');
  }

  const cb = navigator.clipboard as unknown as { read?: () => Promise<ClipboardItem[]> };
  const readFn = cb.read?.bind(navigator.clipboard);

  if (typeof readFn !== 'function') {
    throw new Error('クリップボードAPIが利用できません');
  }

  try {
    const items = await readFn();

    const image = await findClipboardImage(items);
    if (!image) throw new Error('クリップボードに画像がありません');
    const ext = image.type.split('/')[1] || 'png';
    return new File([image.blob], `${filenamePrefix}-${Date.now()}.${ext}`, { type: image.type });
  } catch (error) {
    throw normalizeClipboardError(error);
  }
}
