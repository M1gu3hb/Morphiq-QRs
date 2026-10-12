import { execFileSync } from 'node:child_process';
import path from 'node:path';
export interface ProcessReceipt {
  pid: number;
  executable: string;
  startedAt: string;
  runnerPid: number;
}
export function ownedAlive(receipt: ProcessReceipt): boolean {
  if (!Number.isInteger(receipt.pid) || receipt.pid <= 0) return false;
  try {
    process.kill(receipt.pid, 0);
    if (process.platform !== 'win32') return false;
    const script = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${receipt.pid}'; if($p){@{exe=$p.ExecutablePath;created=$p.CreationDate.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress}`;
    const metadata = JSON.parse(
      execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 5000,
      }),
    );
    return (
      path.resolve(metadata.exe).toLowerCase() === path.resolve(receipt.executable).toLowerCase() &&
      Math.abs(Date.parse(metadata.created) - Date.parse(receipt.startedAt)) < 10000
    );
  } catch {
    return false;
  }
}
export function cancelOwned(receipt: ProcessReceipt) {
  if (!ownedAlive(receipt)) return false;
  execFileSync('taskkill.exe', ['/PID', String(receipt.pid), '/T', '/F'], {
    windowsHide: true,
    stdio: 'pipe',
    timeout: 10000,
  });
  return true;
}
