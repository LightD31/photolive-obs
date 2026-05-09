import { app, dialog, ipcMain, shell } from 'electron';

export type AppIpcContext = {
  getDataDir: () => string;
  getLogsDir: () => string;
};

export function registerAppIpc(ctx: AppIpcContext): void {
  ipcMain.handle('app:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle('app:reveal-data-dir', () => {
    shell.openPath(ctx.getDataDir());
  });

  ipcMain.handle('app:open-logs', () => {
    shell.openPath(ctx.getLogsDir());
  });

  ipcMain.handle('app:pick-folder', async (_event, current: string | null) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: current ?? undefined,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  });
}
