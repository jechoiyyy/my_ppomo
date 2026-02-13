import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, getTokens, setTokens } from "./api/client";
import type { Settings, Session, Task, User } from "./api/types";

type TaskFilter = "today" | "tomorrow" | "all" | "completed";
type TimerMode = "focus" | "short_break" | "long_break";
type TaskPriority = "low" | "medium" | "high";

type TaskListResponse = { items: Task[]; page: number; pageSize: number; total: number };
type DailyStats = { date: string; focusCount: number; totalFocusMinutes: number; completedTasks: number };
type WeeklyStats = { start: string; days: Record<string, number> };
type SessionListResponse = { items: Session[]; page: number; pageSize: number; total: number };

const FILTERS: Array<{ key: TaskFilter; label: string }> = [
  { key: "today", label: "오늘" },
  { key: "tomorrow", label: "내일" },
  { key: "all", label: "할 일" },
  { key: "completed", label: "완료됨" }
];

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("admin@local.test");
  const [password, setPassword] = useState("admin1234");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<TaskFilter>("today");
  const signatureRef = useRef("");

  const [title, setTitle] = useState("");
  const [composePriority, setComposePriority] = useState<TaskPriority>("medium");
  const [composeEstimate, setComposeEstimate] = useState(1);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskDetailDescription, setTaskDetailDescription] = useState("");
  const [taskDetailPriority, setTaskDetailPriority] = useState<TaskPriority>("medium");
  const [taskDetailEstimate, setTaskDetailEstimate] = useState(1);

  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [timerMode, setTimerMode] = useState<TimerMode>("short_break");
  const [remaining, setRemaining] = useState(0);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<Settings | null>(null);
  const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tomorrow = useMemo(() => shiftDate(today, 1), [today]);
  const weeklyStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  }, []);

  const selectedTask = tasks.find((task) => task.id === activeTaskId) ?? tasks[0] ?? null;
  const plannedMinutes = (settings?.focusMin ?? 25) * tasks.reduce((sum, task) => sum + task.estimatePomodoros, 0);
  const completionRate =
    tasks.length === 0 ? 0 : Math.min(100, Math.round((tasks.filter((task) => task.status === "done").length / tasks.length) * 100));

  async function bootstrap(): Promise<void> {
    try {
      const me = await apiFetch<User>("/auth/me");
      setUser(me);
      await apiFetch<{ resetCount: number; timerState: string }>("/sessions/recovery/reset", { method: "POST" });
      setTimerMode("short_break");
      await loadData(filter);
    } catch {
      setUser(null);
      setTokens(null);
    }
  }

  async function loadData(nextFilter: TaskFilter): Promise<void> {
    const [taskRes, settingRes, dailyRes, weeklyRes, sessionRes] = await Promise.all([
      apiFetch<TaskListResponse>(`/tasks?filter=${nextFilter}&page=1&pageSize=100`),
      apiFetch<Settings>("/settings"),
      apiFetch<DailyStats>(`/stats/daily?date=${today}`),
      apiFetch<WeeklyStats>(`/stats/weekly?start=${weeklyStart}`),
      apiFetch<SessionListResponse>(`/sessions?from=${today}&to=${tomorrow}&page=1&pageSize=20`)
    ]);

    setTasks(taskRes.items);
    signatureRef.current = taskRes.items.map((t) => `${t.id}:${t.version}:${t.updatedAt}`).join("|");

    setSettings(settingRes);
    setSettingsDraft(settingRes);
    setTodayStats(dailyRes);
    setWeeklyStats(weeklyRes);
    setTodaySessions(sessionRes.items);
  }

  async function refreshTasksSilently(): Promise<void> {
    const taskRes = await apiFetch<TaskListResponse>(`/tasks?filter=${filter}&page=1&pageSize=100`);
    const newSignature = taskRes.items.map((t) => `${t.id}:${t.version}:${t.updatedAt}`).join("|");

    if (signatureRef.current && signatureRef.current !== newSignature) {
      setWarning("다른 PC에서 변경됨. 최신 데이터로 갱신합니다.");
      setTasks(taskRes.items);
      signatureRef.current = newSignature;
    }
  }

  useEffect(() => {
    if (getTokens()) {
      void bootstrap();
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadData(filter);
  }, [filter, user]);

  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => {
      void refreshTasksSilently().catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(id);
  }, [user, filter]);

  useEffect(() => {
    if (!activeSession || remaining <= 0) return;
    const id = window.setInterval(() => setRemaining((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [activeSession, remaining]);

  useEffect(() => {
    if (!activeSession || remaining > 0) return;
    void completeSession();
  }, [remaining, activeSession]);

  useEffect(() => {
    if (!warning && !error) return;
    const id = window.setTimeout(() => {
      setWarning(null);
      setError(null);
    }, 3500);
    return () => window.clearTimeout(id);
  }, [warning, error]);

  useEffect(() => {
    if (tasks.length === 0) {
      setActiveTaskId(null);
      return;
    }
    if (!activeTaskId || !tasks.some((task) => task.id === activeTaskId)) {
      setActiveTaskId(tasks[0].id);
    }
  }, [tasks, activeTaskId]);

  useEffect(() => {
    if (!selectedTask) return;
    setTaskDetailDescription(selectedTask.description ?? "");
    setTaskDetailPriority(selectedTask.priority);
    setTaskDetailEstimate(selectedTask.estimatePomodoros);
  }, [selectedTask?.id]);

  async function handleLogin(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const data = await apiFetch<{ accessToken: string; refreshToken: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setUser(data.user);
      await bootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 실패");
    }
  }

  async function addTask(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!title.trim()) return;
    setError(null);
    try {
      const plannedDate = filter === "tomorrow" ? tomorrow : filter === "today" ? today : undefined;
      await apiFetch<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          plannedDate,
          estimatePomodoros: composeEstimate,
          priority: composePriority
        })
      });
      setTitle("");
      setComposePriority("medium");
      setComposeEstimate(1);
      await loadData(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "할 일 생성 실패");
    }
  }

  async function updateTask(task: Task, patch: Partial<Task>): Promise<void> {
    setError(null);
    setWarning(null);
    try {
      await apiFetch<Task>(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...patch, version: task.version })
      });
      await loadData(filter);
    } catch (err) {
      const message = err instanceof Error ? err.message : "업데이트 실패";
      if (message.includes("다른 PC에서 변경됨")) {
        setWarning("다른 PC에서 변경됨. 최신 데이터로 갱신합니다.");
        await loadData(filter);
        return;
      }
      setError(message);
    }
  }

  async function saveTaskDetail(): Promise<void> {
    if (!selectedTask) return;
    await updateTask(selectedTask, {
      description: taskDetailDescription,
      priority: taskDetailPriority,
      estimatePomodoros: taskDetailEstimate
    });
  }

  async function removeTask(taskId: string): Promise<void> {
    setError(null);
    await apiFetch<void>(`/tasks/${taskId}`, { method: "DELETE" }).catch((err) => {
      setError(err instanceof Error ? err.message : "삭제 실패");
    });
    await loadData(filter);
  }

  function getModeDurationSec(mode: TimerMode): number {
    if (!settings) return 0;
    if (mode === "focus") return settings.focusMin * 60;
    if (mode === "short_break") return settings.shortBreakMin * 60;
    return settings.longBreakMin * 60;
  }

  async function startSession(mode: TimerMode): Promise<void> {
    setError(null);
    if (!settings) return;
    try {
      const session = await apiFetch<Session>("/sessions/start", {
        method: "POST",
        body: JSON.stringify({
          taskId: mode === "focus" ? activeTaskId : null,
          sessionType: mode,
          durationSec: getModeDurationSec(mode)
        })
      });
      setTimerMode(mode);
      setActiveSession(session);
      setRemaining(session.durationSec);
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 시작 실패");
    }
  }

  function playBell(): void {
    if (!settings?.soundEnabled) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  }

  async function completeSession(): Promise<void> {
    if (!activeSession) return;
    setError(null);

    const completedType = activeSession.sessionType;
    try {
      await apiFetch<Session>(`/sessions/${activeSession.id}/complete`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setActiveSession(null);
      setRemaining(0);
      playBell();
      await loadData(filter);

      if (!settings) {
        setTimerMode("short_break");
        return;
      }

      if (completedType === "focus") {
        const nextCount = (todayStats?.focusCount ?? 0) + 1;
        const interval = Math.max(2, settings.longBreakInterval || 4);
        const nextMode: TimerMode = nextCount % interval === 0 ? "long_break" : "short_break";
        setTimerMode(nextMode);
        if (settings.autoStartBreak) {
          await startSession(nextMode);
        }
      } else {
        setTimerMode("focus");
        if (settings.autoStartFocus) {
          await startSession("focus");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 완료 실패");
    }
  }

  async function cancelSession(): Promise<void> {
    if (!activeSession) return;
    setError(null);
    try {
      await apiFetch<Session>(`/sessions/${activeSession.id}/cancel`, { method: "POST", body: JSON.stringify({}) });
      setActiveSession(null);
      setRemaining(0);
      setTimerMode("short_break");
      await loadData(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 취소 실패");
    }
  }

  async function saveSettings(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!settingsDraft) return;
    setError(null);
    try {
      const updated = await apiFetch<Settings>("/settings", {
        method: "PATCH",
        body: JSON.stringify(settingsDraft)
      });
      setSettings(updated);
      setSettingsDraft(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "설정 저장 실패");
    }
  }

  async function logout(): Promise<void> {
    const tokens = getTokens();
    if (tokens?.refreshToken) {
      await apiFetch<void>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: tokens.refreshToken })
      }).catch(() => undefined);
    }
    setTokens(null);
    setUser(null);
    setTasks([]);
    setSettings(null);
    setSettingsDraft(null);
    setTodayStats(null);
    setWeeklyStats(null);
    setTodaySessions([]);
    setActiveSession(null);
    setWarning(null);
  }

  if (!user) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <h1>Pomodoro Sync Planner</h1>
          <p>Focus To-Do 스타일 개인 집중 도구</p>
          <form onSubmit={handleLogin}>
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </label>
            <label>
              Password
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            </label>
            <button type="submit">로그인</button>
          </form>
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div className="brand">Focus To-Do</div>
        <div className="user-chip">
          <span>{user.email}</span>
          <button onClick={() => void logout()}>로그아웃</button>
        </div>
      </header>

      {warning && <p className="warning toast">{warning}</p>}
      {error && <p className="error toast">{error}</p>}

      <section className="workspace">
        <aside className="left-nav panel">
          <input className="search" placeholder="검색" />
          <nav>
            {FILTERS.map((entry) => (
              <button
                key={entry.key}
                className={`nav-item ${filter === entry.key ? "is-active" : ""}`}
                onClick={() => setFilter(entry.key)}
              >
                <span>{entry.label}</span>
                <small>{entry.key === "today" ? `${todayStats?.focusCount ?? 0}` : tasks.length}</small>
              </button>
            ))}
          </nav>
        </aside>

        <section className="board">
          <h2 className="board-title">오늘</h2>

          <div className="summary-grid panel">
            <div>
              <strong>{Math.floor(plannedMinutes / 60)}시간 {plannedMinutes % 60}분</strong>
              <span>예정 시간</span>
            </div>
            <div>
              <strong>{todayStats?.focusCount ?? 0}</strong>
              <span>완료한 세션</span>
            </div>
            <div>
              <strong>{Math.floor((todayStats?.totalFocusMinutes ?? 0) / 60)}시간 {(todayStats?.totalFocusMinutes ?? 0) % 60}분</strong>
              <span>완료한 시간</span>
            </div>
            <div>
              <strong>{todayStats?.completedTasks ?? 0}</strong>
              <span>완료한 작업</span>
            </div>
          </div>

          <div className="progress-strip panel">
            <span>오늘 완료율</span>
            <div className="bar">
              <i style={{ width: `${completionRate}%` }} />
            </div>
            <strong>{completionRate}%</strong>
          </div>

          <form onSubmit={addTask} className="quick-add panel">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="할 일에 작업 추가하기" maxLength={200} />
            <select value={composePriority} onChange={(e) => setComposePriority(e.target.value as TaskPriority)}>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
            <input
              type="number"
              min={1}
              max={12}
              value={composeEstimate}
              onChange={(e) => setComposeEstimate(Math.max(1, Number(e.target.value) || 1))}
            />
            <button type="submit">추가</button>
          </form>

          <div className="task-block">
            <h3>할 일</h3>
            <ul className="task-list-modern">
              {tasks.map((task) => (
                <li key={task.id} className={`task-row ${selectedTask?.id === task.id ? "selected" : ""}`}>
                  <label className="task-main" onClick={() => setActiveTaskId(task.id)}>
                    <input
                      type="radio"
                      checked={activeTaskId === task.id}
                      onChange={() => setActiveTaskId(task.id)}
                      name="activeTask"
                    />
                    <span className={task.status === "done" ? "done" : ""}>{task.title}</span>
                  </label>
                  <div className="task-meta">
                    <small className={`priority ${task.priority}`}>{task.priority}</small>
                    <small>
                      {task.completedPomodoros}/{task.estimatePomodoros}
                    </small>
                    {task.status !== "done" && (
                      <button onClick={() => void updateTask(task, { status: "done" })} className="ghost-btn">
                        완료
                      </button>
                    )}
                    <button onClick={() => void updateTask(task, { plannedDate: today })} className="ghost-btn">
                      오늘
                    </button>
                    <button onClick={() => void updateTask(task, { plannedDate: tomorrow })} className="ghost-btn">
                      내일
                    </button>
                    <button className="danger-btn" onClick={() => void removeTask(task.id)}>
                      삭제
                    </button>
                  </div>
                </li>
              ))}
              {tasks.length === 0 && <li className="empty">목록이 비어 있습니다.</li>}
            </ul>
          </div>

          <div className="timer-dock panel">
            <div className="mode-switch">
              <button className={timerMode === "focus" ? "is-active" : ""} onClick={() => setTimerMode("focus")}>Focus</button>
              <button className={timerMode === "short_break" ? "is-active" : ""} onClick={() => setTimerMode("short_break")}>Short</button>
              <button className={timerMode === "long_break" ? "is-active" : ""} onClick={() => setTimerMode("long_break")}>Long</button>
            </div>
            <div className="dock-time">{formatClock(activeSession ? remaining : getModeDurationSec(timerMode))}</div>
            <div className="dock-actions">
              <button onClick={() => void startSession(timerMode)} disabled={Boolean(activeSession) || !settings}>
                시작
              </button>
              <button onClick={() => void completeSession()} disabled={!activeSession}>
                완료
              </button>
              <button onClick={() => void cancelSession()} disabled={!activeSession}>
                취소
              </button>
            </div>
          </div>
        </section>

        <aside className="right-panel panel">
          <h3>{selectedTask?.title ?? "작업 상세"}</h3>
          <p>타입: {activeSession?.sessionType ?? timerMode}</p>
          <p>
            포모도로: {selectedTask?.completedPomodoros ?? 0}/{selectedTask?.estimatePomodoros ?? 0}
          </p>

          {selectedTask && (
            <div className="task-editor">
              <label>
                설명
                <textarea
                  rows={3}
                  value={taskDetailDescription}
                  onChange={(e) => setTaskDetailDescription(e.target.value)}
                  placeholder="노트 추가..."
                />
              </label>
              <div className="row2">
                <label>
                  우선순위
                  <select
                    value={taskDetailPriority}
                    onChange={(e) => setTaskDetailPriority(e.target.value as TaskPriority)}
                  >
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </select>
                </label>
                <label>
                  예상 Pomodoro
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={taskDetailEstimate}
                    onChange={(e) => setTaskDetailEstimate(Math.max(1, Number(e.target.value) || 1))}
                  />
                </label>
              </div>
              <button onClick={() => void saveTaskDetail()}>작업 상세 저장</button>
            </div>
          )}

          <div className="divider" />
          <h4>오늘 집중시간</h4>
          <p className="focus-time">{todayStats?.totalFocusMinutes ?? 0}분</p>

          <h4>오늘 세션 기록</h4>
          <ul className="session-list">
            {todaySessions.slice(0, 8).map((session) => (
              <li key={session.id}>
                <span>{session.sessionType}</span>
                <b>{session.status}</b>
              </li>
            ))}
            {todaySessions.length === 0 && <li className="empty">기록 없음</li>}
          </ul>

          <h4>최근 7일 기록</h4>
          <ul className="weekly-list">
            {Object.entries(weeklyStats?.days ?? {}).map(([date, minutes]) => (
              <li key={date}>
                <span>{date}</span>
                <strong>{minutes}m</strong>
              </li>
            ))}
          </ul>

          {settingsDraft && (
            <form onSubmit={saveSettings} className="settings-form">
              <h4>설정</h4>
              <div className="row2">
                <label>
                  Focus
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={settingsDraft.focusMin}
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, focusMin: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Short
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={settingsDraft.shortBreakMin}
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, shortBreakMin: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="row2">
                <label>
                  Long
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={settingsDraft.longBreakMin}
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, longBreakMin: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Interval
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={settingsDraft.longBreakInterval}
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, longBreakInterval: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label>
                Timezone
                <input
                  value={settingsDraft.timezone}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, timezone: e.target.value })}
                />
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settingsDraft.autoStartBreak}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, autoStartBreak: e.target.checked })}
                />
                Focus 완료 후 자동 Break 시작
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settingsDraft.autoStartFocus}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, autoStartFocus: e.target.checked })}
                />
                Break 완료 후 자동 Focus 시작
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settingsDraft.soundEnabled}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, soundEnabled: e.target.checked })}
                />
                완료 사운드 사용
              </label>
              <button type="submit">저장</button>
            </form>
          )}
        </aside>
      </section>
    </main>
  );
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function shiftDate(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
