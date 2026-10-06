(function () {
  var profileStorageKey = 'day-list-profile';
  var settingsStorageKey = 'day-list-settings';
  var taskStoragePrefix = 'day-list-tasks:';
  var legacyTaskStorageKey = 'day-list-tasks';
  var maxProfileNameLength = 60;
  var maxTaskTitleLength = 200;
  var maxPhotoFileSize = 2 * 1024 * 1024;
  var avatarDataUrlPrefix = 'data:image/jpeg;base64,';
  var maxAvatarDataUrlLength = avatarDataUrlPrefix.length +
    4 * Math.ceil(maxPhotoFileSize / 3);
  var maxBackupFileSize = 10 * 1024 * 1024;
  var defaultProfile = { name: 'Nome do Usuário', avatar: 'img/user.jpg' };
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
    if (!profile || typeof profile.name !== 'string' ||
        typeof profile.avatar !== 'string' || !isValidAvatar(profile.avatar)) {
      return defaultProfile;
    }
    var name = cleanText(profile.name, maxProfileNameLength);
    if (!name) {
      return defaultProfile;
    }
    return { name: name, avatar: profile.avatar };
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
    if (avatar === defaultProfile.avatar) {
      return true;
    }
    if (typeof avatar !== 'string' || avatar.length > maxAvatarDataUrlLength ||
        avatar.indexOf(avatarDataUrlPrefix) !== 0 ||
        !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar)) {
      return false;
    }
    var data = avatar.slice(avatarDataUrlPrefix.length);
    var padding = data.slice(-2) === '==' ? 2 : (data.slice(-1) === '=' ? 1 : 0);
    return data.length % 4 === 0 &&
      Math.floor(data.length * 3 / 4) - padding <= maxPhotoFileSize;
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
      showError('Não foi possível salvar o perfil. A imagem pode ser muito grande.');
      return false;
    }
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
      key === legacyTaskStorageKey ||
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
      return {
        title: validateText(title, maxTaskTitleLength, 'O título da tarefa'),
        completed: completed
      };
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
      localNotifications.cancel([4101, 4102]);
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

  function scheduleNotification(localNotifications, key, enabled) {
    if (!localNotifications) {
      return;
    }

    var notificationId = key === 'taskReminders' ? 4101 : 4102;
    if (!enabled) {
      try {
        localNotifications.cancel(notificationId);
      } catch (error) {
        console.error('Não foi possível cancelar a notificação agendada.', error);
        showError('Não foi possível desativar a notificação neste dispositivo.');
      }
      return;
    }

    try {
      localNotifications.schedule({
        id: notificationId,
        title: key === 'taskReminders' ? 'Lembrete de tarefas' : 'Resumo diário',
        text: key === 'taskReminders'
          ? 'Confira as tarefas planejadas para hoje.'
          : 'Confira seu progresso e conclua as tarefas do dia.',
        trigger: { every: 'day' }
      }, function (result) {
        if (result === false) {
          currentNotificationSettings[key] = false;
          saveSettings(currentNotificationSettings);
          showError('O dispositivo não autorizou o agendamento das notificações.');
        }
      }, null, { skipPermission: true });
    } catch (error) {
      console.error('Não foi possível agendar a notificação diária.', error);
      currentNotificationSettings[key] = false;
      saveSettings(currentNotificationSettings);
      showError('Não foi possível agendar a notificação neste dispositivo.');
    }
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
      scheduleNotification(localNotifications, key, true);
    });
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
      if (!file || supportedTypes.indexOf(file.type) === -1) {
        reject(new Error('Selecione uma foto JPEG, PNG, WebP, GIF ou BMP.'));
        return;
      }
      if (file.size > maxPhotoFileSize) {
        reject(new Error('A foto deve ter no máximo 2 MB.'));
        return;
      }

      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error('Não foi possível ler a imagem selecionada.'));
      };
      reader.onload = function () {
        var image = new Image();
        image.onerror = function () {
          reject(new Error('O arquivo selecionado não é uma imagem válida.'));
        };
        image.onload = function () {
          if (!image.width || !image.height ||
              image.width > 8192 || image.height > 8192 ||
              image.width * image.height > 40000000) {
            reject(new Error('As dimensões da foto são grandes demais para processar.'));
            return;
          }
          var maxDimension = 1024;
          var scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          var context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('Não foi possível processar a imagem selecionada.'));
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          var imageData = '';
          [0.82, 0.72, 0.62, 0.52, 0.42].some(function (quality) {
            imageData = canvas.toDataURL('image/jpeg', quality);
            return imageData.length <= maxAvatarDataUrlLength &&
              isValidAvatar(imageData);
          });
          if (!isValidAvatar(imageData)) {
            reject(new Error('Não foi possível comprimir a foto para menos de 2 MB.'));
            return;
          }
          resolve(imageData);
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
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
      } else if (key === profileStorageKey) {
        var profile = JSON.parse(value);
        if (!profile || typeof profile.name !== 'string' ||
            typeof profile.avatar !== 'string' || !isValidAvatar(profile.avatar)) {
          throw new Error('O perfil no backup está inválido.');
        }
        safeData[key] = JSON.stringify({
          name: validateText(profile.name, maxProfileNameLength, 'O nome do perfil'),
          avatar: profile.avatar
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

  function exportBackup() {
    var backup;
    try {
      backup = {
        format: 'day-list-backup',
        version: 1,
        createdAt: new Date().toISOString(),
        data: getAppStorageSnapshot()
      };
    } catch (error) {
      showError('Não foi possível acessar os dados para criar o backup.');
      return;
    }
    var blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    if (blob.size > maxBackupFileSize) {
      showError('O backup gerado excede o limite de 10 MB. Reduza os dados salvos e tente novamente.');
      return;
    }

    if (typeof File === 'function' && navigator.canShare && navigator.share) {
      var file = new File([blob], 'day-list-backup.json', { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ title: 'Backup da Lista de Tarefas', files: [file] }).catch(function (error) {
          if (error.name !== 'AbortError') {
            showError('Não foi possível compartilhar o arquivo de backup.');
          }
        });
        return;
      }
    }

    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'day-list-backup.json';
    link.click();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
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
    var photoInput = pageRoot.querySelector('.settings-photo-input');
    var accountAvatar = pageRoot.querySelector('.settings-account-avatar');
    var profileButton = pageRoot.querySelector('.settings-profile-button');
    var saveProfileButton = pageRoot.querySelector('.settings-save-profile');
    var changePhotoButton = pageRoot.querySelector('.settings-change-photo');
    var deleteDataButton = pageRoot.querySelector('.settings-delete-data');
    var backupInput = pageRoot.querySelector('.settings-backup-input');
    var exportButton = pageRoot.querySelector('.settings-backup-export');
    var importButton = pageRoot.querySelector('.settings-backup-import');
    if (!profileName || !profileEditor || !photoInput || !accountAvatar ||
        !profileButton || !saveProfileButton || !changePhotoButton ||
        !deleteDataButton || !backupInput || !exportButton || !importButton) {
      throw new Error('Não foi possível inicializar as configurações da conta.');
    }

    pageRoot.dataset.settingsInitialized = 'true';
    var currentSettings = readSettings();
    currentNotificationSettings = currentSettings;
    var selectedAvatar = null;

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
      profileName.value = readProfile().name;
    }

    pageRoot.addEventListener('settings:refresh', renderSettings);
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

      if (event.target === photoInput && photoInput.files && photoInput.files[0]) {
        selectedAvatar = null;
        compressImage(photoInput.files[0]).then(function (imageData) {
          selectedAvatar = imageData;
          accountAvatar.src = imageData;
        }).catch(function (error) {
          showError(error.message);
        }).then(function () {
          photoInput.value = '';
        });
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
          backupInput.value = '';
        };
        reader.onload = function () {
          var safeData;
          try {
            safeData = validateBackup(JSON.parse(String(reader.result)));
          } catch (error) {
            showError(error.message || 'O arquivo de backup é inválido.');
            backupInput.value = '';
            return;
          }
          app.dialog.confirm(
            'A restauração substituirá tarefas, configurações e perfil salvos neste dispositivo.',
            'Restaurar backup',
            function () {
              if (restoreBackup(safeData)) {
                showError('O backup foi restaurado.');
              }
              backupInput.value = '';
            },
            function () {
              backupInput.value = '';
            }
          );
        };
        reader.readAsText(backupInput.files[0]);
      }
    });

    profileButton.addEventListener('click', function () {
      var isOpening = profileEditor.hidden;
      profileEditor.hidden = !isOpening;
      profileButton.setAttribute('aria-expanded', String(isOpening));
      if (isOpening) {
        var profile = readProfile();
        profileName.value = profile.name;
        selectedAvatar = null;
      }
    });

    changePhotoButton.addEventListener('click', function () {
      photoInput.click();
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
      if (selectedAvatar) {
        profile.avatar = selectedAvatar;
      }
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

    exportButton.addEventListener('click', exportBackup);
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
