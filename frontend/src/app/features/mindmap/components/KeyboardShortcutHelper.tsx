import React, { useState, useMemo } from 'react';
import { X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { stopPropagationOnly } from '@shared/utils';
import { SHORTCUT_COMMANDS, ShortcutDefinition } from '@/app/commands/system/shortcutMapper';
import './KeyboardShortcutHelper.css';
import { viewportService } from '@/app/core/services';
import { useMindMapStore } from '../store/mindMapStore';
import { useBooleanState } from '@shared/hooks/ui/useBooleanState';
import { useEventListener } from '@shared/hooks/system/useEventListener';

interface ShortcutItem {
  keys: (string | React.ReactNode)[];
  description: string;
  context: string;
}

interface ShortcutCategory {
  category: string;
  items: ShortcutItem[];
}

interface KeyboardShortcutHelperProps {
  isVisible: boolean;
  onClose: () => void;
}


const CATEGORY_LABELS: Record<string, string> = {
  vim: 'Vimモード',
  navigation: 'ナビゲーション',
  editing: '編集操作',
  application: 'アプリケーション',
  ui: '表示・UI',
  utility: 'ユーティリティ'
};


function formatShortcutKeys(shortcut: ShortcutDefinition): (string | React.ReactNode)[] {
  const keys: (string | React.ReactNode)[] = [];
  const mods = shortcut.modifiers || {};

  if (mods.ctrl) keys.push('Ctrl');
  if (mods.shift) keys.push('Shift');
  if (mods.alt) keys.push('Alt');
  if (mods.meta) keys.push('Meta');

  
  if (shortcut.key === 'ArrowUp') {
    keys.push(<ArrowUp key="arrow-up" size={14} />);
  } else if (shortcut.key === 'ArrowDown') {
    keys.push(<ArrowDown key="arrow-down" size={14} />);
  } else if (shortcut.key === 'ArrowLeft') {
    keys.push(<ArrowLeft key="arrow-left" size={14} />);
  } else if (shortcut.key === 'ArrowRight') {
    keys.push(<ArrowRight key="arrow-right" size={14} />);
  } else {
    keys.push(shortcut.key);
  }

  return keys;
}

const KeyboardShortcutHelper: React.FC<KeyboardShortcutHelperProps> = ({ isVisible, onClose }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const { settings } = useMindMapStore();

  
  const allShortcuts: ShortcutCategory[] = useMemo(() => {
    const categoriesMap = new Map<string, ShortcutItem[]>();

    SHORTCUT_COMMANDS.forEach(shortcut => {
      if (!shortcut.category || !shortcut.description) return;

      const category = shortcut.category;
      const item: ShortcutItem = {
        keys: formatShortcutKeys(shortcut),
        description: shortcut.description,
        context: category === 'vim' ? 'Vimモード時' : 'いつでも'
      };

      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, []);
      }
      categoriesMap.get(category)!.push(item);
    });

    
    const custom: Record<string,string> = (settings as any)?.vimCustomKeybindings || {};
    const leader: string = ((settings as any)?.vimLeader && typeof (settings as any).vimLeader === 'string' && (settings as any).vimLeader.length === 1)
      ? (settings as any).vimLeader
      : ',';
    const expand = (lhs: string) => lhs.replace(/<\s*leader\s*>/ig, leader).replace(/<\s*space\s*>/ig, ' ');
    const customItems: ShortcutItem[] = Object.entries(custom).map(([lhs, cmd]) => ({
      keys: [expand(lhs)],
      description: `ユーザー定義: ${cmd}`,
      context: 'Vimモード時'
    }));
    if (customItems.length > 0) {
      const existing = categoriesMap.get('vim') || [];
      categoriesMap.set('vim', [...existing, ...customItems]);
    }

    
    const categoryOrder = ['vim', 'navigation', 'editing', 'application', 'ui', 'utility'];
    return categoryOrder
      .filter(cat => categoriesMap.has(cat))
      .map(cat => ({
        category: CATEGORY_LABELS[cat] || cat,
        items: categoriesMap.get(cat)!
      }));
  }, [settings]);

  
  const shortcuts = useMemo(() => {
    if (activeTab === 'all') {
      return allShortcuts;
    }
    return allShortcuts.filter(cat => {
      const categoryKey = Object.entries(CATEGORY_LABELS).find(([_, label]) => label === cat.category)?.[0];
      return categoryKey === activeTab;
    });
  }, [allShortcuts, activeTab]);

  const filteredShortcuts = shortcuts.map(category => ({
    ...category,
    items: category.items.filter(item => 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.keys.some(key => typeof key === 'string' && key.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  })).filter(category => category.items.length > 0);

  const handleKeyDown = (event: Event) => {
    const e = event as KeyboardEvent;
    if (e.key === 'Escape' && isVisible) {
      onClose();
    }
  };

  useEventListener('keydown', handleKeyDown, { target: document, enabled: isVisible });

  if (!isVisible) return null;

  
  const tabs = [
    { id: 'all', label: 'すべて' },
    { id: 'vim', label: 'Vim' },
    { id: 'navigation', label: 'ナビ' },
    { id: 'editing', label: '編集' },
    { id: 'application', label: 'アプリ' },
    { id: 'ui', label: 'UI' }
  ];

  return (
    <div className="shortcut-helper-overlay" onClick={onClose}>
      <div className="shortcut-helper-panel" onClick={stopPropagationOnly}>
        <div className="shortcut-helper-header">
          <h2>ショートカット</h2>
          <button className="shortcut-helper-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="shortcut-helper-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`shortcut-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="shortcut-helper-search">
          <input
            type="text"
            placeholder="検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="shortcut-search-input"
          />
        </div>

        <div className="shortcut-helper-content">
          {filteredShortcuts.map((category, categoryIndex) => (
            <div key={categoryIndex} className="shortcut-category">
              {activeTab === 'all' && (
                <h3 className="shortcut-category-title">{category.category}</h3>
              )}
              <div className="shortcut-list">
                {category.items.map((shortcut, index) => (
                  <div key={index} className="shortcut-item">
                    <div className="shortcut-keys">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          <kbd className="shortcut-key">{key}</kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="shortcut-plus">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="shortcut-description">
                      {shortcut.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredShortcuts.length === 0 && (
            <div className="shortcut-no-results">
              <p>「{searchTerm}」に一致するショートカットが見つかりません。</p>
            </div>
          )}
        </div>

        <div className="shortcut-helper-footer">
          <kbd>Esc</kbd> で閉じる | <kbd>?</kbd> または <kbd>F1</kbd> で表示
        </div>
      </div>
    </div>
  );
};


interface ShortcutTooltipProps {
  shortcut?: string;
  children: React.ReactNode;
  description: string;
}

export const ShortcutTooltip: React.FC<ShortcutTooltipProps> = ({ shortcut, children, description }) => {
  const { value: isHovered, setTrue: show, setFalse: hide } = useBooleanState({ initialValue: false });
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('bottom');
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    show();
    
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const { width: viewportWidth, height: viewportHeight } = viewportService.getSize();
      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;
      
      
      let position: 'top' | 'bottom' = 'bottom';
      if (spaceAbove >= 80 && spaceBelow < 80) {
        position = 'top';
      } else if (spaceAbove >= 80 && spaceBelow >= 80) {
        
        position = 'bottom';
      } else if (spaceAbove < 80 && spaceBelow >= 80) {
        position = 'bottom';
      } else {
        
        position = spaceAbove >= spaceBelow ? 'top' : 'bottom';
      }
      
      setTooltipPosition(position);

      
      const tooltipMaxWidth = 300; 
      const centerPosition = rect.left + rect.width / 2;
      let leftPosition = centerPosition - tooltipMaxWidth / 2;
      
      
      if (leftPosition < 8) {
        leftPosition = 8;
      }
      
      
      if (leftPosition + tooltipMaxWidth > viewportWidth - 8) {
        leftPosition = viewportWidth - tooltipMaxWidth - 8;
      }
      
      
      const offsetFromCenter = leftPosition + tooltipMaxWidth / 2 - centerPosition;
      
      setTooltipStyle({
        transform: `translateX(calc(-50% + ${offsetFromCenter}px))`
      });
    }
  };

  return (
    <div 
      ref={containerRef}
      className="shortcut-tooltip-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={hide}
    >
      {children}
      {isHovered && (
        <div 
          className={`shortcut-tooltip ${tooltipPosition === 'bottom' ? 'tooltip-bottom' : 'tooltip-top'}`}
          style={tooltipStyle}
        >
          <div className="shortcut-tooltip-description">{description}</div>
          {shortcut && (
            <div className="shortcut-tooltip-keys">
              {shortcut.split('+').map((key, index) => (
                <React.Fragment key={index}>
                  <kbd className="shortcut-tooltip-key">{key}</kbd>
                  {index < shortcut.split('+').length - 1 && (
                    <span className="shortcut-tooltip-plus">+</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KeyboardShortcutHelper;
