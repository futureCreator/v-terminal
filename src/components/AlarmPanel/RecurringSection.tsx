import { useState } from "react";
import { useAlarmStore } from "../../store/alarmStore";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export function RecurringSection() {
  const [newTime, setNewTime] = useState("09:00");
  const [newLabel, setNewLabel] = useState("");
  const [newWeekdays, setNewWeekdays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [showForm, setShowForm] = useState(false);

  const alarms = useAlarmStore((s) => s.alarms);
  const { addAlarm, removeAlarm, toggleAlarm } = useAlarmStore();

  const handleAdd = () => {
    if (!newTime) return;
    if (!newWeekdays.some(Boolean)) return;
    addAlarm(newLabel.trim() || `${newTime} 알림`, newTime, [...newWeekdays]);
    setNewLabel("");
    setShowForm(false);
  };

  const toggleWeekday = (index: number) => {
    const next = [...newWeekdays];
    next[index] = !next[index];
    setNewWeekdays(next);
  };

  return (
    <div className="recurring-section">
      {/* Alarm list */}
      {alarms.length > 0 && (
        <div className="recurring-list">
          {alarms.map((alarm) => (
            <div key={alarm.id} className={`recurring-item${!alarm.enabled ? " recurring-item--disabled" : ""}`}>
              <div className="recurring-item-row">
                <div className="recurring-item-info">
                  <span className="recurring-time">{alarm.time}</span>
                  <span className="recurring-label-text">{alarm.label}</span>
                </div>
                <button
                  className={`recurring-toggle${alarm.enabled ? " recurring-toggle--on" : ""}`}
                  onClick={() => toggleAlarm(alarm.id)}
                  aria-label={alarm.enabled ? "비활성화" : "활성화"}
                >
                  <span className="recurring-toggle-thumb" />
                </button>
              </div>
              <div className="recurring-item-bottom">
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
            </div>
          ))}
        </div>
      )}

      {alarms.length === 0 && !showForm && (
        <div className="recurring-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span>등록된 알림이 없습니다</span>
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="recurring-add-form">
          <div className="recurring-form-header">
            <span className="recurring-form-title">새 알림</span>
            <button className="recurring-form-cancel" onClick={() => setShowForm(false)}>
              취소
            </button>
          </div>
          <input
            className="recurring-time-input"
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
          />
          <input
            className="recurring-label-input"
            type="text"
            placeholder="알림 이름 (선택)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
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
            className="recurring-save-btn"
            onClick={handleAdd}
            disabled={!newTime || !newWeekdays.some(Boolean)}
          >
            저장
          </button>
        </div>
      ) : (
        <button className="recurring-add-trigger" onClick={() => setShowForm(true)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span>알림 추가</span>
        </button>
      )}
    </div>
  );
}
