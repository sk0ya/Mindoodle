// moved to layout/sidebar
import React, { useState } from 'react';
import VimMappingsEditor from '../panel/VimMappingsEditor';
import { useMindMapStore } from '../../../store';

const VimSidebar: React.FC = () => {
  const [tab, setTab] = useState<'mindmap' | 'editor'>('mindmap');
  const { settings, updateSetting } = useMindMapStore();
  const toggleMindMapVim = (e: React.ChangeEvent<HTMLInputElement>) => updateSetting('vimMindMap' as any, e.target.checked as any);
  const toggleEditorVim = (e: React.ChangeEvent<HTMLInputElement>) => updateSetting('vimEditor' as any, e.target.checked as any);
  // Enable the Editor tab
  const editorTabEnabled = true;

  const flushAndSetTab = (next: 'mindmap' | 'editor') => {
    if (next === 'editor' && !editorTabEnabled) return;
    try { window.dispatchEvent(new CustomEvent('mindoodle:vim-mapping-flush')); } catch {}
    // Slight defer to ensure state store updates before mount new editor
    setTimeout(() => setTab(next), 0);
  };

  return (
    <div className="settings-sidebar" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="settings-section" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <h3 className="settings-section-title">Vim マッピング</h3>
        <div className="settings-section-content" style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)' }}>
          <label className="settings-toggle" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="checkbox" checked={(settings as any).vimMindMap} onChange={toggleMindMapVim} />
            <span>マインドマップ Vim</span>
          </label>
          <label className="settings-toggle" style={{ display:'flex', alignItems:'center', gap:8, marginTop: 6 }}>
            <input type="checkbox" checked={(settings as any).vimEditor} onChange={toggleEditorVim} />
            <span>エディタ Vim（Monaco）</span>
          </label>
        </div>
        <div role="tablist" aria-label="Vim mappings scope" className="vim-tabs">
          <button
            role="tab"
            aria-selected={tab === 'mindmap'}
            className={`vim-tab ${tab === 'mindmap' ? 'active' : ''}`}
            onClick={() => flushAndSetTab('mindmap')}
          >Mind Map</button>
          <button
            role="tab"
            aria-selected={tab === 'editor'}
            aria-disabled={!editorTabEnabled}
            disabled={!editorTabEnabled}
            className={`vim-tab ${tab === 'editor' ? 'active' : ''} ${!editorTabEnabled ? 'disabled' : ''}`}
            onClick={() => flushAndSetTab('editor')}
          >Editor</button>
        </div>
        
        <div className="settings-section-content" style={{ flex: 1, minHeight: 0, padding: 0 }}>
          {tab === 'mindmap' ? (
            <VimMappingsEditor
              key="vim-mindmap"
              sourceKey={'vimMappingsSource' as any}
              leaderKey={'vimLeader' as any}
              mappingsKey={'vimCustomKeybindings' as any}
            />
          ) : (
            <VimMappingsEditor
              key="vim-editor"
              sourceKey={'vimEditorMappingsSource' as any}
              leaderKey={'vimEditorLeader' as any}
              mappingsKey={'vimEditorCustomKeybindings' as any}
            />
          )}
        </div>
        <style>{`
          .vim-tabs { display:flex; gap:6px; padding:6px 8px; }
          .vim-tab {
            background: var(--bg-secondary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 6px 10px;
            font-size: 12px;
            cursor: pointer;
          }
          .vim-tab:hover { background: var(--bg-tertiary); }
          .vim-tab.active {
            background: var(--bg-tertiary);
            border-color: var(--accent-color);
            box-shadow: 0 0 0 1px var(--accent-color) inset;
          }
          .vim-tab.disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    </div>
  );
};

export default VimSidebar;
