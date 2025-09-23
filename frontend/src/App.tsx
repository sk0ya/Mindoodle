import React from 'react';

const LocalMindMapApp = React.lazy(() => import('./app'));

const App: React.FC = () => {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading Mindoodle...</div>
      </div>
    }>
      <LocalMindMapApp 
        storageMode="markdown"
      />
    </React.Suspense>
  );
};

export default App;
