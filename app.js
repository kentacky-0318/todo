'use strict';

(() => {
  const STORAGE_KEY = 'todo-app.v1';
  const MAX_LENGTH = 200;
  const FILTERS = {
    all: () => true,
    active: (todo) => !todo.done,
    completed: (todo) => todo.done,
  };

  const form = document.getElementById('new-todo-form');
  const input = document.getElementById('new-todo');
  const main = document.getElementById('main');
  const list = document.getElementById('todo-list');
  const emptyMessage = document.getElementById('empty-message');
  const toggleAll = document.getElementById('toggle-all');
  const footer = document.getElementById('footer');
  const countEl = document.getElementById('todo-count');
  const clearCompleted = document.getElementById('clear-completed');
  const filterLinks = document.querySelectorAll('[data-filter]');

  let todos = load();
  let filter = filterFromHash();
  let editingId = null;

  // ---- 永続化 ----

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(data)) return [];
      return data
        .filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string')
        .map((t) => ({ id: t.id, text: t.text, done: Boolean(t.done) }));
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      // プライベートモード等で保存できない場合はメモリ上だけで動かす
    }
  }

  function newId() {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function filterFromHash() {
    const name = location.hash.replace(/^#\/?/, '');
    return Object.hasOwn(FILTERS, name) ? name : 'all';
  }

  // ---- 状態の更新 ----

  function commit(next) {
    todos = next;
    save();
    render();
  }

  const addTodo = (text) => commit([...todos, { id: newId(), text, done: false }]);
  const removeTodo = (id) => commit(todos.filter((t) => t.id !== id));
  const toggleTodo = (id) => commit(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const renameTodo = (id, text) => commit(todos.map((t) => (t.id === id ? { ...t, text } : t)));
  const setAllDone = (done) => commit(todos.map((t) => ({ ...t, done })));
  const removeCompleted = () => commit(todos.filter((t) => !t.done));

  function startEdit(id) {
    editingId = id;
    render();
  }

  function finishEdit(keep) {
    const field = list.querySelector('.edit');
    if (!field || editingId === null) return;
    const id = editingId;
    // 再描画で入力欄が消えた際の focusout で二重に呼ばれないよう先に解除する
    editingId = null;
    const text = field.value.trim();
    if (!keep) render();
    else if (text) renameTodo(id, text);
    else removeTodo(id);
  }

  // ---- 描画 ----

  function iconButton(className, label, glyph) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `icon-button ${className}`;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.textContent = glyph;
    return button;
  }

  function renderItem(todo) {
    const li = document.createElement('li');
    li.className = todo.done ? 'todo done' : 'todo';
    li.dataset.id = todo.id;

    if (todo.id === editingId) {
      li.classList.add('editing');
      const field = document.createElement('input');
      field.type = 'text';
      field.className = 'edit';
      field.value = todo.text;
      field.maxLength = MAX_LENGTH;
      field.setAttribute('aria-label', 'タスクを編集');
      li.append(field);
      return li;
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'toggle';
    checkbox.checked = todo.done;
    checkbox.setAttribute('aria-label', `「${todo.text}」を完了にする`);

    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = todo.text;
    text.title = 'ダブルクリックで編集';

    li.append(
      checkbox,
      text,
      iconButton('edit-button', '編集', '✎'),
      iconButton('destroy', '削除', '×'),
    );
    return li;
  }

  function render() {
    // 再描画後もキーボード操作の位置を保つため、フォーカス中の要素を覚えておく
    const active = document.activeElement;
    const focusedId = list.contains(active) ? active.closest('li')?.dataset.id : null;
    const focusedClass = focusedId ? active.classList[0] : null;

    const visible = todos.filter(FILTERS[filter]);
    const remaining = todos.filter(FILTERS.active).length;

    list.replaceChildren(...visible.map(renderItem));
    main.hidden = todos.length === 0;
    footer.hidden = todos.length === 0;
    emptyMessage.hidden = visible.length > 0;
    toggleAll.checked = todos.length > 0 && remaining === 0;
    countEl.textContent = `残り ${remaining} 件`;
    clearCompleted.hidden = remaining === todos.length;

    for (const link of filterLinks) {
      const selected = link.dataset.filter === filter;
      link.classList.toggle('selected', selected);
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }

    const field = list.querySelector('.edit');
    if (field) {
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    } else if (focusedId) {
      const item = list.querySelector(`li[data-id="${CSS.escape(focusedId)}"]`);
      (item?.querySelector(`.${focusedClass}`) ?? item?.querySelector('.toggle'))?.focus();
    }
  }

  // ---- イベント ----

  const idOf = (el) => el.closest('li').dataset.id;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addTodo(text);
    input.value = '';
  });

  list.addEventListener('change', (e) => {
    if (e.target.matches('.toggle')) toggleTodo(idOf(e.target));
  });

  list.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    if (button.matches('.destroy')) removeTodo(idOf(button));
    else if (button.matches('.edit-button')) startEdit(idOf(button));
  });

  list.addEventListener('dblclick', (e) => {
    if (e.target.matches('.text')) startEdit(idOf(e.target));
  });

  list.addEventListener('keydown', (e) => {
    if (!e.target.matches('.edit')) return;
    // 日本語入力の変換確定の Enter では確定させない
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') finishEdit(true);
    else if (e.key === 'Escape') finishEdit(false);
  });

  list.addEventListener('focusout', (e) => {
    if (e.target.matches('.edit')) finishEdit(true);
  });

  toggleAll.addEventListener('change', () => setAllDone(toggleAll.checked));
  clearCompleted.addEventListener('click', removeCompleted);

  window.addEventListener('hashchange', () => {
    filter = filterFromHash();
    render();
  });

  // 別タブでの変更を反映する
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    todos = load();
    render();
  });

  render();
})();
