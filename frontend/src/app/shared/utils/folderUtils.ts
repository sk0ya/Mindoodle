

export interface FolderNode {
  path: string;
  name: string;
  level: number;
  parent: string | null;
  children: string[];
  isExpanded: boolean;
}

export interface FolderTree {
  [path: string]: FolderNode;
}


export function parseFolderPath(path: string): string[] {
  if (!path) return ['（未分類）'];
  return path.split('/').filter(segment => segment.trim());
}


export function getParentFolderPath(path: string): string | null {
  if (!path) return null;
  const segments = parseFolderPath(path);
  if (segments.length <= 1) return null;
  return segments.slice(0, -1).join('/');
}


export function getFolderName(path: string): string {
  if (!path) return '（未分類）';
  const segments = parseFolderPath(path);
  return segments[segments.length - 1] || path;
}


export function buildFolderTree(categoryPaths: string[], expandedFolders: Set<string>): FolderTree {
  const tree: FolderTree = {};
  const allPaths = new Set<string>();

  
  categoryPaths.forEach(path => {
    if (!path) {
      allPaths.add('');
      return;
    }

    const segments = parseFolderPath(path);
    for (let i = 1; i <= segments.length; i++) {
      const partialPath = segments.slice(0, i).join('/');
      allPaths.add(partialPath);
    }
  });

  // Build tree nodes
  Array.from(allPaths).forEach(path => {
    const parent = getParentFolderPath(path);
    const name = getFolderName(path);
    const level = parseFolderPath(path).length - 1;

    tree[path] = {
      path,
      name,
      level,
      parent,
      children: [],
      isExpanded: expandedFolders.has(path)
    };
  });

  // Build parent-child relationships
  Object.values(tree).forEach(node => {
    if (node.parent && tree[node.parent]) {
      tree[node.parent].children.push(node.path);
    }
  });

  // Sort children
  Object.values(tree).forEach(node => {
    node.children.sort((a, b) => {
      const nameA = getFolderName(a);
      const nameB = getFolderName(b);
      if (nameA === '（未分類）') return 1;
      if (nameB === '（未分類）') return -1;
      return nameA.localeCompare(nameB, 'ja', {
        numeric: true,
        sensitivity: 'base'
      });
    });
  });

  return tree;
}


export function getRootFolders(tree: FolderTree): string[] {
  return Object.values(tree)
    .filter(node => !node.parent)
    .map(node => node.path)
    .sort((a, b) => {
      const nameA = getFolderName(a);
      const nameB = getFolderName(b);
      if (nameA === '（未分類）') return 1;
      if (nameB === '（未分類）') return -1;
      return nameA.localeCompare(nameB, 'ja', {
        numeric: true,
        sensitivity: 'base'
      });
    });
}


export function getVisibleFolders(tree: FolderTree): string[] {
  const result: string[] = [];
  const rootFolders = getRootFolders(tree);

  function addFolderAndChildren(path: string) {
    result.push(path);
    const node = tree[path];
    if (node && node.isExpanded) {
      node.children.forEach(childPath => {
        addFolderAndChildren(childPath);
      });
    }
  }

  rootFolders.forEach(addFolderAndChildren);
  return result;
}


export function createChildFolderPath(parentPath: string | null, folderName: string): string {
  if (!parentPath) {
    return folderName;
  }
  return `${parentPath}/${folderName}`;
}
