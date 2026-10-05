//INICIALIZAÇÃO DO F7 QUANDO DISPOSITIVO ESTÁ PRONTO
document.addEventListener('deviceready', onDeviceReady, false);
var $$ = Dom7;
var app = new Framework7({
  // App root element
  el: '#app',
  // App Name
  name: 'Blue Day',
  // App id
  id: 'br.com.blueday',
  panel: {
    swipe: false,
  },
  dialog: {
    buttonOk: 'Sim',
    buttonCancel: 'Cancelar',
  },
  // Add default routes
  routes: [
    {
      path: '/index/',
      url: 'index.html',
	  on: {
			pageBeforeIn: function (event, page) {
			  if (window.refreshUserProfile) {
			    window.refreshUserProfile(page.el);
			  }
			},
			pageAfterIn: function (event, page) {
			// fazer algo depois da página ser exibida
			},
			pageInit: function (event, page) {
			  if (window.initializeTaskCalendar) {
			    window.initializeTaskCalendar(page.el);
			  }
			},
			pageBeforeRemove: function (event, page) {
			// fazer algo antes da página ser removida do DOM
			},
		  }
    },
    {
      path: '/outra/',
      url: 'outra.html',
	  on: {
			pageBeforeIn: function (event, page) {
			  if (window.refreshReport) {
			    window.refreshReport(page.el);
			  }
			  if (window.refreshUserProfile) {
			    window.refreshUserProfile(page.el);
			  }
			},
			pageAfterIn: function (event, page) {
			// fazer algo depois da página ser exibida
			},
			pageInit: function (event, page) {
			  if (window.initializeReport) {
			    window.initializeReport(page.el);
			  }
			},
			pageBeforeRemove: function (event, page) {
			// fazer algo antes da página ser removida do DOM
			},
		  }
    },
    {
      path: '/notificacoes/',
      url: 'notificacoes.html',
	  on: {
			pageBeforeIn: function (event, page) {
			  if (window.refreshSettings) {
			    window.refreshSettings(page.el);
			  }
			  if (window.refreshUserProfile) {
			    window.refreshUserProfile(page.el);
			  }
			},
			pageAfterIn: function (event, page) {
			// fazer algo depois da página ser exibida
			},
			pageInit: function (event, page) {
			  if (window.initializeSettings) {
			    window.initializeSettings(page.el);
			  }
			},
			pageBeforeRemove: function (event, page) {
			// fazer algo antes da página ser removida do DOM
			},
		  }
    },
  ],
  // ... other parameters
});

var leftPanel = app.panel.get('.panel-left');
if (leftPanel) {
  leftPanel.disableSwipe();
}

// Para testes locais
var mainView = app.views.create('.view-main', { url: '/index/' });

//EVENTO PARA SABER O ITEM DO MENU ATUAL
app.on('routeChange', function (route) {

  var currentRoute = route.url;
  console.log(currentRoute);
  document.querySelectorAll('.item-panel').forEach(function (el) {
    el.classList.remove('active');
  });
  var targetEl = document.querySelector('.item-panel[href="' + currentRoute + '"]');
  if (targetEl) {
    targetEl.classList.add('active');
  }
});



function onDeviceReady() {
  //Quando estiver rodando no celular
  var mainView = app.views.create('.view-main', { url: '/index/' });

  //COMANDO PARA "OUVIR" O BOTAO VOLTAR NATIVO DO ANDROID 	
  document.addEventListener("backbutton", function (e) {

    if (mainView.router.currentRoute.path === '/index/') {
      e.preventDefault();
      app.dialog.confirm('Deseja sair do aplicativo?', function () {
        navigator.app.exitApp();
      });
    } else {
      e.preventDefault();
      mainView.router.back({ force: true });
    }
  }, false);

}
