const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

// Enable live reload for development
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname);
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    show: false
  });

  // Start the server if not already running
  if (!serverProcess) {
    startServer();
  }

  // Load the control interface
  mainWindow.loadURL('http://localhost:3001/control');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Create application menu
  createMenu();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  try {
    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: 'inherit'
    });

    serverProcess.on('error', (error) => {
      console.error('Failed to start server:', error);
    });

    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`);
      serverProcess = null;
    });
  } catch (error) {
    console.error('Error starting server:', error);
  }
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Select Photos Folder...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory'],
              title: 'Select Photos Folder'
            });

            if (!result.canceled && result.filePaths.length > 0) {
              const selectedPath = result.filePaths[0];
              mainWindow.webContents.send('folder-selected', selectedPath);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Slideshow Window',
          click: () => {
            // Open slideshow in new window
            const slideshowWindow = new BrowserWindow({
              width: 1920,
              height: 1080,
              webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
              }
            });
            slideshowWindow.loadURL('http://localhost:3001/');
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    // Window menu
    template[3].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Handle folder selection from renderer process
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Photos Folder'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Stop server when all windows closed
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});