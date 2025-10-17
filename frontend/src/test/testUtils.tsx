import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

/**
 * Custom render function that wraps components with common providers
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { ...options });
}

/**
 * Mock MindMapNode factory
 */
export function createMockNode(overrides?: Partial<any>): any {
  return {
    id: 'test-node-1',
    text: 'Test Node',
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    level: 1,
    collapsed: false,
    children: [],
    ...overrides,
  };
}

/**
 * Create a node tree for testing
 */
export function createMockNodeTree(): any {
  const root = createMockNode({
    id: 'root',
    text: 'Root Node',
    level: 0,
  });

  const child1 = createMockNode({
    id: 'child-1',
    text: 'Child 1',
    level: 1,
    x: 200,
    y: -50,
  });

  const child2 = createMockNode({
    id: 'child-2',
    text: 'Child 2',
    level: 1,
    x: 200,
    y: 50,
  });

  const grandchild = createMockNode({
    id: 'grandchild-1',
    text: 'Grandchild 1',
    level: 2,
    x: 400,
    y: -50,
  });

  child1.children = [grandchild];
  root.children = [child1, child2];

  return { root, child1, child2, grandchild };
}

/**
 * Mock Zustand store factory
 */
export function createMockStore(initialState?: any) {
  return {
    getState: () => ({
      data: {
        rootNodes: [],
      },
      ui: {
        mode: 'normal',
        zoom: 1,
        pan: { x: 0, y: 0 },
      },
      node: {
        selectedNodeId: null,
        editingNodeId: null,
      },
      settings: {
        fontSize: 14,
        nodeTextWrapEnabled: true,
        nodeTextWrapWidth: 300,
      },
      ...initialState,
    }),
    setState: () => {},
    subscribe: () => () => {},
  };
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
export { customRender as render };
