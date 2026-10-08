import { useCallback, useEffect, useState } from "react";
import TaskList from "./TaskList";
import ProgressBar from "./ProgressBar";
import Navbar from "./Navbar";
import AddTaskForm from "./AddTaskForm";
import Profile from "./Profile";
import "./App.css";

const TASKS_API = "https://testapi.io/api/vytautasmurauskas8-oss/resource/Tasklist";
const USERS_API = "https://testapi.io/api/vytautasmurauskas8-oss/resource/username";

function normalizeTask(task) {
  return {
    ...task,
    id: task.id ?? task._id,
    title: task.title ?? task.name ?? "",
    status: task.status ?? "Nepradėta",
    deadline: task.deadline ?? "",
  };
}

function getRecords(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.username)) return data.username;
  if (Array.isArray(data?.users)) return data.users;
  return null;
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function App() {
  const [activePage, setActivePage] = useState("home");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState("");

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError("");
    try {
      const response = await fetch(TASKS_API);
      if (!response.ok) throw new Error(`Nepavyko įkelti užduočių (${response.status}).`);
      const records = getRecords(await response.json());
      if (!records) throw new Error("API grąžino netinkamą užduočių formatą.");
      setTasks(records.map(normalizeTask));
    } catch (error) {
      setTasksError(error.message || "Nepavyko susisiekti su API.");
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    async function fetchTasks() {
      try {
        const response = await fetch(TASKS_API);
        if (!response.ok) throw new Error(`Nepavyko įkelti užduočių (${response.status}).`);
        const records = getRecords(await response.json());
        if (!records) throw new Error("API grąžino netinkamą užduočių formatą.");
        if (isActive) setTasks(records.map(normalizeTask));
      } catch (error) {
        if (isActive) setTasksError(error.message || "Nepavyko susisiekti su API.");
      } finally {
        if (isActive) setTasksLoading(false);
      }
    }

    fetchTasks();
    return () => { isActive = false; };
  }, [loadTasks]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    const cleanUsername = username.trim();

    try {
      const response = await fetch(USERS_API);
      if (!response.ok) throw new Error(`Nepavyko patikrinti paskyros (${response.status}).`);
      const records = getRecords(await response.json());
      if (!records) throw new Error("API grąžino netinkamą naudotojų formatą.");
      const existingUser = records.find((user) =>
        String(user.username ?? user.name ?? "").toLowerCase() === cleanUsername.toLowerCase(),
      );

      if (authMode === "register") {
        if (existingUser) throw new Error("Šis vartotojo vardas jau užregistruotas.");
        const createResponse = await fetch(USERS_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: cleanUsername, password, fullName: fullName.trim() }),
        });
        const created = await readResponse(createResponse);
        if (!createResponse.ok) throw new Error(created?.message || `Registracija nepavyko (${createResponse.status}).`);
        if (!created) throw new Error("API negrąžino sukurto vartotojo. Patikrinkite API atsakymą.");
        const savedUser = created?.data ?? created;
        if (savedUser.id == null && savedUser._id == null) throw new Error("Registracijos atsakyme trūksta vartotojo ID.");
        setCurrentUser({ ...savedUser, username: savedUser.username ?? cleanUsername, fullName: savedUser.fullName ?? fullName.trim() });
      } else {
        if (!existingUser || existingUser.password !== password) {
          throw new Error("Neteisingas vartotojo vardas arba slaptažodis.");
        }
        setCurrentUser(existingUser);
      }
      setPassword("");
    } catch (error) {
      setAuthError(error.message || "Nepavyko atlikti veiksmo.");
    } finally {
      setAuthLoading(false);
    }
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
      await loadTasks();
      return true;
    } catch (error) {
      setTasksError(error.message || "Nepavyko pridėti užduoties.");
      return false;
    }
  }

  async function updateTask(taskId, changes) {
    const task = tasks.find((item) => String(item.id) === String(taskId));
    if (!task) return false;
    setTasksError("");
    try {
      const response = await fetch(`${TASKS_API}/${encodeURIComponent(taskId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...task, ...changes }),
      });
      if (!response.ok) throw new Error(`Nepavyko atnaujinti užduoties (${response.status}).`);
      await readResponse(response);
      const verifyResponse = await fetch(`${TASKS_API}/${encodeURIComponent(taskId)}`);
      if (!verifyResponse.ok) throw new Error("Nepavyko patikrinti išsaugotos užduoties.");
      const result = await verifyResponse.json();
      const savedTask = normalizeTask(result?.data ?? result);
      if (String(savedTask.id) !== String(taskId) || Object.entries(changes).some(([key, value]) => savedTask[key] !== value)) {
        throw new Error("API nepatvirtino atnaujintų užduoties duomenų.");
      }
      setTasks((currentTasks) => currentTasks.map((item) => String(item.id) === String(taskId) ? savedTask : item));
      return true;
    } catch (error) {
      setTasksError(error.message || "Nepavyko atnaujinti užduoties.");
      await loadTasks();
      return false;
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
  const overdueTaskCount = tasks.filter((task) => task.status !== "Atlikta" && task.deadline && new Date(`${task.deadline}T00:00:00`) < today).length;
  const profileUser = currentUser ? { name: currentUser.fullName || currentUser.username, email: currentUser.username } : {};

  return (
    <>
      <Navbar activePage={activePage} onNavigate={setActivePage} />
      {activePage === "home" && (
        <>
          {currentUser && <header className="welcome-message"><h1>Sveiki, {currentUser.fullName || currentUser.username}!</h1><p>Prisijungėte prie Flowly.</p></header>}
          <main className="login-page">
            {!currentUser && (
              <div className="login-card">
                <header className="login-card__header">
                  <h1>{authMode === "register" ? "Registracija" : "Prisijungti"}</h1>
                  <p>{authMode === "register" ? "Sukurkite paskyrą, kad galėtumėte prisijungti" : "Prisijunkite prie savo Flowly paskyros"}</p>
                </header>
                <form className="login-form" onSubmit={handleAuthSubmit}>
                  {authMode === "register" && <label className="login-field"><span>Vardas</span><input type="text" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>}
                  <label className="login-field"><span>Vartotojo vardas</span><input type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
                  <label className="login-field"><span>Slaptažodis</span><input type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
                  <button type="submit" className="login-submit" disabled={authLoading}>{authLoading ? "Palaukite..." : authMode === "register" ? "Registruotis" : "Prisijungti"}</button>
                  {authError && <p className="login-error" role="alert">{authError}</p>}
                </form>
                <p className="auth-switch">
                  {authMode === "register" ? "Jau turite paskyrą?" : "Neturite paskyros?"}{" "}
                  <button type="button" onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setAuthError(""); }}>{authMode === "register" ? "Prisijunkite" : "Registruokitės"}</button>
                </p>
              </div>
            )}
            {currentUser && (
              <>
                <section className="dashboard-summary" aria-label="Užduočių suvestinė"><p><strong>{tasks.length} užduotys</strong><span aria-hidden="true"> · </span><strong>{completedTaskCount} atliktos</strong><span aria-hidden="true"> · </span><strong>{overdueTaskCount} vėluoja</strong></p></section>
                <TaskList tasks={tasks} loading={tasksLoading} onStatusChange={handleTaskStatusChange} onDeadlineChange={handleTaskDeadlineChange} onTaskUpdate={updateTask} onDelete={handleDeleteTask} />
                {tasksError && <div className="task-api-error" role="alert"><span>{tasksError}</span><button type="button" onClick={loadTasks}>Bandyti dar kartą</button></div>}
                <AddTaskForm onAddTask={handleAddTask} />
                <ProgressBar initialProgress={50} />
              </>
            )}
          </main>
        </>
      )}
      {activePage === "profile" && currentUser && <Profile user={profileUser} tasks={tasks} />}
      {currentUser && <button type="button" className="logout-button" onClick={() => { setCurrentUser(null); setPassword(""); setActivePage("home"); }}>Atsijungti</button>}
    </>
  );
}

export default App;
