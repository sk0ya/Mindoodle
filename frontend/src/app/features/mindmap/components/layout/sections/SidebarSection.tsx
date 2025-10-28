import React from 'react';
import PrimarySidebarContainer from '../sidebar/PrimarySidebarContainer';

// Loosely-typed passthrough wrapper to keep AppContent slim
const SidebarSection: React.FC<any> = (props) => <PrimarySidebarContainer {...props} />;

export default SidebarSection;
