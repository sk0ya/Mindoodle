/**
 * Node renderer helper functions
 *
 * This module re-exports focused utilities from separate modules:
 * - tableParser: Markdown table parsing
 * - displayEntryExtractor: Image and mermaid diagram extraction
 * - pathUtils: Path validation utilities
 * - fileAttachmentConverter: Display entry to file attachment conversion
 */

// Table parsing
export { parseTableFromString } from './tableParser';
export type { TableParseResult } from './tableParser';

// Display entry extraction
export { extractDisplayEntries } from './displayEntryExtractor';
export type { DisplayEntry } from './displayEntryExtractor';

// Path utilities
export { isRelativeLocalPath } from './pathUtils';

// File attachment conversion
export { displayEntriesToFileAttachments } from './fileAttachmentConverter';
export type { FileAttachmentWithMetadata } from './fileAttachmentConverter';
