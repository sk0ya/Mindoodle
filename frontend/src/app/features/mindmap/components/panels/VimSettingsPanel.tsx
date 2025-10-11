import React, { useMemo, useState } from 'react';
import { Settings, Trash2, Plus, Key } from 'lucide-react';
import { useMindMapStore } from '../../store';

type VimSettings = {
  vimLeader?: string;
  vimCustomKeybindings?: Record<string, string>;
  vimMindMap?: boolean;
  vimEditor?: boolean;
};

const VimSettingsPanel: React.FC = () => {
  const { settings, updateSetting } = useMindMapStore();
  const [lhs, setLhs] = useState<string>('');
  const [rhs, setRhs] = useState<string>('');

  const vimSettings = settings as VimSettings;

  const leader = useMemo(() => {
    const v = vimSettings.vimLeader;
    if (typeof v === 'string' && v.length === 1) return v;
    return ',';
  }, [vimSettings.vimLeader]);

  const mappings = vimSettings.vimCustomKeybindings || {};

  const handleToggleMindMapVim = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSetting('vimMindMap', e.target.checked);
  };
  const handleToggleEditorVim = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSetting('vimEditor', e.target.checked);
  };

  const handleLeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (/^<\s*space\s*>$/i.test(value)) value = ' ';
    if (value.length > 1) {
      
      const last = value[value.length - 1] || '';
      value = last;
    }
    if (value.length === 0) value = ','; // fallback
    updateSetting('vimLeader', value);
  };

  const addMapping = () => {
    const k = lhs.trim();
    const c = rhs.trim();
    if (!k || !c) return;
    const next = { ...mappings };
    next[k] = c;
    updateSetting('vimCustomKeybindings', next);
    setLhs('');
    setRhs('');
  };

  const removeMapping = (key: string) => {
    const next = { ...mappings };
    delete next[key];
    updateSetting('vimCustomKeybindings', next);
  };

  const clearAll = () => {
    updateSetting('vimCustomKeybindings', {});
  };

  const expand = (s: string) => s
    .replace(/<\s*leader\s*>/ig, leader)
    .replace(/<\s*space\s*>/ig, ' ');

  return (
    <div className="vim-settings-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Settings size={14} />
          <span>Vim 設定</span>
        </div>
      </div>

      <div className="panel-content">
        <div className="section">
          <label className="section-title">有効化</label>
          <div className="row">
            <label className="toggle">
              <input type="checkbox" checked={vimSettings.vimMindMap ?? false} onChange={handleToggleMindMapVim} />
              <span>マインドマップ Vim</span>
            </label>
          </div>
          <div className="row">
            <label className="toggle">
              <input type="checkbox" checked={vimSettings.vimEditor ?? false} onChange={handleToggleEditorVim} />
              <span>Markdown エディタ Vim</span>
            </label>
          </div>
        </div>

        <div className="section">
          <label className="section-title">Leader キー</label>
          <div className="row">
            <div className="input-with-icon">
              <Key size={14} />
              <input
                type="text"
                value={leader === ' ' ? '<Space>' : leader}
                onChange={handleLeaderChange}
                placeholder="," 
                className="text-input"
              />
            </div>
          </div>
          <div className="hint">1文字のみ。スペースは「&lt;Space&gt;」と入力できます。</div>
        </div>

        <div className="section">
          <label className="section-title">カスタムマッピング</label>
          <div className="row add-mapping">
            <input
              type="text"
              placeholder="<leader>h"
              value={lhs}
              onChange={(e) => setLhs(e.target.value)}
              className="text-input"
            />
            <span className="arrow">→</span>
            <input
              type="text"
              placeholder="left"
              value={rhs}
              onChange={(e) => setRhs(e.target.value)}
              className="text-input"
            />
            <button className="btn add" onClick={addMapping} title="追加">
              <Plus size={14} />
            </button>
          </div>
          <div className="mapping-list">
            {Object.entries(mappings).length === 0 && (
              <div className="empty">カスタムマッピングはまだありません。</div>
            )}
            {Object.entries(mappings).map(([k, v]) => (
              <div key={k} className="mapping-item">
                <code className="lhs" title={`実効: ${expand(k)}`}>{k}</code>
                <span className="arrow">→</span>
                <code className="rhs">{v}</code>
                <button className="btn remove" onClick={() => removeMapping(k)} title="削除">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          {Object.entries(mappings).length > 0 && (
            <div className="row">
              <button className="btn danger" onClick={clearAll}>すべてクリア</button>
            </div>
          )}
          <div className="hint">LHS では「&lt;leader&gt;」「&lt;Space&gt;」が使えます。ビルトインVimシーケンスより優先されます。</div>
        </div>
      </div>

      <style>{`
        .vim-settings-panel {
          position: fixed;
          top: 0;
          right: 0;
          height: 100vh;
          width: 360px;
          background: var(--bg-primary);
          border-left: 1px solid var(--border-color);
          box-shadow: -6px 0 20px rgba(0,0,0,0.12);
          z-index: 950;
          display: flex;
          flex-direction: column;
        }
        .vim-settings-panel .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
          min-height: 36px;
          flex-shrink: 0;
        }
        .vim-settings-panel .panel-title { display:flex; gap:6px; align-items:center; font-size:12px; font-weight:500; }
        .vim-settings-panel .panel-title svg { color: var(--text-secondary); }
        .vim-settings-panel .panel-content { padding: 12px; overflow: auto; flex: 1; }
        .vim-settings-panel .section { margin-bottom: 16px; }
        .vim-settings-panel .section-title { display:block; font-weight:600; margin-bottom: 6px; font-size:12px; color: var(--text-primary); }
        .vim-settings-panel .row { display:flex; align-items:center; gap: 8px; margin-bottom: 8px; }
        .vim-settings-panel .toggle { display:flex; align-items:center; gap:8px; font-size:12px; color: var(--text-primary); }
        .vim-settings-panel .input-with-icon { display:flex; align-items:center; gap:6px; border:1px solid var(--border-color); background: var(--bg-tertiary); padding: 4px 8px; border-radius: 4px; }
        .vim-settings-panel .text-input { background: transparent; border: none; outline: none; color: var(--text-primary); font-size: 12px; }
        .vim-settings-panel .hint { color: var(--text-secondary); font-size: 11px; opacity: 0.9; }
        .vim-settings-panel .add-mapping .text-input { border:1px solid var(--border-color); background: var(--bg-tertiary); padding: 6px 8px; border-radius: 4px; }
        .vim-settings-panel .add-mapping .arrow { color: var(--text-secondary); font-size:12px; }
        .vim-settings-panel .btn { display:flex; align-items:center; gap:4px; border:1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); padding: 6px 8px; border-radius: 4px; font-size:12px; }
        .vim-settings-panel .btn:hover { background: var(--bg-secondary); }
        .vim-settings-panel .btn.add { border-color: #10b981; }
        .vim-settings-panel .btn.remove { border-color: #ef4444; }
        .vim-settings-panel .btn.danger { border-color: #ef4444; }
        .vim-settings-panel .mapping-list { display:flex; flex-direction:column; gap:6px; margin-top: 8px; }
        .vim-settings-panel .mapping-item { display:flex; align-items:center; gap:8px; border:1px solid var(--border-color); background: var(--bg-tertiary); border-radius: 4px; padding: 6px 8px; }
        .vim-settings-panel .mapping-item code { font-family: 'Consolas','Monaco','Courier New', monospace; font-size:12px; }
        .vim-settings-panel .mapping-item .lhs { min-width: 90px; }
        .vim-settings-panel .empty { color: var(--text-secondary); font-size:12px; }
      `}</style>
    </div>
  );
};

export default VimSettingsPanel;

