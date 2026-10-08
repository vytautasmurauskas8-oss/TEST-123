import { useCallback, useEffect, useState } from "react";
import TaskList from "./TaskList";
import ProgressBar from "./ProgressBar";
import Navbar from "./Navbar";
import AddTaskForm from "./AddTaskForm";
import Profile from "./Profile";
import "./App.css";

const TASKS_API = "https://testapi.io/api/vytautasmurauskas8-oss/resource/Tasklist";

function normalizeTask(task) {
  return {
    ...task,
    id: task.id ?? task._id,
    title: task.title ?? task.name ?? "",
    status: task.status ?? "Nepradėta",
    deadline: task.deadline ?? "",
  };
}

function App() {
  const user = {
    name: "Jonas Jonaitis",
    email: "jonas@flowly.lt",
  };

  const [activePage, setActivePage] = useState("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState("");

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError("");

    try {
      const response = await fetch(TASKS_API);
      if (!response.ok) throw new Error(`Nepavyko įkelti užduočių (${response.status}).`);
      const data = await response.json();
      const records = Array.isArray(data) ? data : data?.data;
      if (!Array.isArray(records)) throw new Error("API grąžino netinkamą užduočių formatą.");
      setTasks(records.map(normalizeTask));
    } catch (error) {
      setTasksError(error.message || "Nepavyko susisiekti su API.");
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  function handleSubmit(event) {
    event.preventDefault();

    if (email === "admin" && password === "admin") {
      setIsLoggedIn(true);
      setLoginError("");
      return;
    }

    setLoginError("Neteisingas vartotojo vardas arba slaptažodis.");
  }

  async function handleAddTask(newTask) {
    setTasksError("");
    try {
      const response = await fetch(TASKS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });
      if (!response.ok) throw new Error(`Nepavyko pridėti užduoties (${response.status}).`);
      await response.json().catch(() => null);
      await loadTasks();
      return true;
    } catch (error) {
      setTasksError(error.message || "Nepavyko pridėti užduoties.");
      return false;
    }
  }

  async function updateTask(taskId, changes) {
    const task = tasks.find((item) => String(item.id) === String(taskId));
    if (!task) return;
    setTasksError("");

    try {
      const response = await fetch(`${TASKS_API}/${encodeURIComponent(taskId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...task, ...changes }),
      });
      if (!response.ok) throw new Error(`Nepavyko atnaujinti užduoties (${response.status}).`);
      const data = await response.json().catch(() => null);
      const record = data?.data ?? data;
      const normalizedRecord = record && typeof record === "object" && record.id != null
        ? normalizeTask(record)
        : null;
      setTasks((currentTasks) => currentTasks.map((item) =>
        String(item.id) === String(taskId)
          ? { ...task, ...changes, ...(normalizedRecord || {}) }
          : item,
      ));
    } catch (error) {
      setTasksError(error.message || "Nepavyko atnaujinti užduoties.");
      await loadTasks();
    }
  }

  function handleTaskStatusChange(taskId, status) {
    updateTask(taskId, { status });
  }

  function handleTaskDeadlineChange(taskId, deadline) {
    updateTask(taskId, { deadline });
  }

  async function handleDeleteTask(taskId) {
    setTasksError("");
    try {
      const response = await fetch(`${TASKS_API}/${encodeURIComponent(taskId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Nepavyko ištrinti užduoties (${response.status}).`);
      setTasks((currentTasks) => currentTasks.filter((task) => String(task.id) !== String(taskId)));
    } catch (error) {
      setTasksError(error.message || "Nepavyko ištrinti užduoties.");
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedTaskCount = tasks.filter((task) => task.status === "Atlikta").length;
  const overdueTaskCount = tasks.filter((task) => {
    if (task.status === "Atlikta" || !task.deadline) return false;
    return new Date(`${task.deadline}T00:00:00`) < today;
  }).length;

  return (
    <>
      <Navbar activePage={activePage} onNavigate={setActivePage} />

      {activePage === "home" && (
        <>
          {isLoggedIn && (
            <header className="welcome-message">
              <h1>Sveiki sugrįžę!</h1>
              <p>Prisijungėte kaip admin.</p>
            </header>
          )}

          <main className="login-page">
            {!isLoggedIn && (
              <div className="login-card">
                <header className="login-card__header">
                  <h1>Prisijungti</h1>
                  <p>Įveskite savo duomenis, kad tęstumėte</p>
                </header>

                <form className="login-form" onSubmit={handleSubmit}>
                  <label className="login-field">
                    <span>Vartotojo vardas</span>
                    <input type="text" name="username" autoComplete="username" placeholder="admin" value={email} onChange={(event) => setEmail(event.target.value)} required />
                  </label>
                  <label className="login-field">
                    <span>Slaptažodis</span>
                    <input type="password" name="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} required />
                  </label>
                  <button type="submit" className="login-submit">Prisijungti</button>
                  {loginError && <p className="login-error" role="alert">{loginError}</p>}
                </form>
              </div>
            )}

            {isLoggedIn && (
              <>
                <section className="dashboard-summary" aria-label="Užduočių suvestinė">
                  <p>
                    <strong>{tasks.length} užduotys</strong><span aria-hidden="true"> · </span>
                    <strong>{completedTaskCount} atliktos</strong><span aria-hidden="true"> · </span>
                    <strong>{overdueTaskCount} vėluoja</strong>
                  </p>
                </section>
                <TaskList tasks={tasks} loading={tasksLoading} onStatusChange={handleTaskStatusChange} onDeadlineChange={handleTaskDeadlineChange} onDelete={handleDeleteTask} />
                {tasksError && <div className="task-api-error" role="alert"><span>{tasksError}</span><button type="button" onClick={loadTasks}>Bandyti dar kartą</button></div>}
                <AddTaskForm onAddTask={handleAddTask} />
                <ProgressBar initialProgress={50} />
              </>
            )}
          </main>
        </>
      )}

      {activePage === "profile" && <Profile user={user} tasks={tasks} />}
    </>
  );
}

export default App;
