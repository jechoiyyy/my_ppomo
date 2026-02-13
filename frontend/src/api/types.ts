export type User = {
  id: string;
  email: string;
  timezone: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "done";
  plannedDate: string | null;
  estimatePomodoros: number;
  completedPomodoros: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  id: string;
  taskId: string | null;
  sessionType: "focus" | "short_break" | "long_break";
  durationSec: number;
  startedAt: string;
  endedAt: string | null;
  status: "in_progress" | "completed" | "cancelled";
};

export type Settings = {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  longBreakInterval: number;
  autoStartBreak: boolean;
  autoStartFocus: boolean;
  soundEnabled: boolean;
  timezone: string;
};
