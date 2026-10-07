(function () {
  window.initializeReport = function (pageElement) {
    var page = pageElement && pageElement.el ? pageElement.el : pageElement;
    var pageRoot = page && page.matches && page.matches('.report-page')
      ? page
      : page && page.querySelector('.report-page');

    if (!pageRoot || pageRoot.dataset.reportInitialized === 'true') {
      return;
    }

    var monthTitle = pageRoot.querySelector('.report-month-title');
    var calendarGrid = pageRoot.querySelector('.report-calendar-grid');
    var emptyState = pageRoot.querySelector('.report-empty-state');
    var emptyTitle = pageRoot.querySelector('.report-empty-title');
    var emptyMessage = pageRoot.querySelector('.report-empty-message');
    var emptyAddButton = pageRoot.querySelector('.report-empty-add-button');
    var stats = pageRoot.querySelector('.report-stats');
    var feedback = pageRoot.querySelector('.report-feedback');
    var completedCount = pageRoot.querySelector('.report-completed-count');
    var completedTotal = pageRoot.querySelector('.report-completed-total');
    var progressRing = pageRoot.querySelector('.report-progress-ring');
    var streakCount = pageRoot.querySelector('.report-streak-count');
    var mood = pageRoot.querySelector('.report-mood');
    var moodIcon = mood && mood.querySelector('.mdi');
    var performanceTitle = pageRoot.querySelector('.report-performance-title');
    var performanceMessage = pageRoot.querySelector('.report-performance-message');

    if (!monthTitle || !calendarGrid || !emptyState || !emptyTitle ||
        !emptyMessage || !emptyAddButton || !stats || !feedback || !completedCount ||
        !completedTotal || !progressRing || !streakCount || !performanceTitle ||
        !mood || !moodIcon || !performanceMessage) {
      throw new Error('Não foi possível inicializar os componentes do relatório.');
    }

    pageRoot.dataset.reportInitialized = 'true';
    var storagePrefix = 'day-list-tasks:';
    var maxTaskTitleLength = 200;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var dayRolloverTimer = null;
    var visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    var selectedDate = new Date(today);
    var tasksByDate = loadReportTasks();

    function padNumber(number) {
      return String(number).padStart(2, '0');
    }

    function getDateKey(date) {
      return date.getFullYear() + '-' + padNumber(date.getMonth() + 1) + '-' + padNumber(date.getDate());
    }

    function getMonthTitle(date) {
      var month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date);
      return 'Visão Geral: ' + month.charAt(0).toLocaleUpperCase('pt-BR') +
        month.slice(1) + ' ' + date.getFullYear();
    }

    function sanitizeTaskTitle(title) {
      return title.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, maxTaskTitleLength);
    }

    function loadReportTasks() {
      var tasks = {};

      try {
        for (var index = 0; index < window.localStorage.length; index += 1) {
          var key = window.localStorage.key(index);
          if (!key || key.indexOf(storagePrefix) !== 0) {
            continue;
          }

          var dateKey = key.slice(storagePrefix.length);
          var entries = JSON.parse(window.localStorage.getItem(key));
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Array.isArray(entries)) {
            continue;
          }

          tasks[dateKey] = entries.map(function (entry) {
            if (typeof entry === 'string') {
              return { title: sanitizeTaskTitle(entry), completed: false };
            }
            if (!entry || typeof entry.title !== 'string' || typeof entry.completed !== 'boolean') {
              throw new Error('Os dados de uma tarefa não são válidos.');
            }
            return { title: sanitizeTaskTitle(entry.title), completed: entry.completed };
          });
        }
      } catch (error) {
        app.dialog.alert('Não foi possível carregar os dados do relatório salvos neste dispositivo.');
      }

      return tasks;
    }

    function getDayStatus(date) {
      var dateKey = getDateKey(date);
      var dayTasks = tasksByDate[dateKey] || [];
      if (dayTasks.length > 0 && dayTasks.every(function (task) { return task.completed; })) {
        return 'is-completed';
      }
      if (dayTasks.length > 0) {
        return 'has-pending';
      }
      return '';
    }

    function createDayButton(date) {
      var button = document.createElement('button');
      var isCurrentDay = getDateKey(date) === getDateKey(today);
      var isSelected = getDateKey(date) === getDateKey(selectedDate);

      button.type = 'button';
      button.className = 'report-day ' + getDayStatus(date);
      button.dataset.date = getDateKey(date);
      button.setAttribute('aria-label', new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(date));
      button.setAttribute('aria-pressed', String(isSelected));
      if (isCurrentDay) {
        button.classList.add('is-today');
      }
      if (isSelected) {
        button.classList.add('is-selected');
      }
      if (date.getTime() < today.getTime()) {
        button.classList.add('is-elapsed');
      }
      button.textContent = String(date.getDate());
      return button;
    }

    function createWeek(dates) {
      var week = document.createElement('div');
      week.className = 'report-week';
      if (dates.some(function (date) { return date && getDayStatus(date) === 'is-completed'; })) {
        week.classList.add('has-completed');
      }

      dates.forEach(function (date) {
        if (date) {
          week.appendChild(createDayButton(date));
        } else {
          var emptyCell = document.createElement('span');
          emptyCell.className = 'report-day-placeholder';
          emptyCell.setAttribute('aria-hidden', 'true');
          week.appendChild(emptyCell);
        }
      });

      return week;
    }

    function isDayComplete(date) {
      var dayTasks = tasksByDate[getDateKey(date)] || [];
      return dayTasks.length > 0 && dayTasks.every(function (task) { return task.completed; });
    }

    function getCompletedWorkdays(sunday) {
      if (sunday.getDay() !== 0) {
        return 0;
      }

      var monday = new Date(sunday);
      monday.setDate(monday.getDate() - 6);
      var completedDays = 0;
      for (var day = 0; day < 6; day += 1) {
        var workday = new Date(monday);
        workday.setDate(monday.getDate() + day);
        if (workday.getTime() < today.getTime() && isDayComplete(workday)) {
          completedDays += 1;
        }
      }
      return completedDays;
    }

    function hasEarnedRestDay(sunday) {
      return getCompletedWorkdays(sunday) >= 5;
    }

    function getWeekEndingSunday(date) {
      var sunday = new Date(date);
      sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7));
      return sunday;
    }

    function getCurrentStreak() {
      var streak = 0;
      var date = new Date(today);
      date.setDate(date.getDate() - 1);

      while (true) {
        if (date.getDay() === 0) {
          if (hasEarnedRestDay(date)) {
            date.setDate(date.getDate() - 1);
            continue;
          }
          break;
        }
        if (!isDayComplete(date)) {
          if (!hasEarnedRestDay(getWeekEndingSunday(date))) {
            break;
          }
        } else {
          streak += 1;
        }
        date.setDate(date.getDate() - 1);
      }

      return streak;
    }

    function updateSummary() {
      var visibleMonthPrefix = visibleMonth.getFullYear() + '-' + padNumber(visibleMonth.getMonth() + 1) + '-';
      var hasMonthTasks = Object.keys(tasksByDate).some(function (dateKey) {
        return dateKey.indexOf(visibleMonthPrefix) === 0 && tasksByDate[dateKey].length > 0;
      });
      var hasAnyTasks = Object.keys(tasksByDate).some(function (dateKey) {
        return tasksByDate[dateKey].length > 0;
      });
      var completedWeekDays = getCompletedWorkdays(getWeekEndingSunday(today));
      var completionRate = Math.round((completedWeekDays / 6) * 100);
      var hasEarnedRestThisWeek = completedWeekDays >= 5;

      emptyState.hidden = hasMonthTasks;
      emptyAddButton.hidden = hasMonthTasks;
      stats.hidden = !hasMonthTasks;
      feedback.hidden = !hasAnyTasks;

      completedCount.textContent = String(completedWeekDays);
      completedTotal.textContent = '/ 6';
      progressRing.style.setProperty('--report-progress', completionRate + '%');
      streakCount.textContent = String(getCurrentStreak());

      mood.classList.remove('report-mood-good', 'report-mood-medium', 'report-mood-low');
      if (hasEarnedRestThisWeek) {
        mood.classList.add('report-mood-good');
        moodIcon.className = 'mdi mdi-emoticon-happy';
        performanceTitle.textContent = 'Descanso merecido!';
        performanceMessage.textContent = 'Boa frequência: você concluiu ' + completedWeekDays +
          ' de 6 dias nesta semana. Aproveite seu descanso: sua sequência está mantida.';
      } else if (completedWeekDays >= 3) {
        mood.classList.add('report-mood-medium');
        moodIcon.className = 'mdi mdi-emoticon-neutral';
        performanceTitle.textContent = 'Frequência mediana';
        performanceMessage.textContent = 'Você concluiu ' + completedWeekDays +
          ' de 6 dias nesta semana. Continue avançando para alcançar uma boa frequência.';
      } else {
        mood.classList.add('report-mood-low');
        moodIcon.className = 'mdi mdi-emoticon-sad';
        performanceTitle.textContent = 'Frequência baixa';
        performanceMessage.textContent = 'Você concluiu ' + completedWeekDays +
          ' de 6 dias nesta semana. Retome suas tarefas para melhorar sua frequência.';
      }

      if (!hasMonthTasks) {
        emptyTitle.textContent = hasAnyTasks
          ? 'Nenhuma atividade neste mês'
          : 'Seu relatório começa com uma tarefa';
        emptyMessage.textContent = hasAnyTasks
          ? 'Não há tarefas registradas neste mês. Escolha outro mês no calendário ou adicione uma tarefa.'
          : 'Adicione uma tarefa para começar a acompanhar seu progresso e ver seus dados aqui.';
        return;
      }
    }

    function refreshToday() {
      var currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      if (currentDate.getTime() === today.getTime()) {
        return;
      }

      var previousToday = today;
      today = currentDate;
      if (selectedDate.getTime() === previousToday.getTime()) {
        selectedDate = new Date(today);
      }
      if (visibleMonth.getFullYear() === previousToday.getFullYear() &&
          visibleMonth.getMonth() === previousToday.getMonth()) {
        visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      }
    }

    function scheduleDayRollover() {
      if (dayRolloverTimer !== null) {
        window.clearTimeout(dayRolloverTimer);
      }

      var nextDay = new Date();
      nextDay.setHours(24, 0, 0, 50);
      dayRolloverTimer = window.setTimeout(function () {
        dayRolloverTimer = null;
        renderReport();
      }, nextDay.getTime() - Date.now());
    }

    function changeMonth(offset) {
      visibleMonth.setMonth(visibleMonth.getMonth() + offset);
      var targetDay = Math.min(
        selectedDate.getDate(),
        new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()
      );
      selectedDate = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), targetDay);
      renderReport(offset);
    }

    function renderReport(animationDirection) {
      refreshToday();
      tasksByDate = loadReportTasks();
      monthTitle.textContent = getMonthTitle(visibleMonth);
      calendarGrid.replaceChildren();

      var daysInMonth = new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth() + 1,
        0
      ).getDate();
      var firstWeekday = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay();
      var weekDates = [];

      for (var blank = 0; blank < firstWeekday; blank += 1) {
        weekDates.push(null);
      }

      for (var day = 1; day <= daysInMonth; day += 1) {
        weekDates.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
        if (weekDates.length === 7) {
          calendarGrid.appendChild(createWeek(weekDates));
          weekDates = [];
        }
      }

      if (weekDates.length > 0) {
        while (weekDates.length < 7) {
          weekDates.push(null);
        }
        calendarGrid.appendChild(createWeek(weekDates));
      }

      updateSummary();
      scheduleDayRollover();

      if (animationDirection) {
        calendarGrid.classList.remove('report-month-enter-next', 'report-month-enter-previous');
        void calendarGrid.offsetWidth;
        calendarGrid.classList.add(
          animationDirection > 0 ? 'report-month-enter-next' : 'report-month-enter-previous'
        );
      }
    }

    pageRoot.addEventListener('report:refresh', renderReport);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        renderReport();
      }
    });
    window.addEventListener('focus', renderReport);
    document.addEventListener('resume', renderReport);
    window.addEventListener('storage', function (event) {
      if (event.key && event.key.indexOf(storagePrefix) === 0) {
        renderReport();
      }
    });

    var pointerStart = null;
    var suppressCalendarClick = false;

    calendarGrid.addEventListener('pointerdown', function (event) {
      if (event.isPrimary && event.pointerType !== 'touch') {
        pointerStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      }
    });

    calendarGrid.addEventListener('pointerup', function (event) {
      if (event.pointerType === 'touch' || !pointerStart ||
          event.pointerId !== pointerStart.pointerId) {
        return;
      }

      handleCalendarSwipe(pointerStart.x, pointerStart.y, event.clientX, event.clientY);
      pointerStart = null;
    });

    calendarGrid.addEventListener('pointercancel', function () {
      pointerStart = null;
    });

    calendarGrid.addEventListener('touchstart', function (event) {
      if (event.touches.length === 1) {
        pointerStart = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
          pointerId: 'touch'
        };
      } else {
        pointerStart = null;
      }
    }, { passive: true });

    calendarGrid.addEventListener('touchend', function (event) {
      if (!pointerStart || pointerStart.pointerId !== 'touch' ||
          event.changedTouches.length !== 1) {
        return;
      }

      handleCalendarSwipe(
        pointerStart.x,
        pointerStart.y,
        event.changedTouches[0].clientX,
        event.changedTouches[0].clientY
      );
      pointerStart = null;
    }, { passive: true });

    calendarGrid.addEventListener('touchcancel', function () {
      pointerStart = null;
    }, { passive: true });

    function handleCalendarSwipe(startX, startY, endX, endY) {
      var horizontalDistance = endX - startX;
      var verticalDistance = endY - startY;
      if (Math.abs(horizontalDistance) < 50 ||
          Math.abs(horizontalDistance) < Math.abs(verticalDistance) * 1.25) {
        return;
      }

      suppressCalendarClick = true;
      window.setTimeout(function () {
        suppressCalendarClick = false;
      }, 500);
      changeMonth(horizontalDistance < 0 ? 1 : -1);
    }

    calendarGrid.addEventListener('click', function (event) {
      if (suppressCalendarClick) {
        suppressCalendarClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    calendarGrid.addEventListener('keydown', function (event) {
      if (event.key === 'PageUp' || event.key === 'PageDown') {
        event.preventDefault();
        changeMonth(event.key === 'PageDown' ? 1 : -1);
      }
    });

    calendarGrid.addEventListener('click', function (event) {
      var button = event.target.closest('.report-day');
      if (!button || !calendarGrid.contains(button)) {
        return;
      }

      var parts = button.dataset.date.split('-').map(Number);
      selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
      renderReport();
    });

    function openAddTaskDialog(event) {
      event.preventDefault();
      app.dialog.prompt('Digite a tarefa para este dia:', 'Nova tarefa', function (value) {
        var title = typeof value === 'string'
          ? value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim()
          : '';
        if (!title) {
          return;
        }
        if (title.length > maxTaskTitleLength) {
          app.dialog.alert('A tarefa deve ter no máximo ' + maxTaskTitleLength + ' caracteres.');
          return;
        }

        var dateKey = getDateKey(selectedDate);
        var dayStorageKey = storagePrefix + dateKey;
        var previousTasks = tasksByDate[dateKey] || [];
        var nextTasks = previousTasks.concat({ title: title, completed: false });

        try {
          window.localStorage.setItem(dayStorageKey, JSON.stringify(nextTasks));
        } catch (error) {
          app.dialog.alert('Não foi possível salvar a tarefa. Verifique o espaço disponível no dispositivo.');
          return;
        }

        tasksByDate[dateKey] = nextTasks;
        renderReport();
      });
    }

    emptyAddButton.addEventListener('click', openAddTaskDialog);

    renderReport();
  };

  window.refreshReport = function (pageElement) {
    var page = pageElement && pageElement.el ? pageElement.el : pageElement;
    var pageRoot = page && page.matches && page.matches('.report-page')
      ? page
      : page && page.querySelector('.report-page');

    if (pageRoot && pageRoot.dataset.reportInitialized === 'true') {
      pageRoot.dispatchEvent(new Event('report:refresh'));
    }
  };
})();
