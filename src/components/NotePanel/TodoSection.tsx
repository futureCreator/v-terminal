import { useState, useRef, useCallback } from "react";
import { useNoteStore } from "../../store/noteStore";

interface TodoSectionProps {
  tabId: string;
}

export function TodoSection({ tabId }: TodoSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const todos = useNoteStore((s) => s.notes[tabId]?.todos ?? []);
  const { addTodo, toggleTodo, removeTodo, updateTodoText, clearCompleted } =
    useNoteStore();

  const completed = todos.filter((t) => t.completed).length;
  const total = todos.length;

  const handleAdd = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      const text = (e.target as HTMLInputElement).value.trim();
      if (!text) return;
      addTodo(tabId, text);
      (e.target as HTMLInputElement).value = "";
    },
    [tabId, addTodo],
  );

  const handleBlurEdit = useCallback(
    (todoId: string, text: string) => {
      const trimmed = text.trim();
      if (trimmed) {
        updateTodoText(tabId, todoId, trimmed);
      } else {
        removeTodo(tabId, todoId);
      }
    },
    [tabId, updateTodoText, removeTodo],
  );

  return (
    <div className="todo-section">
      <button
        className="todo-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <svg
          className={`todo-chevron ${collapsed ? "" : "todo-chevron--open"}`}
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
        <span className="todo-header-label">TODO</span>
        {total > 0 && (
          <span className="todo-header-count">
            {completed}/{total}
          </span>
        )}
        {completed > 0 && (
          <button
            className="todo-clear-btn"
            onClick={(e) => {
              e.stopPropagation();
              clearCompleted(tabId);
            }}
            aria-label="Clear completed"
            title="Clear completed"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 3h7M4.5 3V2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M5 5.5v3M7 5.5v3M3.5 3l.5 7a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1l.5-7"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </button>

      {!collapsed && (
        <div className="todo-body">
          <div className="todo-list">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={`todo-item ${todo.completed ? "todo-item--done" : ""}`}
              >
                <button
                  className="todo-checkbox"
                  onClick={() => toggleTodo(tabId, todo.id)}
                  aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}
                >
                  {todo.completed ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect
                        x="1"
                        y="1"
                        width="12"
                        height="12"
                        rx="3"
                        fill="var(--accent)"
                      />
                      <path
                        d="M4 7.2L6 9.2 10 4.8"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect
                        x="1.5"
                        y="1.5"
                        width="11"
                        height="11"
                        rx="2.5"
                        stroke="var(--label-tertiary)"
                        strokeWidth="1.2"
                      />
                    </svg>
                  )}
                </button>
                <span
                  className="todo-text"
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={(e) =>
                    handleBlurEdit(todo.id, e.currentTarget.textContent ?? "")
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                >
                  {todo.text}
                </span>
                <button
                  className="todo-delete"
                  onClick={() => removeTodo(tabId, todo.id)}
                  aria-label="Delete"
                  title="Delete"
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
          <div className="todo-input-wrap">
            <input
              ref={inputRef}
              className="todo-input"
              type="text"
              placeholder="Add a task..."
              onKeyDown={handleAdd}
            />
          </div>
        </div>
      )}
    </div>
  );
}
