import { useState } from "react";
import "./TaskList.css";

function TaskList({ tasks = [], loading = false, onStatusChange, onDeadlineChange, onTaskUpdate, onDelete }) {
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStatus, setEditStatus] = useState("Nepradėta");
  const [editDeadline, setEditDeadline] = useState("");

  function startEditing(task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditStatus(task.status);
    setEditDeadline(task.deadline);
  }

  async function saveTask(taskId) {
    const wasUpdated = await onTaskUpdate?.(taskId, {
      title: editTitle.trim(),
      status: editStatus,
      deadline: editDeadline,
    });
    if (wasUpdated) setEditingTaskId(null);
  }

  if (loading) {
    return <section className="task-card"><p className="task-state">Kraunamos užduotys...</p></section>;
  }

  if (tasks.length === 0) {
    return <section className="task-card"><p className="task-state">Užduočių kol kas nėra.</p></section>;
  }

  return (
    <section className="task-card">
      <header className="task-card__header">
        <h2>Užduotys</h2>
        <p>Artimiausi darbai ir jų būsena</p>
      </header>

      <div className="task-list">
        {tasks.map((task) => (
          <article className="task-item" key={task.id}>
            <div className="task-item__top">
              {editingTaskId === task.id ? (
                <input className="task-edit-title" type="text" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} aria-label="Užduoties pavadinimas" required />
              ) : <h3>{task.title}</h3>}

              {editingTaskId === task.id ? (
                <label className="task-status-field">
                  <span className="visually-hidden">Užduoties statusas</span>
                  <select value={editStatus} onChange={(event) => setEditStatus(event.target.value)} aria-label="Užduoties statusas">
                    <option value="Nepradėta">Nepradėta</option>
                    <option value="Vykdoma">Vykdoma</option>
                    <option value="Atlikta">Atlikta</option>
                  </select>
                </label>
              ) : (
                <label className="task-status-field">
                  <span className="visually-hidden">Užduoties statusas</span>
                  <select
                    className={`task-status task-status--${task.status.toLowerCase().replace(" ", "-")}`}
                    value={task.status}
                    onChange={(event) => onStatusChange?.(task.id, event.target.value)}
                    aria-label={`Keisti užduoties „${task.title}“ statusą`}
                  >
                    <option value="Nepradėta">Nepradėta</option>
                    <option value="Vykdoma">Vykdoma</option>
                    <option value="Atlikta">Atlikta</option>
                  </select>
                </label>
              )}
            </div>

            {editingTaskId === task.id ? (
              <label className="task-deadline">
                <span>Terminas:</span>
                <input type="date" value={editDeadline} onChange={(event) => setEditDeadline(event.target.value)} aria-label="Užduoties terminas" />
              </label>
            ) : (
              <label className="task-deadline">
                <span>Terminas:</span>
                <input type="date" value={task.deadline} onChange={(event) => onDeadlineChange?.(task.id, event.target.value)} aria-label={`Keisti užduoties „${task.title}“ terminą`} />
              </label>
            )}

            <div className="task-item__actions">
              {editingTaskId === task.id ? (
                <>
                  <button type="button" className="task-edit-button" onClick={() => saveTask(task.id)} disabled={!editTitle.trim()}>Išsaugoti</button>
                  <button type="button" className="task-edit-button" onClick={() => setEditingTaskId(null)}>Atšaukti</button>
                </>
              ) : (
                <button type="button" className="task-edit-button" onClick={() => startEditing(task)}>Redaguoti</button>
              )}
              <button type="button" className="task-delete-button" onClick={() => onDelete?.(task.id)} aria-label={`Ištrinti užduotį „${task.title}“`}>Ištrinti</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default TaskList;
