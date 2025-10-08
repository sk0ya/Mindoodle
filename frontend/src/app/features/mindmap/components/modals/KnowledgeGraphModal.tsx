import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { MindMapData, NodeLink, MindMapNode } from '@shared/types';
import { resolveHrefToMapTarget, extractAllMarkdownLinksDetailed } from '../../../markdown/markdownLinkUtils';

// Graph data structures
export interface GraphNode {
  id: string;
  label: string;
  type: 'map' | 'node';
  mapId?: string;
  position: [number, number, number];
  velocity?: [number, number, number];
  links?: NodeLink[];
}

export interface GraphEdge {
  source: string;
  target: string;
  linkId?: string;
}

interface KnowledgeGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  allMapsData: MindMapData[];
}

// Force-directed layout physics
const applyForces = (nodes: GraphNode[], edges: GraphEdge[], iterations: number = 50) => {
  const simulatedNodes = nodes.map(node => ({
    ...node,
    velocity: node.velocity || [0, 0, 0] as [number, number, number],
  }));

  for (let iter = 0; iter < iterations; iter++) {
    // Reset forces
    simulatedNodes.forEach(node => {
      node.velocity = [0, 0, 0];
    });

    // Repulsion between all nodes (prevent overlap)
    for (let i = 0; i < simulatedNodes.length; i++) {
      for (let j = i + 1; j < simulatedNodes.length; j++) {
        const nodeA = simulatedNodes[i];
        const nodeB = simulatedNodes[j];

        const dx = nodeB.position[0] - nodeA.position[0];
        const dy = nodeB.position[1] - nodeA.position[1];
        const dz = nodeB.position[2] - nodeA.position[2];
        const distSq = dx * dx + dy * dy + dz * dz + 0.01;
        const dist = Math.sqrt(distSq);

        // Stronger repulsion for closer nodes
        const repulsionStrength = (nodeA.type === 'map' && nodeB.type === 'map') ? 15 : 8;
        const force = repulsionStrength / distSq;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;

        nodeA.velocity[0] -= fx;
        nodeA.velocity[1] -= fy;
        nodeA.velocity[2] -= fz;
        nodeB.velocity[0] += fx;
        nodeB.velocity[1] += fy;
        nodeB.velocity[2] += fz;
      }
    }

    // Attraction along edges (spring forces)
    edges.forEach(edge => {
      const sourceNode = simulatedNodes.find(n => n.id === edge.source);
      const targetNode = simulatedNodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) return;

      const dx = targetNode.position[0] - sourceNode.position[0];
      const dy = targetNode.position[1] - sourceNode.position[1];
      const dz = targetNode.position[2] - sourceNode.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz + 0.01);

      // Ideal spring length depends on node types
      const idealLength = (sourceNode.type === 'map' && targetNode.type === 'map') ? 6 : 2.5;
      const springStrength = 0.1;
      const force = (dist - idealLength) * springStrength;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;

      sourceNode.velocity[0] += fx;
      sourceNode.velocity[1] += fy;
      sourceNode.velocity[2] += fz;
      targetNode.velocity[0] -= fx;
      targetNode.velocity[1] -= fy;
      targetNode.velocity[2] -= fz;
    });

    // Apply velocities with damping
    const damping = 0.5;
    simulatedNodes.forEach(node => {
      node.position[0] += node.velocity[0] * damping;
      node.position[1] += node.velocity[1] * damping;
      node.position[2] += node.velocity[2] * damping;
    });
  }

  return simulatedNodes;
};

// Animated node component
const GraphNodeComponent: React.FC<{ node: GraphNode }> = ({ node }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      // Scale on hover
      const targetScale = hovered ? 1.15 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
    }
  });

  const size = node.type === 'map' ? 0.8 : 0.35;
  const segments = node.type === 'map' ? 32 : 20;

  return (
    <group position={[node.position[0], node.position[1], node.position[2]]}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[size, segments, segments]} />
        <meshStandardMaterial
          color={node.type === 'map' ? '#6366f1' : '#ec4899'}
          emissive={node.type === 'map' ? '#4f46e5' : '#db2777'}
          emissiveIntensity={hovered ? 0.8 : 0.4}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      <Text
        position={[0, node.type === 'map' ? 1.2 : 0.6, 0]}
        fontSize={node.type === 'map' ? 0.5 : 0.25}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {node.label}
      </Text>
    </group>
  );
};

// Animated edge component
const GraphEdgeComponent: React.FC<{
  source: GraphNode;
  target: GraphNode;
}> = ({ source, target }) => {
  const points = [
    new THREE.Vector3(...source.position),
    new THREE.Vector3(...target.position),
  ];

  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <primitive
      object={new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          color: '#94a3b8',
          transparent: true,
          opacity: 0.6,
          linewidth: 2,
        })
      )}
    />
  );
};

// 3D Graph Component with physics
const KnowledgeGraph3D: React.FC<{ nodes: GraphNode[]; edges: GraphEdge[] }> = ({ nodes, edges }) => {
  return (
    <>
      {/* Render nodes */}
      {nodes.map((node) => (
        <GraphNodeComponent key={node.id} node={node} />
      ))}

      {/* Render edges */}
      {edges.map((edge, index) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);

        if (!sourceNode || !targetNode) return null;

        return (
          <GraphEdgeComponent
            key={`${edge.source}-${edge.target}-${index}`}
            source={sourceNode}
            target={targetNode}
          />
        );
      })}

      {/* Enhanced lighting */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 10]} intensity={1.5} />
      <directionalLight position={[-10, -10, -10]} intensity={0.8} />
      <pointLight position={[0, 10, 0]} intensity={1.0} />
    </>
  );
};

const KnowledgeGraphModal: React.FC<KnowledgeGraphModalProps> = ({
  isOpen,
  onClose,
  allMapsData,
}) => {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({
    nodes: [],
    edges: [],
  });

  // Build graph data from all maps
  const buildGraphData = useCallback(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const mapNodeMap = new Map<string, GraphNode>();

    // Get all available map IDs for link resolution
    const availableMapIds = allMapsData.map(m => m.mapIdentifier.mapId);

    // Calculate positions in a circular layout
    const mapCount = allMapsData.length;
    const radius = Math.max(5, mapCount * 0.8);

    // Create map nodes
    allMapsData.forEach((mapData, index) => {
      const angle = (index / mapCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 0;

      const mapNode: GraphNode = {
        id: `map-${mapData.mapIdentifier.mapId}`,
        label: mapData.mapIdentifier.mapId.split('/').pop() || mapData.mapIdentifier.mapId,
        type: 'map',
        mapId: mapData.mapIdentifier.mapId,
        position: [x, y, z],
      };

      nodes.push(mapNode);
      mapNodeMap.set(mapData.mapIdentifier.mapId, mapNode);
    });

    // Process nodes with links
    allMapsData.forEach((mapData) => {
      const sourceMapNode = mapNodeMap.get(mapData.mapIdentifier.mapId);
      if (!sourceMapNode) return;

      const processNode = (node: MindMapNode) => {
        // Collect all inter-map links from both node.links and markdown note
        const interMapLinks: Array<{ targetMapId: string; linkType: string }> = [];

        // 1. Check node.links array
        if (node.links && node.links.length > 0) {
          node.links.forEach((link) => {
            let targetMapId: string | undefined;

            // Direct targetMapId check
            if (link.targetMapId && link.targetMapId !== mapData.mapIdentifier.mapId) {
              targetMapId = link.targetMapId;
            }
            // Check if targetNodeId contains map reference (format: "mapId/nodeId")
            else if (link.targetNodeId && link.targetNodeId.includes('/')) {
              const linkMapId = link.targetNodeId.split('/')[0];
              if (linkMapId !== mapData.mapIdentifier.mapId) {
                targetMapId = linkMapId;
              }
            }

            if (targetMapId) {
              interMapLinks.push({ targetMapId, linkType: 'direct' });
            }
          });
        }

        // 2. Check markdown note for relative path links
        if (node.note) {
          const markdownLinks = extractAllMarkdownLinksDetailed(node.note);
          markdownLinks.forEach((mdLink) => {
            const resolved = resolveHrefToMapTarget(
              mdLink.href,
              mapData.mapIdentifier.mapId,
              availableMapIds
            );
            if (resolved && resolved.mapId !== mapData.mapIdentifier.mapId) {
              interMapLinks.push({ targetMapId: resolved.mapId, linkType: 'markdown' });
            }
          });
        }

        console.log('Node links analysis:', {
          nodeText: node.text,
          hasLinks: !!node.links?.length,
          hasNote: !!node.note,
          interMapLinksFound: interMapLinks.length,
          targets: interMapLinks.map(l => l.targetMapId)
        });

        if (interMapLinks.length > 0) {
          // Create a node for this specific node with links
          const nodeId = `node-${mapData.mapIdentifier.mapId}-${node.id}`;
          const offset = 1.2;
          const randomAngle = Math.random() * Math.PI * 2;
          const randomRadius = 0.5 + Math.random() * 0.5;

          const nodeGraphNode: GraphNode = {
            id: nodeId,
            label: node.text.slice(0, 20),
            type: 'node',
            mapId: mapData.mapIdentifier.mapId,
            position: [
              sourceMapNode.position[0] + Math.cos(randomAngle) * offset * randomRadius,
              sourceMapNode.position[1] + (Math.random() - 0.5) * 0.5,
              sourceMapNode.position[2] + Math.sin(randomAngle) * offset * randomRadius,
            ],
          };

          nodes.push(nodeGraphNode);

          // Create edge from node to its parent map
          edges.push({
            source: nodeId,
            target: sourceMapNode.id,
          });

          // Create edges to target maps (deduplicate by targetMapId)
          const uniqueTargets = new Set<string>();
          interMapLinks.forEach((link) => {
            if (!uniqueTargets.has(link.targetMapId)) {
              uniqueTargets.add(link.targetMapId);
              const targetMapNode = mapNodeMap.get(link.targetMapId);
              if (targetMapNode) {
                edges.push({
                  source: nodeId,
                  target: targetMapNode.id,
                });
                console.log('Created edge:', { from: nodeId, to: targetMapNode.id, type: link.linkType });
              } else {
                console.warn('Target map not found in graph:', link.targetMapId);
              }
            }
          });
        }

        // Recursively process children
        if (node.children) {
          node.children.forEach(processNode);
        }
      };

      if (mapData.rootNodes) {
        mapData.rootNodes.forEach(processNode);
      }
    });

    // Apply force-directed layout to stabilize positions
    const optimizedNodes = applyForces(nodes, edges, 100);

    setGraphData({ nodes: optimizedNodes, edges });
  }, [allMapsData]);

  useEffect(() => {
    if (isOpen && allMapsData.length > 0) {
      buildGraphData();
    }
  }, [isOpen, allMapsData, buildGraphData]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="knowledge-graph-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="knowledge-graph-content">
        <div className="knowledge-graph-header">
          <h2>Workspace Knowledge Graph</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="knowledge-graph-body">
          {allMapsData.length === 0 ? (
            <div className="placeholder">
              <p>No maps found in workspace.</p>
              <p>Open or create maps to see the knowledge graph.</p>
            </div>
          ) : (
            <>
              <Canvas
                camera={{ position: [0, 8, 20], fov: 75 }}
                style={{ background: '#0a0a0a' }}
              >
                <OrbitControls
                  enablePan
                  enableZoom
                  enableRotate
                  zoomSpeed={1.2}
                  panSpeed={0.8}
                  rotateSpeed={0.5}
                  minDistance={5}
                  maxDistance={50}
                />
                <KnowledgeGraph3D nodes={graphData.nodes} edges={graphData.edges} />
              </Canvas>
              {graphData.edges.length === 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    color: 'rgba(255, 255, 255, 0.5)',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                >
                  <p style={{ margin: '8px 0', fontSize: '14px' }}>
                    {allMapsData.length} map{allMapsData.length > 1 ? 's' : ''} in workspace
                  </p>
                  <p style={{ margin: '8px 0', fontSize: '12px' }}>
                    Create links between maps to see connections
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="knowledge-graph-footer">
          <div className="legend">
            <div className="legend-item">
              <span className="legend-color map-color"></span>
              <span>Map</span>
            </div>
            <div className="legend-item">
              <span className="legend-color node-color"></span>
              <span>Node with links</span>
            </div>
          </div>
          <div className="stats">
            <span>{graphData.nodes.filter((n) => n.type === 'map').length} maps</span>
            <span> · </span>
            <span>{graphData.edges.length} connections</span>
          </div>
        </div>
      </div>

      <style>{`
        .knowledge-graph-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
          box-sizing: border-box;
        }

        .knowledge-graph-content {
          background: var(--bg-primary);
          color: var(--text-primary);
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          width: 95%;
          height: 90vh;
          max-width: 1400px;
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border-color);
          overflow: hidden;
        }

        .knowledge-graph-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .knowledge-graph-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .close-button {
          background: none;
          border: none;
          font-size: 28px;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .close-button:hover {
          background: var(--hover-color);
          color: var(--text-primary);
        }

        .knowledge-graph-body {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        .placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary);
          text-align: center;
          padding: 40px;
        }

        .placeholder p {
          margin: 8px 0;
          font-size: 14px;
        }

        .knowledge-graph-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          border-top: 1px solid var(--border-color);
          background: var(--bg-secondary);
          font-size: 13px;
        }

        .legend {
          display: flex;
          gap: 16px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid var(--border-color);
        }

        .legend-color.map-color {
          background: #6366f1;
        }

        .legend-color.node-color {
          background: #ec4899;
        }

        .stats {
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
};

export default KnowledgeGraphModal;
