/**
 * Force-Directed Layout - ベクトル類似度に基づく2Dレイアウト計算
 *
 * PCA（主成分分析）で高次元ベクトルを2次元に射影し、
 * その後force-directedで微調整します。
 */

export interface Node2D {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  vector: Float32Array;
}

export interface ForceDirectedLayoutOptions {
  width?: number;
  height?: number;
  iterations?: number;
  attractionStrength?: number;
  repulsionStrength?: number;
}

export class ForceDirectedLayout {
  private nodes: Node2D[] = [];
  private width: number;
  private height: number;
  private attractionStrength: number;
  private repulsionStrength: number;

  constructor(options: ForceDirectedLayoutOptions = {}) {
    this.width = options.width || 800;
    this.height = options.height || 600;
    this.attractionStrength = options.attractionStrength || 0.5;
    this.repulsionStrength = options.repulsionStrength || 5000;
  }

  /**
   * PCAで高次元ベクトルを2次元に射影
   */
  private projectToPCA(vectors: Float32Array[]): Array<{ x: number; y: number }> {
    const n = vectors.length;
    if (n === 0) return [];

    const dim = vectors[0].length;

    // 1. 中心化（平均を引く）
    const mean = new Float32Array(dim);
    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        mean[i] += vec[i];
      }
    }
    for (let i = 0; i < dim; i++) {
      mean[i] /= n;
    }

    const centered = vectors.map(vec => {
      const c = new Float32Array(dim);
      for (let i = 0; i < dim; i++) {
        c[i] = vec[i] - mean[i];
      }
      return c;
    });

    // 2. 共分散行列を計算（簡易版: ランダム投影を使用）
    // 完全なPCAは計算コストが高いため、ランダム投影で近似
    const projection1 = new Float32Array(dim);
    const projection2 = new Float32Array(dim);

    // ランダムな投影ベクトルを生成（正規化）
    for (let i = 0; i < dim; i++) {
      projection1[i] = Math.random() - 0.5;
      projection2[i] = Math.random() - 0.5;
    }

    // 正規化
    const norm1 = Math.sqrt(projection1.reduce((sum, v) => sum + v * v, 0));
    const norm2 = Math.sqrt(projection2.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < dim; i++) {
      projection1[i] /= norm1;
      projection2[i] /= norm2;
    }

    // 3. 各ベクトルを2次元に射影
    const projected = centered.map(vec => {
      let x = 0;
      let y = 0;
      for (let i = 0; i < dim; i++) {
        x += vec[i] * projection1[i];
        y += vec[i] * projection2[i];
      }
      return { x, y };
    });

    // 4. 画面サイズに正規化（画面いっぱいに広げる）
    const xs = projected.map(p => p.x);
    const ys = projected.map(p => p.y);

    // 最小値・最大値で正規化（シンプルに画面いっぱいに）
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const margin = 20;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    return projected.map(p => ({
      x: margin + ((p.x - minX) / rangeX) * (this.width - 2 * margin),
      y: margin + ((p.y - minY) / rangeY) * (this.height - 2 * margin),
    }));
  }

  /**
   * ノードデータをセット（PCAで初期配置）
   */
  setNodes(nodeData: Array<{ id: string; vector: Float32Array }>): void {
    // PCAで2次元座標を計算
    const positions = this.projectToPCA(nodeData.map(d => d.vector));

    this.nodes = nodeData.map((d, i) => ({
      ...d,
      x: positions[i].x,
      y: positions[i].y,
      vx: 0,
      vy: 0,
    }));

    // ノード数に応じて力の強度を動的に調整（微調整用）
    const nodeCount = this.nodes.length;
    const area = this.width * this.height;
    const targetAreaPerNode = area / nodeCount;

    // PCAで既に配置されているので、力は弱めに設定
    this.repulsionStrength = targetAreaPerNode * 0.5;
    this.attractionStrength = 0.05;
  }

  /**
   * コサイン類似度を計算
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dot / denominator;
  }

  /**
   * 1ステップのシミュレーション
   */
  step(alpha = 0.3): void {
    // 力の初期化
    for (const node of this.nodes) {
      node.vx = 0;
      node.vy = 0;
    }

    // ノード間の力を計算
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.sqrt(dx * dx + dy * dy) + 0.01; // ゼロ除算回避

        // コサイン類似度に基づく引力（類似度が高いほど引き合う）
        const similarity = this.cosineSimilarity(a.vector, b.vector);
        // 類似度を0-1から-1-1に変換して、非類似なものは反発するように
        const normalizedSimilarity = (similarity + 1) / 2; // 0-1に正規化

        // 理想距離を画面サイズとノード数から動的に計算
        // 画面全体に均等に配置するための基準距離
        const avgDimension = (this.width + this.height) / 2;
        const baseDistance = avgDimension / (Math.sqrt(this.nodes.length) * 1.5);

        // 類似度が高い → 近づける（baseDistance × 0.3）
        // 類似度が低い → 遠ざける（baseDistance × 3）
        const targetDistance = baseDistance * (0.3 + 2.7 * (1 - normalizedSimilarity));
        const attractionForce = this.attractionStrength * (distance - targetDistance);

        // 全体的な反発力（ノードが重ならないように）
        const repulsionForce = this.repulsionStrength / (distance * distance);

        // 合計の力
        const totalForce = attractionForce - repulsionForce;
        const fx = (dx / distance) * totalForce;
        const fy = (dy / distance) * totalForce;

        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // 中心への引力は削除（画面全体に広がるように）

    // 位置更新
    for (const node of this.nodes) {
      node.x += node.vx * alpha;
      node.y += node.vy * alpha;

      // 境界内に収める（マージン20px - より広く使う）
      const margin = 20;
      node.x = Math.max(margin, Math.min(this.width - margin, node.x));
      node.y = Math.max(margin, Math.min(this.height - margin, node.y));
    }
  }

  /**
   * 複数ステップのシミュレーション実行
   */
  simulate(iterations = 100): void {
    for (let i = 0; i < iterations; i++) {
      // アルファ値を徐々に減衰（初期は大きく移動、後半は微調整）
      // 非線形減衰で初期の広がりを強化
      const progress = i / iterations;
      const alpha = Math.max(0.01, Math.pow(1 - progress, 2));
      this.step(alpha);
    }
  }

  /**
   * 現在のノード座標を取得
   */
  getNodes(): Node2D[] {
    return this.nodes;
  }

  /**
   * レイアウトサイズを変更
   */
  resize(width: number, height: number): void {
    const scaleX = width / this.width;
    const scaleY = height / this.height;

    this.width = width;
    this.height = height;

    // ノード座標をスケール
    for (const node of this.nodes) {
      node.x *= scaleX;
      node.y *= scaleY;
    }
  }

  /**
   * エネルギー計算（収束判定用）
   */
  getTotalEnergy(): number {
    let energy = 0;
    for (const node of this.nodes) {
      energy += node.vx * node.vx + node.vy * node.vy;
    }
    return energy;
  }
}
