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

    for (const item of items) {
      const types: string[] = Array.from((item as unknown as { types?: Iterable<string> }).types || []);

      for (const type of types) {
        if (typeof type === 'string' && type.startsWith('image/')) {
          const blob: Blob = await item.getType(type);
          const ext = type.split('/')[1] || 'png';
          const file = new File([blob], `${filenamePrefix}-${Date.now()}.${ext}`, { type });
          return file;
        }
      }
    }

    throw new Error('クリップボードに画像がありません');
  } catch (error) {
    if (error instanceof Error && error.message === 'クリップボードに画像がありません') {
      throw error;
    }

    // Permission denied or other clipboard API error
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      throw new Error('クリップボードへのアクセスが拒否されました。ブラウザの権限設定を確認してください。');
    }

    throw new Error(`クリップボードの読み取りに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}
