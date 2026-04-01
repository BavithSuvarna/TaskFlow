let currentFilter = 'all';
let searchQuery = '';
let editingTodoId = null;

// API functions
async function fetchTodos() {
    const response = await fetch('/api/todos');
    return response.json();
}

async function createTodo(todo) {
    const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(todo)
    });
    return response.json();
}

async function updateTodo(id, updates) {
    const response = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    return response.json();
}

async function deleteTodo(id) {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' });
}

// UI functions
function renderTodos(todos) {
    const filteredTodos = filterTodos(todos);
    const todoList = document.getElementById('todo-list');
    const emptyState = document.getElementById('empty-state');

    if (filteredTodos.length === 0) {
        todoList.innerHTML = '';
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        todoList.innerHTML = filteredTodos.map((todo, index) => createTodoHTML(todo, index)).join('');
    }

    updateStats(todos);
}

function filterTodos(todos) {
    let filtered = todos;

    if (currentFilter === 'pending') {
        filtered = filtered.filter(t => !t.completed);
    } else if (currentFilter === 'completed') {
        filtered = filtered.filter(t => t.completed);
    } else if (currentFilter === 'high') {
        filtered = filtered.filter(t => t.priority === 'high');
    }

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(t =>
            t.title.toLowerCase().includes(query) ||
            (t.description && t.description.toLowerCase().includes(query))
        );
    }

    return filtered;
}

function createTodoHTML(todo, index) {
    const priorityClass = `${todo.priority}-priority`;
    const completedClass = todo.completed ? 'completed' : '';
    const checkedClass = todo.completed ? 'checked' : '';
    const dueDateHTML = todo.due_date ? formatDueDate(todo.due_date) : '';

    return `
        <div class="todo-item ${priorityClass} ${completedClass}" data-id="${todo.id}" style="animation-delay: ${index * 0.05}s">
            <div class="checkbox ${checkedClass}" onclick="toggleTodo(${todo.id})">
                ${todo.completed ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
            </div>
            <div class="todo-content">
                <div class="todo-title">${escapeHtml(todo.title)}</div>
                ${todo.description ? `<div class="todo-description">${escapeHtml(todo.description)}</div>` : ''}
                <div class="todo-meta">
                    <span class="priority-tag ${todo.priority}">${getPriorityEmoji(todo.priority)} ${capitalize(todo.priority)}</span>
                    ${dueDateHTML}
                    <span class="created-date">📅 ${todo.created_at}</span>
                </div>
            </div>
            <div class="todo-actions">
                <button class="action-btn edit" onclick="openEditModal(${todo.id})" title="Edit">✏️</button>
                <button class="action-btn delete" onclick="confirmDelete(${todo.id})" title="Delete">🗑️</button>
            </div>
        </div>
    `;
}

function formatDueDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = date < today && !isToday(date);

    return `<span class="due-date ${isOverdue ? 'overdue' : ''}">🎯 ${dateStr}</span>`;
}

function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
}

function updateStats(todos) {
    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    const pending = total - completed;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    animateNumber('total-count', total);
    animateNumber('pending-count', pending);
    animateNumber('completed-count', completed);

    document.getElementById('progress-percent').textContent = progress + '%';
    document.getElementById('progress-bar').style.width = progress + '%';
}

function animateNumber(elementId, target) {
    const element = document.getElementById(elementId);
    const current = parseInt(element.textContent) || 0;
    const increment = target > current ? 1 : -1;
    const steps = Math.abs(target - current);

    if (steps === 0) return;

    let step = 0;
    const interval = setInterval(() => {
        step++;
        element.textContent = current + (increment * step);
        if (step >= steps) clearInterval(interval);
    }, 30);
}

// Event handlers
async function addTodo() {
    const titleInput = document.getElementById('title-input');
    const descInput = document.getElementById('description-input');
    const prioritySelect = document.getElementById('priority-select');
    const dueDateInput = document.getElementById('due-date-input');

    const title = titleInput.value.trim();
    if (!title) {
        titleInput.focus();
        titleInput.style.borderColor = '#ef4444';
        setTimeout(() => titleInput.style.borderColor = '', 1000);
        return;
    }

    const todo = {
        title: title,
        description: descInput.value.trim(),
        priority: prioritySelect.value,
        due_date: dueDateInput.value || null
    };

    await createTodo(todo);

    titleInput.value = '';
    descInput.value = '';
    dueDateInput.value = '';
    prioritySelect.value = 'normal';

    await loadTodos();
}

async function toggleTodo(id) {
    const todos = await fetchTodos();
    const todo = todos.find(t => t.id === id);
    if (todo) {
        await updateTodo(id, { completed: !todo.completed });
        await loadTodos();
    }
}

function openEditModal(id) {
    const todos = window.currentTodos || [];
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    editingTodoId = id;
    document.getElementById('edit-title').value = todo.title;
    document.getElementById('edit-description').value = todo.description || '';
    document.getElementById('edit-priority').value = todo.priority;
    document.getElementById('edit-due-date').value = todo.due_date || '';
    document.getElementById('edit-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('edit-modal').classList.remove('active');
    editingTodoId = null;
}

async function saveEdit() {
    if (!editingTodoId) return;

    const title = document.getElementById('edit-title').value.trim();
    if (!title) {
        document.getElementById('edit-title').focus();
        return;
    }

    const updates = {
        title: title,
        description: document.getElementById('edit-description').value.trim(),
        priority: document.getElementById('edit-priority').value,
        due_date: document.getElementById('edit-due-date').value || null
    };

    await updateTodo(editingTodoId, updates);
    closeModal();
    await loadTodos();
}

async function confirmDelete(id) {
    if (confirm('Are you sure you want to delete this task?')) {
        await deleteTodo(id);
        await loadTodos();
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getPriorityEmoji(priority) {
    const emojis = { high: '🔴', normal: '🟡', low: '🟢' };
    return emojis[priority] || '🟡';
}

async function loadTodos() {
    const todos = await fetchTodos();
    window.currentTodos = todos;
    renderTodos(todos);
}

function setCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date().toLocaleDateString('en-US', options);
    document.getElementById('current-date').textContent = today;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setCurrentDate();
    loadTodos();

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTodos(window.currentTodos);
        });
    });

    // Search input
    document.getElementById('search-input').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderTodos(window.currentTodos);
    });

    // Enter key to add todo
    document.getElementById('title-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTodo();
        }
    });

    // Close modal on outside click
    document.getElementById('edit-modal').addEventListener('click', (e) => {
        if (e.target.id === 'edit-modal') {
            closeModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
});