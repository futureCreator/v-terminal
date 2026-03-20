import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTodoStore } from "../../store/todoStore";
import { useTerminalConfigStore } from "../../store/terminalConfigStore";

export function TodoSection() {
  const { t } = useTranslation();
  const [completedOpen, setCompletedOpen] = useState(false);
  const [fadingId, setFadingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const inlineInputRef = useRef<HTMLSpanElement>(null);

  const todos = useTodoStore((s) => s.todos);
  const { addTodo, toggleTodo, removeTodo, updateTodoText, clearCompleted } =
    useTodoStore();
  const fontSize = useTerminalConfigStore((s) => s.fontSize);

  const activeTodos = todos.filter((todo) => !todo.completed);
  const completedTodos = todos.filter((todo) => todo.completed);
  const completedCount = completedTodos.length;

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
        }, 200);
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
      }, 150);
    },
    [removeTodo],
  );

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
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.currentTarget.textContent = "";
        (e.currentTarget as HTMLElement).blur();
      }
    },
    [addTodo],
  );

  const handleKeyDown = useCallback(
    (_todoId: string, e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur();
        setIsAddingNew(true);
      }
    },
    [],
  );

  const handleGhostClick = useCallback(() => {
    setIsAddingNew(true);
  }, []);

  return (
    <div className="todo-section">
      <div className="todo-scroll">
        {activeTodos.map((todo) => (
          <div
            key={todo.id}
            className={`todo-item${fadingId === todo.id ? " todo-item--fading" : ""}${removingId === todo.id ? " todo-item--removing" : ""}`}
          >
            <button
              className="todo-check"
              onClick={() => handleCheck(todo.id)}
              aria-label={t("todo.markComplete")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
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
              className="todo-rm"
              onClick={() => handleRemove(todo.id)}
              aria-label={t("todo.delete")}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path
                  d="M1.5 1.5l5 5M6.5 1.5l-5 5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}

        <div
          className={`todo-item todo-ghost${isAddingNew ? " todo-ghost--active" : ""}`}
          onClick={!isAddingNew ? handleGhostClick : undefined}
        >
          <div className="todo-check todo-check--ghost">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle
                cx="8"
                cy="8"
                r="7"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeDasharray="3 2.5"
              />
            </svg>
          </div>
          {isAddingNew ? (
            <span
              ref={inlineInputRef}
              className="todo-text todo-input"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              style={{ fontSize: `${fontSize}px` }}
              onBlur={handleInlineInputBlur}
              onKeyDown={handleInlineInputKeyDown}
            />
          ) : (
            <span
              className="todo-placeholder"
              style={{ fontSize: `${fontSize}px` }}
            >
              {t("todo.newTaskPlaceholder")}
            </span>
          )}
        </div>

        {completedCount > 0 && (
          <div className="todo-done">
            <div className="todo-done-bar">
              <button
                className="todo-done-toggle"
                onClick={() => setCompletedOpen((o) => !o)}
                aria-expanded={completedOpen}
              >
                <svg
                  className={`todo-done-chevron${completedOpen ? " todo-done-chevron--open" : ""}`}
                  width="8"
                  height="8"
                  viewBox="0 0 8 8"
                  fill="none"
                >
                  <path
                    d="M2 1L6 4L2 7"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="todo-done-label">
                  {t("todo.completedSection")}
                </span>
                <span className="todo-done-count">{completedCount}</span>
              </button>
              <button className="todo-done-clear" onClick={clearCompleted}>
                {t("todo.clearAll")}
              </button>
            </div>

            {completedOpen &&
              completedTodos.map((todo) => (
                <div
                  key={todo.id}
                  className={`todo-item todo-item--done${removingId === todo.id ? " todo-item--removing" : ""}`}
                >
                  <button
                    className="todo-check"
                    onClick={() => toggleTodo(todo.id)}
                    aria-label={t("todo.markIncomplete")}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="var(--accent)" />
                      <path
                        d="M5 8.2L7 10.2L11 5.8"
                        stroke="white"
                        strokeWidth="1.3"
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
                      handleBlurEdit(
                        todo.id,
                        e.currentTarget.textContent ?? "",
                      )
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
                    className="todo-rm"
                    onClick={() => handleRemove(todo.id)}
                    aria-label={t("todo.delete")}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path
                        d="M1.5 1.5l5 5M6.5 1.5l-5 5"
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
    </div>
  );
}
