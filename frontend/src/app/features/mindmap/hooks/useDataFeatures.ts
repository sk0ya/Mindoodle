import { useMindMapFileOps, type UseMindMapFileOpsParams } from './useMindMapFileOps';
import { useMindMapLinks, type UseMindMapLinksParams } from './useMindMapLinks';

/**
 * データ管理機能の統合Hook
 *
 * ファイル操作とリンク管理を統合
 * 注: useMindMapPersistenceは最上位レベルで管理されるため、ここには含まれない
 */
export interface DataFeaturesParams {
  fileOps: UseMindMapFileOpsParams;
  linkOps: UseMindMapLinksParams;
}

export const useDataFeatures = (params: DataFeaturesParams) => {
  const fileOps = useMindMapFileOps(params.fileOps);
  const linkOps = useMindMapLinks(params.linkOps);

  return {
    // ファイル操作
    fileOps,

    // リンク管理
    linkOps
  };
};
