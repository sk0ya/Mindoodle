/**
 * 座標・位置関連の定数
 */
export const COORDINATES = {
  // デフォルトキャンバス中心（サイドバー考慮でルートノードを左寄りに）
  DEFAULT_CENTER_X: 180, // サイドバー280px + マップエリア20%位置を考慮して調整
  DEFAULT_CENTER_Y: 300,

  // ルートノードのデフォルト位置（サイドバーを考慮）
  ROOT_NODE_X: 180, // サイドバー幅を考慮した左端中央位置
  ROOT_NODE_Y: 300,

  // 子ノードの初期オフセット
  CHILD_OFFSET_X: 250,
  CHILD_OFFSET_Y: 350,
};