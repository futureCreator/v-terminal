import { useState, useRef, useCallback } from "react";

export interface PasswordDialogState {
  visible: boolean;
  title: string;
  subtitle: string;
  description: string;
  input: string;
  error: string | null;
  connecting: boolean;
}

export interface PasswordDialogActions {
  prompt: (title: string, subtitle: string, description: string) => Promise<string | null>;
  submit: () => void;
  cancel: () => void;
  setInput: (value: string) => void;
  setError: (error: string | null) => void;
  setConnecting: (connecting: boolean) => void;
  hide: () => void;
}

/**
 * Manages password dialog state for SSH/WSL authentication flows.
 * Returns the dialog state and action handlers.
 */
export function usePasswordDialog(): [PasswordDialogState, PasswordDialogActions] {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState("SSH Authentication");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const resolverRef = useRef<((password: string | null) => void) | null>(null);

  const prompt = useCallback((t: string, sub: string, desc: string): Promise<string | null> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setTitle(t);
      setSubtitle(sub);
      setDescription(desc);
      setError(null);
      setInput("");
      setVisible(true);
    });
  }, []);

  const submit = useCallback(() => {
    if (resolverRef.current && !connecting) {
      setConnecting(true);
      setError(null);
      resolverRef.current(input);
      resolverRef.current = null;
      setInput("");
    }
  }, [input, connecting]);

  const cancel = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(null);
      resolverRef.current = null;
    }
    setVisible(false);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    setConnecting(false);
  }, []);

  const state: PasswordDialogState = { visible, title, subtitle, description, input, error, connecting };
  const actions: PasswordDialogActions = { prompt, submit, cancel, setInput, setError, setConnecting, hide };

  return [state, actions];
}
