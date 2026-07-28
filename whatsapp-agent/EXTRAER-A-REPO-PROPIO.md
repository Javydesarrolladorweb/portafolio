# Cómo mover esto a su propio repositorio

Pediste el chatbot en un repositorio separado. No pude crearlo desde la sesión
en la que se escribió este código: el token de GitHub estaba limitado a
`javydesarrolladorweb/portafolio` y `POST /user/repos` respondía
`403 Resource not accessible by integration`.

Así que el proyecto está aquí, en `whatsapp-agent/`, pero es **autocontenido**:
tiene su propio `package.json`, su `.gitignore`, su `vercel.json` y no importa
nada de fuera de su carpeta. Sacarlo es cuestión de un minuto.

## Opción A — copiar la carpeta (recomendado)

Es lo más simple y no arrastra el historial del portafolio, que no aporta nada
aquí.

```bash
# 1. Crea el repositorio vacío en github.com/new  →  whatsapp-agent

# 2. Copia la carpeta a un directorio hermano
cp -r whatsapp-agent ../whatsapp-agent
cd ../whatsapp-agent

# 3. Inicializa y sube
git init
git add .
git commit -m "Chatbot de WhatsApp con Claude y Cloud API Coexistence"
git branch -M main
git remote add origin git@github.com:javydesarrolladorweb/whatsapp-agent.git
git push -u origin main
```

Después, borra la carpeta del portafolio para no mantener dos copias:

```bash
cd ../portafolio
git rm -r whatsapp-agent
git commit -m "Mover el chatbot a su propio repositorio"
git push
```

## Opción B — conservar el historial de commits

Solo tiene sentido si quieres mantener la traza de cómo se construyó.

```bash
git subtree split --prefix=whatsapp-agent -b whatsapp-agent-only

cd ..
git clone -b whatsapp-agent-only portafolio whatsapp-agent
cd whatsapp-agent
git remote set-url origin git@github.com:javydesarrolladorweb/whatsapp-agent.git
git branch -M main
git push -u origin main
```

## Verificación

En el repositorio nuevo, antes de desplegar:

```bash
npm install
npm test                                  # deben pasar las 15 pruebas
cp .env.example .env                      # y rellenarlo
node --env-file=.env scripts/check-setup.js
```

Si `check-setup` da todo en verde, sigue con la sección **Desplegar** del
[README](README.md).
