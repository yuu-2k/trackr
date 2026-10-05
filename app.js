(function () {
  "use strict";

  const STATUSES = ["planned", "in-progress", "completed", "on-hold"];
  const PRIORITIES = ["low", "medium", "high"];
  const STATUS_LABELS = {
    planned: "Planned",
    "in-progress": "In Progress",
    completed: "Completed",
    "on-hold": "On Hold"
  };
  const PRIORITY_LABELS = { low: "Low", medium: "Medium", high: "High" };
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
  let projects = [];
  let currentView = "dashboard";
  let activeProjectId = null;
  let toastTimer = null;

  function validDate(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "project-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function cleanProject(project, index) {
    if (!project || typeof project !== "object" || typeof project.name !== "string" || !project.name.trim()) {
      throw new Error("Project " + (index + 1) + " is missing a name.");
    }
    const tasks = Array.isArray(project.tasks) ? project.tasks : [];
    return {
      id: typeof project.id === "string" && project.id ? project.id : "project-" + (index + 1),
      name: project.name.trim().slice(0, 80),
      url: typeof project.url === "string" ? project.url.trim().slice(0, 500) : "",
      description: typeof project.description === "string" ? project.description.slice(0, 500) : "",
      fullDescription: typeof project.fullDescription === "string" ? project.fullDescription.slice(0, 10000) : "",
      status: STATUSES.includes(project.status) ? project.status : "planned",
      priority: PRIORITIES.includes(project.priority) ? project.priority : "medium",
      progress: Number.isFinite(Number(project.progress)) ? Math.max(0, Math.min(100, Math.round(Number(project.progress)))) : 0,
      deadline: typeof project.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(project.deadline) ? project.deadline : "",
      tags: Array.isArray(project.tags) ? project.tags.filter(tag => typeof tag === "string").map(tag => tag.trim().slice(0, 30)).filter(Boolean).slice(0, 12) : [],
      tasks: tasks.filter(task => task && typeof task.title === "string" && task.title.trim()).map((task, taskIndex) => ({
        id: typeof task.id === "string" && task.id ? task.id : "task-" + (taskIndex + 1),
        title: task.title.trim().slice(0, 120),
        completed: task.completed === true
      })),
      createdAt: validDate(project.createdAt) ? project.createdAt : "",
      updatedAt: validDate(project.updatedAt) ? project.updatedAt : ""
    };
  }

  async function loadProjects() {
    const response = await fetch(new URL("projects.json", document.baseURI), { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load projects.json (HTTP " + response.status + ").");
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("projects.json must contain a JSON array of projects.");
    projects = data.map(cleanProject);
    $("#loadError").classList.add("hidden");
    render();
    handleHashChange();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function formatDate(value, options) {
    if (!validDate(value)) return "Not set";
    return new Intl.DateTimeFormat(undefined, options || { month: "short", day: "numeric", year: "numeric" }).format(new Date(value + (value.length === 10 ? "T12:00:00" : "")));
  }

  function relativeDate(value) {
    if (!validDate(value)) return "No update date";
    const date = new Date(value);
    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (days <= 0) return "Updated today";
    if (days === 1) return "Updated yesterday";
    if (days < 7) return "Updated " + days + " days ago";
    return "Updated " + formatDate(value, { month: "short", day: "numeric" });
  }

  function projectInitial(name) {
    return escapeHtml((name.trim()[0] || "P").toUpperCase());
  }

  function statusBadge(status) {
    const safeStatus = STATUSES.includes(status) ? status : "planned";
    return '<span class="status-badge status-' + safeStatus + '">' + STATUS_LABELS[safeStatus] + "</span>";
  }

  function priorityBadge(priority) {
    const safePriority = PRIORITIES.includes(priority) ? priority : "medium";
    return '<span class="priority-badge priority-' + safePriority + '">' + PRIORITY_LABELS[safePriority] + "</span>";
  }

  function projectUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function render() {
    $("#navProjectCount").textContent = String(projects.length);
    renderDashboard();
    renderProjects();
    if (currentView === "detail") renderDetail();
  }

  function renderDashboard() {
    const total = projects.length;
    const inProgress = projects.filter(project => project.status === "in-progress").length;
    const completed = projects.filter(project => project.status === "completed").length;
    const onHold = projects.filter(project => project.status === "on-hold").length;
    const average = total ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / total) : 0;
    const stats = [
      ["Total projects", total, "◫", ""],
      ["In progress", inProgress, "↗", "blue"],
      ["Completed", completed, "✓", "purple"],
      ["On hold", onHold, "Ⅱ", "orange"]
    ];
    $("#statsGrid").innerHTML = stats.map(item =>
      '<article class="stat-card"><div class="stat-top"><span>' + item[0] + '</span><span class="stat-icon ' + item[3] + '">' + item[2] + '</span></div><div><strong class="stat-value">' + item[1] + '</strong><span class="stat-foot">' + (item[1] === 1 ? "project" : "projects") + "</span></div></article>"
    ).join("");
    $("#overallPercent").textContent = average + "%";
    $("#overallDonut").style.background = "conic-gradient(var(--accent) " + average + "%, #303237 " + average + "%)";
    $("#overallProgressBar").style.width = average + "%";
    $("#progressHeadline").textContent = total ? (average >= 75 ? "You’re on a roll" : average >= 35 ? "Steady progress" : "Every step counts") : "A fresh start";
    $("#progressSubline").textContent = total ? average + "% average completion across " + total + (total === 1 ? " project." : " projects.") : "Projects will appear here when added to projects.json.";
    renderDeadlines();
    renderRecent();
  }

  function renderDeadlines() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = projects.filter(project => project.deadline && project.status !== "completed")
      .map(project => ({ project, days: Math.ceil((new Date(project.deadline + "T00:00:00").getTime() - today.getTime()) / 86400000) }))
      .filter(item => item.days >= -1)
      .sort((a, b) => a.days - b.days)
      .slice(0, 4);
    if (!upcoming.length) {
      $("#deadlineList").innerHTML = '<div class="empty-state compact"><p>' + (projects.length ? "No upcoming deadlines. You’re all caught up." : "Deadlines from projects.json will appear here.") + "</p></div>";
      return;
    }
    $("#deadlineList").innerHTML = upcoming.map(({ project, days }) => {
      const label = days < 0 ? "Overdue" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : formatDate(project.deadline, { month: "short", day: "numeric" });
      const urgency = days < 0 ? "overdue" : days < 3 ? "urgent" : "";
      return '<div class="deadline-item" data-open-project="' + escapeHtml(project.id) + '"><span class="list-symbol">' + projectInitial(project.name) + '</span><span class="list-copy"><span class="list-title">' + escapeHtml(project.name) + '</span><span class="list-meta">' + STATUS_LABELS[project.status] + '</span></span><span class="deadline-date ' + urgency + '">' + label + "</span></div>";
    }).join("");
  }

  function renderRecent() {
    const recent = [...projects].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0)).slice(0, 4);
    if (!recent.length) {
      $("#recentList").innerHTML = '<div class="empty-state compact"><p>Projects from projects.json will appear here.</p></div>';
      return;
    }
    $("#recentList").innerHTML = recent.map(project =>
      '<div class="recent-item" data-open-project="' + escapeHtml(project.id) + '"><span class="list-symbol">' + projectInitial(project.name) + '</span><span class="list-copy"><span class="list-title">' + escapeHtml(project.name) + '</span><span class="list-meta">' + relativeDate(project.updatedAt) + '</span></span><span class="recent-progress" aria-label="' + project.progress + '% complete"><span style="width:' + project.progress + '%"></span></span></div>'
    ).join("");
  }

  function filteredProjects() {
    const query = $("#projectSearch").value.trim().toLocaleLowerCase();
    const status = $("#statusFilter").value;
    const priority = $("#priorityFilter").value;
    const sort = $("#projectSort").value;
    const filtered = projects.filter(project => {
      const haystack = [project.name, project.description, ...project.tags].join(" ").toLocaleLowerCase();
      return (!query || haystack.includes(query)) && (!status || project.status === status) && (!priority || project.priority === priority);
    });
    filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "progress") return b.progress - a.progress || a.name.localeCompare(b.name);
      if (sort === "deadline") return (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31");
      return Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0);
    });
    return filtered;
  }

  function renderProjects() {
    const visible = filteredProjects();
    $("#resultsSummary").innerHTML = "<strong>" + visible.length + "</strong> of " + projects.length + (projects.length === 1 ? " project" : " projects");
    if (!visible.length) {
      const hasFilters = $("#projectSearch").value.trim() || $("#statusFilter").value || $("#priorityFilter").value;
      $("#projectsGrid").innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-art">⌕</div><h3>' + (hasFilters ? "No matching projects" : "No projects yet") + "</h3><p>" + (hasFilters ? "Try adjusting your search or filters." : "Create a project, then download and publish the updated JSON file.") + (hasFilters ? "" : '<button class="button button-primary" type="button" data-action="new-project"><span class="plus-icon">+</span> New Project</button>') + "</div>";
      return;
    }
    $("#projectsGrid").innerHTML = visible.map(project => {
      const tags = project.tags.slice(0, 4).map(tag => '<span class="tag">' + escapeHtml(tag) + "</span>").join("");
      const url = projectUrl(project.url);
      const projectLink = url ? '<a class="project-link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">Open project <span aria-hidden="true">↗</span></a>' : "";
      return '<article class="project-card"><div class="project-card-top"><span class="project-glyph">' + projectInitial(project.name) + '</span><div class="card-actions"><button class="card-action" type="button" data-action="edit-project" data-id="' + escapeHtml(project.id) + '" aria-label="Edit ' + escapeHtml(project.name) + '" title="Edit project">✎</button><button class="card-action delete" type="button" data-action="delete-project" data-id="' + escapeHtml(project.id) + '" aria-label="Delete ' + escapeHtml(project.name) + '" title="Delete project">×</button></div></div><h2 class="project-title" data-open-project="' + escapeHtml(project.id) + '">' + escapeHtml(project.name) + '</h2>' + projectLink + '<p class="project-description">' + (escapeHtml(project.description) || "No description added yet.") + '</p><div class="badge-row">' + statusBadge(project.status) + priorityBadge(project.priority) + '</div><div class="card-progress-heading"><span>Progress</span><strong>' + project.progress + "%</strong></div><div class=\"progress-track\" role=\"progressbar\" aria-label=\"Project progress\" aria-valuenow=\"" + project.progress + "\" aria-valuemin=\"0\" aria-valuemax=\"100\"><span style=\"width:" + project.progress + '%"></span></div><div class="card-tags">' + tags + '</div><div class="card-footer"><span>' + (project.deadline ? "Due " + formatDate(project.deadline, { month: "short", day: "numeric", year: "numeric" }) : "No deadline") + '</span><span>' + relativeDate(project.updatedAt) + "</span></div></article>";
    }).join("");
  }

  function renderDetail() {
    const project = projects.find(item => item.id === activeProjectId);
    if (!project) {
      navigate("projects");
      return;
    }
    const completedTasks = project.tasks.filter(task => task.completed).length;
    const tags = project.tags.length ? project.tags.map(tag => '<span class="tag">' + escapeHtml(tag) + "</span>").join("") : '<span class="list-meta">No tags</span>';
    const url = projectUrl(project.url);
    const projectLink = url ? '<a class="button button-secondary" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">Open project <span aria-hidden="true">↗</span></a>' : "";
    const taskMarkup = project.tasks.length ? project.tasks.map(task =>
      '<div class="task-item ' + (task.completed ? "completed" : "") + '"><input class="task-check" type="checkbox" disabled ' + (task.completed ? "checked" : "") + ' aria-label="' + escapeHtml(task.title) + '"><span class="task-title">' + escapeHtml(task.title) + "</span></div>"
    ).join("") : '<div class="empty-state compact"><p>No tasks listed in projects.json.</p></div>';
    $("#projectDetail").innerHTML = `
      <div class="detail-heading">
        <div>
          <div class="detail-title-line"><span class="project-glyph">${projectInitial(project.name)}</span><h1>${escapeHtml(project.name)}</h1></div>
          <div class="badge-row">${statusBadge(project.status)}${priorityBadge(project.priority)}</div>
          <p class="detail-description">${escapeHtml(project.description) || "No description added yet."}</p>
        </div>
        <div class="detail-actions">
          ${projectLink}
          <button class="button button-secondary" type="button" data-action="edit-project" data-id="${escapeHtml(project.id)}">✎ Edit</button>
          <button class="button button-danger-outline" type="button" data-action="delete-project" data-id="${escapeHtml(project.id)}">Delete</button>
        </div>
      </div>
      <div class="detail-layout">
        <div class="detail-main">
          ${project.fullDescription ? '<article class="panel detail-panel full-description-panel"><div class="panel-heading"><h2>About this project</h2></div><p class="full-description-text">' + escapeHtml(project.fullDescription) + "</p></article>" : ""}
          <article class="panel detail-panel">
            <div class="panel-heading"><h2>Progress</h2><span class="subtle-label">${completedTasks} of ${project.tasks.length} tasks complete</span></div>
            <div class="detail-progress">
              <div class="detail-progress-head"><span>Project completion</span><strong>${project.progress}%</strong></div>
              <div class="progress-track" role="progressbar" aria-label="Project progress" aria-valuenow="${project.progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${project.progress}%"></span></div>
            </div>
          </article>
          <article class="panel detail-panel">
            <div class="panel-heading"><h2>Tasks</h2><span class="subtle-label">${project.tasks.length} ${project.tasks.length === 1 ? "task" : "tasks"}</span></div>
            <div class="task-list">${taskMarkup}</div>
          </article>
        </div>
        <aside class="detail-aside">
          <article class="panel detail-panel">
            <div class="panel-heading"><h2>Project details</h2></div>
            <div class="detail-meta-list">
              <div class="detail-meta-item"><span>Project link</span>${url ? '<a class="project-detail-link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">Open project ↗</a>' : '<strong>Not set</strong>'}</div>
              <div class="detail-meta-item"><span>Deadline</span><strong>${project.deadline ? formatDate(project.deadline) : "Not set"}</strong></div>
              <div class="detail-meta-item"><span>Created</span><strong>${project.createdAt ? formatDate(project.createdAt) : "Not set"}</strong></div>
              <div class="detail-meta-item"><span>Last updated</span><strong>${project.updatedAt ? formatDate(project.updatedAt) : "Not set"}</strong></div>
              <div class="detail-meta-item"><span>Tags</span><span class="detail-tags">${tags}</span></div>
            </div>
          </article>
        </aside>
      </div>`;
  }

  function navigate(view, projectId) {
    if (view === "detail") {
      activeProjectId = projectId;
      location.hash = "project/" + encodeURIComponent(projectId);
    } else {
      activeProjectId = null;
      if (location.hash !== "#" + view) location.hash = view;
    }
    showView(view);
  }

  function showView(view) {
    const validViews = ["dashboard", "projects", "settings", "detail"];
    currentView = validViews.includes(view) ? view : "dashboard";
    $$("[data-view]").forEach(section => section.classList.toggle("hidden", section.dataset.view !== currentView));
    const navPage = currentView === "detail" ? "projects" : currentView;
    $$(".nav-link[data-page]").forEach(link => link.classList.toggle("active", link.dataset.page === navPage));
    const labels = { dashboard: "Dashboard", projects: "Projects", settings: "Settings", detail: "Project details" };
    $("#breadcrumbPage").textContent = labels[currentView];
    document.title = (currentView === "detail" ? "Project details" : labels[currentView]) + " — Trackr";
    if (currentView === "detail") renderDetail();
    window.scrollTo(0, 0);
  }

  function handleHashChange() {
    const hash = location.hash.slice(1);
    if (hash.startsWith("project/")) {
      const id = decodeURIComponent(hash.slice("project/".length));
      if (projects.some(project => project.id === id)) {
        activeProjectId = id;
        showView("detail");
      } else {
        navigate("projects");
      }
      return;
    }
    showView(["dashboard", "projects", "settings"].includes(hash) ? hash : "dashboard");
  }

  function openProjectModal(project) {
    $("#projectForm").reset();
    $("#projectId").value = project ? project.id : "";
    $("#projectName").value = project ? project.name : "";
    $("#projectUrl").value = project ? project.url : "";
    $("#projectDescription").value = project ? project.description : "";
    $("#projectFullDescription").value = project ? project.fullDescription : "";
    $("#projectStatus").value = project ? project.status : "planned";
    $("#projectPriority").value = project ? project.priority : "medium";
    $("#projectProgress").value = project ? project.progress : 0;
    $("#projectDeadline").value = project ? project.deadline : "";
    $("#projectTags").value = project ? project.tags.join(", ") : "";
    $("#modalTitle").textContent = project ? "Edit project" : "New project";
    $("#formError").textContent = "";
    $("#formError").classList.remove("visible");
    $("#projectModal").showModal();
    $("#projectName").focus();
  }

  function saveProject(event) {
    event.preventDefault();
    const name = $("#projectName").value.trim();
    const progressValue = $("#projectProgress").value;
    const progress = Number(progressValue);
    let error = "";
    if (!name) error = "Please enter a project name.";
    else if (progressValue === "" || !Number.isFinite(progress) || progress < 0 || progress > 100) error = "Progress must be a number from 0 to 100.";
    else if ($("#projectUrl").value.trim() && !projectUrl($("#projectUrl").value.trim())) error = "Enter a valid project link beginning with http:// or https://.";
    if (error) {
      $("#formError").textContent = error;
      $("#formError").classList.add("visible");
      const focusTarget = !name ? $("#projectName") : !projectUrl($("#projectUrl").value.trim()) && $("#projectUrl").value.trim() ? $("#projectUrl") : $("#projectProgress");
      focusTarget.focus();
      return;
    }

    const id = $("#projectId").value;
    const previous = projects.find(project => project.id === id);
    const now = new Date().toISOString();
    const updatedProject = {
      id: previous ? previous.id : makeId(),
      name: name.slice(0, 80),
      url: projectUrl($("#projectUrl").value.trim()),
      description: $("#projectDescription").value.trim().slice(0, 500),
      fullDescription: $("#projectFullDescription").value.trim().slice(0, 10000),
      status: $("#projectStatus").value,
      priority: $("#projectPriority").value,
      progress: Math.round(progress),
      deadline: $("#projectDeadline").value,
      tags: [...new Set($("#projectTags").value.split(",").map(tag => tag.trim()).filter(Boolean).map(tag => tag.slice(0, 30)))].slice(0, 12),
      tasks: previous ? previous.tasks : [],
      createdAt: previous ? previous.createdAt : now,
      updatedAt: now
    };
    projects = previous
      ? projects.map(project => project.id === id ? updatedProject : project)
      : [updatedProject, ...projects];
    $("#projectModal").close();
    render();
    downloadProjects();
    showToast("Updated projects.json was downloaded. Upload it to GitHub to publish.");
  }

  function deleteProject(id) {
    const project = projects.find(item => item.id === id);
    if (!project || !window.confirm('Delete "' + project.name + '" and download the updated projects.json?')) return;
    projects = projects.filter(item => item.id !== id);
    if (activeProjectId === id) navigate("projects");
    render();
    downloadProjects();
    showToast("Project removed. Upload the downloaded JSON to publish.");
  }

  function exportProjects() {
    downloadProjects();
    showToast("Downloaded projects.json.");
  }

  function downloadProjects() {
    const blob = new Blob([JSON.stringify(projects, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "projects.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
  }

  document.addEventListener("click", event => {
    const navLink = event.target.closest(".nav-link[data-page]");
    if (navLink) {
      event.preventDefault();
      navigate(navLink.dataset.page);
      return;
    }
    const openTarget = event.target.closest("[data-open-project]");
    if (openTarget) {
      navigate("detail", openTarget.dataset.openProject);
      return;
    }
    const action = event.target.closest("[data-action]");
    if (!action) return;
    if (action.dataset.action === "back-projects") navigate("projects");
    if (action.dataset.action === "new-project") openProjectModal(null);
    if (action.dataset.action === "edit-project") {
      const project = projects.find(item => item.id === action.dataset.id);
      if (project) openProjectModal(project);
    }
    if (action.dataset.action === "delete-project") deleteProject(action.dataset.id);
    if (action.dataset.action === "close-modal") $("#projectModal").close();
  });

  document.addEventListener("change", event => {
    if (event.target.matches("#statusFilter, #priorityFilter, #projectSort")) renderProjects();
  });

  document.addEventListener("input", event => {
    if (event.target.matches("#projectSearch")) renderProjects();
  });

  $("#exportButton").addEventListener("click", exportProjects);
  $("#projectForm").addEventListener("submit", saveProject);
  window.addEventListener("hashchange", handleHashChange);
  loadProjects().catch(error => {
    console.error("Could not load projects.json.", error);
    $("#loadError").textContent = error.message + " Run this app from a static web server (or GitHub Pages), not directly from file://.";
    $("#loadError").classList.remove("hidden");
    projects = [];
    render();
  });
})();
