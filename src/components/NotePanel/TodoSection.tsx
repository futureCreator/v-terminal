import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTodoStore } from "../../store/todoStore";
import { useTerminalConfigStore } from "../../store/terminalConfigStore";

export function TodoSection() {
  const { t } = useTranslation();
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [fadingId, setFadingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  const [pendingFocus, setPendingFocus] = useState(false);

  const handleNewTodo = useCallback(() => {
    addTodo("");
    setPendingFocus(true);
  }, [addTodo]);

  // Focus the last todo text after React renders the new item
  useEffect(() => {
    if (!pendingFocus || !listRef.current) return;
    setPendingFocus(false);
    const items = listRef.current.querySelectorAll(".todo-text");
    const lastItem = items[items.length - 1] as HTMLElement;
    if (lastItem) lastItem.focus();
  }, [pendingFocus, todos]);

  const handleKeyDown = useCallback(
    (todoId: string, e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur();
        // After committing current edit, create a new todo for rapid entry
        handleNewTodo();
      }
    },
    [handleNewTodo],
  );

  return (
    <div className="todo-section">
      {/* Counter bar — hidden when empty */}
      {total > 0 && (
        <div className="todo-counter-bar">
          <span className="todo-counter-remaining">
            {t('todo.remaining', { count: remaining })}
          </span>
          <span className="todo-counter-fraction">
            {completed}/{total}
          </span>
        </div>
      )}

      {/* Empty state */}
      {total === 0 && (
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

      {/* Active todo list */}
      {activeTodos.length > 0 && (
        <div className="todo-list" ref={listRef}>
          {activeTodos.map((todo) => (
            <div
              key={todo.id}
              className={`todo-item${fadingId === todo.id ? " todo-item--fading" : ""}`}
            >
              <button
                className="todo-checkbox"
                onClick={() => handleCheck(todo.id)}
                aria-label={t('todo.markComplete')}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5"/>
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
                onClick={() => removeTodo(todo.id)}
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
      )}

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
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
            >
              <path
                d="M2 1.5L5.5 4 2 6.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="todo-completed-label">
              {t('todo.completedSection')}
            </span>
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

          {!completedCollapsed && (
            <div className="todo-completed-list">
              {completedTodos.map((todo) => (
                <div key={todo.id} className="todo-item todo-item--done">
                  <button
                    className="todo-checkbox"
                    onClick={() => toggleTodo(todo.id)}
                    aria-label={t('todo.markIncomplete')}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <circle cx="9" cy="9" r="8" fill="var(--accent)"/>
                      <path
                        d="M5.5 9.5L8 12 12.5 6.5"
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
                    onClick={() => removeTodo(todo.id)}
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
          )}
        </div>
      )}

      {/* Bottom: + New Todo button */}
      <button className="todo-new-btn" onClick={handleNewTodo}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="var(--accent)"/>
          <path d="M8 5v6M5 8h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="todo-new-btn-text">{t('todo.newTodo')}</span>
      </button>
    </div>
  );
}
