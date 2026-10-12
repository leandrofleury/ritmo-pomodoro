# Ritmo — Pomodoro (PWA)

Aplicativo Pomodoro instalável para Android, em português (PT-BR), sem dependências externas e sem servidor de dados.

## O que está incluído

- Foco e pausa com durações configuráveis (1–180 e 1–60 minutos).
- Iniciar, pausar, continuar, reiniciar e pular de etapa.
- Anel de progresso, estado visível, contagem de sessões e indicador de grupos de quatro.
- Tarefas: adicionar, concluir, excluir e limpar concluídas, com barra de progresso.
- Som suave opcional quando um ciclo termina.
- Aviso opcional do sistema quando o aplicativo estiver em execução e o navegador permitir.
- Dados mantidos no próprio dispositivo via `localStorage` (configurações, tarefas, sessões e estado do cronômetro).
- Service worker que armazena os arquivos do aplicativo para execução sem internet.
- Manifesto PWA e ícones 192×192, 512×512 e máscara adaptável.

## Instalar no Android

**Para instalar, primeiro publique a pasta em um endereço HTTPS.** Um arquivo aberto como `file://` ou uma página dentro de um ZIP não permite registro normal de service worker ou instalação PWA.

### Opção A — GitHub Pages

1. Extraia o ZIP em seu computador.
2. Crie um repositório GitHub (ex.: `ritmo-pomodoro`).
3. Envie o conteúdo da pasta `ritmo-pomodoro/` para a raiz do repositório (arquivos `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest` e pasta `icons/`).
4. No repositório, acesse **Settings → Pages → Build and deployment**. Em **Source**, escolha **Deploy from a branch**; use a branch principal e `/ (root)`.
5. Abra o endereço HTTPS fornecido pelo Pages, como `https://seuusuario.github.io/ritmo-pomodoro/`.
6. No Android, abra esse endereço no **Chrome**. Use o botão **Instalar** do app ou o menu `⋮ → Instalar aplicativo` / `Adicionar à tela inicial`.
7. Abra uma vez conectado à internet para que os arquivos sejam salvos em cache; depois o app funcionará sem conexão.

### Opção B — Netlify Drop

1. Extraia o ZIP.
2. Acesse a ferramenta de deploy manual do Netlify em `https://app.netlify.com/drop` e arraste a pasta `ritmo-pomodoro/`.
3. Abra o endereço HTTPS gerado e instale pelo Chrome no Android.

> GitHub Pages e Netlify podem mudar sua interface de implantação. Não é necessário configurar backend, banco de dados ou API.

## Testar localmente

Execute na pasta do projeto:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8080` no computador. O navegador permite testar o service worker em `localhost`.

**Observação:** abrir `http://IP-DO-PC:8080` do Android **não equivale** a HTTPS ou localhost e pode bloquear PWA/service worker.

## Limitações importantes

- O relógio usa o horário do dispositivo para calcular o tempo restante. Se o Android suspender ou encerrar o app, ao reabrir o tempo é recalculado e uma sessão vencida é contabilizada **uma única vez**.
- Sons e notificações **não são garantidos em segundo plano**, especialmente com a tela bloqueada ou o app encerrado. O app **não** usa servidor push ou agendamento nativo de alarmes. Para alarmes estritamente pontuais em segundo plano, seria necessário um aplicativo Android nativo ou mecanismo externo.
- Se o usuário limpar os dados do site/aplicativo, desinstalar com exclusão de dados ou usar outro navegador/dispositivo, o progresso armazenado localmente poderá ser perdido. O app não sincroniza entre dispositivos.
- O uso offline é garantido após a primeira visita online bem-sucedida e a instalação do service worker; o cache pode ser removido pelo sistema/navegador sob pressão de armazenamento.
- O recurso de som depende de permissão de reprodução de áudio do navegador e do volume do aparelho.

## Privacidade

O Ritmo não carrega bibliotecas remotas, não envia tarefas a servidores, não coleta analytics e não exige conta. Os dados são salvos apenas no armazenamento local do navegador/aplicativo.

## Estrutura

```text
ritmo-pomodoro/
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-maskable-512.png
└── README.md
```

### Atualização

Ao publicar uma nova versão, mude `CACHE_NAME` em `sw.js` (ex.: `ritmo-offline-v2`) para invalidar o cache anterior. Usuários conectados recebem os novos arquivos quando o service worker atualiza. A chave `ritmo:pomodoro:v1` mantém os dados locais enquanto o formato permanecer compatível.
