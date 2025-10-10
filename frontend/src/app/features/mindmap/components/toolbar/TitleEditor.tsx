import React, { useState, useCallback } from 'react';
import { useBooleanState } from '@shared/hooks/ui/useBooleanState';
import { useActivityLifecycle } from '../../hooks/useEditingState';

interface TitleEditorProps {
  title: string;
  onTitleChange: (title: string) => void;
}

const TitleEditor: React.FC<TitleEditorProps> = ({
  title,
  onTitleChange
}) => {
  const { value: isEditingTitle, setTrue: startEditing, setFalse: stopEditing } = useBooleanState({ initialValue: false });
  const [tempTitle, setTempTitle] = useState<string>(title);
  
  
  useActivityLifecycle('typing', isEditingTitle);

  const handleTitleClick = useCallback((): void => {
    startEditing();
    setTempTitle(title);
  }, [title, startEditing]);

  const handleTitleSave = useCallback((): void => {
    onTitleChange(tempTitle);
    stopEditing();
  }, [tempTitle, onTitleChange, stopEditing]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      stopEditing();
      setTempTitle(title);
    }
  }, [handleTitleSave, title, stopEditing]);

  const handleTitleBlur = useCallback((): void => {
    handleTitleSave();
  }, [handleTitleSave]);

  return (
    <div className="title-section">
      {isEditingTitle ? (
        <input
          type="text"
          value={tempTitle}
          onChange={(e) => setTempTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          autoFocus
          className="title-input"
        />
      ) : (
        <h1 
          className="app-title" 
          onClick={handleTitleClick}
          title="クリックして編集"
        >
          {title}
        </h1>
      )}
    </div>
  );
};

export default TitleEditor;
