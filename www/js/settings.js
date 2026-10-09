(function () {
  var profileStorageKey = 'day-list-profile';
  var settingsStorageKey = 'day-list-settings';
  var taskStoragePrefix = 'day-list-tasks:';
  var legacyTaskStorageKey = 'day-list-tasks';
  var recurringStorageKey = 'day-list-recurring-tasks';
  var maxProfileNameLength = 60;
  var maxTaskTitleLength = 200;
  var maxBackupFileSize = 10 * 1024 * 1024;
  var backupKdfIterations = 600000;
  var avatarOptions = [
    'img/avatar-gato.png',
    'img/avatar-raposa.png',
    'img/avatar-robo-verde.png',
    'img/avatar-pinguim.png',
    'img/avatar-panda.png',
    'img/avatar-robo-roxo.png',
    'img/avatar-coruja.png',
    'img/avatar-hipopotamo.png'
  ];
  var defaultProfile = { name: 'Nome do Usuário', avatar: avatarOptions[0] };
  var defaultSettings = {
    taskReminders: false,
    dailySummary: false,
    theme: 'dark'
  };

  function showError(message) {
    if (window.app && window.app.dialog) {
      window.app.dialog.alert(message);
    } else {
      console.error(message);
    }
  }

  function readJson(key, fallback) {
    try {
      var value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      showError('Não foi possível ler as configurações salvas neste dispositivo.');
      return fallback;
    }
  }

  function readProfile() {
    var profile = readJson(profileStorageKey, defaultProfile);
    if (!profile || typeof profile.name !== 'string') {
      return defaultProfile;
    }
    var name = cleanText(profile.name, maxProfileNameLength);
    if (!name) {
      return defaultProfile;
    }
    return {
      name: name,
      avatar: isValidAvatar(profile.avatar) ? profile.avatar : defaultProfile.avatar
    };
  }

  function cleanText(value, maxLength) {
    return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, maxLength);
  }

  function validateText(value, maxLength, label) {
    var cleanValue = cleanText(value, maxLength);
    if (!cleanValue) {
      throw new Error(label + ' não pode ficar vazio.');
    }
    if (cleanText(value, value.length).length > maxLength) {
      throw new Error(label + ' deve ter no máximo ' + maxLength + ' caracteres.');
    }
    return cleanValue;
  }

  function isValidAvatar(avatar) {
    return typeof avatar === 'string' && avatarOptions.indexOf(avatar) !== -1;
  }

  function readSettings() {
    var stored = readJson(settingsStorageKey, defaultSettings);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
      return Object.assign({}, defaultSettings);
    }
    return {
      taskReminders: stored.taskReminders === true,
      dailySummary: stored.dailySummary === true,
      theme: stored.theme === 'light' ? 'light' : 'dark'
    };
  }

  function applyProfile(root) {
    var profile = readProfile();
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-profile-name]').forEach(function (element) {
      element.textContent = profile.name;
    });
    scope.querySelectorAll('[data-profile-avatar]').forEach(function (image) {
      image.src = profile.avatar;
    });
    scope.querySelectorAll('.settings-account-avatar').forEach(function (image) {
      image.src = profile.avatar;
      image.alt = 'Foto de ' + profile.name;
    });
  }

  function applyTheme(theme) {
    var appRoot = document.getElementById('app');
    if (appRoot) {
      appRoot.classList.toggle('app-light-theme', theme === 'light');
    }
  }

  function saveSettings(settings) {
    try {
      window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
      applyTheme(settings.theme);
      return true;
    } catch (error) {
      showError('Não foi possível salvar as configurações. Verifique o espaço disponível no dispositivo.');
      return false;
    }
  }

  function saveProfile(profile) {
    try {
      window.localStorage.setItem(profileStorageKey, JSON.stringify(profile));
      applyProfile();
      return true;
    } catch (error) {
      showError('Não foi possível salvar o perfil. Verifique o espaço disponível no dispositivo.');
      return false;
    }
  }

  function openProfileDialog() {
    var profile = readProfile();
    var selectedAvatar = profile.avatar;
    var avatarButtons = avatarOptions.map(function (avatar, index) {
      return '<button class="settings-avatar-option" type="button" aria-pressed="' +
        String(avatar === selectedAvatar) + '" data-profile-avatar-choice="' + avatar +
        '" aria-label="Escolher foto de perfil ' + (index + 1) + '">' +
        '<img src="' + avatar + '" alt=""></button>';
    }).join('');
    var dialog = app.dialog.create({
      title: 'Editar perfil',
      content: '<div class="task-dialog-content profile-dialog-content">' +
        '<div class="task-dialog-field">' +
        '<label for="profile-dialog-name">Nome de usuário</label>' +
        '<input id="profile-dialog-name" class="settings-profile-name" type="text" maxlength="60" ' +
        'autocomplete="name" value="' + escapeHtml(profile.name) + '">' +
        '</div>' +
        '<span class="settings-avatar-label">Escolha uma foto</span>' +
        '<div class="settings-avatar-options" role="group" aria-label="Fotos de perfil">' +
        avatarButtons + '</div></div>',
      buttons: [
        { text: 'Cancelar' },
        { text: 'Salvar', bold: true }
      ],
      onClick: function (instance, index) {
        if (index !== 1) {
          return;
        }
        var nameInput = instance.$el[0].querySelector('#profile-dialog-name');
        var name;
        try {
          name = validateText(nameInput.value, maxProfileNameLength, 'O nome do perfil');
        } catch (error) {
          showError(error.message);
          nameInput.focus();
          return;
        }
        var selectedButton = instance.$el[0].querySelector('[data-profile-avatar-choice][aria-pressed="true"]');
        var nextProfile = {
          name: name,
          avatar: selectedButton ? selectedButton.dataset.profileAvatarChoice : profile.avatar
        };
        if (saveProfile(nextProfile)) {
          instance.close();
        }
      }
    });
    dialog.open();
    window.setTimeout(function () {
      var nameInput = dialog.$el && dialog.$el[0] &&
        dialog.$el[0].querySelector('#profile-dialog-name');
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
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

  function getAppStorageSnapshot() {
    var data = {};
    for (var index = 0; index < window.localStorage.length; index += 1) {
      var key = window.localStorage.key(index);
      if (isAppStorageKey(key)) {
        data[key] = window.localStorage.getItem(key);
      }
    }
    return data;
  }

  function isAppStorageKey(key) {
    return key === profileStorageKey || key === settingsStorageKey ||
      key === legacyTaskStorageKey || key === recurringStorageKey ||
      (key && key.indexOf(taskStoragePrefix) === 0);
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

  function validateTaskList(tasks) {
    if (!Array.isArray(tasks)) {
      throw new Error('As tarefas no backup estão inválidas.');
    }
    return tasks.map(function (task) {
      var title;
      var completed = false;
      if (typeof task === 'string') {
        title = task;
      } else if (task && typeof task.title === 'string' &&
          typeof task.completed === 'boolean') {
        title = task.title;
        completed = task.completed;
      } else {
        throw new Error('Uma tarefa no backup está inválida.');
      }
      var normalized = {
        title: validateText(title, maxTaskTitleLength, 'O título da tarefa'),
        completed: completed,
        time: normalizeTaskTime(typeof task === 'string' ? '' : task.time)
      };
      if (typeof task !== 'string' && typeof task.routineId === 'string') {
        normalized.routineId = task.routineId;
      }
      return normalized;
    });
  }

  function normalizeTaskTime(value) {
    if (value === undefined || value === null || value === '') {
      return '';
    }
    if (typeof value !== 'string') {
      throw new Error('O horário de uma tarefa no backup está inválido.');
    }
    var normalized = value.trim().toLowerCase().replace(/\s+/g, '');
    var hours;
    var minutes = 0;
    if (/^\d{1,2}:\d{2}$/.test(normalized)) {
      var parts = normalized.split(':');
      hours = Number(parts[0]);
      minutes = Number(parts[1]);
    } else if (/^\d{1,2}h\d{2}$/.test(normalized)) {
      var hourParts = normalized.split('h');
      hours = Number(hourParts[0]);
      minutes = Number(hourParts[1]);
    } else if (/^\d{1,2}[h.]?$/.test(normalized)) {
      hours = Number(normalized.replace(/[h.]$/, ''));
    } else if (/^\d{1,2}\.\d{2}$/.test(normalized)) {
      var dottedParts = normalized.split('.');
      hours = Number(dottedParts[0]);
      minutes = Number(dottedParts[1]);
    } else if (/^\d{3,4}$/.test(normalized)) {
      hours = Number(normalized.slice(0, normalized.length - 2));
      minutes = Number(normalized.slice(-2));
    } else {
      throw new Error('O horário de uma tarefa no backup está inválido.');
    }
    if (hours > 23 || minutes > 59) {
      throw new Error('O horário de uma tarefa no backup está inválido.');
    }
    return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
  }

  function validateRecurringTasks(tasks) {
    if (!Array.isArray(tasks)) {
      throw new Error('As tarefas padrão no backup estão inválidas.');
    }
    return tasks.map(function (task) {
      if (!task || typeof task.id !== 'string' || !Array.isArray(task.weekdays) ||
          !isValidDateKey(task.startDate)) {
        throw new Error('Uma tarefa padrão no backup está inválida.');
      }
      var weekdays = task.weekdays.filter(function (day, index, days) {
        return Number.isInteger(day) && day >= 0 && day <= 6 && days.indexOf(day) === index;
      });
      if (!weekdays.length) {
        throw new Error('Uma tarefa padrão precisa ter pelo menos um dia válido.');
      }
      return {
        id: task.id,
        title: validateText(task.title, maxTaskTitleLength, 'O título da tarefa padrão'),
        time: normalizeTaskTime(task.time),
        weekdays: weekdays,
        startDate: task.startDate,
        skippedDates: Array.isArray(task.skippedDates)
          ? task.skippedDates.filter(isValidDateKey)
          : []
      };
    });
  }

  function getAllowedBackupPasswords() {
    var snapshot = getAppStorageSnapshot();
    if (!snapshot[recurringStorageKey]) {
      return [];
    }
    return validateRecurringTasks(JSON.parse(snapshot[recurringStorageKey]))
      .slice(0, 3)
      .map(function (routine) { return { title: routine.title }; });
  }

  function getCryptoApi() {
    if (!window.crypto || !window.crypto.subtle ||
        typeof window.crypto.getRandomValues !== 'function' ||
        typeof window.TextEncoder !== 'function' ||
        typeof window.TextDecoder !== 'function') {
      throw new Error('Este dispositivo não oferece suporte à Web Crypto API necessária para proteger o backup.');
    }
    return window.crypto;
  }

  function bytesToBase64(bytes) {
    var binary = '';
    for (var offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 0x8000));
    }
    return window.btoa(binary);
  }

  function base64ToBytes(value) {
    if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
      throw new Error('O arquivo de backup criptografado está inválido.');
    }
    var binary = window.atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function deriveBackupKey(password, salt) {
    var cryptoApi = getCryptoApi();
    var encoder = new window.TextEncoder();
    return cryptoApi.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    ).then(function (passwordKey) {
      return cryptoApi.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: backupKdfIterations,
          hash: 'SHA-256'
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    });
  }

  function encryptBackup(backup, password) {
    var cryptoApi = getCryptoApi();
    var encoder = new window.TextEncoder();
    var salt = cryptoApi.getRandomValues(new Uint8Array(16));
    var iv = cryptoApi.getRandomValues(new Uint8Array(12));
    var plaintext = encoder.encode(JSON.stringify(backup));
    return deriveBackupKey(password, salt).then(function (key) {
      return cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plaintext);
    }).then(function (ciphertext) {
      return {
        format: 'day-list-backup',
        version: 2,
        createdAt: backup.createdAt,
        encryption: {
          algorithm: 'AES-GCM',
          keyDerivation: 'PBKDF2-SHA-256',
          iterations: backupKdfIterations,
          salt: bytesToBase64(salt),
          iv: bytesToBase64(iv)
        },
        data: bytesToBase64(new Uint8Array(ciphertext))
      };
    });
  }

  function decryptBackup(backup, password) {
    if (!backup || backup.format !== 'day-list-backup' || backup.version !== 2 ||
        !backup.encryption || backup.encryption.algorithm !== 'AES-GCM' ||
        backup.encryption.keyDerivation !== 'PBKDF2-SHA-256' ||
        backup.encryption.iterations !== backupKdfIterations) {
      throw new Error('O arquivo selecionado não é um backup criptografado compatível.');
    }
    if (typeof password !== 'string' || !password) {
      throw new Error('Digite a senha escolhida ao exportar este backup.');
    }

    var salt = base64ToBytes(backup.encryption.salt);
    var iv = base64ToBytes(backup.encryption.iv);
    var ciphertext = base64ToBytes(backup.data);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16 ||
        ciphertext.length > maxBackupFileSize) {
      throw new Error('O arquivo de backup criptografado está inválido.');
    }

    var cryptoApi = getCryptoApi();
    return deriveBackupKey(password, salt).then(function (key) {
      return cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ciphertext);
    }).catch(function () {
      throw new Error('Senha incorreta ou arquivo de backup danificado.');
    }).then(function (plaintext) {
      var decoded = new window.TextDecoder().decode(plaintext);
      return validateBackup(JSON.parse(decoded));
    });
  }

  function notifyViewsOfDataChange() {
    applyProfile();
    window.document.querySelectorAll('.report-page').forEach(function (page) {
      page.dispatchEvent(new Event('report:refresh'));
    });
    window.document.querySelectorAll('.task-page').forEach(function (page) {
      page.dispatchEvent(new Event('tasks:refresh'));
    });
    window.document.querySelectorAll('.settings-page').forEach(function (page) {
      page.dispatchEvent(new Event('settings:refresh'));
    });
  }

  function clearAccountData() {
    var snapshot;
    try {
      snapshot = getAppStorageSnapshot();
      Object.keys(snapshot).forEach(function (key) {
        window.localStorage.removeItem(key);
      });
    } catch (error) {
      try {
        Object.keys(snapshot || {}).forEach(function (key) {
          window.localStorage.setItem(key, snapshot[key]);
        });
      } catch (restoreError) {
        console.error('Não foi possível restaurar todos os dados após uma falha ao apagá-los.', restoreError);
      }
      showError('Não foi possível apagar os dados da conta.');
      return;
    }

    var localNotifications = window.cordova && window.cordova.plugins &&
      window.cordova.plugins.notification && window.cordova.plugins.notification.local;
    if (localNotifications) {
      localNotifications.cancel([4101, 4102, 4103]);
    }
    applyTheme('dark');
    notifyViewsOfDataChange();
    showError('Os dados locais da conta foram apagados.');
  }

  function requestNotificationPermission(callback) {
    var localNotifications = window.cordova && window.cordova.plugins &&
      window.cordova.plugins.notification && window.cordova.plugins.notification.local;

    if (!localNotifications ||
        typeof localNotifications.hasPermission !== 'function' ||
        typeof localNotifications.requestPermission !== 'function' ||
        typeof localNotifications.schedule !== 'function') {
      callback(false, null);
      return;
    }

    try {
      localNotifications.hasPermission(function (granted) {
        if (granted) {
          callback(true, localNotifications);
          return;
        }
        localNotifications.requestPermission(function (permissionGranted) {
          callback(permissionGranted === true, localNotifications);
        });
      });
    } catch (error) {
      console.error('Não foi possível solicitar a permissão de notificações ao dispositivo.', error);
      callback(false, null);
    }
  }

  function scheduleNotification(localNotifications, key, enabled, checkbox) {
    if (!localNotifications) {
      return;
    }

    var notification = key === 'taskReminders'
      ? {
        id: 4101,
        hour: 9,
        title: 'Lembrete de tarefas',
        text: 'Confira as tarefas planejadas para hoje.'
      }
      : {
        id: 4102,
        hour: 20,
        title: 'Resumo diário',
        text: 'Seu resumo de hoje está pronto. Abra o Blue Day para conferir suas tarefas concluídas e pendentes.'
      };
    if (!enabled) {
      try {
        localNotifications.cancel(notification.id);
      } catch (error) {
        console.error('Não foi possível cancelar a notificação agendada.', error);
        showError('Não foi possível desativar a notificação neste dispositivo.');
      }
      return;
    }

    function handleSchedulingFailure(error) {
      if (error) {
        console.error('Não foi possível agendar a notificação diária.', error);
      }
      currentNotificationSettings[key] = false;
      if (checkbox) {
        checkbox.checked = false;
      }
      saveSettings(currentNotificationSettings);
      showError('Não foi possível agendar a notificação neste dispositivo.');
    }

    try {
      localNotifications.schedule({
        id: notification.id,
        title: notification.title,
        text: notification.text,
        trigger: { every: { hour: notification.hour, minute: 0 } },
        androidAllowWhileIdle: true
      }, function (result) {
        if (result === false) {
          handleSchedulingFailure();
          return;
        }
        localNotifications.isScheduled(notification.id, function (scheduled) {
          if (!scheduled) {
            handleSchedulingFailure(new Error('O Android não confirmou o agendamento da notificação.'));
          }
        });
      }, null, { skipPermission: true });
    } catch (error) {
      handleSchedulingFailure(error);
    }
  }

  function testLocalNotification(statusElement) {
    var localNotifications = window.cordova && window.cordova.plugins &&
      window.cordova.plugins.notification && window.cordova.plugins.notification.local;

    statusElement.textContent = '';
    if (!localNotifications) {
      showError('O teste de notificações só funciona no aplicativo Android instalado.');
      return;
    }

    requestNotificationPermission(function (granted) {
      if (!granted) {
        showError('A permissão para notificações não foi concedida. Autorize-a nas configurações do dispositivo e tente novamente.');
        return;
      }

      try {
        localNotifications.cancel(4103);
        localNotifications.schedule({
          id: 4103,
          title: 'Teste do Blue Day',
          text: 'As notificações do aplicativo estão funcionando.',
          trigger: { in: 5, unit: 'second' },
          androidAllowWhileIdle: true
        }, function (result) {
          if (result === false) {
            showError('O Android não conseguiu agendar a notificação de teste.');
            return;
          }
          localNotifications.isScheduled(4103, function (scheduled) {
            if (!scheduled) {
              showError('O Android não confirmou o agendamento da notificação de teste.');
              return;
            }
            statusElement.textContent = 'Teste agendado. A notificação deve aparecer em até 5 segundos.';
          });
        }, null, { skipPermission: true });
      } catch (error) {
        console.error('Não foi possível agendar a notificação de teste.', error);
        showError('Não foi possível agendar a notificação de teste neste dispositivo.');
      }
    });
  }

  function restoreEnabledNotifications() {
    var settings = readSettings();
    if (!settings.taskReminders && !settings.dailySummary) {
      return;
    }

    var localNotifications = window.cordova && window.cordova.plugins &&
      window.cordova.plugins.notification && window.cordova.plugins.notification.local;
    if (!localNotifications || typeof localNotifications.hasPermission !== 'function') {
      return;
    }

    localNotifications.hasPermission(function (granted) {
      if (!granted) {
        return;
      }
      currentNotificationSettings = settings;
      if (settings.taskReminders) {
        scheduleNotification(localNotifications, 'taskReminders', true);
      }
      if (settings.dailySummary) {
        scheduleNotification(localNotifications, 'dailySummary', true);
      }
    });
  }

  var currentNotificationSettings = defaultSettings;

  function requestAndSaveNotification(settings, key, checkbox) {
    requestNotificationPermission(function (granted, localNotifications) {
      if (!granted) {
        settings[key] = false;
        checkbox.checked = false;
        if (!localNotifications) {
          showError('As notificações só podem ser ativadas no aplicativo instalado, pois é necessário solicitar permissão ao dispositivo.');
        } else {
          showError('A permissão para notificações não foi concedida. Você pode autorizá-la nas configurações do dispositivo.');
        }
        return;
      }

      settings[key] = true;
      currentNotificationSettings = settings;
      if (!saveSettings(settings)) {
        checkbox.checked = false;
        settings[key] = false;
        return;
      }
      scheduleNotification(localNotifications, key, true, checkbox);
    });
  }

  function validateBackup(backup) {
    if (!backup || backup.format !== 'day-list-backup' || backup.version !== 1 ||
        !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
      throw new Error('O arquivo selecionado não é um backup compatível.');
    }

    var safeData = {};
    Object.keys(backup.data).forEach(function (key) {
      if (!isAppStorageKey(key) || typeof backup.data[key] !== 'string') {
        return;
      }
      var value = backup.data[key];
      if (key.indexOf(taskStoragePrefix) === 0) {
        var dateKey = key.slice(taskStoragePrefix.length);
        if (!isValidDateKey(dateKey)) {
          throw new Error('Uma data de tarefa no backup está inválida.');
        }
        safeData[key] = JSON.stringify(validateTaskList(JSON.parse(value)));
      } else if (key === legacyTaskStorageKey) {
        var tasksByDate = JSON.parse(value);
        if (!tasksByDate || typeof tasksByDate !== 'object' || Array.isArray(tasksByDate)) {
          throw new Error('As tarefas antigas no backup estão inválidas.');
        }
        var safeTasksByDate = {};
        Object.keys(tasksByDate).forEach(function (dateKey) {
          if (!isValidDateKey(dateKey)) {
            throw new Error('Uma data de tarefa no backup está inválida.');
          }
          safeTasksByDate[dateKey] = validateTaskList(tasksByDate[dateKey]);
        });
        safeData[key] = JSON.stringify(safeTasksByDate);
      } else if (key === recurringStorageKey) {
        safeData[key] = JSON.stringify(validateRecurringTasks(JSON.parse(value)));
      } else if (key === profileStorageKey) {
        var profile = JSON.parse(value);
        if (!profile || typeof profile.name !== 'string') {
          throw new Error('O perfil no backup está inválido.');
        }
        var avatar = isValidAvatar(profile.avatar) ? profile.avatar : defaultProfile.avatar;
        safeData[key] = JSON.stringify({
          name: validateText(profile.name, maxProfileNameLength, 'O nome do perfil'),
          avatar: avatar
        });
      } else if (key === settingsStorageKey) {
        var settings = JSON.parse(value);
        if (!settings || typeof settings !== 'object' || Array.isArray(settings) ||
            (settings.theme !== undefined && settings.theme !== 'light' && settings.theme !== 'dark') ||
            (settings.taskReminders !== undefined && typeof settings.taskReminders !== 'boolean') ||
            (settings.dailySummary !== undefined && typeof settings.dailySummary !== 'boolean')) {
          throw new Error('As configurações no backup estão inválidas.');
        }
        safeData[key] = JSON.stringify({
          taskReminders: settings.taskReminders === true,
          dailySummary: settings.dailySummary === true,
          theme: settings.theme === 'light' ? 'light' : 'dark'
        });
      } else {
        safeData[key] = value;
      }
    });
    return safeData;
  }

  function downloadBackupFile(blob) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'day-list-backup.enc';
    link.click();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function saveBackupToAndroid(contents) {
    if (!window.BlueDayBackup || typeof window.BlueDayBackup.save !== 'function') {
      return Promise.reject(new Error('O recurso para salvar backups em Downloads não está instalado. Atualize o aplicativo.'));
    }

    var timestamp = new Date().toISOString().replace(/[^0-9T-]/g, '');
    var fileName = 'day-list-backup-' + timestamp + '.enc';
    return new Promise(function (resolve, reject) {
      window.BlueDayBackup.save(contents, fileName, resolve, reject);
    });
  }

  function restoreBackup(data) {
    var previousData;
    try {
      previousData = getAppStorageSnapshot();
    } catch (error) {
      showError('Não foi possível acessar os dados atuais para restaurar o backup.');
      return false;
    }
    try {
      Object.keys(previousData).forEach(function (key) {
        window.localStorage.removeItem(key);
      });
      Object.keys(data).forEach(function (key) {
        window.localStorage.setItem(key, data[key]);
      });
    } catch (error) {
      try {
        Object.keys(getAppStorageSnapshot()).forEach(function (key) {
          window.localStorage.removeItem(key);
        });
        Object.keys(previousData).forEach(function (key) {
          window.localStorage.setItem(key, previousData[key]);
        });
      } catch (restoreError) {
        console.error('Não foi possível restaurar os dados anteriores após uma falha na importação.', restoreError);
      }
      showError('Não foi possível restaurar o backup. Os dados anteriores foram preservados quando possível.');
      return false;
    }

    applyTheme(readSettings().theme);
    notifyViewsOfDataChange();
    return true;
  }

  function exportBackup(passwordInput) {
    var backup;
    var password = passwordInput ? passwordInput.value.trim() : '';
    try {
      var allowedPasswords = getAllowedBackupPasswords();
      if (!allowedPasswords.length) {
        throw new Error('Cadastre uma tarefa padrão personalizada antes de criar um backup protegido por senha.');
      }
      if (allowedPasswords.every(function (task) { return task.title !== password.trim(); })) {
        throw new Error('A senha deve ser exatamente o título de uma das três tarefas padrão personalizadas exibidas nesta seção.');
      }
      backup = {
        format: 'day-list-backup',
        version: 1,
        createdAt: new Date().toISOString(),
        data: getAppStorageSnapshot()
      };
    } catch (error) {
      showError(error.message || 'Não foi possível acessar os dados para criar o backup.');
      if (passwordInput) {
        passwordInput.value = '';
      }
      return;
    }
    Promise.resolve().then(function () {
      return encryptBackup(backup, password);
    }).then(function (encryptedBackup) {
      var backupContents = JSON.stringify(encryptedBackup, null, 2);
      var blob = new Blob([backupContents], { type: 'application/octet-stream' });
      if (blob.size > maxBackupFileSize) {
        throw new Error('O backup gerado excede o limite de 10 MB. Reduza os dados salvos e tente novamente.');
      }

      if (window.cordova && window.cordova.platformId === 'android') {
        return saveBackupToAndroid(backupContents).then(function (savedPath) {
          showError('Backup salvo em ' + savedPath + '.');
        });
      }

      if (typeof File === 'function' && navigator.canShare && navigator.share) {
        var file = new File([blob], 'day-list-backup.enc', { type: 'application/octet-stream' });
        if (navigator.canShare({ files: [file] })) {
          return navigator.share({ title: 'Backup da Lista de Tarefas', files: [file] }).catch(function (error) {
            if (error.name === 'AbortError') {
              return;
            }
            downloadBackupFile(blob);
          });
        }
      }

      downloadBackupFile(blob);
    }).catch(function (error) {
      if (error.name !== 'AbortError') {
        showError(error.message || 'Não foi possível criptografar o backup.');
      }
    }).then(function () {
      if (passwordInput) {
        passwordInput.value = '';
      }
    });
  }

  function initializeSettings(pageElement) {
    var page = pageElement && pageElement.el ? pageElement.el : pageElement;
    var pageRoot = page && page.matches && page.matches('.settings-page')
      ? page
      : page && page.querySelector('.settings-page');
    if (!pageRoot || pageRoot.dataset.settingsInitialized === 'true') {
      return;
    }

    var profileName = pageRoot.querySelector('.settings-profile-name');
    var profileEditor = pageRoot.querySelector('.settings-profile-editor');
    var accountAvatar = pageRoot.querySelector('.settings-account-avatar');
    var profileButton = pageRoot.querySelector('.settings-profile-button');
    var saveProfileButton = pageRoot.querySelector('.settings-save-profile');
    var avatarChoices = pageRoot.querySelectorAll('[data-avatar-choice]');
    var deleteDataButton = pageRoot.querySelector('.settings-delete-data');
    var backupInput = pageRoot.querySelector('.settings-backup-input');
    var exportButton = pageRoot.querySelector('.settings-backup-export');
    var importButton = pageRoot.querySelector('.settings-backup-import');
    var backupPassword = pageRoot.querySelector('.settings-backup-password');
    var backupPasswordHint = pageRoot.querySelector('.settings-backup-password-hint');
    var notificationTestButton = pageRoot.querySelector('.settings-notification-test');
    var notificationTestStatus = pageRoot.querySelector('.settings-notification-test-status');
    if (!profileName || !profileEditor || !accountAvatar ||
        !profileButton || !saveProfileButton || !avatarChoices.length ||
        !deleteDataButton || !backupInput || !exportButton || !importButton ||
        !backupPassword || !backupPasswordHint || !notificationTestButton ||
        !notificationTestStatus) {
      throw new Error('Não foi possível inicializar as configurações da conta.');
    }

    pageRoot.dataset.settingsInitialized = 'true';
    var currentSettings = readSettings();
    currentNotificationSettings = currentSettings;
    var selectedAvatar = defaultProfile.avatar;

    function selectAvatar(avatar) {
      selectedAvatar = avatar;
      accountAvatar.src = avatar;
      avatarChoices.forEach(function (choice) {
        var isSelected = choice.dataset.avatarChoice === avatar;
        choice.setAttribute('aria-pressed', String(isSelected));
      });
    }

    function renderSettings() {
      currentSettings = readSettings();
      pageRoot.querySelectorAll('[data-notification-setting]').forEach(function (input) {
        input.checked = currentSettings[input.dataset.notificationSetting] === true;
      });
      var themeInput = pageRoot.querySelector(
        'input[name="settings-theme"][value="' + currentSettings.theme + '"]'
      );
      if (themeInput) {
        themeInput.checked = true;
      }
      applyTheme(currentSettings.theme);
      applyProfile(pageRoot);
      var profile = readProfile();
      profileName.value = profile.name;
      selectAvatar(profile.avatar);
      try {
        var passwordTasks = getAllowedBackupPasswords();
        backupPasswordHint.textContent = passwordTasks.length
          ? 'Senhas permitidas (até 3 tarefas padrão): ' + passwordTasks.map(function (task) {
            return '“' + task.title + '”';
          }).join(', ') + '.'
          : 'Cadastre pelo menos uma tarefa padrão personalizada para definir uma senha de backup.';
      } catch (error) {
        backupPasswordHint.textContent = 'Não foi possível ler as tarefas padrão para definir a senha.';
        console.error('Não foi possível carregar as tarefas padrão para o backup.', error);
      }
    }

    function clearBackupImportState() {
      backupInput.value = '';
      backupPassword.value = '';
    }

    function confirmBackupRestore(validatedData) {
      app.dialog.confirm(
        'A restauração substituirá tarefas, configurações e perfil salvos neste dispositivo.',
        'Restaurar backup',
        function () {
          if (restoreBackup(validatedData)) {
            showError('O backup foi restaurado.');
          }
          clearBackupImportState();
        },
        clearBackupImportState
      );
    }

    function requestEncryptedBackupPassword(encryptedBackup) {
      var passwordDialog = app.dialog.prompt(
        'Digite a senha usada ao exportar este backup.',
        'Senha do backup',
        function (password) {
          Promise.resolve().then(function () {
            return decryptBackup(encryptedBackup, password);
          }).then(function (validatedData) {
            confirmBackupRestore(validatedData);
          }).catch(function (error) {
            showError(error.message || 'Não foi possível descriptografar ou validar o backup.');
            clearBackupImportState();
          });
        },
        clearBackupImportState
      );
      var passwordField = passwordDialog && passwordDialog.$el &&
        passwordDialog.$el.find('input');
      if (passwordField && passwordField.length) {
        passwordField.addClass('settings-backup-password-prompt');
        passwordField.attr('type', 'password');
        passwordField.attr('autocomplete', 'off');
        passwordField.attr('autocapitalize', 'off');
        passwordField.attr('placeholder', 'Senha do backup');
        passwordField.focus();
      } else {
        console.error('O modal de senha não disponibilizou um campo de entrada.');
        clearBackupImportState();
        showError('Não foi possível abrir o campo da senha do backup neste dispositivo.');
      }
    }

    pageRoot.addEventListener('settings:refresh', renderSettings);
    notificationTestButton.addEventListener('click', function () {
      testLocalNotification(notificationTestStatus);
    });

    pageRoot.addEventListener('change', function (event) {
      var checkbox = event.target.closest('[data-notification-setting]');
      if (checkbox) {
        var key = checkbox.dataset.notificationSetting;
        if (checkbox.checked) {
          requestAndSaveNotification(currentSettings, key, checkbox);
        } else {
          currentSettings[key] = false;
          if (saveSettings(currentSettings)) {
            var localNotifications = window.cordova && window.cordova.plugins &&
              window.cordova.plugins.notification && window.cordova.plugins.notification.local;
            scheduleNotification(localNotifications, key, false);
          }
        }
        return;
      }

      var themeChoice = event.target.closest('input[name="settings-theme"]');
      if (themeChoice) {
        currentSettings.theme = themeChoice.value;
        saveSettings(currentSettings);
        return;
      }

      if (event.target === backupInput && backupInput.files && backupInput.files[0]) {
        if (backupInput.files[0].size > maxBackupFileSize) {
          showError('O arquivo de backup deve ter no máximo 10 MB.');
          backupInput.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onerror = function () {
          showError('Não foi possível ler o arquivo de backup.');
          clearBackupImportState();
        };
        reader.onload = function () {
          var parsedBackup;
          try {
            parsedBackup = JSON.parse(String(reader.result));
          } catch (error) {
            showError(error.message || 'O arquivo de backup é inválido.');
            clearBackupImportState();
            return;
          }
          if (parsedBackup && parsedBackup.version === 2) {
            requestEncryptedBackupPassword(parsedBackup);
            return;
          }
          try {
            confirmBackupRestore(validateBackup(parsedBackup));
          } catch (error) {
            showError(error.message || 'O arquivo de backup é inválido.');
            clearBackupImportState();
          }
        };
        reader.readAsText(backupInput.files[0]);
      }
    });

    exportButton.addEventListener('click', function () {
      exportBackup(backupPassword);
    });
    profileButton.addEventListener('click', function () {
      var isOpening = profileEditor.hidden;
      profileEditor.hidden = !isOpening;
      profileButton.setAttribute('aria-expanded', String(isOpening));
      if (isOpening) {
        var profile = readProfile();
        profileName.value = profile.name;
        selectAvatar(profile.avatar);
      }
    });

    avatarChoices.forEach(function (choice) {
      choice.addEventListener('click', function () {
        selectAvatar(choice.dataset.avatarChoice);
      });
    });

    saveProfileButton.addEventListener('click', function () {
      var name;
      try {
        name = validateText(profileName.value, maxProfileNameLength, 'O nome do perfil');
      } catch (error) {
        showError(error.message);
        profileName.focus();
        return;
      }
      var profile = readProfile();
      profile.name = name;
      profile.avatar = selectedAvatar;
      if (saveProfile(profile)) {
        profileEditor.hidden = true;
        profileButton.setAttribute('aria-expanded', 'false');
      }
    });

    deleteDataButton.addEventListener('click', function () {
      app.dialog.confirm(
        'Esta ação apagará permanentemente as tarefas, o perfil e as configurações salvas neste dispositivo. Não é possível desfazê-la.',
        'Excluir dados da conta?',
        clearAccountData
      );
    });

    importButton.addEventListener('click', function () {
      backupInput.click();
    });
    renderSettings();
  }

  window.refreshUserProfile = applyProfile;
  window.refreshSettings = function (pageElement) {
    var page = pageElement && pageElement.el ? pageElement.el : pageElement;
    var pageRoot = page && page.matches && page.matches('.settings-page')
      ? page
      : page && page.querySelector('.settings-page');
    if (pageRoot && pageRoot.dataset.settingsInitialized === 'true') {
      pageRoot.dispatchEvent(new Event('settings:refresh'));
    }
  };
  window.initializeSettings = initializeSettings;
  window.addEventListener('deviceready', restoreEnabledNotifications, false);
  document.addEventListener('resume', restoreEnabledNotifications, false);

  window.addEventListener('storage', function (event) {
    if (event.key === profileStorageKey) {
      applyProfile();
    }
    if (event.key === settingsStorageKey) {
      applyTheme(readSettings().theme);
      document.querySelectorAll('.settings-page').forEach(function (page) {
        page.dispatchEvent(new Event('settings:refresh'));
      });
    }
  });

  document.addEventListener('click', function (event) {
    var avatarChoice = event.target.closest('[data-profile-avatar-choice]');
    if (avatarChoice) {
      var avatarDialog = avatarChoice.closest('.dialog');
      if (avatarDialog) {
        avatarDialog.querySelectorAll('[data-profile-avatar-choice]').forEach(function (choice) {
          choice.setAttribute('aria-pressed', String(choice === avatarChoice));
        });
      }
      return;
    }

    var profileButton = event.target.closest('.task-avatar');
    if (profileButton) {
      event.preventDefault();
      openProfileDialog();
    }
  });

  if (window.app && typeof window.app.on === 'function') {
    window.app.on('pageInit', function (page) {
      if (page.name === 'notificacoes') {
        initializeSettings(page.el);
      }
    });
    window.app.on('pageBeforeIn', function (page) {
      applyProfile(page.el);
      if (page.name === 'notificacoes') {
        window.refreshSettings(page.el);
      }
    });
  }

  applyTheme(readSettings().theme);
  applyProfile();
  var currentSettingsPage = document.querySelector('.page[data-name="notificacoes"]');
  if (currentSettingsPage) {
    initializeSettings(currentSettingsPage);
  }
})();
