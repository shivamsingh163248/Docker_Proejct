const apiBase = `http://${window.location.hostname}:5000/api`;
const taskList = document.querySelector("#task-list");
const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-title");
const taskCount = document.querySelector("#task-count");
const emptyState = document.querySelector("#empty-state");
const message = document.querySelector("#message");
const connectionStatus = document.querySelector("#connection-status");
const statusDot = document.querySelector("#status-dot");

function setConnection(online) {
  connectionStatus.textContent = online ? "All systems ready" : "API unavailable";
  statusDot.className = `status-dot ${online ? "online" : "offline"}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

function renderTasks(tasks) {
  taskList.replaceChildren();
  taskCount.textContent = `${tasks.length} ${tasks.length === 1 ? "ITEM" : "ITEMS"}`;
  emptyState.classList.toggle("visible", tasks.length === 0);

  for (const task of tasks) {
    const item = document.createElement("li");
    item.className = `task-item${task.completed ? " completed" : ""}`;

    const toggle = document.createElement("button");
    toggle.className = "task-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", task.completed ? "Mark task incomplete" : "Mark task complete");
    toggle.textContent = task.completed ? "✓" : "";
    toggle.addEventListener("click", () => updateTask(task.id, !task.completed));

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;

    const remove = document.createElement("button");
    remove.className = "delete-task";
    remove.type = "button";
    remove.setAttribute("aria-label", `Delete ${task.title}`);
    remove.title = "Delete task";
    remove.textContent = "×";
    remove.addEventListener("click", () => deleteTask(task.id));

    item.append(toggle, title, remove);
    taskList.append(item);
  }
}

async function loadTasks() {
  try {
    const tasks = await request("/tasks");
    renderTasks(tasks);
    setConnection(true);
  } catch (error) {
    setConnection(false);
    message.textContent = error.message;
  }
}

async function updateTask(id, completed) {
  try {
    await request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ completed }) });
    message.textContent = "";
    await loadTasks();
  } catch (error) {
    message.textContent = error.message;
  }
}

async function deleteTask(id) {
  try {
    await request(`/tasks/${id}`, { method: "DELETE" });
    message.textContent = "";
    await loadTasks();
  } catch (error) {
    message.textContent = error.message;
  }
}

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) return;
  try {
    await request("/tasks", { method: "POST", body: JSON.stringify({ title }) });
    taskInput.value = "";
    message.textContent = "";
    await loadTasks();
    taskInput.focus();
  } catch (error) {
    message.textContent = error.message;
    setConnection(false);
  }
});

loadTasks();