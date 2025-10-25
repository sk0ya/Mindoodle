/**
 * Vim state management helpers
 * Reduces boilerplate in useVimMode hook
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { VimMode } from './useVimMode';

// Vim state subset (excluding isEnabled which comes from settings)
export interface VimState {
  mode: VimMode;
  lastCommand: string;
  commandBuffer: string;
  commandLineBuffer: string;
  commandOutput: string;
  searchQuery: string;
  searchResults: string[];
  currentSearchIndex: number;
  jumpyLabels: Array<{ nodeId: string; label: string }>;
  jumpyBuffer: string;
  countBuffer: string;
}

/**
 * Creates all vim state setters using functional patterns
 * Reduces 24 individual useCallback definitions to a single call
 */
export function createVimStateSetters(setState: Dispatch<SetStateAction<Omit<VimState, 'isEnabled'>>>) {
  // Simple property setters (5 lines each → 1 line)
  const setMode = useCallback(
    (mode: VimMode) => setState((prev) => ({ ...prev, mode })),
    [setState]
  );

  const setCommandOutput = useCallback(
    (output: string) => setState((prev) => ({ ...prev, commandOutput: output })),
    [setState]
  );

  const updateSearchQuery = useCallback(
    (query: string) => setState((prev) => ({ ...prev, searchQuery: query })),
    [setState]
  );

  const updateCommandLineBuffer = useCallback(
    (buffer: string) => setState((prev) => ({ ...prev, commandLineBuffer: buffer })),
    [setState]
  );

  // Buffer operations
  const appendToCommandBuffer = useCallback(
    (char: string) => setState((prev) => ({ ...prev, commandBuffer: prev.commandBuffer + char })),
    [setState]
  );

  const clearCommandBuffer = useCallback(
    () => setState((prev) => ({ ...prev, commandBuffer: '' })),
    [setState]
  );

  const appendToCountBuffer = useCallback(
    (digit: string) => setState((prev) => ({ ...prev, countBuffer: prev.countBuffer + digit })),
    [setState]
  );

  const clearCountBuffer = useCallback(
    () => setState((prev) => ({ ...prev, countBuffer: '' })),
    [setState]
  );

  // Mode transitions with state resets
  const startCommandLine = useCallback(
    () => setState((prev) => ({
      ...prev,
      mode: 'command' as const,
      commandLineBuffer: '',
      commandOutput: ''
    })),
    [setState]
  );

  const exitCommandLine = useCallback(
    () => setState((prev) => ({
      ...prev,
      mode: 'normal' as const,
      commandLineBuffer: '',
      commandOutput: ''
    })),
    [setState]
  );

  const startSearch = useCallback(
    () => setState((prev) => ({
      ...prev,
      mode: 'search' as const,
      searchQuery: '',
      searchResults: [],
      currentSearchIndex: -1
    })),
    [setState]
  );

  const exitSearch = useCallback(
    () => setState((prev) => ({
      ...prev,
      mode: 'normal' as const,
      searchQuery: '',
      searchResults: [],
      currentSearchIndex: -1
    })),
    [setState]
  );

  const startJumpy = useCallback(
    (labels: Array<{ nodeId: string; label: string }>) => setState((prev) => ({
      ...prev,
      mode: 'jumpy' as const,
      jumpyLabels: labels,
      jumpyBuffer: ''
    })),
    [setState]
  );

  const exitJumpy = useCallback(
    () => setState((prev) => ({
      ...prev,
      mode: 'normal' as const,
      jumpyLabels: [],
      jumpyBuffer: ''
    })),
    [setState]
  );

  const appendToJumpyBuffer = useCallback(
    (char: string) => setState((prev) => ({ ...prev, jumpyBuffer: prev.jumpyBuffer + char })),
    [setState]
  );

  const clearSearchResults = useCallback(
    () => setState((prev) => ({ ...prev, searchResults: [], currentSearchIndex: -1 })),
    [setState]
  );

  const setSearchResults = useCallback(
    (results: string[], index: number = 0) => setState((prev) => ({
      ...prev,
      searchResults: results,
      currentSearchIndex: index
    })),
    [setState]
  );

  const nextSearchResult = useCallback(
    () => setState((prev) => ({
      ...prev,
      currentSearchIndex: prev.searchResults.length > 0
        ? (prev.currentSearchIndex + 1) % prev.searchResults.length
        : -1
    })),
    [setState]
  );

  const previousSearchResult = useCallback(
    () => setState((prev) => ({
      ...prev,
      currentSearchIndex: prev.searchResults.length > 0
        ? (prev.currentSearchIndex - 1 + prev.searchResults.length) % prev.searchResults.length
        : -1
    })),
    [setState]
  );

  const executeCommand = useCallback(
    (command: string) => setState((prev) => ({
      ...prev,
      lastCommand: command,
      commandBuffer: ''
    })),
    [setState]
  );

  return {
    // Mode setters
    setMode,
    startCommandLine,
    exitCommandLine,
    startSearch,
    exitSearch,
    startJumpy,
    exitJumpy,

    // Buffer operations
    appendToCommandBuffer,
    clearCommandBuffer,
    appendToCountBuffer,
    clearCountBuffer,
    appendToJumpyBuffer,

    // Command operations
    executeCommand,
    setCommandOutput,
    updateCommandLineBuffer,

    // Search operations
    updateSearchQuery,
    clearSearchResults,
    setSearchResults,
    nextSearchResult,
    previousSearchResult
  };
}

/**
 * Type for the return value of createVimStateSetters
 */
export type VimStateSetters = ReturnType<typeof createVimStateSetters>;
