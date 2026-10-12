$ErrorActionPreference = 'Stop'
$officeDir = Split-Path $PSScriptRoot -Parent
$baseDir = (Resolve-Path (Join-Path $officeDir '../../..')).Path
$launcher = Join-Path $baseDir 'Iniciar-Oficina.ps1'
$launcherText = @'
param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'repos/Morphiq-QRs/office/scripts/start.ps1') -NoBrowser:$NoBrowser
'@
Set-Content -LiteralPath $launcher -Value $launcherText -Encoding utf8
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $baseDir 'Abrir Morphiq Oficina.lnk'))
$shortcut.TargetPath = (Get-Command powershell.exe).Source
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $launcher + '"'
$shortcut.WorkingDirectory = $baseDir
$shortcut.Description = 'Abrir la oficina local de agentes Morphiq'
$shortcut.WindowStyle = 7
$shortcut.Save()
Write-Output ('Acceso creado en ' + $baseDir)
