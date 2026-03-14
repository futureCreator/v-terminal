import { useState } from "react";
import { useAlarmStore } from "../../store/alarmStore";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export function RecurringSection() {
  const [collapsed, setCollapsed] = useState(false);
  const [newTime, setNewTime] = useState("09:00");
  const [newLabel, setNewLabel] = useState("");
  const [newWeekdays, setNewWeekdays] = useState<boolean[]>([true, true, true, true, true, false, false]);

  const alarms = useAlarmStore((s) => s.alarms);
  const { addAlarm, removeAlarm, toggleAlarm } = useAlarmStore();

  const enabledCount = alarms.filter((a) => a.enabled).length;

  const handleAdd = () => {
    if (!newTime) return;
    if (!newWeekdays.some(Boolean)) return;
    addAlarm(newLabel.trim() || `${newTime} 알림`, newTime, [...newWeekdays]);
    setNewLabel("");
  };

  const toggleWeekday = (index: number) => {
    const next = [...newWeekdays];
    next[index] = !next[index];
    setNewWeekdays(next);
  };

  return (
    <div className="alarm-section">
      <button
        className="alarm-section-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <svg
          className={`alarm-chevron${collapsed ? "" : " alarm-chevron--open"}`}
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
        >
          <path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="alarm-section-label">반복 알림</span>
        {alarms.length > 0 && (
          <span className="alarm-section-count">
            {enabledCount}/{alarms.length}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="recurring-body">
          {alarms.length > 0 && (
            <div className="recurring-list">
              {alarms.map((alarm) => (
                <div key={alarm.id} className={`recurring-item${!alarm.enabled ? " recurring-item--disabled" : ""}`}>
                  <div className="recurring-item-top">
                    <span className="recurring-time">{alarm.time}</span>
                    <span className="recurring-label-text">{alarm.label}</span>
                    <button
                      className={`recurring-toggle${alarm.enabled ? " recurring-toggle--on" : ""}`}
                      onClick={() => toggleAlarm(alarm.id)}
                      aria-label={alarm.enabled ? "비활성화" : "활성화"}
                    >
                      <span className="recurring-toggle-thumb" />
                    </button>
                    <button
                      className="recurring-delete"
                      onClick={() => removeAlarm(alarm.id)}
                      aria-label="삭제"
                      title="삭제"
                    >
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="recurring-weekdays-display">
                    {WEEKDAY_LABELS.map((label, i) => (
                      <span
                        key={i}
                        className={`recurring-weekday-dot${alarm.weekdays[i] ? " recurring-weekday-dot--active" : ""}`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="recurring-add-form">
            <div className="recurring-add-top">
              <input
                className="recurring-time-input"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
              <input
                className="recurring-label-input"
                type="text"
                placeholder="알림 이름"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              />
            </div>
            <div className="recurring-add-bottom">
              <div className="recurring-weekday-picker">
                {WEEKDAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    className={`recurring-weekday-btn${newWeekdays[i] ? " recurring-weekday-btn--active" : ""}`}
                    onClick={() => toggleWeekday(i)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                className="recurring-add-btn"
                onClick={handleAdd}
                title="추가"
                disabled={!newTime || !newWeekdays.some(Boolean)}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
