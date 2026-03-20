import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTodoStore } from "../../store/todoStore";
import { useTerminalConfigStore } from "../../store/terminalConfigStore";

export function TodoSection() {
  const { t } = useTranslation();
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [fadingId, setFadingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inlineInputRef = useRef<HTMLSpanElement>(null);

  const todos = useTodoStore((s) => s.todos);
  const { addTodo, toggleTodo, removeTodo, updateTodoText, clearCompleted } =
    useTodoStore();
  const fontSize = useTerminalConfigStore((s) => s.fontSize);

  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);
  const total = todos.length;
  const completed = completedTodos.length;
  const remaining = activeTodos.length;

  const handleBlurEdit = useCallback(
    (todoId: string, text: string) => {
      const trimmed = text.trim();
      if (trimmed) {
        updateTodoText(todoId, trimmed);
      } else {
        removeTodo(todoId);
      }
    },
    [updateTodoText, removeTodo],
  );

  const handleCheck = useCallback(
    (todoId: string) => {
      const todo = todos.find((t) => t.id === todoId);
      if (todo && !todo.completed) {
        setFadingId(todoId);
        setTimeout(() => {
          toggleTodo(todoId);
          setFadingId(null);
        }, 300);
      } else {
        toggleTodo(todoId);
      }
    },
    [todos, toggleTodo],
  );

  const handleRemove = useCallback(
    (todoId: string) => {
      setRemovingId(todoId);
      setTimeout(() => {
        removeTodo(todoId);
        setRemovingId(null);
      }, 200);
    },
    [removeTodo],
  );

  // Focus the inline input when isAddingNew becomes true
  useEffect(() => {
    if (isAddingNew && inlineInputRef.current) {
      inlineInputRef.current.focus();
    }
  }, [isAddingNew]);

  const handleInlineInputBlur = useCallback(
    (e: React.FocusEvent<HTMLSpanElement>) => {
      const text = e.currentTarget.textContent?.trim() ?? "";
      if (text) {
        addTodo(text);
        e.currentTarget.textContent = "";
      }
      setIsAddingNew(false);
    },
    [addTodo],
  );

  const handleInlineInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const text = e.currentTarget.textContent?.trim() ?? "";
        if (text) {
          addTodo(text);
          e.currentTarget.textContent = "";
        }
        // Keep focus for rapid entry
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.currentTarget.textContent = "";
        (e.currentTarget as HTMLElement).blur();
      }
    },
    [addTodo],
  );

  const handleKeyDown = useCallback(
    (todoId: string, e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur();
        // After committing current edit, focus the inline input
        setIsAddingNew(true);
      }
    },
    [],
  );

  const handleGhostRowClick = useCallback(() => {
    setIsAddingNew(true);
  }, []);

  return (
    <div className="todo-section">
      {/* Counter bar — always rendered for stable layout */}
      <div className={`todo-counter-bar${total === 0 ? " todo-counter-bar--hidden" : ""}`}>
        <span className="todo-counter-remaining">
          {t('todo.remaining', { count: remaining })}
        </span>
        <span className="todo-counter-fraction">
          {completed}/{total}
        </span>
      </div>

      {/* Todo list — always rendered for stable layout */}
      <div className="todo-list" ref={listRef}>
        {activeTodos.length === 0 && !isAddingNew && (
          <div className="todo-empty">
            <svg className="todo-empty-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 9l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="8" y1="15" x2="16" y2="15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="8" y1="18" x2="13" y2="18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span className="todo-empty-text">{t('todo.empty')}</span>
          </div>
        )}

        {activeTodos.map((todo) => (
          <div
            key={todo.id}
            className={`todo-item todo-item--enter${fadingId === todo.id ? " todo-item--fading" : ""}${removingId === todo.id ? " todo-item--removing" : ""}`}
          >
            <button
              className="todo-checkbox"
              onClick={() => handleCheck(todo.id)}
              aria-label={t('todo.markComplete')}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="10" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
            <span
              className="todo-text"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              style={{ fontSize: `${fontSize}px` }}
              onBlur={(e) =>
                handleBlurEdit(todo.id, e.currentTarget.textContent ?? "")
              }
              onKeyDown={(e) => handleKeyDown(todo.id, e)}
            >
              {todo.text}
            </span>
            <button
              className="todo-delete"
              onClick={() => handleRemove(todo.id)}
              aria-label={t('todo.delete')}
              title={t('todo.delete')}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2 2l6 6M8 2l-6 6"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}

        {/* Inline input row — ghost or active */}
        <div
          className={`todo-item todo-inline-row${isAddingNew ? " todo-inline-row--active" : ""}`}
          onClick={!isAddingNew ? handleGhostRowClick : undefined}
        >
          <div className="todo-inline-checkbox">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
            </svg>
          </div>
          {isAddingNew ? (
            <span
              ref={inlineInputRef}
              className="todo-text todo-inline-input"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              style={{ fontSize: `${fontSize}px` }}
              onBlur={handleInlineInputBlur}
              onKeyDown={handleInlineInputKeyDown}
            />
          ) : (
            <span className="todo-inline-placeholder" style={{ fontSize: `${fontSize}px` }}>
              {t('todo.newTaskPlaceholder')}
            </span>
          )}
        </div>
      </div>

      {/* Completed section — progressive disclosure */}
      {completed > 0 && (
        <div className="todo-completed-section">
          <button
            className="todo-completed-toggle"
            onClick={() => setCompletedCollapsed((c) => !c)}
            aria-expanded={!completedCollapsed}
          >
            <svg
              className={`todo-completed-chevron${completedCollapsed ? "" : " todo-completed-chevron--open"}`}
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
            >
              <path
                d="M3 2L7 5L3 8"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="todo-completed-label">
              {t('todo.completedSection')}
            </span>
            <span className="todo-completed-badge">{completed}</span>
            <button
              className="todo-clear-all"
              onClick={(e) => {
                e.stopPropagation();
                clearCompleted();
              }}
            >
              {t('todo.clearAll')}
            </button>
          </button>

          <div className={`todo-completed-list${completedCollapsed ? " todo-completed-list--collapsed" : ""}`}>
            {completedTodos.map((todo) => (
              <div key={todo.id} className="todo-item todo-item--done">
                <button
                  className="todo-checkbox"
                  onClick={() => toggleTodo(todo.id)}
                  aria-label={t('todo.markIncomplete')}
                >
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <circle cx="11" cy="11" r="10" fill="var(--accent)"/>
                    <path
                      className="todo-checkmark"
                      d="M7 11.5L10 14.5 15.5 8"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span
                  className="todo-text"
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  style={{ fontSize: `${fontSize}px` }}
                  onBlur={(e) =>
                    handleBlurEdit(todo.id, e.currentTarget.textContent ?? "")
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).blur();
                    }
                  }}
                >
                  {todo.text}
                </span>
                <button
                  className="todo-delete"
                  onClick={() => handleRemove(todo.id)}
                  aria-label={t('todo.delete')}
                  title={t('todo.delete')}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 2l6 6M8 2l-6 6"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
