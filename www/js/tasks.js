(function () {
  // Configuração das Notificações Globais Diárias (09:00 e 20:00)
  function setupDailyNotifications() {
    var localNotifications = window.cordova && window.cordova.plugins &&
      window.cordova.plugins.notification && window.cordova.plugins.notification.local;

    if (!localNotifications || typeof localNotifications.schedule !== 'function') return;

    function scheduleGlobals() {
      // 1. Notificação das 09:00 (Lembrete matinal)
      localNotifications.schedule({
        id: 4101,
        title: 'Day List - Planejamento Diário',
        text: 'Bom dia! Abra o aplicativo para consultar suas tarefas de hoje.',
        trigger: { every: { hour: 9, minute: 0 } },
        androidAllowWhileIdle: true,
        foreground: true,
        priority: 2,
        channel: 'daylist_daily_channel'
      });

      // 2. Notificação das 20:00 (Resumo noturno)
      localNotifications.schedule({
        id: 4102,
        title: 'Day List - Resumo do Dia',
        text: 'Boa noite! Abra o aplicativo para conferir suas tarefas concluídas e pendentes.',
        trigger: { every: { hour: 20, minute: 0 } },
        androidAllowWhileIdle: true,
        foreground: true,
        priority: 2,
        channel: 'daylist_daily_channel'
      });
    }

    if (typeof localNotifications.hasPermission === 'function') {
      localNotifications.hasPermission(function (granted) {
        if (granted) {
          scheduleGlobals();
        } else if (typeof localNotifications.requestPermission === 'function') {
          localNotifications.requestPermission(function (permissionGranted) {
            if (permissionGranted) scheduleGlobals();
          });
        }
      });
    } else {
      scheduleGlobals();
    }
  }

  document.addEventListener('deviceready', setupDailyNotifications, false);

  window.initializeTaskCalendar = function (pageElement) {
    var page = pageElement && pageElement.el ? pageElement.el : pageElement;
    var pageRoot = page && page.matches && page.matches('.page') ? page : page && page.querySelector('.page');

    if (!pageRoot || pageRoot.dataset.taskCalendarInitialized === 'true') {
      return;
    }

    var storagePrefix = 'day-list-tasks:';
    var legacyStorageKey = 'day-list-tasks';
    var recurringStorageKey = 'day-list-recurring-tasks';
    var maxTaskTitleLength = 200;
    var monthLabel = pageRoot.querySelector('.task-month-label');
    var daysContainer = pageRoot.querySelector('.task-days');
    var monthControls = pageRoot.querySelector('.task-month-controls');
    var heading = pageRoot.querySelector('.task-day-heading h1');
    var taskCount = pageRoot.querySelector('.task-day-heading p');
    var taskList = pageRoot.querySelector('.task-items');
    var taskDateNotice = document.createElement('p');
    var emptyState = pageRoot.querySelector('.task-empty-state');
    var honestyNotice = pageRoot.querySelector('.task-honesty-notice');
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
    var recurringTasks = loadRecurringTasks();

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
      if (typeof value !== 'string') return '';
      var normalized = value.trim().toLowerCase().replace(/\s+/g, '');
      if (!normalized) return '';

      var hours, minutes = 0;
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
      return padNumber(hours) + ':' + padNumber(minutes);
    }

    function hashCode(str) {
      var hash = 0;
      for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    }

    function cancelTaskNotification(task, dateKey) {
      var localNotifications = window.cordova && window.cordova.plugins &&
        window.cordova.plugins.notification && window.cordova.plugins.notification.local;

      if (!localNotifications || typeof localNotifications.cancel !== 'function') return;

      var notifId = Math.abs(hashCode(dateKey + task.title)) % 100000;
      try {
        localNotifications.cancel(notifId);
      } catch (err) {
        console.error('Erro ao cancelar notificação:', err);
      }
    }

    function scheduleDeadlineNotification(task, dateKey) {
      if (task.completed || (!task.endTime && !task.time)) {
        cancelTaskNotification(task, dateKey);
        return;
      }

      var localNotifications = window.cordova && window.cordova.plugins &&
        window.cordova.plugins.notification && window.cordova.plugins.notification.local;

      if (!localNotifications || typeof localNotifications.schedule !== 'function') return;

      var targetTime = task.endTime || task.time;
      var parts = dateKey.split('-').map(Number);
      var timeParts = targetTime.split(':').map(Number);
      var deadlineDate = new Date(parts[0], parts[1] - 1, parts[2], timeParts[0], timeParts[1]);

      var reminderDate = new Date(deadlineDate.getTime() - 15 * 60 * 1000);
      if (reminderDate.getTime() <= Date.now()) return;

      var notifId = Math.abs(hashCode(dateKey + task.title)) % 100000;

      function doSchedule() {
        try {
          localNotifications.schedule({
            id: notifId,
            title: 'Lembrete de Tarefa: ' + task.title,
            text: task.endTime
              ? 'Atenção! O prazo encerra às ' + task.endTime + '.'
              : 'Sua tarefa começa às ' + task.time + '.',
            trigger: { at: reminderDate },
            androidAllowWhileIdle: true,
            foreground: true,
            priority: 2,
            channel: 'daylist_tasks_channel'
          });
        } catch (err) {
          console.error('Erro ao agendar notificação:', err);
        }
      }

      if (typeof localNotifications.hasPermission === 'function') {
        localNotifications.hasPermission(function (granted) {
          if (granted) {
            doSchedule();
          } else if (typeof localNotifications.requestPermission === 'function') {
            localNotifications.requestPermission(function (permissionGranted) {
              if (permissionGranted) doSchedule();
            });
          }
        });
      } else {
        doSchedule();
      }
    }

    function sortTasks(tasks) {
      return tasks.slice().sort(function (firstTask, secondTask) {
        var firstTime = sanitizeTaskTime(firstTask.time);
        var secondTime = sanitizeTaskTime(secondTask.time);
        if (!firstTime && !secondTime) return 0;
        if (!firstTime) return 1;
        if (!secondTime) return -1;
        return firstTime.localeCompare(secondTime);
      });
    }

    function normalizeDayTasks(tasks) {
      if (!Array.isArray(tasks)) throw new Error('Formato de tarefas diárias inválido.');
      return tasks.map(function (task) {
        if (typeof task === 'string') {
          return { title: sanitizeTaskTitle(task), completed: false, time: '', endTime: '', description: '', priority: 'baixa' };
        }
        if (!task || typeof task.title !== 'string' || typeof task.completed !== 'boolean') {
          throw new Error('Formato de tarefa inválido.');
        }
        var normalized = {
          title: sanitizeTaskTitle(task.title),
          completed: task.completed,
          time: sanitizeTaskTime(task.time),
          endTime: sanitizeTaskTime(task.endTime),
          description: typeof task.description === 'string' ? task.description.trim() : '',
          priority: ['baixa', 'media', 'alta'].indexOf(task.priority) !== -1 ? task.priority : 'baixa'
        };
        if (typeof task.routineId === 'string') {
          normalized.routineId = task.routineId;
        }
        return normalized;
      });
    }

    function isValidDateKey(dateKey) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
      var parts = dateKey.split('-').map(Number);
      var date = new Date(parts[0], parts[1] - 1, parts[2]);
      return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2];
    }

    function loadTasks() {
      var storage;
      var storedByDate = {};
      try { storage = window.localStorage; } catch (error) { return {}; }

      try {
        for (var index = 0; index < storage.length; index += 1) {
          var key = storage.key(index);
          if (!key || key.indexOf(storagePrefix) !== 0) continue;
          var dateKey = key.slice(storagePrefix.length);
          if (!isValidDateKey(dateKey)) continue;
          storedByDate[dateKey] = normalizeDayTasks(JSON.parse(storage.getItem(key)));
        }
        return storedByDate;
      } catch (error) {
        return storedByDate;
      }
    }

    function loadRecurringTasks() {
      try {
        var stored = window.localStorage.getItem(recurringStorageKey);
        if (!stored) return [];
        var routines = JSON.parse(stored);
        if (!Array.isArray(routines)) return [];
        return routines.map(function (routine) {
          return {
            id: routine.id,
            title: sanitizeTaskTitle(routine.title),
            time: sanitizeTaskTime(routine.time),
            endTime: sanitizeTaskTime(routine.endTime),
            description: typeof routine.description === 'string' ? routine.description.trim() : '',
            priority: ['baixa', 'media', 'alta'].indexOf(routine.priority) !== -1 ? routine.priority : 'baixa',
            repeatType: routine.repeatType === 'monthday' ? 'monthday' : 'weekday',
            weekdays: Array.isArray(routine.weekdays) ? routine.weekdays : [],
            monthdays: Array.isArray(routine.monthdays) ? routine.monthdays : [],
            months: Array.isArray(routine.months) && routine.months.length > 0 ? routine.months : [selectedDate.getMonth()],
            startDate: routine.startDate,
            skippedDates: routine.skippedDates || []
          };
        });
      } catch (error) { return []; }
    }

    function saveRecurringTasks(nextTasks) {
      try {
        window.localStorage.setItem(recurringStorageKey, JSON.stringify(nextTasks));
        recurringTasks = nextTasks;
        return true;
      } catch (error) {
        app.dialog.alert('Não foi possível salvar a tarefa padrão.');
        return false;
      }
    }

    function syncRecurringTasks(dateKey) {
      var dateParts = dateKey.split('-').map(Number);
      var date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      var dayTasks = (tasksByDate[dateKey] || []).slice();
      var changed = false;

      recurringTasks.forEach(function (routine) {
        if (dateKey < routine.startDate) return;
        if (routine.skippedDates && routine.skippedDates.indexOf(dateKey) !== -1) return;
        if (dayTasks.some(function (task) { return task.routineId === routine.id; })) return;

        var routineMonths = (routine.months && routine.months.length) ? routine.months : [date.getMonth()];
        if (routineMonths.indexOf(date.getMonth()) === -1) return;

        var repeatType = routine.repeatType || 'weekday';
        if (repeatType === 'weekday') {
          if (!routine.weekdays || routine.weekdays.indexOf(date.getDay()) === -1) return;
        } else if (repeatType === 'monthday') {
          if (!routine.monthdays || routine.monthdays.indexOf(date.getDate()) === -1) return;
        }

        dayTasks.push({
          title: routine.title,
          completed: false,
          time: routine.time,
          endTime: routine.endTime || '',
          description: routine.description || '',
          priority: routine.priority || 'baixa',
          routineId: routine.id
        });
        changed = true;
      });

      if (!changed) return;
      dayTasks = sortTasks(dayTasks);
      try {
        window.localStorage.setItem(storagePrefix + dateKey, JSON.stringify(dayTasks));
        tasksByDate[dateKey] = dayTasks;
      } catch (error) {}
    }

    function createDayButton(date) {
      var button = document.createElement('button');
      var weekday = document.createElement('span');
      var dayNumber = document.createElement('strong');
      var isSelected = getDateKey(date) === getDateKey(selectedDate);

      button.type = 'button';
      button.className = 'task-day' + (isSelected ? ' is-selected' : '');
      button.dataset.date = getDateKey(date);
      if (isSelected) button.setAttribute('aria-current', 'date');

      weekday.textContent = capitalize(formatDate(date, { weekday: 'short' }).replace('.', ''));
      dayNumber.textContent = String(date.getDate());
      button.appendChild(weekday);
      button.appendChild(dayNumber);
      return button;
    }

    function renderTasks() {
      var dateKey = getDateKey(selectedDate);
      syncRecurringTasks(dateKey);
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
        var timeSpan = document.createElement('span');
        var descSpan = document.createElement('span');
        var priorityBadge = document.createElement('span');
        var deleteButton = document.createElement('button');
        var deleteIcon = document.createElement('i');

        item.className = 'task-item task-priority-' + (task.priority || 'baixa');
        item.classList.toggle('is-completed', task.completed);
        item.dataset.taskIndex = String(index);

        completionLabel.className = 'task-completion';
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = task.completed;
        checkbox.disabled = !canCompleteTasks;
        checkmark.className = 'task-checkmark';

        textContent.className = 'task-text task-edit-trigger';
        title.className = 'task-title';
        title.textContent = task.title;

        var timeText = task.time || '';
        if (task.endTime) {
          timeText = (timeText ? timeText + ' - ' : 'Até ') + task.endTime;
        }
        timeSpan.className = 'task-time';
        timeSpan.textContent = timeText;
        timeSpan.hidden = !timeText;

        descSpan.className = 'task-description';
        descSpan.textContent = task.description || '';
        descSpan.hidden = !task.description;

        priorityBadge.className = 'task-priority-badge priority-' + (task.priority || 'baixa');
        priorityBadge.textContent = (task.priority || 'baixa').toUpperCase();

        var titleContainer = document.createElement('div');
        titleContainer.className = 'task-title-container';
        titleContainer.appendChild(title);
        titleContainer.appendChild(priorityBadge);

        textContent.appendChild(titleContainer);
        if (timeText) textContent.appendChild(timeSpan);
        if (task.description) textContent.appendChild(descSpan);

        completionLabel.appendChild(checkbox);
        completionLabel.appendChild(checkmark);

        deleteButton.type = 'button';
        deleteButton.className = 'task-delete-button';
        deleteIcon.className = 'mdi mdi-delete-outline';
        deleteButton.appendChild(deleteIcon);

        item.appendChild(completionLabel);
        item.appendChild(textContent);
        item.appendChild(deleteButton);
        taskList.appendChild(item);

        scheduleDeadlineNotification(task, dateKey);
      });

      taskCount.textContent = pendingTasks === 1 ? 'Você tem 1 tarefa pendente' : 'Você tem ' + pendingTasks + ' tarefas pendentes';
      taskDateNotice.hidden = canCompleteTasks;
      taskDateNotice.textContent = selectedDayIsFuture
        ? 'Você pode planejar tarefas para este dia, mas só poderá marcá-las como concluídas quando ele chegar.'
        : 'Tarefas de dias anteriores não podem ser marcadas como concluídas.';

      emptyState.hidden = hasTasks;

      if (honestyNotice) {
        honestyNotice.hidden = !hasTasks;
        honestyNotice.style.display = hasTasks ? '' : 'none';
      }
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
        if (previousTasks) tasksByDate[dateKey] = previousTasks;
        else delete tasksByDate[dateKey];
        renderTasks();
        return false;
      }
    }

    function renderCalendar() {
      var month = capitalize(formatDate(selectedDate, { month: 'long' })).toLocaleUpperCase('pt-BR');
      var firstVisibleDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 2);

      monthLabel.textContent = month + ' ' + selectedDate.getFullYear();
      heading.textContent = capitalize(formatDate(selectedDate, { weekday: 'long' })) + ', ' + selectedDate.getDate();
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
      var lastDayOfTargetMonth = new Date(firstDayOfTargetMonth.getFullYear(), firstDayOfTargetMonth.getMonth() + 1, 0).getDate();
      selectedDate = new Date(firstDayOfTargetMonth.getFullYear(), firstDayOfTargetMonth.getMonth(), Math.min(selectedDate.getDate(), lastDayOfTargetMonth));
      renderCalendar();
    }

    function showAddTaskOptions() {
      app.dialog.create({
        title: 'Adicionar tarefa',
        text: 'Escolha como deseja planejar sua tarefa.',
        buttons: [
          { text: 'Cancelar' },
          { text: 'Simples', bold: true },
          { text: 'Padrão', bold: true }
        ],
        onClick: function (dialog, index) {
          if (index === 1) window.setTimeout(function () { openTaskModal(false, null); }, 0);
          else if (index === 2) window.setTimeout(function () { openTaskModal(true, null); }, 0);
        }
      }).open();
    }

    function bindTimeInput(input) {
      if (!input) return;
      input.addEventListener('input', function () {
        var digits = input.value.replace(/\D/g, '').slice(0, 4);
        var formatted = digits.length <= 2 ? digits : digits.slice(0, 2) + ':' + digits.slice(2);
        input.value = formatted;
      });
    }

    function openTaskModal(isRecurring, editIndex) {
      var dateKey = getDateKey(selectedDate);
      var isEditing = editIndex !== null && editIndex !== undefined;
      var currentTask = isEditing ? (tasksByDate[dateKey] || [])[editIndex] : null;

      var today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!isEditing && dateKey < getDateKey(today)) {
        app.dialog.alert('Não é possível adicionar tarefas a dias anteriores.');
        return;
      }

      var weekdaysList = [
        { value: 0, label: 'Dom' }, { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' },
        { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' }
      ];

      var monthsList = [
        { value: 0, label: 'Jan' }, { value: 1, label: 'Fev' }, { value: 2, label: 'Mar' },
        { value: 3, label: 'Abr' }, { value: 4, label: 'Mai' }, { value: 5, label: 'Jun' },
        { value: 6, label: 'Jul' }, { value: 7, label: 'Ago' }, { value: 8, label: 'Set' },
        { value: 9, label: 'Out' }, { value: 10, label: 'Nov' }, { value: 11, label: 'Dez' }
      ];

      var titleVal = currentTask ? currentTask.title : '';
      var timeVal = currentTask ? currentTask.time || '' : '';
      var endTimeVal = currentTask ? currentTask.endTime || '' : '';
      var descVal = currentTask ? currentTask.description || '' : '';
      var priorityVal = currentTask ? currentTask.priority || 'baixa' : 'baixa';

      var currentRepeatType = 'weekday';
      var currentWeekdays = [selectedDate.getDay()];
      var currentMonthdays = [selectedDate.getDate()];
      // Apenas o mês selecionado/atual fica marcado por padrão ao criar nova tarefa
      var currentMonths = [selectedDate.getMonth()];

      if (isRecurring && currentTask && currentTask.routineId) {
        var foundRoutine = recurringTasks.find(function(r) { return r.id === currentTask.routineId; });
        if (foundRoutine) {
          currentRepeatType = foundRoutine.repeatType || 'weekday';
          currentWeekdays = foundRoutine.weekdays || [];
          currentMonthdays = foundRoutine.monthdays || [];
          currentMonths = foundRoutine.months || currentMonths;
        }
      }

      var content = '<div class="task-dialog-content">' +
        '<div class="task-dialog-field">' +
        '<label for="task-form-title">Tarefa</label>' +
        '<input id="task-form-title" type="text" maxlength="200" placeholder="Digite o nome da tarefa" value="' + escapeHtml(titleVal) + '" autocomplete="off" />' +
        '</div>' +
        '<div class="task-dialog-field">' +
        '<label for="task-form-desc">Descrição</label>' +
        '<textarea id="task-form-desc" rows="2" placeholder="Notas ou detalhes da tarefa">' + escapeHtml(descVal) + '</textarea>' +
        '</div>' +
        '<div class="task-dialog-row">' +
        '<div class="task-dialog-field half-field">' +
        '<label for="task-form-time">Início (Horário)</label>' +
        '<input id="task-form-time" type="text" inputmode="numeric" maxlength="5" placeholder="Ex.: 08:00" value="' + timeVal + '" />' +
        '</div>' +
        '<div class="task-dialog-field half-field">' +
        '<label for="task-form-endtime">Prazo (Término)</label>' +
        '<input id="task-form-endtime" type="text" inputmode="numeric" maxlength="5" placeholder="Ex.: 13:00" value="' + endTimeVal + '" />' +
        '</div>' +
        '</div>' +
        '<div class="task-dialog-field">' +
        '<label for="task-form-priority">Prioridade</label>' +
        '<select id="task-form-priority" class="task-priority-select">' +
        '<option value="baixa"' + (priorityVal === 'baixa' ? ' selected' : '') + '>Baixa (Verde)</option>' +
        '<option value="media"' + (priorityVal === 'media' ? ' selected' : '') + '>Média (Amarelo)</option>' +
        '<option value="alta"' + (priorityVal === 'alta' ? ' selected' : '') + '>Alta (Vermelho)</option>' +
        '</select>' +
        '</div>';

      if (isRecurring) {
        content += '<div class="task-dialog-field">' +
          '<label for="task-form-repeat-type">Frequência da Repetição</label>' +
          '<select id="task-form-repeat-type" class="task-priority-select">' +
          '<option value="weekday"' + (currentRepeatType === 'weekday' ? ' selected' : '') + '>Dias da semana</option>' +
          '<option value="monthday"' + (currentRepeatType === 'monthday' ? ' selected' : '') + '>Dias do mês</option>' +
          '</select>' +
          '</div>';

        content += '<fieldset id="task-weekday-wrapper" class="task-dialog-field task-weekday-field"' +
          (currentRepeatType !== 'weekday' ? ' style="display:none;"' : '') + '>' +
          '<legend>Dias da semana</legend><div class="task-weekday-options">';
        weekdaysList.forEach(function (weekday) {
          var wChecked = currentWeekdays.indexOf(weekday.value) !== -1 ? ' checked' : '';
          content += '<label class="weekday-chip"><input type="checkbox" class="chk-weekday" value="' + weekday.value + '"' + wChecked + '><span>' + weekday.label + '</span></label>';
        });
        content += '</div></fieldset>';

        content += '<fieldset id="task-monthday-wrapper" class="task-dialog-field task-monthday-field"' +
          (currentRepeatType !== 'monthday' ? ' style="display:none;"' : '') + '>' +
          '<legend>Dias do mês</legend><div class="task-monthday-grid">';
        for (var mDay = 1; mDay <= 31; mDay++) {
          var mChecked = currentMonthdays.indexOf(mDay) !== -1 ? ' checked' : '';
          content += '<label class="monthday-chip"><input type="checkbox" class="chk-monthday" value="' + mDay + '"' + mChecked + '><span>' + mDay + '</span></label>';
        }
        content += '</div></fieldset>';

        content += '<fieldset class="task-dialog-field task-months-field">' +
          '<legend>Meses do ano</legend><div class="task-month-grid">';
        monthsList.forEach(function (m) {
          var monthChecked = currentMonths.indexOf(m.value) !== -1 ? ' checked' : '';
          content += '<label class="month-chip"><input type="checkbox" class="chk-month" value="' + m.value + '"' + monthChecked + '><span>' + m.label + '</span></label>';
        });
        content += '</div></fieldset>';
      }
      content += '</div>';

      var taskDialog = app.dialog.create({
        title: isEditing ? 'Editar tarefa' : (isRecurring ? 'Nova tarefa padrão' : 'Nova tarefa'),
        content: content,
        buttons: [
          { text: 'Cancelar' },
          { text: 'Salvar', bold: true }
        ],
        onClick: function (dialogInstance, index) {
          if (index === 1) {
            var dialogEl = dialogInstance.$el ? dialogInstance.$el[0] : dialogInstance.el;
            var titleInput = dialogEl.querySelector('#task-form-title');
            var descInput = dialogEl.querySelector('#task-form-desc');
            var timeInput = dialogEl.querySelector('#task-form-time');
            var endTimeInput = dialogEl.querySelector('#task-form-endtime');
            var prioritySelect = dialogEl.querySelector('#task-form-priority');

            var title = titleInput ? sanitizeTaskTitle(titleInput.value) : '';
            var description = descInput ? descInput.value.trim() : '';
            var time = sanitizeTaskTime(timeInput ? timeInput.value : '');
            var endTime = sanitizeTaskTime(endTimeInput ? endTimeInput.value : '');
            var priority = prioritySelect ? prioritySelect.value : 'baixa';

            if (!title) {
              app.dialog.alert('Digite o nome da tarefa antes de salvar.');
              return;
            }

            if (isRecurring) {
              var repeatType = dialogEl.querySelector('#task-form-repeat-type') ? dialogEl.querySelector('#task-form-repeat-type').value : 'weekday';

              var selectedWeekdays = [];
              if (repeatType === 'weekday') {
                selectedWeekdays = Array.prototype.slice.call(
                  dialogEl.querySelectorAll('.chk-weekday:checked')
                ).map(function (input) { return Number(input.value); });

                if (!selectedWeekdays.length) {
                  app.dialog.alert('Selecione pelo menos um dia da semana.');
                  return;
                }
              }

              var selectedMonthdays = [];
              if (repeatType === 'monthday') {
                selectedMonthdays = Array.prototype.slice.call(
                  dialogEl.querySelectorAll('.chk-monthday:checked')
                ).map(function (input) { return Number(input.value); });

                if (!selectedMonthdays.length) {
                  app.dialog.alert('Selecione pelo menos um dia do mês.');
                  return;
                }
              }

              var selectedMonths = Array.prototype.slice.call(
                dialogEl.querySelectorAll('.chk-month:checked')
              ).map(function (input) { return Number(input.value); });

              if (!selectedMonths.length) {
                app.dialog.alert('Selecione pelo menos um mês do ano.');
                return;
              }

              var routineId = (currentTask && currentTask.routineId) ? currentTask.routineId : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

              var routine = {
                id: routineId,
                title: title,
                description: description,
                time: time,
                endTime: endTime,
                priority: priority,
                repeatType: repeatType,
                weekdays: selectedWeekdays,
                monthdays: selectedMonthdays,
                months: selectedMonths,
                startDate: dateKey,
                skippedDates: []
              };

              var nextRoutines = recurringTasks.filter(function(r) { return r.id !== routineId; }).concat(routine);
              if (saveRecurringTasks(nextRoutines)) renderCalendar();
            } else {
              var previousTasks = tasksByDate[dateKey];
              var currentDayTasks = (tasksByDate[dateKey] || []).slice();

              var updatedTask = {
                title: title,
                description: description,
                completed: isEditing && currentTask ? currentTask.completed : false,
                time: time,
                endTime: endTime,
                priority: priority
              };

              if (currentTask && currentTask.routineId) {
                updatedTask.routineId = currentTask.routineId;
              }

              if (isEditing) {
                currentDayTasks[editIndex] = updatedTask;
              } else {
                currentDayTasks.push(updatedTask);
              }

              tasksByDate = Object.assign({}, tasksByDate);
              tasksByDate[dateKey] = sortTasks(currentDayTasks);

              if (saveTasks(dateKey, previousTasks)) renderCalendar();
            }
          }
        }
      });

      taskDialog.open();
      window.setTimeout(function () {
        var dialogEl = taskDialog.$el ? taskDialog.$el[0] : taskDialog.el;
        if (dialogEl) {
          bindTimeInput(dialogEl.querySelector('#task-form-time'));
          bindTimeInput(dialogEl.querySelector('#task-form-endtime'));
          var tInput = dialogEl.querySelector('#task-form-title');
          if (tInput) { tInput.focus(); }

          // Aplicação Dinâmica da Cor da Prioridade no Select
          var prioritySelect = dialogEl.querySelector('#task-form-priority');
          if (prioritySelect) {
            var updatePriorityStyle = function () {
              prioritySelect.className = 'task-priority-select priority-' + prioritySelect.value;
            };
            updatePriorityStyle();
            prioritySelect.addEventListener('change', updatePriorityStyle);
          }

          var repeatTypeSelect = dialogEl.querySelector('#task-form-repeat-type');
          if (repeatTypeSelect) {
            repeatTypeSelect.addEventListener('change', function () {
              var val = repeatTypeSelect.value;
              var wWrap = dialogEl.querySelector('#task-weekday-wrapper');
              var mWrap = dialogEl.querySelector('#task-monthday-wrapper');
              if (wWrap) wWrap.style.display = val === 'weekday' ? 'block' : 'none';
              if (mWrap) mWrap.style.display = val === 'monthday' ? 'block' : 'none';
            });
          }
        }
      }, 100);
    }

    function escapeHtml(value) {
      return (value || '').replace(/[&<>"']/g, function (character) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
      });
    }

    function searchTasks() {
      app.dialog.prompt('Digite o nome ou parte da tarefa:', 'Pesquisar tarefas', function (value) {
        var query = value.trim().toLocaleLowerCase('pt-BR');
        if (!query) return;

        var matchingTasks = [];
        Object.keys(tasksByDate).sort().forEach(function (dateKey) {
          tasksByDate[dateKey].forEach(function (task) {
            if (task.title.toLocaleLowerCase('pt-BR').indexOf(query) !== -1) {
              matchingTasks.push({ dateKey: dateKey, title: task.title, time: sanitizeTaskTime(task.time) });
            }
          });
        });

        if (matchingTasks.length === 0) {
          app.dialog.alert('Nenhuma tarefa encontrada.', 'Pesquisa');
          return;
        }

        var resultList = matchingTasks.map(function (match) {
          return '<div>' + match.dateKey + ' — ' + escapeHtml(match.title) + '</div>';
        }).join('');

        app.dialog.alert(resultList, 'Resultados da pesquisa');
      });
    }

    monthControls.addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (!button) return;
      changeMonth(button.querySelector('.mdi-chevron-left') ? -1 : 1);
    });

    daysContainer.addEventListener('click', function (event) {
      var button = event.target.closest('.task-day');
      if (!button || !daysContainer.contains(button)) return;
      var parts = button.dataset.date.split('-').map(Number);
      selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
      renderCalendar();
    });

    taskList.addEventListener('click', function (event) {
      var deleteButton = event.target.closest('.task-delete-button');
      var checkbox = event.target.closest('.task-checkbox');
      var editTrigger = event.target.closest('.task-edit-trigger');
      var item = event.target.closest('.task-item');

      if (!item || !taskList.contains(item)) return;

      var dateKey = getDateKey(selectedDate);
      var taskIndex = Number(item.dataset.taskIndex);
      var task = tasksByDate[dateKey] && tasksByDate[dateKey][taskIndex];

      if (!task) return;

      if (checkbox) {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dateKey !== getDateKey(today)) {
          app.dialog.alert('As tarefas só podem ser marcadas como concluídas no dia atual.');
          renderTasks();
          return;
        }
        var previousTasks = tasksByDate[dateKey];
        tasksByDate = Object.assign({}, tasksByDate);
        tasksByDate[dateKey][taskIndex].completed = checkbox.checked;

        if (checkbox.checked) {
          cancelTaskNotification(task, dateKey);
        }

        if (saveTasks(dateKey, previousTasks)) renderTasks();
        return;
      }

      if (editTrigger && !deleteButton) {
        var todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        if (dateKey < getDateKey(todayDate)) {
          app.dialog.alert('Tarefas de dias anteriores não podem ser editadas.');
          return;
        }

        openTaskModal(!!task.routineId, taskIndex);
        return;
      }

      if (deleteButton) {
        cancelTaskNotification(task, dateKey);

        if (task.routineId) {
          app.dialog.create({
            title: 'Excluir ou Editar',
            text: 'O que deseja fazer com a tarefa padrão "' + escapeHtml(task.title) + '"?',
            buttons: [
              { text: 'Cancelar' },
              {
                text: 'Somente deste dia',
                onClick: function () {
                  var rIdx = -1;
                  for (var i = 0; i < recurringTasks.length; i++) {
                    if (recurringTasks[i].id === task.routineId) { rIdx = i; break; }
                  }
                  if (rIdx !== -1) {
                    var updRoutines = recurringTasks.slice();
                    if (updRoutines[rIdx].skippedDates.indexOf(dateKey) === -1) {
                      updRoutines[rIdx].skippedDates.push(dateKey);
                    }
                    saveRecurringTasks(updRoutines);
                  }
                  var prevTasks = tasksByDate[dateKey];
                  tasksByDate = Object.assign({}, tasksByDate);
                  tasksByDate[dateKey].splice(taskIndex, 1);
                  if (tasksByDate[dateKey].length === 0) delete tasksByDate[dateKey];
                  if (saveTasks(dateKey, prevTasks)) renderTasks();
                }
              },
              {
                text: 'Todas as repetições',
                bold: true,
                color: 'red',
                onClick: function () {
                  var nextRoutines = recurringTasks.filter(function (r) { return r.id !== task.routineId; });
                  saveRecurringTasks(nextRoutines);
                  Object.keys(tasksByDate).forEach(function (dKey) {
                    tasksByDate[dKey] = tasksByDate[dKey].filter(function (t) { return t.routineId !== task.routineId; });
                    if (tasksByDate[dKey].length === 0) delete tasksByDate[dKey];
                  });
                  renderTasks();
                }
              }
            ],
            verticalButtons: true
          }).open();
        } else {
          app.dialog.confirm('Tem certeza de que deseja excluir a tarefa "' + escapeHtml(task.title) + '"?', 'Excluir tarefa', function () {
            var prevTasks = tasksByDate[dateKey];
            tasksByDate = Object.assign({}, tasksByDate);
            tasksByDate[dateKey].splice(taskIndex, 1);
            if (tasksByDate[dateKey].length === 0) delete tasksByDate[dateKey];
            if (saveTasks(dateKey, prevTasks)) renderTasks();
          });
        }
      }
    });

    addButton.addEventListener('click', function (event) {
      event.preventDefault();
      showAddTaskOptions();
    });

    searchButton.addEventListener('click', searchTasks);
    pageRoot.addEventListener('tasks:refresh', function () {
      tasksByDate = loadTasks();
      recurringTasks = loadRecurringTasks();
      renderCalendar();
    });

    renderCalendar();
  };

  if (window.app && typeof window.app.on === 'function') {
    window.app.on('pageInit', function (page) {
      if (page.name === 'index') window.initializeTaskCalendar(page.el);
    });
  }

  var currentIndexPage = document.querySelector('.page[data-name="index"]');
  if (currentIndexPage) window.initializeTaskCalendar(currentIndexPage);
})();