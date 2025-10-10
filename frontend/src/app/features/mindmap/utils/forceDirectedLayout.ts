

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

  
  private projectToPCA(vectors: Float32Array[]): Array<{ x: number; y: number }> {
    const n = vectors.length;
    if (n === 0) return [];

    const dim = vectors[0].length;

    
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

    
    
    const projection1 = new Float32Array(dim);
    const projection2 = new Float32Array(dim);

    
    for (let i = 0; i < dim; i++) {
      projection1[i] = Math.random() - 0.5;
      projection2[i] = Math.random() - 0.5;
    }

    
    const norm1 = Math.sqrt(projection1.reduce((sum, v) => sum + v * v, 0));
    const norm2 = Math.sqrt(projection2.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < dim; i++) {
      projection1[i] /= norm1;
      projection2[i] /= norm2;
    }

    
    const projected = centered.map(vec => {
      let x = 0;
      let y = 0;
      for (let i = 0; i < dim; i++) {
        x += vec[i] * projection1[i];
        y += vec[i] * projection2[i];
      }
      return { x, y };
    });

    
    const xs = projected.map(p => p.x);
    const ys = projected.map(p => p.y);

    
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

  
  setNodes(nodeData: Array<{ id: string; vector: Float32Array }>): void {
    
    const positions = this.projectToPCA(nodeData.map(d => d.vector));

    this.nodes = nodeData.map((d, i) => ({
      ...d,
      x: positions[i].x,
      y: positions[i].y,
      vx: 0,
      vy: 0,
    }));

    
    const nodeCount = this.nodes.length;
    const area = this.width * this.height;
    const targetAreaPerNode = area / nodeCount;

    
    this.repulsionStrength = targetAreaPerNode * 0.5;
    this.attractionStrength = 0.05;
  }

  
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

  
  step(alpha = 0.3): void {
    
    for (const node of this.nodes) {
      node.vx = 0;
      node.vy = 0;
    }

    
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.sqrt(dx * dx + dy * dy) + 0.01; 

        
        const similarity = this.cosineSimilarity(a.vector, b.vector);
        
        const normalizedSimilarity = (similarity + 1) / 2; 

        
        
        const avgDimension = (this.width + this.height) / 2;
        const baseDistance = avgDimension / (Math.sqrt(this.nodes.length) * 1.5);

        
        
        const targetDistance = baseDistance * (0.3 + 2.7 * (1 - normalizedSimilarity));
        const attractionForce = this.attractionStrength * (distance - targetDistance);

        
        const repulsionForce = this.repulsionStrength / (distance * distance);

        
        const totalForce = attractionForce - repulsionForce;
        const fx = (dx / distance) * totalForce;
        const fy = (dy / distance) * totalForce;

        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    

    
    for (const node of this.nodes) {
      node.x += node.vx * alpha;
      node.y += node.vy * alpha;

      
      const margin = 20;
      node.x = Math.max(margin, Math.min(this.width - margin, node.x));
      node.y = Math.max(margin, Math.min(this.height - margin, node.y));
    }
  }

  
  simulate(iterations = 100): void {
    for (let i = 0; i < iterations; i++) {
      
      
      const progress = i / iterations;
      const alpha = Math.max(0.01, Math.pow(1 - progress, 2));
      this.step(alpha);
    }
  }

  
  getNodes(): Node2D[] {
    return this.nodes;
  }

  
  resize(width: number, height: number): void {
    const scaleX = width / this.width;
    const scaleY = height / this.height;

    this.width = width;
    this.height = height;

    
    for (const node of this.nodes) {
      node.x *= scaleX;
      node.y *= scaleY;
    }
  }

  
  getTotalEnergy(): number {
    let energy = 0;
    for (const node of this.nodes) {
      energy += node.vx * node.vx + node.vy * node.vy;
    }
    return energy;
  }
}
