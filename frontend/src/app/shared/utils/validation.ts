import type { MindMapData } from '../types';
import { isMindMapNode, validateMindMapNode } from '@mindmap/utils/nodeOperations';

/**
 * 型ガード関数 - ランタイム型チェック
 */
export const isMindMapData = (data: unknown): data is MindMapData => {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.rootNode === 'object' &&
    obj.rootNode !== null &&
    isMindMapNode(obj.rootNode)
  );
};

/**
 * データバリデーション結果型
 */
export interface DataValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * MindMapDataの詳細バリデーション
 */
export const validateMindMapData = (data: unknown): DataValidationResult => {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Data must be an object');
    return { isValid: false, errors };
  }

  const obj = data as Record<string, unknown>;

  // 必須フィールドのチェック
  if (!obj.id || typeof obj.id !== 'string') {
    errors.push('Missing or invalid id field');
  }

  if (!obj.title || typeof obj.title !== 'string') {
    errors.push('Missing or invalid title field');
  }

  if (!obj.rootNode) {
    errors.push('Missing rootNode field');
  } else {
    const nodeValidation = validateMindMapNode(obj.rootNode);
    if (!nodeValidation.isValid) {
      errors.push(`Invalid rootNode: ${nodeValidation.errors.join(', ')}`);
    }
  }

  // オプショナルフィールドのチェック
  if (obj.createdAt && typeof obj.createdAt !== 'string') {
    errors.push('Invalid createdAt field');
  }

  if (obj.updatedAt && typeof obj.updatedAt !== 'string') {
    errors.push('Invalid updatedAt field');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * ファイル拡張子バリデーション
 */
export const isValidFileExtension = (filename: string, allowedExtensions: string[]): boolean => {
  const extension = filename.toLowerCase().split('.').pop();
  return extension ? allowedExtensions.includes(extension) : false;
};

/**
 * URL バリデーション
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 文字列の安全性チェック（XSS対策）
 */
export const isSafeString = (str: string): boolean => {
  // スクリプトタグや危険なパターンをチェック
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ];

  return !dangerousPatterns.some(pattern => pattern.test(str));
};