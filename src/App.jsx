import { useCallback, useEffect, useState } from "react";
import TaskList from "./TaskList";
import ProgressBar from "./ProgressBar";
import Navbar from "./Navbar";
import AddTaskForm from "./AddTaskForm";
import Profile from "./Profile";
import "./App.css";

const TASKS_API = "https://testapi.io/api/vytautasmurauskas8-oss/resource/Tasklist";
const USERS_API = "https://testapi.io/api/vytautasmurauskas8-oss/resource/username";
const SESSION_KEY = "flowly-current-user";

function getTaskStorageKey(ownerId) {
  return `flowly-tasks-${ownerId}`;
}

function readSavedTasks(ownerId) {
  try {
    const savedTasks = localStorage.getItem(getTaskStorageKey(ownerId));
    return savedTasks ? JSON.parse(savedTasks) : [];
  } catch {
    return [];
  }
}

function saveTasksForUser(ownerId, userTasks) {
  try {
    localStorage.setItem(getTaskStorageKey(ownerId), JSON.stringify(userTasks));
  } catch {
    // Keep task changes in memory if browser storage is unavailable.
  }
}

function getSavedUser() {
  try {
    const savedUser = localStorage.getItem(SESSION_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
}

function getInitialTasks() {
  const savedUser = getSavedUser();
  const ownerId = savedUser?.id ?? savedUser?._id;
  return ownerId == null ? [] : readSavedTasks(ownerId);
}

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
  const [currentUser, setCurrentUser] = useState(getSavedUser);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tasks, setTasks] = useState(getInitialTasks);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState("");

  const loadTasks = useCallback(async (ownerId) => {
    const savedTasks = readSavedTasks(ownerId);
    try {
      const response = await fetch(TASKS_API);
      if (!response.ok) throw new Error(`Nepavyko įkelti užduočių (${response.status}).`);
      const records = getRecords(await response.json());
      if (!records) throw new Error("API grąžino netinkamą užduočių formatą.");
      const ownedTasks = records
        .map(normalizeTask)
        .filter((task) => String(task.userId ?? task.ownerId) === String(ownerId));
      const mergedTasks = [...savedTasks];
      ownedTasks.forEach((apiTask) => {
        const existingIndex = mergedTasks.findIndex((task) => String(task.id) === String(apiTask.id));
        if (existingIndex === -1) mergedTasks.push(apiTask);
        else mergedTasks[existingIndex] = { ...mergedTasks[existingIndex], ...apiTask };
      });
      setTasks(mergedTasks);
      saveTasksForUser(ownerId, mergedTasks);
      setTasksError("");
    } catch (error) {
      setTasks(savedTasks);
      setTasksError(error.message || "Nepavyko susisiekti su API.");
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return undefined;
    let isActive = true;

    async function fetchUserTasks() {
      try {
        const response = await fetch(TASKS_API);
        if (!response.ok) throw new Error(`Nepavyko įkelti užduočių (${response.status}).`);
        const records = getRecords(await response.json());
        if (!records) throw new Error("API grąžino netinkamą užduočių formatą.");
        const ownerId = currentUser.id ?? currentUser._id;
        const cachedTasks = readSavedTasks(ownerId);
        const apiTasks = records
          .map(normalizeTask)
          .filter((task) => String(task.userId ?? task.ownerId) === String(ownerId));
        const mergedTasks = [...cachedTasks];
        apiTasks.forEach((apiTask) => {
          const taskIndex = mergedTasks.findIndex((task) => String(task.id) === String(apiTask.id));
          if (taskIndex === -1) mergedTasks.push(apiTask);
          else mergedTasks[taskIndex] = { ...mergedTasks[taskIndex], ...apiTask };
        });
        if (isActive) {
          setTasks(mergedTasks);
          saveTasksForUser(ownerId, mergedTasks);
          setTasksError("");
        }
      } catch (error) {
        if (isActive) {
          const ownerId = currentUser.id ?? currentUser._id;
          setTasks(readSavedTasks(ownerId));
          setTasksError(error.message || "Nepavyko susisiekti su API.");
        }
      } finally {
        if (isActive) setTasksLoading(false);
      }
    }

    fetchUserTasks();
    return () => { isActive = false; };
  }, [currentUser]);

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
      let authenticatedUser;

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
        authenticatedUser = { ...savedUser, id: savedUser.id ?? savedUser._id, username: savedUser.username ?? cleanUsername, fullName: savedUser.fullName ?? fullName.trim() };
      } else {
        if (!existingUser || existingUser.password !== password) {
          throw new Error("Neteisingas vartotojo vardas arba slaptažodis.");
        }
        authenticatedUser = { ...existingUser, id: existingUser.id ?? existingUser._id };
      }
      setCurrentUser(authenticatedUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify(authenticatedUser));
      setTasksLoading(true);
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
      const ownerId = currentUser.id ?? currentUser._id;
      const response = await fetch(TASKS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newTask, userId: ownerId }),
      });
      if (!response.ok) throw new Error(`Nepavyko pridėti užduoties (${response.status}).`);
      const created = await readResponse(response);
      const createdTask = created?.data ?? created;
      const savedTask = normalizeTask({
        ...newTask,
        ...(createdTask && typeof createdTask === "object" ? createdTask : {}),
        id: createdTask?.id ?? createdTask?._id ?? `local-${Date.now()}`,
        userId: createdTask?.userId ?? createdTask?.ownerId ?? ownerId,
      });
      setTasks((currentTasks) => {
        const updatedTasks = [...currentTasks, savedTask];
        saveTasksForUser(ownerId, updatedTasks);
        return updatedTasks;
      });
      return true;
    } catch (error) {
      setTasksError(error.message || "Nepavyko pridėti užduoties.");
      return false;
    }
  }

  async function updateTask(taskId, changes) {
    const task = tasks.find((item) => String(item.id) === String(taskId));
    if (!task || String(task.userId ?? task.ownerId) !== String(currentUser.id ?? currentUser._id)) return false;
    setTasksError("");
    if (String(taskId).startsWith("local-")) {
      setTasks((currentTasks) => {
        const updatedTasks = currentTasks.map((item) => String(item.id) === String(taskId) ? { ...item, ...changes } : item);
        saveTasksForUser(currentUser.id ?? currentUser._id, updatedTasks);
        return updatedTasks;
      });
      return true;
    }
    try {
      const response = await fetch(`${TASKS_API}/${encodeURIComponent(taskId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...task, ...changes, userId: currentUser.id ?? currentUser._id }),
      });
      if (!response.ok) throw new Error(`Nepavyko atnaujinti užduoties (${response.status}).`);
      const result = await readResponse(response);
      const returnedTask = result?.data ?? result;
      const savedTask = normalizeTask({ ...task, ...changes, ...(returnedTask && typeof returnedTask === "object" ? returnedTask : {}) });
      setTasks((currentTasks) => {
        const updatedTasks = currentTasks.map((item) => String(item.id) === String(taskId) ? savedTask : item);
        saveTasksForUser(currentUser.id ?? currentUser._id, updatedTasks);
        return updatedTasks;
      });
      return true;
    } catch (error) {
      setTasksError(error.message || "Nepavyko atnaujinti užduoties.");
      const ownerId = currentUser.id ?? currentUser._id;
      await loadTasks(ownerId);
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
      const task = tasks.find((item) => String(item.id) === String(taskId));
      if (!task || String(task.userId ?? task.ownerId) !== String(currentUser.id ?? currentUser._id)) throw new Error("Galite trinti tik savo užduotis.");
      if (String(taskId).startsWith("local-")) {
        setTasks((currentTasks) => {
          const updatedTasks = currentTasks.filter((item) => String(item.id) !== String(taskId));
          saveTasksForUser(currentUser.id ?? currentUser._id, updatedTasks);
          return updatedTasks;
        });
        return;
      }
      const response = await fetch(`${TASKS_API}/${encodeURIComponent(taskId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Nepavyko ištrinti užduoties (${response.status}).`);
      setTasks((currentTasks) => {
        const updatedTasks = currentTasks.filter((task) => String(task.id) !== String(taskId));
        saveTasksForUser(currentUser.id ?? currentUser._id, updatedTasks);
        return updatedTasks;
      });
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
                {tasksError && <div className="task-api-error" role="alert"><span>{tasksError}</span><button type="button" onClick={() => loadTasks(currentUser.id ?? currentUser._id)}>Bandyti dar kartą</button></div>}
                <AddTaskForm onAddTask={handleAddTask} />
                <ProgressBar initialProgress={50} />
              </>
            )}
          </main>
        </>
      )}
      {activePage === "profile" && currentUser && <Profile user={profileUser} tasks={tasks} />}
      {currentUser && <button type="button" className="logout-button" onClick={() => { localStorage.removeItem(SESSION_KEY); setCurrentUser(null); setPassword(""); setTasks([]); setActivePage("home"); }}>Atsijungti</button>}
    </>
  );
}

export default App;
