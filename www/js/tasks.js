(function () {
  window.initializeTaskCalendar = function (pageElement) {
  var page = pageElement && pageElement.el ? pageElement.el : pageElement;
  var pageRoot = page && page.matches && page.matches('.page') ? page : page && page.querySelector('.page');

  if (!pageRoot || pageRoot.dataset.taskCalendarInitialized === 'true') {
    return;
  }

  var storagePrefix = 'day-list-tasks:';
  var legacyStorageKey = 'day-list-tasks';
  var maxTaskTitleLength = 200;
  var monthLabel = pageRoot.querySelector('.task-month-label');
  var daysContainer = pageRoot.querySelector('.task-days');
  var monthControls = pageRoot.querySelector('.task-month-controls');
  var heading = pageRoot.querySelector('.task-day-heading h1');
  var taskCount = pageRoot.querySelector('.task-day-heading p');
  var taskList = pageRoot.querySelector('.task-items');
  var taskDateNotice = document.createElement('p');
  var emptyState = pageRoot.querySelector('.task-empty-state');
  var addButton = pageRoot.querySelector('.task-add-button');
  var searchButton = pageRoot.querySelector('.task-search');

  if (!monthLabel || !daysContainer || !monthControls || !heading || !taskCount ||
      !taskList || !emptyState || !addButton || !searchButton) {
    delete pageRoot.dataset.taskCalendarInitialized;
    throw new Error('Os elementos do calendário de tarefas não foram encontrados.');
  }

  taskDateNotice.className = 'task-date-notice';
  taskDateNotice.setAttribute('role', 'status');
  taskList.parentNode.insertBefore(taskDateNotice, taskList);
  pageRoot.dataset.taskCalendarInitialized = 'true';

  var selectedDate = new Date();
  selectedDate.setHours(0, 0, 0, 0);
  var tasksByDate = loadTasks();

  function padNumber(number) {
    return String(number).padStart(2, '0');
  }

  function getDateKey(date) {
    return date.getFullYear() + '-' + padNumber(date.getMonth() + 1) + '-' + padNumber(date.getDate());
  }

  function formatDate(date, options) {
    return new Intl.DateTimeFormat('pt-BR', options).format(date);
  }

  function capitalize(text) {
    return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);
  }

  function sanitizeTaskTitle(title) {
    return title.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, maxTaskTitleLength);
  }

  function sanitizeTaskTime(value) {
    if (typeof value !== 'string') {
      return '';
    }

    var normalized = value.trim().toLowerCase().replace(/\s+/g, '');
    if (!normalized) {
      return '';
    }

    var hours;
    var minutes = 0;

    if (/^\d{1,2}:\d{2}$/.test(normalized)) {
      var parts = normalized.split(':');
      hours = Number(parts[0]);
      minutes = Number(parts[1]);
    } else if (/^\d{1,2}[h.]\d{2}$/.test(normalized)) {
      var dotted = normalized.replace(/h/g, '.');
      var dotParts = dotted.split('.');
      hours = Number(dotParts[0]);
      minutes = Number(dotParts[1]);
    } else if (/^\d{1,2}h$/.test(normalized) || /^\d{1,2}$/.test(normalized)) {
      hours = Number(normalized.replace(/h$/, ''));
    } else if (/^\d{3,4}$/.test(normalized)) {
      if (normalized.length === 3) {
        hours = Number(normalized.charAt(0));
        minutes = Number(normalized.slice(1));
      } else {
        hours = Number(normalized.slice(0, 2));
        minutes = Number(normalized.slice(2));
      }
    } else {
      return '';
    }

    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return '';
    }

    return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
  }

  function sortTasks(tasks) {
    return tasks.slice().sort(function (firstTask, secondTask) {
      var firstTime = sanitizeTaskTime(firstTask.time);
      var secondTime = sanitizeTaskTime(secondTask.time);

      if (!firstTime && !secondTime) {
        return 0;
      }
      if (!firstTime) {
        return 1;
      }
      if (!secondTime) {
        return -1;
      }
      return firstTime.localeCompare(secondTime);
    });
  }

  function loadTasks() {
    var storage;
    var storedByDate = {};

    try {
      storage = window.localStorage;
    } catch (error) {
      app.dialog.alert('Não foi possível acessar o armazenamento das tarefas neste dispositivo.');
      return {};
    }

    try {
      for (var index = 0; index < storage.length; index += 1) {
        var key = storage.key(index);

        if (!key || key.indexOf(storagePrefix) !== 0) {
          continue;
        }

        var dateKey = key.slice(storagePrefix.length);
        if (!isValidDateKey(dateKey)) {
          continue;
        }

        storedByDate[dateKey] = normalizeDayTasks(JSON.parse(storage.getItem(key)));
      }

      var legacyData = storage.getItem(legacyStorageKey);
      if (legacyData) {
        var legacyTasks = normalizeTasksByDate(JSON.parse(legacyData));
        Object.keys(legacyTasks).forEach(function (dateKey) {
          if (!Object.prototype.hasOwnProperty.call(storedByDate, dateKey)) {
            storedByDate[dateKey] = legacyTasks[dateKey];
          }
        });

        Object.keys(legacyTasks).forEach(function (dateKey) {
          var dayStorageKey = storagePrefix + dateKey;
          if (storage.getItem(dayStorageKey) === null) {
            storage.setItem(dayStorageKey, JSON.stringify(storedByDate[dateKey]));
          }
        });

        storage.removeItem(legacyStorageKey);
      }

      var todayKey = getDateKey(new Date());
      Object.keys(storedByDate).forEach(function (dateKey) {
        if (dateKey > todayKey && storedByDate[dateKey].some(function (task) {
          return task.completed;
        })) {
          storedByDate[dateKey] = storedByDate[dateKey].map(function (task) {
            return { title: task.title, completed: false, time: sanitizeTaskTime(task.time) };
          });
          storage.setItem(storagePrefix + dateKey, JSON.stringify(storedByDate[dateKey]));
        }
      });

      return storedByDate;
    } catch (error) {
      app.dialog.alert('Não foi possível carregar ou migrar as tarefas salvas. Os dados anteriores foram mantidos.');
      return storedByDate;
    }
  }

  function isValidDateKey(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return false;
    }

    var parts = dateKey.split('-').map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.getFullYear() === parts[0] &&
      date.getMonth() === parts[1] - 1 &&
      date.getDate() === parts[2];
  }

  function normalizeDayTasks(tasks) {
    if (!Array.isArray(tasks)) {
      throw new Error('Formato de tarefas diárias inválido.');
    }

    return tasks.map(function (task) {
      if (typeof task === 'string') {
        return { title: sanitizeTaskTitle(task), completed: false, time: '' };
      }

      if (!task || typeof task.title !== 'string' || typeof task.completed !== 'boolean') {
        throw new Error('Formato de tarefa inválido.');
      }

      return {
        title: sanitizeTaskTitle(task.title),
        completed: task.completed,
        time: sanitizeTaskTime(task.time)
      };
    });
  }

  function normalizeTasksByDate(tasksByDate) {
    if (!tasksByDate || typeof tasksByDate !== 'object' || Array.isArray(tasksByDate)) {
      throw new Error('Formato de dados de tarefas inválido.');
    }

    var normalized = {};
    Object.keys(tasksByDate).forEach(function (dateKey) {
      if (!isValidDateKey(dateKey)) {
        throw new Error('Data de tarefa inválida.');
      }
      normalized[dateKey] = normalizeDayTasks(tasksByDate[dateKey]);
    });
    return normalized;
  }

  function createDayButton(date) {
    var button = document.createElement('button');
    var weekday = document.createElement('span');
    var dayNumber = document.createElement('strong');
    var isSelected = getDateKey(date) === getDateKey(selectedDate);

    button.type = 'button';
    button.className = 'task-day' + (isSelected ? ' is-selected' : '');
    button.dataset.date = getDateKey(date);
    button.setAttribute('aria-label', formatDate(date, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }));

    if (isSelected) {
      button.setAttribute('aria-current', 'date');
    }

    weekday.textContent = capitalize(formatDate(date, { weekday: 'short' }).replace('.', ''));
    dayNumber.textContent = String(date.getDate());
    button.appendChild(weekday);
    button.appendChild(dayNumber);
    return button;
  }

  function renderTasks() {
    var dateKey = getDateKey(selectedDate);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var canCompleteTasks = dateKey === getDateKey(today);
    var selectedDayIsFuture = dateKey > getDateKey(today);
    var tasks = sortTasks(tasksByDate[dateKey] || []);
    var hasTasks = tasks.length > 0;
    var pendingTasks = tasks.filter(function (task) { return !task.completed; }).length;

    taskList.replaceChildren();
    tasks.forEach(function (task, index) {
      var item = document.createElement('li');
      var completionLabel = document.createElement('label');
      var checkbox = document.createElement('input');
      var checkmark = document.createElement('span');
      var textContent = document.createElement('div');
      var title = document.createElement('span');
      var time = document.createElement('span');
      var deleteButton = document.createElement('button');
      var deleteIcon = document.createElement('i');

      item.className = 'task-item';
      item.classList.toggle('is-completed', task.completed);
      item.dataset.taskIndex = String(index);

      completionLabel.className = 'task-completion';
      completionLabel.classList.toggle('is-completion-disabled', !canCompleteTasks);
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = task.completed;
      checkbox.disabled = !canCompleteTasks;
      if (!canCompleteTasks) {
        checkbox.title = selectedDayIsFuture
          ? 'Disponível para conclusão neste dia.'
          : 'Tarefas passadas não podem ser marcadas como concluídas.';
      }
      checkbox.setAttribute('aria-label', 'Marcar "' + task.title + '" como concluída');
      checkmark.className = 'task-checkmark';
      textContent.className = 'task-text';
      title.className = 'task-title';
      title.textContent = task.title;
      time.className = 'task-time';
      time.textContent = sanitizeTaskTime(task.time);
      time.hidden = !task.time;
      textContent.appendChild(title);
      if (task.time) {
        textContent.appendChild(time);
      }
      completionLabel.appendChild(checkbox);
      completionLabel.appendChild(checkmark);
      completionLabel.appendChild(textContent);

      deleteButton.type = 'button';
      deleteButton.className = 'task-delete-button';
      deleteButton.setAttribute('aria-label', 'Excluir tarefa: ' + task.title);
      deleteIcon.className = 'mdi mdi-delete-outline';
      deleteIcon.setAttribute('aria-hidden', 'true');
      deleteButton.appendChild(deleteIcon);

      item.appendChild(completionLabel);
      item.appendChild(deleteButton);
      taskList.appendChild(item);
    });

    taskCount.textContent = pendingTasks === 1
      ? 'Você tem 1 tarefa pendente'
      : 'Você tem ' + pendingTasks + ' tarefas pendentes';
    taskDateNotice.hidden = canCompleteTasks;
    taskDateNotice.textContent = selectedDayIsFuture
      ? 'Você pode planejar tarefas para este dia, mas só poderá marcá-las como concluídas quando ele chegar.'
      : 'Tarefas de dias anteriores não podem ser marcadas como concluídas.';
    emptyState.hidden = hasTasks;
  }

  function saveTasks(dateKey, previousTasks) {
    var dayStorageKey = storagePrefix + dateKey;
    var dayTasks = tasksByDate[dateKey] || [];

    try {
      if (dayTasks.length > 0) {
        window.localStorage.setItem(dayStorageKey, JSON.stringify(dayTasks));
      } else {
        window.localStorage.removeItem(dayStorageKey);
      }
      return true;
    } catch (error) {
      if (previousTasks) {
        tasksByDate[dateKey] = previousTasks;
      } else {
        delete tasksByDate[dateKey];
      }
      app.dialog.alert('Não foi possível salvar a alteração. Verifique o espaço disponível no dispositivo.');
      renderTasks();
      return false;
    }
  }

  function renderCalendar() {
    var month = capitalize(formatDate(selectedDate, { month: 'long' })).toLocaleUpperCase('pt-BR');
    var firstVisibleDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate() - 2
    );

    monthLabel.textContent = month + ' ' + selectedDate.getFullYear();
    heading.textContent = capitalize(formatDate(selectedDate, { weekday: 'long' })) +
      ', ' + selectedDate.getDate();
    daysContainer.replaceChildren();

    for (var offset = 0; offset < 5; offset += 1) {
      var date = new Date(firstVisibleDate);
      date.setDate(firstVisibleDate.getDate() + offset);
      daysContainer.appendChild(createDayButton(date));
    }

    renderTasks();
  }

  function changeMonth(amount) {
    var targetMonth = selectedDate.getMonth() + amount;
    var firstDayOfTargetMonth = new Date(selectedDate.getFullYear(), targetMonth, 1);
    var lastDayOfTargetMonth = new Date(
      firstDayOfTargetMonth.getFullYear(),
      firstDayOfTargetMonth.getMonth() + 1,
      0
    ).getDate();

    selectedDate = new Date(
      firstDayOfTargetMonth.getFullYear(),
      firstDayOfTargetMonth.getMonth(),
      Math.min(selectedDate.getDate(), lastDayOfTargetMonth)
    );
    renderCalendar();
  }

  function addTask() {
    var taskDateKey = getDateKey(selectedDate);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    if (taskDateKey < getDateKey(today)) {
      app.dialog.alert('Não é possível adicionar tarefas a dias anteriores. Registre as tarefas no dia em que forem realizadas.');
      return;
    }

    var taskDialog = app.dialog.create({
      title: 'Nova tarefa',
      content: '<div class="task-dialog-content">' +
        '<div class="task-dialog-field">' +
        '<label for="task-dialog-title">Tarefa</label>' +
        '<input id="task-dialog-title" type="text" maxlength="200" placeholder="Digite a tarefa" autocomplete="off" autofocus />' +
        '</div>' +
        '<div class="task-dialog-field">' +
        '<label for="task-dialog-time">Horário</label>' +
        '<input id="task-dialog-time" type="text" inputmode="numeric" maxlength="5" placeholder="Ex.: 9:30 / 9h30" autocomplete="off" />' +
        '</div>' +
        '</div>',
      buttons: [
        { text: 'Cancelar' },
        { text: 'Salvar', bold: true }
      ],
      onClick: function (dialog, index) {
        if (index === 1) {
          var titleInput = document.getElementById('task-dialog-title');
          var timeInput = document.getElementById('task-dialog-time');
          var title = titleInput && titleInput.value ? titleInput.value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim() : '';
          var time = sanitizeTaskTime(timeInput && timeInput.value ? timeInput.value : '');

          if (timeInput && timeInput.value && !time) {
            app.dialog.alert('O horário deve estar em um formato válido, como 09:30, 9:30, 9h30 ou 930.');
            return;
          }

          if (!title) {
            app.dialog.alert('Digite o nome da tarefa antes de salvar.');
            return;
          }
          if (title.length > maxTaskTitleLength) {
            app.dialog.alert('A tarefa deve ter no máximo ' + maxTaskTitleLength + ' caracteres.');
            return;
          }

          var currentDate = new Date();
          currentDate.setHours(0, 0, 0, 0);
          if (taskDateKey < getDateKey(currentDate)) {
            app.dialog.alert('Não é possível adicionar tarefas a dias anteriores. Registre as tarefas no dia em que forem realizadas.');
            return;
          }

          var dateKey = taskDateKey;
          var previousTasks = tasksByDate[dateKey];
          tasksByDate = Object.assign({}, tasksByDate);
          tasksByDate[dateKey] = sortTasks((tasksByDate[dateKey] || []).concat({
            title: title,
            completed: false,
            time: time
          }));

          if (saveTasks(dateKey, previousTasks)) {
            renderCalendar();
          }
        }
      }
    });

    taskDialog.open();
    window.setTimeout(function () {
      var titleInput = document.getElementById('task-dialog-title');
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }, 100);
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function searchTasks() {
    app.dialog.prompt('Digite o nome ou parte da tarefa:', 'Pesquisar tarefas', function (value) {
      var query = value.trim().toLocaleLowerCase('pt-BR');

      if (!query) {
        return;
      }

      var matchingTasks = [];
      Object.keys(tasksByDate).sort().forEach(function (dateKey) {
        tasksByDate[dateKey].forEach(function (task) {
          if (task.title.toLocaleLowerCase('pt-BR').indexOf(query) !== -1) {
            matchingTasks.push({
              dateKey: dateKey,
              title: task.title,
              time: sanitizeTaskTime(task.time)
            });
          }
        });
      });

      if (matchingTasks.length === 0) {
        app.dialog.alert('Nenhuma tarefa encontrada para "' + escapeHtml(value.trim()) + '".', 'Pesquisa');
        return;
      }

      var firstDateParts = matchingTasks[0].dateKey.split('-').map(Number);
      selectedDate = new Date(firstDateParts[0], firstDateParts[1] - 1, firstDateParts[2]);
      renderCalendar();

      var resultList = matchingTasks.map(function (match) {
        var parts = match.dateKey.split('-').map(Number);
        var date = new Date(parts[0], parts[1] - 1, parts[2]);
        var timeLabel = match.time ? ' às ' + match.time : '';
        return '<div>' + formatDate(date, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) + timeLabel + ' — ' + escapeHtml(match.title) + '</div>';
      }).join('');

      app.dialog.alert(resultList, 'Tarefas encontradas: ' + matchingTasks.length);
    });
  }

  monthControls.addEventListener('click', function (event) {
    var button = event.target.closest('button');

    if (!button) {
      return;
    }

    var amount = button.querySelector('.mdi-chevron-left') ? -1 : 1;
    changeMonth(amount);
  });

  daysContainer.addEventListener('click', function (event) {
    var button = event.target.closest('.task-day');

    if (!button || !daysContainer.contains(button)) {
      return;
    }

    var parts = button.dataset.date.split('-').map(Number);
    selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
    renderCalendar();
  });

  taskList.addEventListener('change', function (event) {
    var checkbox = event.target.closest('.task-checkbox');
    var item = checkbox && checkbox.closest('.task-item');

    if (!item || !taskList.contains(item)) {
      return;
    }

    var dateKey = getDateKey(selectedDate);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateKey !== getDateKey(today)) {
      app.dialog.alert('As tarefas só podem ser marcadas como concluídas no dia atual.');
      renderTasks();
      return;
    }

    var taskIndex = Number(item.dataset.taskIndex);
    var previousTasks = tasksByDate[dateKey];
    tasksByDate = Object.assign({}, tasksByDate);
    tasksByDate[dateKey] = tasksByDate[dateKey].map(function (task, index) {
      return index === taskIndex
        ? { title: task.title, completed: checkbox.checked, time: sanitizeTaskTime(task.time) }
        : task;
    });

    if (saveTasks(dateKey, previousTasks)) {
      renderTasks();
    }
  });

  taskList.addEventListener('click', function (event) {
    var deleteButton = event.target.closest('.task-delete-button');
    var item = deleteButton && deleteButton.closest('.task-item');

    if (!item || !taskList.contains(item)) {
      return;
    }

    var dateKey = getDateKey(selectedDate);
    var taskIndex = Number(item.dataset.taskIndex);
    var task = tasksByDate[dateKey] && tasksByDate[dateKey][taskIndex];

    if (!task) {
      return;
    }

    app.dialog.confirm(
      'Tem certeza de que deseja excluir a tarefa "' + escapeHtml(task.title) + '"?',
      'Excluir tarefa',
      function () {
        var previousTasks = tasksByDate[dateKey];
        tasksByDate = Object.assign({}, tasksByDate);
        tasksByDate[dateKey] = tasksByDate[dateKey].filter(function (currentTask, index) {
          return index !== taskIndex;
        });

        if (tasksByDate[dateKey].length === 0) {
          delete tasksByDate[dateKey];
        }

        if (saveTasks(dateKey, previousTasks)) {
          renderTasks();
        }
      }
    );
  });

  addButton.addEventListener('click', function (event) {
    event.preventDefault();
    addTask();
  });

  searchButton.addEventListener('click', searchTasks);
  pageRoot.addEventListener('tasks:refresh', function () {
    tasksByDate = loadTasks();
    renderCalendar();
  });

  renderCalendar();
  };

  if (window.app && typeof window.app.on === 'function') {
    window.app.on('pageInit', function (page) {
      if (page.name === 'index') {
        window.initializeTaskCalendar(page.el);
      }
    });
  }

  var currentIndexPage = document.querySelector('.page[data-name="index"]');
  if (currentIndexPage) {
    window.initializeTaskCalendar(currentIndexPage);
  }
})();
