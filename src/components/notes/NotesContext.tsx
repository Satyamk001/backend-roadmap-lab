import React, { createContext, useContext, useMemo } from 'react';

export interface NotesNavigation {
  openNotes: (anchor?: string) => void;
}

const noop = () => {};

const NotesContext = createContext<NotesNavigation>({ openNotes: noop });

export const NotesProvider: React.FC<{
  onOpen: (anchor?: string) => void;
  children: React.ReactNode;
}> = ({ onOpen, children }) => {
  const value = useMemo<NotesNavigation>(() => ({ openNotes: onOpen }), [onOpen]);
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
};

export function useNotes(): NotesNavigation {
  return useContext(NotesContext);
}
