import { useMindMapFileOps, type UseMindMapFileOpsParams } from './useMindMapFileOps';
import { useMindMapLinks, type UseMindMapLinksParams } from './useMindMapLinks';


export interface DataFeaturesParams {
  fileOps: UseMindMapFileOpsParams;
  linkOps: UseMindMapLinksParams;
}

export const useDataFeatures = (params: DataFeaturesParams) => {
  const fileOps = useMindMapFileOps(params.fileOps);
  const linkOps = useMindMapLinks(params.linkOps);

  return {
    
    fileOps,

    
    linkOps
  };
};
