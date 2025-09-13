import React from 'react';

// Only local mode for Mindoodle
const LocalMindMapApp = React.lazy(() => import('./app'));

const App: React.FC = () => {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading Mindoodle...</div>
      </div>
    }>
      <LocalMindMapApp 
        storageMode="local"
        // Do not pass onModeChange -> hides cloud/local switch
      />
    </React.Suspense>
  );
};

export default App;
