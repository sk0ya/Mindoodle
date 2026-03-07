import React from 'react';
import { BaseModal, ModalFooterActions } from '../../Shared/BaseModal';

const DEFAULT_MAP_NAME = '新しいマップ';
const INVALID_MAP_NAME_CHARS = /[<>:"/\\|?*]/;
const INVALID_PATH_CHARS = /[<>:"\\|?*]/;

const createMapModalStyles = `
  .create-map-modal {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .path-input-wrap {
    position: relative;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .form-field input,
  .form-field select,
  .name-input-row {
    width: 100%;
    box-sizing: border-box;
    min-height: 40px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
  }

  .form-field input,
  .form-field select {
    padding: 0 12px;
    color: var(--text-primary);
    font-size: 14px;
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
  }

  .form-field select {
    appearance: none;
  }

  .form-field input:focus,
  .form-field select:focus,
  .name-input-row:focus-within {
    outline: none;
    border-color: color-mix(in srgb, var(--accent-color) 60%, var(--border-color));
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-color) 18%, transparent);
  }

  .name-input-row {
    display: flex;
    align-items: center;
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
  }

  .name-input-row input {
    flex: 1;
    min-width: 0;
    height: 38px;
    border: none;
    background: transparent;
    box-shadow: none;
  }

  .name-input-row input:focus {
    box-shadow: none;
  }

  .name-suffix {
    padding: 0 12px 0 0;
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .field-note {
    margin: -2px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary);
  }

  .path-suggestions {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 20;
    margin: 0;
    padding: 4px;
    list-style: none;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
    max-height: 220px;
    overflow-y: auto;
  }

  .path-suggestion {
    display: block;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-primary);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .path-suggestion:hover,
  .path-suggestion.is-active {
    background: color-mix(in srgb, var(--accent-color) 14%, transparent);
  }

  .form-error {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid rgba(220, 38, 38, 0.24);
    background: rgba(220, 38, 38, 0.08);
    color: #b91c1c;
    font-size: 13px;
    line-height: 1.5;
  }

  [data-theme="dark"] .form-error {
    color: #fca5a5;
    background: rgba(127, 29, 29, 0.35);
    border-color: rgba(248, 113, 113, 0.22);
  }

  @media (max-width: 640px) {
    .name-input-row {
      align-items: stretch;
    }
  }
`;

const normalizePathInput = (value: string): string =>
  value
    .replace(/\\/g, '/')
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)
    .join('/');

const hasInvalidPathSegments = (value: string): boolean =>
  normalizePathInput(value)
    .split('/')
    .filter(Boolean)
    .some(segment => segment === '.' || segment === '..');

const buildMapId = (path: string, name: string): string => (path ? `${path}/${name}` : name);

const getFilteredFolderSuggestions = (value: string, suggestions: string[]): string[] => {
  const normalizedValue = normalizePathInput(value).toLowerCase();

  if (!normalizedValue) {
    return suggestions.slice(0, 8);
  }

  const prefixMatches = suggestions.filter((suggestion) => suggestion.toLowerCase().startsWith(normalizedValue));
  const partialMatches = suggestions.filter((suggestion) => {
    const lowerSuggestion = suggestion.toLowerCase();
    return !lowerSuggestion.startsWith(normalizedValue) && lowerSuggestion.includes(normalizedValue);
  });

  return [...prefixMatches, ...partialMatches].slice(0, 8);
};

const getValidationError = ({
  workspaceId,
  path,
  name,
  existingMapIds,
}: {
  workspaceId: string | null;
  path: string;
  name: string;
  existingMapIds: string[];
}): string => {
  const normalizedPath = normalizePathInput(path);
  const trimmedName = name.trim();

  if (!workspaceId) {
    return 'マップを作成するワークスペースを選択してください。';
  }
  if (!trimmedName) {
    return 'マップ名を入力してください。';
  }
  if (trimmedName === '.' || trimmedName === '..') {
    return '`.` と `..` はマップ名に使えません。';
  }
  if (INVALID_MAP_NAME_CHARS.test(trimmedName)) {
    return 'マップ名に使用できない文字が含まれています。';
  }
  if (trimmedName.includes('/')) {
    return 'フォルダは path に入力し、マップ名には `/` を含めないでください。';
  }
  if (INVALID_PATH_CHARS.test(path)) {
    return 'path に使用できない文字が含まれています。';
  }
  if (hasInvalidPathSegments(path)) {
    return 'path に `.` や `..` は使えません。';
  }
  if (existingMapIds.includes(buildMapId(normalizedPath, trimmedName))) {
    return '同じ path に同名のマップが既に存在します。';
  }
  return '';
};

interface CreateMapModalProps {
  isOpen: boolean;
  workspaceId: string | null;
  workspaces: Array<{ id: string; name: string }>;
  initialPath: string;
  initialName?: string;
  existingMapIdsByWorkspace: Record<string, string[]>;
  folderSuggestionsByWorkspace: Record<string, string[]>;
  onClose: () => void;
  onCreate: (input: { name: string; path: string; workspaceId: string }) => Promise<void>;
}

interface CreateMapModalBodyProps {
  workspaceId: string | null;
  workspaces: Array<{ id: string; name: string }>;
  path: string;
  name: string;
  filteredPathSuggestions: string[];
  isPathSuggestionsOpen: boolean;
  activePathSuggestionIndex: number;
  validationError: string;
  submitError: string;
  nameInputRef: React.RefObject<HTMLInputElement>;
  pathInputRef: React.RefObject<HTMLInputElement>;
  onWorkspaceChange: (workspaceId: string) => void;
  onPathChange: (value: string) => void;
  onPathFocus: () => void;
  onPathBlur: () => void;
  onPathKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectPathSuggestion: (value: string) => void;
  onNameChange: (value: string) => void;
  onNameKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

function CreateMapModalBody({
  workspaceId,
  workspaces,
  path,
  name,
  filteredPathSuggestions,
  isPathSuggestionsOpen,
  activePathSuggestionIndex,
  validationError,
  submitError,
  nameInputRef,
  pathInputRef,
  onWorkspaceChange,
  onPathChange,
  onPathFocus,
  onPathBlur,
  onPathKeyDown,
  onSelectPathSuggestion,
  onNameChange,
  onNameKeyDown,
  onSubmit,
}: Readonly<CreateMapModalBodyProps>) {
  return (
    <>
      <form className="create-map-modal" onSubmit={onSubmit}>
        <label className="form-field">
          <span className="field-label">Workspace</span>
          <select
            value={workspaceId ?? ''}
            onChange={(event) => onWorkspaceChange(event.target.value)}
            disabled={workspaces.length === 0}
          >
            {workspaces.length === 0 ? (
              <option value="">ワークスペースがありません</option>
            ) : (
              <>
                <option value="">ワークスペースを選択</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </label>

        <label className="form-field">
          <span className="field-label">保存フォルダ</span>
          <div className="path-input-wrap">
            <input
              ref={pathInputRef}
              type="text"
              value={path}
              onChange={(event) => onPathChange(event.target.value)}
              onFocus={onPathFocus}
              onBlur={onPathBlur}
              onKeyDown={onPathKeyDown}
              placeholder="folder/subfolder"
              autoComplete="off"
            />
            {isPathSuggestionsOpen && filteredPathSuggestions.length > 0 && (
              <ul className="path-suggestions" role="listbox" aria-label="保存フォルダ候補">
                {filteredPathSuggestions.map((suggestion, index) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      className={`path-suggestion ${index === activePathSuggestionIndex ? 'is-active' : ''}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onSelectPathSuggestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <span className="field-note">空欄ならワークスペース直下に作成されます。</span>
        </label>

        <label className="form-field">
          <span className="field-label">マップ名</span>
          <div className="name-input-row">
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              onKeyDown={onNameKeyDown}
              placeholder={DEFAULT_MAP_NAME}
              autoComplete="off"
            />
            <span className="name-suffix">.md</span>
          </div>
        </label>

        {(validationError || submitError) && (
          <div className="form-error" role="alert">
            {submitError || validationError}
          </div>
        )}
      </form>

      <style>{createMapModalStyles}</style>
    </>
  );
}

export const CreateMapModal: React.FC<CreateMapModalProps> = ({
  isOpen,
  workspaceId,
  workspaces,
  initialPath,
  initialName = DEFAULT_MAP_NAME,
  existingMapIdsByWorkspace,
  folderSuggestionsByWorkspace,
  onClose,
  onCreate,
}: Readonly<CreateMapModalProps>) => {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState<string | null>(workspaceId);
  const [path, setPath] = React.useState(initialPath);
  const [name, setName] = React.useState(initialName);
  const [submitError, setSubmitError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isPathSuggestionsOpen, setIsPathSuggestionsOpen] = React.useState(false);
  const [activePathSuggestionIndex, setActivePathSuggestionIndex] = React.useState(-1);
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const pathInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedWorkspaceId(workspaceId);
    setPath(initialPath);
    setName(initialName);
    setSubmitError('');
    setIsSubmitting(false);
    setIsPathSuggestionsOpen(false);
    setActivePathSuggestionIndex(-1);

    const frameId = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [initialName, initialPath, isOpen, workspaceId]);
  const filteredPathSuggestions = React.useMemo(() => {
    if (!selectedWorkspaceId) {
      return [];
    }
    return getFilteredFolderSuggestions(path, folderSuggestionsByWorkspace[selectedWorkspaceId] || []);
  }, [folderSuggestionsByWorkspace, path, selectedWorkspaceId]);

  React.useEffect(() => {
    if (!isPathSuggestionsOpen || filteredPathSuggestions.length === 0) {
      setActivePathSuggestionIndex(-1);
      return;
    }

    setActivePathSuggestionIndex((prev) => {
      if (prev < 0 || prev >= filteredPathSuggestions.length) {
        return 0;
      }
      return prev;
    });
  }, [filteredPathSuggestions, isPathSuggestionsOpen]);

  if (!isOpen) {
    return null;
  }

  const validationError = getValidationError({
    workspaceId: selectedWorkspaceId,
    path,
    name,
    existingMapIds: selectedWorkspaceId ? (existingMapIdsByWorkspace[selectedWorkspaceId] || []) : [],
  });

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!selectedWorkspaceId || validationError) {
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      await onCreate({
        name: name.trim(),
        path: normalizePathInput(path),
        workspaceId: selectedWorkspaceId,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'マップの作成に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSubmitError = () => {
    if (submitError) {
      setSubmitError('');
    }
  };

  const applyPathSuggestion = (value: string) => {
    setPath(value);
    setIsPathSuggestionsOpen(false);
    setActivePathSuggestionIndex(-1);
    resetSubmitError();
    window.requestAnimationFrame(() => {
      pathInputRef.current?.focus();
    });
  };

  const handleNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const nativeEvent = event.nativeEvent as KeyboardEvent;
    if (event.key !== 'Enter' || nativeEvent.isComposing || nativeEvent.keyCode === 229) {
      return;
    }

    event.preventDefault();
    void handleSubmit();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="マップを作成"
      size="small"
      footer={(
        <ModalFooterActions
          onCancel={onClose}
          onSave={() => {
            void handleSubmit();
          }}
          cancelText="キャンセル"
          saveText={isSubmitting ? '作成中...' : '作成'}
          saveDisabled={isSubmitting || !!validationError}
        />
      )}
    >
      <CreateMapModalBody
        workspaceId={selectedWorkspaceId}
        workspaces={workspaces}
        path={path}
        name={name}
        filteredPathSuggestions={filteredPathSuggestions}
        isPathSuggestionsOpen={isPathSuggestionsOpen}
        activePathSuggestionIndex={activePathSuggestionIndex}
        validationError={validationError}
        submitError={submitError}
        nameInputRef={nameInputRef}
        pathInputRef={pathInputRef}
        onWorkspaceChange={(value) => {
          setSelectedWorkspaceId(value || null);
          setIsPathSuggestionsOpen(false);
          setActivePathSuggestionIndex(-1);
          resetSubmitError();
        }}
        onPathChange={(value) => {
          setPath(value);
          setIsPathSuggestionsOpen(true);
          resetSubmitError();
        }}
        onPathFocus={() => {
          if (selectedWorkspaceId && filteredPathSuggestions.length > 0) {
            setIsPathSuggestionsOpen(true);
          }
        }}
        onPathBlur={() => {
          setPath(prev => normalizePathInput(prev));
          setIsPathSuggestionsOpen(false);
          setActivePathSuggestionIndex(-1);
        }}
        onPathKeyDown={(event) => {
          if (!isPathSuggestionsOpen || filteredPathSuggestions.length === 0) {
            if (event.key === 'ArrowDown' && selectedWorkspaceId) {
              setIsPathSuggestionsOpen(true);
            }
            return;
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActivePathSuggestionIndex((prev) => (prev + 1) % filteredPathSuggestions.length);
            return;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActivePathSuggestionIndex((prev) => (
              prev <= 0 ? filteredPathSuggestions.length - 1 : prev - 1
            ));
            return;
          }

          if ((event.key === 'Enter' || event.key === 'Tab') && activePathSuggestionIndex >= 0) {
            event.preventDefault();
            applyPathSuggestion(filteredPathSuggestions[activePathSuggestionIndex]);
            return;
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            setIsPathSuggestionsOpen(false);
            setActivePathSuggestionIndex(-1);
          }
        }}
        onSelectPathSuggestion={applyPathSuggestion}
        onNameChange={(value) => {
          setName(value);
          resetSubmitError();
        }}
        onNameKeyDown={handleNameKeyDown}
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      />
    </BaseModal>
  );
};

export default CreateMapModal;
