/**
 * Browser dialogs are kept behind one boundary so feature code does not
 * depend directly on blocking browser APIs.
 */
/* eslint-disable no-alert */

export const showBrowserAlert = (message: string): void => {
  window.alert(message);
};

export const confirmBrowserAction = (message: string): boolean => window.confirm(message);

export const promptBrowserText = (message: string, defaultValue = ''): string | null =>
  window.prompt(message, defaultValue);
