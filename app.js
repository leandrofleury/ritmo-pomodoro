(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'ritmo:pomodoro:v1';
  const MAX_TASKS = 150;
  const RING_CIRCUMFERENCE = 2 * Math.PI * 123;
  const START_SVG = '<path d="M8 5.5v13L19 12Z"/>';
  const PAUSE_SVG = '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';
  const DELETE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>';
  const LIMITS = { focus: 180, break: 60 };

  const clampInteger = (raw, min, max, fallback) => {
    const number = Number(raw);
    return Number.isFinite(number) && Number.isInteger(number) && number >= min && number <= max ? number : fallback;
  };
  const safeNumber = (raw, fallback) => Number.isFinite(raw) && raw >= 0 ? raw : fallback;
  const initial = {
    focus: 25, break: 5, sound: true, notifications: false, sessions: 0, tasks: [],
    timer: { mode: 'focus', status: 'idle', remainingMs: 25 * 60000, deadlineMs: null }
  };
  function readSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }
  function createState(saved) {
    if (!saved || typeof saved !== 'object') return structuredClone(initial);
    const focus = clampInteger(saved.focus, 1, 180, 25);
    const pause = clampInteger(saved.break, 1, 60, 5);
    const mode = saved.timer?.mode === 'break' ? 'break' : 'focus';
    const maxRemaining = (mode === 'focus' ? focus : pause) * 60000;
    const permittedStatus = ['idle', 'running', 'paused', 'complete'];
    let status = permittedStatus.includes(saved.timer?.status) ? saved.timer.status : 'idle';
    let deadlineMs = Number.isFinite(saved.timer?.deadlineMs) && saved.timer.deadlineMs > 0 ? saved.timer.deadlineMs : null;
    let remainingMs = Math.max(0, Math.min(maxRemaining, safeNumber(saved.timer?.remainingMs, maxRemaining)));
    if (status === 'running' && !deadlineMs) status = 'paused';
    if (status === 'complete') remainingMs = 0;
    if (status === 'idle') remainingMs = maxRemaining;
    const tasks = Array.isArray(saved.tasks) ? saved.tasks
      .filter(task => task && typeof task.text === 'string' && task.text.trim())
      .slice(0, MAX_TASKS)
      .map((task, index) => ({
        id: typeof task.id === 'string' ? task.id.slice(0, 90) : String(index),
        text: task.text.trim().slice(0, 120),
        done: task.done === true
      })) : [];
    return {
      focus, break: pause,
      sound: saved.sound !== false,
      notifications: saved.notifications === true,
      sessions: clampInteger(saved.sessions, 0, 999999, 0),
      tasks,
      timer: { mode, status, remainingMs, deadlineMs }
    };
  }

  const state = createState(readSaved());
  let intervalId = null;
  let audioContext = null;
  let installPrompt = null;
  let toastTimer = null;

  const durationMs = (mode = state.timer.mode) => state[mode] * 60000;
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (_) { /* Private browsing or insufficient storage: app still works during this visit. */ }
  }
  function timeRemaining() {
    return state.timer.status === 'running'
      ? Math.max(0, state.timer.deadlineMs - Date.now())
      : state.timer.remainingMs;
  }
  function showToast(message) {
    const toast = $('toast');
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('visible'));
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => { if (!toast.classList.contains('visible')) toast.hidden = true; }, 260);
    }, 3600);
  }
  function prepareSound() {
    if (!state.sound) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      if (!audioContext) audioContext = new Context();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch (_) { /* Some browsers block audio until a user gesture. */ }
  }
  function playChime() {
    if (!state.sound || !audioContext || audioContext.state !== 'running') return;
    try {
      const now = audioContext.currentTime;
      [[0, 523.25], [0.2, 659.25], [0.4, 783.99]].forEach(([offset, hz]) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(hz, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.085, now + offset + 0.028);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.7);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + 0.73);
      });
    } catch (_) { /* Muted/blocked by OS. */ }
  }
  async function notifyCompletion(completedMode) {
    if (!state.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(completedMode === 'focus' ? 'Foco concluído' : 'Pausa concluída', {
        body: completedMode === 'focus' ? 'Ótimo trabalho. Que tal uma pausa?' : 'Sua próxima sessão de foco está pronta.',
        icon: './icons/icon-192.png', badge: './icons/icon-192.png',
        tag: 'ritmo-timer-finished', renotify: true
      });
    } catch (_) { /* Notification support varies by platform. */ }
  }
  function cancelTicking() {
    if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
  }
  function completeTimer(shouldSignal = true) {
    if (state.timer.status !== 'running') return;
    const finishedMode = state.timer.mode;
    state.timer.status = 'complete';
    state.timer.remainingMs = 0;
    state.timer.deadlineMs = null;
    if (finishedMode === 'focus') state.sessions = Math.min(999999, state.sessions + 1);
    cancelTicking();
    persist();
    render();
    if (shouldSignal) {
      if (document.visibilityState === 'visible') playChime();
      notifyCompletion(finishedMode);
      showToast(finishedMode === 'focus' ? 'Foco concluído! Você merece uma pausa.' : 'Pausa concluída! Pronto para retomar?');
    }
  }
  function syncTimer(shouldSignal = true) {
    if (state.timer.status !== 'running') return;
    if (Date.now() >= state.timer.deadlineMs) completeTimer(shouldSignal);
    else renderTimerDigits();
  }
  function runTicker() {
    cancelTicking();
    intervalId = setInterval(() => syncTimer(true), 200);
  }
  function startTimer() {
    if (state.timer.status === 'running') return;
    prepareSound();
    if (state.timer.status === 'complete') return;
    state.timer.remainingMs = Math.max(1, state.timer.remainingMs);
    state.timer.status = 'running';
    state.timer.deadlineMs = Date.now() + state.timer.remainingMs;
    persist();
    runTicker();
    render();
  }
  function pauseTimer() {
    if (state.timer.status !== 'running') return;
    syncTimer(true);
    if (state.timer.status !== 'running') return;
    state.timer.remainingMs = timeRemaining();
    state.timer.deadlineMs = null;
    state.timer.status = 'paused';
    cancelTicking();
    persist();
    render();
  }
  function setMode(mode, autoStart = false) {
    if (mode !== 'focus' && mode !== 'break') return;
    cancelTicking();
    state.timer = { mode, status: 'idle', remainingMs: durationMs(mode), deadlineMs: null };
    persist();
    render();
    if (autoStart) startTimer();
  }
  function onMainButton() {
    if (state.timer.status === 'running') pauseTimer();
    else if (state.timer.status === 'complete') setMode(state.timer.mode === 'focus' ? 'break' : 'focus', true);
    else startTimer();
  }
  function renderTimerDigits() {
    const ms = timeRemaining();
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const display = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    $('timer-display').textContent = display;
    $('timer-display').setAttribute('aria-label', `${minutes} minutos e ${seconds} segundos`);
    const ratio = Math.max(0, Math.min(1, 1 - ms / durationMs()));
    $('progress-ring').style.strokeDasharray = String(RING_CIRCUMFERENCE);
    $('progress-ring').style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - ratio));
    document.title = state.timer.status === 'running' ? `${display} · Ritmo` : 'Ritmo — Pomodoro';
  }
  function renderCounts() {
    $('session-count').textContent = state.sessions.toLocaleString('pt-BR');
    $('header-count').textContent = state.sessions.toLocaleString('pt-BR');
    const filled = state.sessions === 0 ? 0 : ((state.sessions - 1) % 4) + 1;
    [...$('session-dots').children].forEach((element, index) => element.classList.toggle('filled', index < filled));
  }
  function render() {
    const mode = state.timer.mode;
    const focus = mode === 'focus';
    const status = state.timer.status;
    $('mode-focus').classList.toggle('active', focus);
    $('mode-break').classList.toggle('active', !focus);
    $('mode-focus').setAttribute('aria-pressed', String(focus));
    $('mode-break').setAttribute('aria-pressed', String(!focus));
    document.querySelector('.timer-card').classList.toggle('break-mode', !focus);
    $('timer-caption').textContent = focus ? 'TEMPO DE FOCO' : 'TEMPO DE PAUSA';
    $('progress-ring').setAttribute('stroke', focus ? '#6fa080' : '#c7a071');
    let message;
    if (status === 'complete') message = focus ? 'FOCO CONCLUÍDO' : 'PAUSA CONCLUÍDA';
    else if (status === 'running') message = focus ? 'EM FOCO' : 'EM PAUSA';
    else if (status === 'paused') message = 'PAUSADO';
    else message = 'PRONTO PARA COMEÇAR';
    $('status-text').textContent = message;
    $('status-dot').className = 'status-dot' + (status === 'complete' ? ' complete' : status === 'running' ? focus ? ' running' : ' breaking' : '');
    $('timer-subtitle').textContent = status === 'complete'
      ? (focus ? 'Muito bem. Hora de descansar.' : 'Você está pronto para continuar.')
      : focus ? 'Seu momento de concentração' : 'Respire. Este tempo é seu.';
    let buttonLabel;
    if (status === 'complete') buttonLabel = focus ? 'Começar pausa' : 'Voltar ao foco';
    else if (status === 'running') buttonLabel = 'Pausar';
    else if (status === 'paused') buttonLabel = 'Continuar';
    else buttonLabel = focus ? 'Iniciar foco' : 'Iniciar pausa';
    $('start-label').textContent = buttonLabel;
    $('start-button').setAttribute('aria-label', buttonLabel);
    $('start-icon').innerHTML = status === 'running' ? PAUSE_SVG : START_SVG;
    $('focus-duration').value = state.focus;
    $('break-duration').value = state.break;
    $('focus-duration').disabled = status === 'running';
    $('break-duration').disabled = status === 'running';
    $('sound-toggle').classList.toggle('on', state.sound);
    $('sound-toggle').setAttribute('aria-checked', String(state.sound));
    renderTimerDigits();
    renderCounts();
  }
  function renderTasks() {
    const list = $('task-list');
    list.replaceChildren();
    const total = state.tasks.length;
    const completed = state.tasks.filter(task => task.done).length;
    $('task-counter').textContent = `${completed} de ${total}`;
    $('empty-tasks').hidden = total > 0;
    $('task-summary').textContent = total ? (completed === total ? 'Tudo concluído!' : `${total - completed} ${total - completed === 1 ? 'tarefa pendente' : 'tarefas pendentes'}`) : 'Nenhuma tarefa adicionada';
    $('clear-done').hidden = completed === 0;
    const percentage = total ? Math.round(completed / total * 100) : 0;
    $('task-progress').style.width = `${percentage}%`;
    $('task-progress-aria').setAttribute('aria-valuenow', String(percentage));
    for (const task of state.tasks) {
      const item = document.createElement('li');
      item.className = 'task-item' + (task.done ? ' done' : '');
      const check = document.createElement('input');
      check.className = 'task-checkbox';
      check.type = 'checkbox';
      check.checked = task.done;
      check.setAttribute('aria-label', `Marcar como ${task.done ? 'pendente' : 'concluída'}: ${task.text}`);
      check.addEventListener('change', () => { task.done = check.checked; persist(); renderTasks(); });
      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;
      const remove = document.createElement('button');
      remove.className = 'delete-task';
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remover tarefa: ${task.text}`);
      remove.innerHTML = DELETE_SVG;
      remove.addEventListener('click', () => { state.tasks = state.tasks.filter(item => item.id !== task.id); persist(); renderTasks(); });
      item.append(check, text, remove);
      list.append(item);
    }
  }
  function updateDuration(inputId, mode) {
    const input = $(inputId);
    if (state.timer.status === 'running') { input.value = state[mode]; return; }
    const val = Number(input.value);
    const maximum = LIMITS[mode];
    if (!Number.isFinite(val) || val < 1) {
      showToast('Escolha um valor de pelo menos 1 minuto.');
    } else if (val > maximum) {
      showToast(`Limite: ${maximum} minutos.`);
    }
    state[mode] = Math.max(1, Math.min(maximum, Number.isFinite(val) ? Math.trunc(val) : state[mode]));
    if (state.timer.mode === mode) {
      state.timer.status = 'idle';
      state.timer.deadlineMs = null;
      state.timer.remainingMs = durationMs();
    }
    persist(); render();
  }
  function renderNotificationSettings() {
    const button = $('notify-button');
    const description = $('notification-description');
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      button.disabled = true;
      button.textContent = 'Indisponível';
      description.textContent = 'Não suportado neste navegador';
    } else if (Notification.permission === 'denied') {
      button.disabled = false;
      button.textContent = 'Bloqueado';
      description.textContent = 'Permita nas configurações do navegador';
    } else if (state.notifications && Notification.permission === 'granted') {
      button.disabled = false;
      button.textContent = 'Desativar';
      description.textContent = 'O app precisa estar em execução';
    } else {
      button.disabled = false;
      button.textContent = 'Ativar';
      description.textContent = 'O app precisa estar em execução';
    }
  }
  async function toggleNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (state.notifications && Notification.permission === 'granted') {
      state.notifications = false;
      persist(); renderNotificationSettings(); showToast('Avisos desativados.');
      return;
    }
    if (Notification.permission === 'denied') {
      showToast('Permissão bloqueada. Altere nas configurações do site no navegador.');
      return;
    }
    try {
      const answer = await Notification.requestPermission();
      state.notifications = answer === 'granted';
      persist(); renderNotificationSettings();
      showToast(answer === 'granted' ? 'Avisos ativados enquanto o app estiver em execução.' : 'Permissão de avisos não concedida.');
    } catch (_) { showToast('Este navegador não permitiu ativar os avisos.'); }
  }

  $('start-button').addEventListener('click', onMainButton);
  $('reset-button').addEventListener('click', () => setMode(state.timer.mode));
  $('skip-button').addEventListener('click', () => setMode(state.timer.mode === 'focus' ? 'break' : 'focus'));
  $('mode-focus').addEventListener('click', () => { if (state.timer.mode !== 'focus') setMode('focus'); });
  $('mode-break').addEventListener('click', () => { if (state.timer.mode !== 'break') setMode('break'); });
  $('focus-duration').addEventListener('change', () => updateDuration('focus-duration', 'focus'));
  $('break-duration').addEventListener('change', () => updateDuration('break-duration', 'break'));
  $('sound-toggle').addEventListener('click', () => {
    state.sound = !state.sound;
    if (state.sound) prepareSound();
    persist(); render();
  });
  $('notify-button').addEventListener('click', toggleNotifications);
  $('clear-sessions').addEventListener('click', () => {
    if (state.sessions === 0) return;
    if (!window.confirm('Zerar a contagem de sessões concluídas?')) return;
    state.sessions = 0;
    persist(); renderCounts(); showToast('Contagem reiniciada.');
  });
  $('task-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('task-input');
    const text = input.value.trim();
    if (!text) return;
    if (state.tasks.length >= MAX_TASKS) { showToast(`Limite de ${MAX_TASKS} tarefas atingido.`); return; }
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    state.tasks.push({ id, text: text.slice(0, 120), done: false });
    input.value = '';
    persist(); renderTasks(); input.focus();
  });
  $('clear-done').addEventListener('click', () => {
    state.tasks = state.tasks.filter(task => !task.done);
    persist(); renderTasks();
  });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const target = event.target;
    if (target?.closest?.('input, button, textarea, select, dialog, [contenteditable="true"]')) return;
    if (event.code === 'Space') { event.preventDefault(); onMainButton(); }
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); setMode(state.timer.mode); }
  });
  function refreshOnlineStatus() {
    const offline = !navigator.onLine;
    $('network-state').classList.toggle('offline', offline);
    $('network-label').textContent = offline ? 'Sem conexão' : 'Disponível offline';
    $('network-state').title = offline ? 'Sem internet. O temporizador e seus dados locais continuam funcionando.' : 'O aplicativo pode funcionar offline depois que os arquivos forem armazenados.';
  }
  window.addEventListener('online', refreshOnlineStatus);
  window.addEventListener('offline', refreshOnlineStatus);
  document.addEventListener('visibilitychange', () => syncTimer(true));
  window.addEventListener('focus', () => syncTimer(true));
  window.addEventListener('pageshow', () => syncTimer(true));
  window.addEventListener('pagehide', persist);

  function showInstallInstructions() {
    const dialog = $('install-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else showToast('No Chrome, menu ⋮ → Instalar aplicativo.');
  }
  $('close-dialog').addEventListener('click', () => $('install-dialog').close());
  $('close-dialog-primary').addEventListener('click', () => $('install-dialog').close());
  $('install-dialog').addEventListener('click', event => {
    if (event.target === $('install-dialog')) $('install-dialog').close();
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    $('install-label').textContent = 'Instalar';
  });
  $('install-button').addEventListener('click', async () => {
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      try { await prompt.prompt(); await prompt.userChoice; }
      catch (_) { showInstallInstructions(); }
    } else showInstallInstructions();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    $('install-button').hidden = true;
    showToast('Ritmo instalado! Agora você pode abri-lo pela tela inicial.');
  });
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) $('install-button').hidden = true;
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
        showToast('Não foi possível habilitar o modo offline neste endereço. Use HTTPS.');
      });
    });
  }

  syncTimer(false);
  if (state.timer.status === 'running') runTicker();
  render();
  renderTasks();
  renderNotificationSettings();
  refreshOnlineStatus();
})();
