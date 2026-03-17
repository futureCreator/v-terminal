import { useEffect, useState } from "react";
import "./Toast.css";

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

export function Toast({ message, visible, onHide, duration = 1500 }: ToastProps) {
  const [phase, setPhase] = useState<"in" | "out" | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      setPhase("in");
      let dismissTimer: ReturnType<typeof setTimeout>;
      const timer = setTimeout(() => {
        setPhase("out");
        dismissTimer = setTimeout(() => {
          setShow(false);
          setPhase(null);
          onHide();
        }, 150);
      }, duration);
      return () => {
        clearTimeout(timer);
        clearTimeout(dismissTimer);
      };
    }
  }, [visible, duration, onHide]);

  if (!show) return null;

  return (
    <div className={`toast${phase === "out" ? " toast--out" : ""}`}>
      {message}
    </div>
  );
}
