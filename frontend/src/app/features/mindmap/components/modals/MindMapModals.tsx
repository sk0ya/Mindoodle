import React from 'react';
import { MindMapModalsProvider, type MindMapModalsProviderProps } from './MindMapModalsContext';

const MindMapModals: React.FC<Omit<MindMapModalsProviderProps, 'children'>> = (props) => (
  <MindMapModalsProvider {...props} children={null} />
);

export default MindMapModals;
