import React, { createContext, useContext } from "react";
import { useVimMode } from "../hooks/useVimMode";

export type VimContextType = ReturnType<typeof useVimMode>;

const VimContext = createContext<VimContextType | null>(null);

export const VimProvider: React.FC<{ children: React.ReactNode; mindMap?: unknown }> = ({ children, mindMap }) => {
  const vim = useVimMode(mindMap);
  return <VimContext.Provider value={vim}>{children}</VimContext.Provider>;
};

export const useVim = (): VimContextType => {
  const ctx = useContext(VimContext);
  if (!ctx) {
    throw new Error("useVim must be used inside a VimProvider");
  }
  return ctx;
};
