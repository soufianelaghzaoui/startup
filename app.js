/**
 * AuraTask — Frontend Logic & Interactions
 * Features: State Management, LocalStorage, Web Audio Chimes, Confetti Particles, Search, Filters
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Default Initial Tasks Seed
  // ---------------------------------------------------------------------------
  const INITIAL_TASKS = [
    {
      id: 'task-1',
      title: 'Review quarterly architecture roadmap & design system',
      completed: true,
      priority: 'high',
      category: 'Design',
      dueDate: getRelativeDate(0),
      createdAt: Date.now() - 86400000,
      starred: true,
    },
    {
      id: 'task-2',
      title: 'Implement smooth micro-interactions & SVG progress ring',
      completed: false,
      priority: 'high',
      category: 'Code',
      dueDate: getRelativeDate(1),
      createdAt: Date.now() - 43200000,
      starred: true,
    },
    {
      id: 'task-3',
      title: 'Configure GitHub Actions CI/CD pipelines with security audit',
      completed: false,
      priority: 'medium',
      category: 'Work',
      dueDate: getRelativeDate(2),
      createdAt: Date.now() - 21600000,
      starred: false,
    },
    {
      id: 'task-4',
      title: 'Afternoon mindfulness walk & coffee break',
      completed: false,
      priority: 'low',
      category: 'Health',
      dueDate: getRelativeDate(0),
      createdAt: Date.now() - 10000000,
      starred: false,
    },
  ];

  function getRelativeDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }

  // ---------------------------------------------------------------------------
  // Application State
  // ---------------------------------------------------------------------------
  const state = {
    tasks: [],
    filter: 'all', // 'all' | 'active' | 'completed'
    priorityFilter: 'all',
    searchQuery: '',
    sortBy: 'newest',
    soundEnabled: true,
    theme: 'dark',
  };

  // ---------------------------------------------------------------------------
  // DOM Element Selectors
  // ---------------------------------------------------------------------------
  const elements = {
    html: document.documentElement,
    currentDate: document.getElementById('current-date'),
    soundToggle: document.getElementById('sound-toggle'),
    soundIconOn: document.getElementById('sound-icon-on'),
    soundIconOff: document.getElementById('sound-icon-off'),
    themeToggle: document.getElementById('theme-toggle'),
    themeIconSun: document.getElementById('theme-icon-sun'),
    themeIconMoon: document.getElementById('theme-icon-moon'),

    // Stats
    statTotal: document.getElementById('stat-total'),
    statActive: document.getElementById('stat-active'),
    statCompleted: document.getElementById('stat-completed'),
    progressBadge: document.getElementById('progress-badge'),
    linearProgressBar: document.getElementById('linear-progress-bar'),
    progressCircle: document.getElementById('progress-circle'),
    progressPercent: document.getElementById('progress-percent'),

    // Task Form
    addTaskForm: document.getElementById('add-task-form'),
    taskTitleInput: document.getElementById('task-title-input'),
    taskPrioritySelect: document.getElementById('task-priority-select'),
    taskCategorySelect: document.getElementById('task-category-select'),
    taskDateInput: document.getElementById('task-date-input'),

    // Search and Filters
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    countAll: document.getElementById('count-all'),
    countActive: document.getElementById('count-active'),
    countCompleted: document.getElementById('count-completed'),
    filterPriority: document.getElementById('filter-priority'),
    sortBy: document.getElementById('sort-by'),
    clearCompletedBtn: document.getElementById('clear-completed-btn'),

    // Task list & Empty State
    taskList: document.getElementById('task-list'),
    emptyState: document.getElementById('empty-state'),

    // Edit Modal
    editModal: document.getElementById('edit-modal'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    editTaskForm: document.getElementById('edit-task-form'),
    editTaskId: document.getElementById('edit-task-id'),
    editTaskTitle: document.getElementById('edit-task-title'),
    editTaskPriority: document.getElementById('edit-task-priority'),
    editTaskCategory: document.getElementById('edit-task-category'),
    editTaskDate: document.getElementById('edit-task-date'),

    // Toasts & Canvas
    toastContainer: document.getElementById('toast-container'),
    confettiCanvas: document.getElementById('confetti-canvas'),
  };

  // ---------------------------------------------------------------------------
  // Sound Synthesizer (Web Audio API)
  // ---------------------------------------------------------------------------
  let audioCtx = null;

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
  }

  function playTone(freq, type, duration, delay = 0) {
    if (!state.soundEnabled) return;
    try {
      initAudioContext();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      const startTime = audioCtx.currentTime + delay;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch {
      // Audio playback fails gracefully if blocked
    }
  }

  function playChime(kind) {
    if (!state.soundEnabled) return;
    if (kind === 'complete') {
      playTone(523.25, 'sine', 0.25, 0);     // C5
      playTone(659.25, 'sine', 0.25, 0.08);  // E5
      playTone(783.99, 'sine', 0.35, 0.16);  // G5
    } else if (kind === 'add') {
      playTone(440, 'triangle', 0.15, 0);    // A4
      playTone(880, 'sine', 0.2, 0.07);      // A5
    } else if (kind === 'delete') {
      playTone(320, 'sine', 0.18, 0);
      playTone(220, 'sine', 0.22, 0.06);
    }
  }

  // ---------------------------------------------------------------------------
  // Confetti Particle Explosion
  // ---------------------------------------------------------------------------
  let confettiCtx = null;
  let particles = [];
  let confettiAnimationId = null;

  function initConfetti() {
    if (!elements.confettiCanvas) return;
    confettiCtx = elements.confettiCanvas.getContext('2d');
    resizeConfettiCanvas();
    window.addEventListener('resize', resizeConfettiCanvas);
  }

  function resizeConfettiCanvas() {
    if (!elements.confettiCanvas) return;
    elements.confettiCanvas.width = window.innerWidth;
    elements.confettiCanvas.height = window.innerHeight;
  }

  function launchConfetti(x, y) {
    const originX = x !== undefined ? x : window.innerWidth / 2;
    const originY = y !== undefined ? y : window.innerHeight / 2;
    const colors = ['#6366f1', '#a855f7', '#06b6d4', '#ec4899', '#f59e0b', '#10b981'];

    for (let i = 0; i < 45; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: Math.random() * 7 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        life: 1,
        decay: Math.random() * 0.02 + 0.015,
      });
    }

    if (!confettiAnimationId) {
      animateConfetti();
    }
  }

  function animateConfetti() {
    if (!confettiCtx) return;
    confettiCtx.clearRect(0, 0, elements.confettiCanvas.width, elements.confettiCanvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25; // gravity
      p.rotation += p.vRot;
      p.life -= p.decay;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate((p.rotation * Math.PI) / 180);
      confettiCtx.globalAlpha = p.life;
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      confettiCtx.restore();
    }

    if (particles.length > 0) {
      confettiAnimationId = requestAnimationFrame(animateConfetti);
    } else {
      confettiAnimationId = null;
      confettiCtx.clearRect(0, 0, elements.confettiCanvas.width, elements.confettiCanvas.height);
    }
  }

  // ---------------------------------------------------------------------------
  // LocalStorage Persistence
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'auratask_data_v1';
  const THEME_KEY = 'auratask_theme';
  const SOUND_KEY = 'auratask_sound';

  function loadState() {
    try {
      const savedTasks = localStorage.getItem(STORAGE_KEY);
      state.tasks = savedTasks ? JSON.parse(savedTasks) : INITIAL_TASKS;

      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme) {
        state.theme = savedTheme;
      }

      const savedSound = localStorage.getItem(SOUND_KEY);
      if (savedSound !== null) {
        state.soundEnabled = savedSound === 'true';
      }
    } catch (e) {
      console.warn('LocalStorage access restricted; using defaults.', e);
      state.tasks = INITIAL_TASKS;
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    } catch (e) {
      console.warn('Unable to save tasks to LocalStorage', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Toast Notifications
  // ---------------------------------------------------------------------------
  function showToast(message, icon = '✨') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-leave');
      toast.addEventListener('animationend', () => toast.remove());
    }, 2800);
  }

  // ---------------------------------------------------------------------------
  // Rendering & Statistics
  // ---------------------------------------------------------------------------
  function updateDateHeader() {
    const now = new Date();
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    elements.currentDate.textContent = now.toLocaleDateString(undefined, options);
  }

  function updateStats() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const active = total - completed;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    elements.statTotal.textContent = total;
    elements.statActive.textContent = active;
    elements.statCompleted.textContent = completed;

    elements.countAll.textContent = total;
    elements.countActive.textContent = active;
    elements.countCompleted.textContent = completed;

    // Progress bar and SVG ring
    elements.linearProgressBar.style.width = `${percentage}%`;
    elements.progressPercent.textContent = `${percentage}%`;

    const circumference = 2 * Math.PI * 36; // r=36 -> ~226.19
    const offset = circumference - (percentage / 100) * circumference;
    elements.progressCircle.style.strokeDashoffset = offset;

    // Motivational Badge
    if (total === 0) {
      elements.progressBadge.textContent = 'All Clear';
    } else if (percentage === 100) {
      elements.progressBadge.textContent = 'Mastery 🏆';
    } else if (percentage >= 70) {
      elements.progressBadge.textContent = 'Crushing It 🚀';
    } else if (percentage >= 40) {
      elements.progressBadge.textContent = 'On Track ✨';
    } else {
      elements.progressBadge.textContent = 'In Motion ⚡';
    }
  }

  function getFilteredAndSortedTasks() {
    let list = [...state.tasks];

    // Status filter
    if (state.filter === 'active') {
      list = list.filter(t => !t.completed);
    } else if (state.filter === 'completed') {
      list = list.filter(t => t.completed);
    }

    // Priority filter
    if (state.priorityFilter !== 'all') {
      list = list.filter(t => t.priority === state.priorityFilter);
    }

    // Search filter
    if (state.searchQuery.trim() !== '') {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.priority.toLowerCase().includes(q)
      );
    }

    // Sorting
    list.sort((a, b) => {
      // Pinned tasks float to top
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;

      switch (state.sortBy) {
        case 'oldest':
          return a.createdAt - b.createdAt;
        case 'dueDate':
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        case 'priority': {
          const map = { high: 3, medium: 2, low: 1 };
          return (map[b.priority] || 0) - (map[a.priority] || 0);
        }
        case 'title':
          return a.title.localeCompare(b.title);
        case 'newest':
        default:
          return b.createdAt - a.createdAt;
      }
    });

    return list;
  }

  function renderTasks() {
    const filteredTasks = getFilteredAndSortedTasks();
    elements.taskList.innerHTML = '';

    if (filteredTasks.length === 0) {
      elements.emptyState.classList.remove('hidden');
    } else {
      elements.emptyState.classList.add('hidden');
      filteredTasks.forEach(task => {
        elements.taskList.appendChild(createTaskElement(task));
      });
    }

    updateStats();
  }

  function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = `task-item priority-${task.priority} ${task.completed ? 'completed' : ''}`;
    li.dataset.id = task.id;

    // Date formatting helper
    let dateBadgeHtml = '';
    if (task.dueDate) {
      const today = new Date().toISOString().split('T')[0];
      let statusClass = '';
      let displayDate = task.dueDate;

      if (!task.completed) {
        if (task.dueDate < today) {
          statusClass = 'overdue';
          displayDate = `⚠️ ${task.dueDate}`;
        } else if (task.dueDate === today) {
          statusClass = 'today';
          displayDate = `Today`;
        }
      }

      dateBadgeHtml = `<span class="tag-badge date-tag ${statusClass}">📅 ${escapeHtml(displayDate)}</span>`;
    }

    li.innerHTML = `
      <button class="task-checkbox-btn" aria-label="Toggle completed task" title="${task.completed ? 'Mark as incomplete' : 'Mark as complete'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>

      <div class="task-body">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <div class="task-tags">
          <span class="tag-badge category-tag">${escapeHtml(task.category)}</span>
          <span class="tag-badge priority-tag">${escapeHtml(task.priority)}</span>
          ${dateBadgeHtml}
        </div>
      </div>

      <div class="task-actions">
        <button class="task-action-btn star-btn ${task.starred ? 'starred' : ''}" title="${task.starred ? 'Unpin task' : 'Pin task to top'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${task.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
        <button class="task-action-btn edit-btn" title="Edit task details">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </button>
        <button class="task-action-btn delete-btn" title="Delete task">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Event Listeners for Task Items
    const checkboxBtn = li.querySelector('.task-checkbox-btn');
    checkboxBtn.addEventListener('click', e => {
      const rect = checkboxBtn.getBoundingClientRect();
      toggleTaskCompletion(task.id, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    const starBtn = li.querySelector('.star-btn');
    starBtn.addEventListener('click', () => toggleTaskStar(task.id));

    const editBtn = li.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => openEditModal(task.id));

    const deleteBtn = li.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => deleteTaskWithAnimation(li, task.id));

    return li;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ---------------------------------------------------------------------------
  // Task Actions (Add, Toggle, Delete, Edit, Star)
  // ---------------------------------------------------------------------------
  function addTask(title, priority, category, dueDate) {
    const newTask = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      title: title.trim(),
      completed: false,
      priority: priority || 'medium',
      category: category || 'Personal',
      dueDate: dueDate || '',
      createdAt: Date.now(),
      starred: false,
    };

    state.tasks.unshift(newTask);
    saveTasks();
    renderTasks();
    playChime('add');
    showToast('Task added successfully!', '✨');
  }

  function toggleTaskCompletion(id, clickX, clickY) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    saveTasks();
    renderTasks();

    if (task.completed) {
      playChime('complete');
      launchConfetti(clickX, clickY);
      showToast('Task completed! Keep up the momentum! 🎉', '🚀');
    }
  }

  function toggleTaskStar(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.starred = !task.starred;
    saveTasks();
    renderTasks();
    showToast(task.starred ? 'Task pinned to top' : 'Task unpinned', '📌');
  }

  function deleteTaskWithAnimation(element, id) {
    element.classList.add('deleting');
    playChime('delete');

    element.addEventListener(
      'animationend',
      () => {
        state.tasks = state.tasks.filter(t => t.id !== id);
        saveTasks();
        renderTasks();
        showToast('Task removed', '🗑️');
      },
      { once: true }
    );
  }

  function clearCompletedTasks() {
    const completedCount = state.tasks.filter(t => t.completed).length;
    if (completedCount === 0) {
      showToast('No completed tasks to clear.', 'ℹ️');
      return;
    }

    state.tasks = state.tasks.filter(t => !t.completed);
    saveTasks();
    renderTasks();
    playChime('delete');
    showToast(`Cleared ${completedCount} completed task${completedCount > 1 ? 's' : ''}`, '🧹');
  }

  // ---------------------------------------------------------------------------
  // Modal Edit Handler
  // ---------------------------------------------------------------------------
  function openEditModal(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    elements.editTaskId.value = task.id;
    elements.editTaskTitle.value = task.title;
    elements.editTaskPriority.value = task.priority;
    elements.editTaskCategory.value = task.category;
    elements.editTaskDate.value = task.dueDate || '';

    elements.editModal.classList.remove('hidden');
    elements.editTaskTitle.focus();
  }

  function closeEditModal() {
    elements.editModal.classList.add('hidden');
    elements.editTaskForm.reset();
  }

  // ---------------------------------------------------------------------------
  // Theme & Audio Controls
  // ---------------------------------------------------------------------------
  function applyTheme(theme) {
    state.theme = theme;
    elements.html.setAttribute('data-theme', theme);
    if (theme === 'light') {
      elements.themeIconMoon.classList.add('hidden');
      elements.themeIconSun.classList.remove('hidden');
    } else {
      elements.themeIconSun.classList.add('hidden');
      elements.themeIconMoon.classList.remove('hidden');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignored
    }
  }

  function toggleTheme() {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    showToast(`Switched to ${newTheme} mode`, newTheme === 'dark' ? '🌙' : '☀️');
  }

  function updateSoundUI() {
    if (state.soundEnabled) {
      elements.soundIconOff.classList.add('hidden');
      elements.soundIconOn.classList.remove('hidden');
    } else {
      elements.soundIconOn.classList.add('hidden');
      elements.soundIconOff.classList.remove('hidden');
    }
    try {
      localStorage.setItem(SOUND_KEY, state.soundEnabled ? 'true' : 'false');
    } catch {
      // Ignored
    }
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    updateSoundUI();
    if (state.soundEnabled) {
      playTone(600, 'sine', 0.15);
      showToast('Sound effects enabled', '🔊');
    } else {
      showToast('Sound effects muted', '🔇');
    }
  }

  // ---------------------------------------------------------------------------
  // Setup Event Listeners
  // ---------------------------------------------------------------------------
  function setupEventListeners() {
    // Theme & Sound
    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.soundToggle.addEventListener('click', toggleSound);

    // Add Task Form Submission
    elements.addTaskForm.addEventListener('submit', e => {
      e.preventDefault();
      const title = elements.taskTitleInput.value;
      if (!title.trim()) return;

      const priority = elements.taskPrioritySelect.value;
      const category = elements.taskCategorySelect.value;
      const date = elements.taskDateInput.value;

      addTask(title, priority, category, date);
      elements.taskTitleInput.value = '';
      elements.taskTitleInput.focus();
    });

    // Search Input
    elements.searchInput.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      if (state.searchQuery.length > 0) {
        elements.searchClearBtn.classList.remove('hidden');
      } else {
        elements.searchClearBtn.classList.add('hidden');
      }
      renderTasks();
    });

    elements.searchClearBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.searchQuery = '';
      elements.searchClearBtn.classList.add('hidden');
      elements.searchInput.focus();
      renderTasks();
    });

    // Status Tabs (All, Active, Completed)
    elements.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.tabButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        state.filter = btn.dataset.filter;
        renderTasks();
      });
    });

    // Priority filter
    elements.filterPriority.addEventListener('change', e => {
      state.priorityFilter = e.target.value;
      renderTasks();
    });

    // Sort by
    elements.sortBy.addEventListener('change', e => {
      state.sortBy = e.target.value;
      renderTasks();
    });

    // Clear completed
    elements.clearCompletedBtn.addEventListener('click', clearCompletedTasks);

    // Modal Edit Save
    elements.editTaskForm.addEventListener('submit', e => {
      e.preventDefault();
      const id = elements.editTaskId.value;
      const task = state.tasks.find(t => t.id === id);
      if (!task) return;

      task.title = elements.editTaskTitle.value.trim();
      task.priority = elements.editTaskPriority.value;
      task.category = elements.editTaskCategory.value;
      task.dueDate = elements.editTaskDate.value;

      saveTasks();
      renderTasks();
      closeEditModal();
      showToast('Task updated successfully', '💾');
    });

    // Modal dismissals
    elements.modalCloseBtn.addEventListener('click', closeEditModal);
    elements.modalCancelBtn.addEventListener('click', closeEditModal);
    elements.editModal.addEventListener('click', e => {
      if (e.target === elements.editModal) closeEditModal();
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', e => {
      // Escape closes modal
      if (e.key === 'Escape' && !elements.editModal.classList.contains('hidden')) {
        closeEditModal();
      }
      // '/' triggers search focus if not already focused in an input
      if (
        e.key === '/' &&
        document.activeElement !== elements.taskTitleInput &&
        document.activeElement !== elements.searchInput &&
        elements.editModal.classList.contains('hidden')
      ) {
        e.preventDefault();
        elements.searchInput.focus();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Application Bootstrap
  // ---------------------------------------------------------------------------
  function init() {
    loadState();
    applyTheme(state.theme);
    updateSoundUI();
    updateDateHeader();
    initConfetti();
    setupEventListeners();
    renderTasks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
