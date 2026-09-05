# Guia de Configuração Local - Evolution API (Windows)

Este guia ajudará você a configurar a **Evolution API** diretamente no seu computador para evitar os problemas de conexão que tivemos na nuvem.

## 📥 Requisitos (O que baixar)

Para que o servidor funcione no seu PC, você precisará baixar e instalar estes dois programas:

1.  **Docker Desktop** (O "motor" que roda o servidor): 
    - [Baixe aqui para Windows](https://www.docker.com/products/docker-desktop/)
    - Após instalar, reinicie o computador se ele pedir (é necessário para o WSL2 ou Hyper-V).
2.  **Cloudflare Tunnel** (Para o WhatsApp conseguir falar com o seu PC):
    - [Baixe o `cloudflared-windows-amd64.msi`](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi)
    - Isso é o que permitirá o Webhook funcionar sem você precisar abrir portas no roteador.

---

## 🚀 Passo 1: Configurando o Servidor no PC

1.  **Crie uma pasta** no seu computador (ex: `C:\Users\Gusta\Desktop\EvolutionAPI`).
2.  Dentro dessa pasta, crie um arquivo chamado `docker-compose.yml` e cole o conteúdo abaixo:

```yaml
version: '3.3'

services:
  evolution_api:
    container_name: evolution_api
    image: atendai/evolution-api:latest
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SERVER_URL=http://localhost:8080
      - API_KEY=4224771A-8F12-4FF2-A9F6-444455556666
      - AUTH_INTERNAL_API_KEY=4224771A-8F12-4FF2-A9F6-444455556666
      - DELAY_MESSAGES=1000
      - WEBHOOK_GLOBAL_ENABLED=false
```

3.  Abra o **Docker Desktop** e espere ele iniciar ("Engine Running").
4.  Abra o Terminal (PowerShell) na pasta que você criou e digite:
    ```powershell
    docker compose up -d
    ```
5.  O servidor estará rodando em `http://localhost:8080`.

---

## 🌐 Passo 2: Deixando o Servidor "Visível" para o WhatsApp

Como o WhatsApp está na internet e o seu servidor está no seu PC, precisamos de um "túnel" para conectá-los (tipo um cabo virtual).

1.  No Terminal, digite este comando para criar o túnel temporário:
    ```powershell
    cloudflared tunnel --url http://localhost:8080
    ```
2.  Isso vai gerar um link como `https://random-words.trycloudflare.com`.
3.  **IMPORTANTE:** Mantenha esse terminal aberto. Copie esse link. Ele será a sua nova URL da API no Kanban.

---

## ☁️ Sobre a Oracle Cloud (O que fazer com o antigo?)

Você perguntou se pode "deixar quieto":
- **Pode deixar?** Pode. Ele continuará ligado nos servidores da Oracle, mas não vai afetar o seu PC local. 
- **Pode deixar lá?** Sim, mas se você não vai usar mais, é só desligar a máquina no site da Oracle para ficar tudo "limpo". Não tem perigo de "acontecer nada" de ruim se esquecer ligado.

---

> [!TIP]
> Se precisar transferir para outro PC depois, é só copiar essa pasta e pronto!

Deseja que eu gere o arquivo `.yml` agora na sua pasta atual do projeto para facilitar?
