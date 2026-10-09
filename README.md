# Blue Day

Blue Day é um aplicativo mobile para organização diária de tarefas, com foco em produtividade pessoal, acompanhamento de progresso e planejamento por calendário. A aplicação permite criar tarefas por dia, marcá-las como concluídas, acompanhar desempenho semanal e personalizar o perfil do usuário.

O projeto foi desenvolvido com HTML, JavaScript e Apache Cordova, utilizando uma interface em Framework7 para oferecer uma experiência semelhante a um app nativo em Android.

## Visão geral

O Blue Day foi pensado para ajudar a pessoa a manter o controle de compromissos e objetivos no dia a dia. A funcionalidade principal é uma agenda de tarefas por data, em que cada dia pode receber uma lista de itens e o usuário pode concluir ou remover tarefas conforme necessário.

Além disso, o app inclui:

- calendário mensal para navegação por datas;
- lista de tarefas por dia;
- acompanhamento de tarefas pendentes e concluídas;
- relatório semanal de desempenho;
- perfil personalizado com avatar;
- configurações de notificações;
- backup protegido por senha.

## Funcionalidades

### 1. Gerenciamento de tarefas diárias

Na tela inicial, o usuário visualiza um calendário mensal e pode selecionar um dia para abrir sua lista de tarefas. A partir daí é possível:

- adicionar novas tarefas;
- editar o título e o conteúdo da tarefa;
- marcar tarefas como concluídas;
- remover itens já finalizados ou não desejados;
- visualizar o total de tarefas pendentes do dia selecionado.

As tarefas são salvas localmente no dispositivo, de forma persistente, para que o histórico continue disponível mesmo após o app ser fechado.

### 2. Relatório de desempenho

Na página de relatório, o usuário consegue ver uma visão consolidada do progresso ao longo da semana e do mês.

Esse módulo calcula:

- dias concluídos na semana;
- sequência atual de dias com produtividade;
- feedback visual sobre o desempenho geral;
- resumo do volume de atividades concluídas em relação ao período analisado.

Essa funcionalidade ajuda a manter uma rotina mais consistente e a identificar padrões de produtividade.

### 3. Perfil e personalização

A área de configurações permite:

- escolher um nome de usuário;
- selecionar um avatar entre opções pré-definidas;
- aplicar um tema claro ou escuro;
- controlar as notificações do app.

A personalização torna a experiência mais amigável e mantém a aplicação ligada ao perfil do usuário.

### 4. Notificações

O aplicativo pode enviar lembretes para reforçar a organização do dia. Nas configurações, é possível ativar:

- lembretes de tarefas;
- resumo diário;
- teste manual de notificação.

Essas opções dependem da permissão do sistema operacional e do plugin de notificações do Cordova.

### 5. Backup e restauração de dados

A aplicação oferece proteção para os dados locais por meio de backup criptografado.

O fluxo de backup inclui:

- exportação de dados em um arquivo seguro;
- criptografia AES-GCM com derivação de chave PBKDF2;
- validação do arquivo antes da restauração;
- exigência de senha para importação e leitura do backup.

Essa funcionalidade é útil quando o usuário troca de aparelho, faz manutenção do dispositivo ou deseja preservar registros importantes.

## Tecnologias

- HTML5
- JavaScript
- CSS personalizado
- Framework7
- Apache Cordova
- Plugin de notificações locais
- Web Crypto API para criptografia de backup

## Estrutura do projeto

```text
applist/
├── config.xml                  # Configuração do app Cordova
├── index.html                  # Página principal de redirecionamento
├── package.json                # Dependências e metadados do projeto
├── www/                       # Código do aplicativo
│   ├── css/                   # Estilos personalizados
│   ├── img/                   # Ícones, avatares e assets visuais
│   ├── js/                    # Lógica principal do app
│   │   ├── routes.js          # Rotas do aplicativo
│   │   ├── tasks.js           # Calendário e tarefas
│   │   ├── report.js          # Relatórios e métricas
│   │   ├── settings.js        # Perfil, notificações e backup
│   ├── index.html             # Tela principal de tarefas
│   ├── outra.html             # Tela de relatório
│   ├── notificacoes.html      # Tela de configurações
│   └── lib/                  # Bibliotecas do Framework7 e jQuery
├── local-plugins/             # Plugins locais do Cordova
├── platforms/                 # Arquivos gerados para Android
├── plugins/                   # Plugins instalados pelo Cordova
└── package-lock.json          # Lockfile do npm
```

## Pré-requisitos

Para compilar e executar o projeto, você precisará de:

- Node.js
- npm
- Apache Cordova
- Android SDK (para build Android)
- Java JDK
- Emulador Android ou dispositivo físico conectado

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

5. Execute em um emulador ou dispositivo:

```bash
npx cordova run android
```

## Como usar

1. Abra o aplicativo.
2. Na tela inicial, escolha o dia desejado no calendário.
3. Adicione suas tarefas do dia.
4. Marque o item como concluído quando necessário.
5. Acesse o painel de relatório para acompanhar o desempenho.
6. Configure notificações e prefira o perfil do usuário na seção de configurações.
7. Faça backup dos dados sempre que quiser preservar informações importantes.

## Segurança e privacidade

O Blue Day armazena os dados localmente no navegador do dispositivo por meio do Web Storage (`localStorage`). Isso torna o app funcional mesmo sem infraestrutura externa ou backend.

O backup exportado é protegido com criptografia forte, e a importação exige a senha correta para restaurar o conteúdo. Ainda assim, a aplicação foi desenhada para uso local e não depende de um servidor para funcionamento principal.

## Observações

- O aplicativo foi pensado como ferramenta pessoal de organização e produtividade.
- O mecanismo de backup foi implementado para reduzir risco de perda de dados locais.
- A interface foi adaptada ao uso em dispositivos móveis em formato de app híbrido.

## Licença

Este projeto está licenciado sob a Apache License 2.0.

## Autor

Hibisco Tropical
