# Blue Day

Blue Day é um aplicativo mobile para organização diária de tarefas, com foco em produtividade pessoal, acompanhamento do progresso e planejamento por calendário. A aplicação permite criar tarefas por dia, definir horários para sua realização, marcá-las como concluídas, acompanhar o desempenho semanal e personalizar o perfil do usuário.

O projeto foi desenvolvido com HTML, JavaScript e Apache Cordova, utilizando uma interface baseada no Framework7 para oferecer uma experiência semelhante à de um aplicativo nativo no Android.

## Visão geral

O Blue Day foi pensado para ajudar o usuário a manter o controle de compromissos e objetivos no dia a dia. A funcionalidade principal é uma agenda de tarefas por data, em que cada dia pode receber uma lista de itens com horários definidos, que o usuário pode concluir ou remover conforme necessário.

Além disso, o app inclui:

* calendário mensal para navegação por datas;
* lista de tarefas por dia, com definição de horários;
* acompanhamento de tarefas pendentes e concluídas;
* relatório semanal de desempenho;
* perfil personalizado com avatar;
* configurações de notificações;
* backup protegido por senha.

## Funcionalidades

### 1. Gerenciamento de tarefas diárias

Na tela inicial, o usuário visualiza um calendário mensal e pode selecionar um dia para abrir sua lista de tarefas. A partir daí, é possível:

* adicionar novas tarefas;
* definir um horário para cada tarefa;
* editar o título, o conteúdo e o horário da tarefa;
* marcar tarefas como concluídas;
* remover itens já finalizados ou não desejados;
* visualizar o total de tarefas pendentes do dia selecionado.

As tarefas são salvas localmente no dispositivo, de forma persistente, para que o histórico continue disponível mesmo após o fechamento do app.

### 2. Relatório de desempenho

Na página de relatório, o usuário pode visualizar uma visão consolidada do progresso ao longo da semana e do mês.

Esse módulo calcula:

* dias concluídos na semana;
* sequência atual de dias com produtividade;
* feedback visual sobre o desempenho geral;
* resumo do volume de atividades concluídas em relação ao período analisado.

Essa funcionalidade ajuda a manter uma rotina mais consistente e a identificar padrões de produtividade.

### 3. Perfil e personalização

A área de configurações permite:

* escolher um nome de usuário;
* selecionar um avatar entre opções predefinidas;
* aplicar um tema claro ou escuro;
* controlar as notificações do app.

A personalização torna a experiência mais amigável e mantém a aplicação vinculada ao perfil do usuário.

### 4. Notificações

O aplicativo pode enviar lembretes para reforçar a organização do dia. Nas configurações, é possível ativar:

* lembretes de tarefas;
* resumo diário;
* teste manual de notificação.

Essas opções dependem das permissões concedidas ao aplicativo no sistema operacional e do plugin de notificações do Cordova.

### 5. Backup e restauração de dados

A aplicação oferece proteção para os dados locais por meio de backup criptografado.

O processo de backup inclui:

* exportação de dados em um arquivo seguro;
* criptografia AES-GCM com derivação de chave por meio do PBKDF2;
* validação do arquivo antes da restauração;
* exigência de senha para a importação e a leitura do backup.

Essa funcionalidade é útil quando o usuário troca de aparelho, realiza a manutenção do dispositivo ou deseja preservar registros importantes.

## Tecnologias

* HTML5
* JavaScript
* CSS personalizado
* Framework7
* Apache Cordova
* Plugin de notificações locais
* Web Crypto API para criptografia de backup

## Estrutura do projeto

```text
applist/
├── config.xml                  # Configuração do app Cordova
├── index.html                  # Página principal de redirecionamento
├── package.json                # Dependências e metadados do projeto
├── www/                        # Código do aplicativo
│   ├── css/                    # Estilos personalizados
│   ├── img/                    # Ícones, avatares e recursos visuais
│   ├── js/                     # Lógica principal do app
│   │   ├── routes.js           # Rotas do aplicativo
│   │   ├── tasks.js            # Calendário e tarefas
│   │   ├── report.js           # Relatórios e métricas
│   │   ├── settings.js         # Perfil, notificações e backup
│   ├── index.html              # Tela principal de tarefas
│   ├── outra.html              # Tela de relatório
│   ├── notificacoes.html       # Tela de configurações
│   └── lib/                    # Bibliotecas do Framework7 e jQuery
├── local-plugins/              # Plugins locais do Cordova
├── platforms/                  # Arquivos gerados para Android
├── plugins/                    # Plugins instalados pelo Cordova
└── package-lock.json           # Arquivo de bloqueio de dependências do npm
```

## Pré-requisitos

Para compilar e executar o projeto, você precisará de:

* Node.js
* npm
* Apache Cordova
* Android SDK (para compilação no Android)
* Java JDK
* Emulador Android ou dispositivo físico conectado

## Instalação

1. Clone o repositório:

```bash
git clone https://github.com/hibiscotropical/BlueDay.git
cd BlueDay
```

2. Instale as dependências:

```bash
npm install
```

3. Adicione a plataforma Android:

```bash
npx cordova platform add android
```

4. Compile o app:

```bash
npx cordova build android
```

5. Execute o app em um emulador ou dispositivo:

```bash
npx cordova run android
```

## Como usar

1. Abra o aplicativo.
2. Na tela inicial, escolha o dia desejado no calendário.
3. Adicione suas tarefas e defina os horários de realização.
4. Marque cada tarefa como concluída quando necessário.
5. Acesse o painel de relatórios para acompanhar o desempenho.
6. Configure as notificações e personalize o perfil do usuário na seção de configurações.
7. Faça backup dos dados sempre que quiser preservar informações importantes.

## Segurança e privacidade

O Blue Day armazena os dados localmente no navegador do dispositivo, por meio do Web Storage (`localStorage`). Isso permite que o app funcione sem infraestrutura externa ou backend.

O backup exportado é protegido por criptografia, e a importação exige a senha correta para restaurar o conteúdo. Ainda assim, a aplicação foi projetada para uso local e não depende de um servidor para seu funcionamento principal.

## Observações

* O aplicativo foi pensado como uma ferramenta pessoal de organização e produtividade.
* As tarefas podem ser organizadas por data e horário, facilitando o planejamento da rotina.
* O mecanismo de backup foi implementado para reduzir o risco de perda de dados locais.
* A interface foi adaptada ao uso em dispositivos móveis, no formato de um aplicativo híbrido.

## Licença

Este projeto está licenciado sob a Apache License 2.0.

## Autor

Hibisco Tropical
