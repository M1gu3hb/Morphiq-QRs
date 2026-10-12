param([switch]$NoBrowser)
$ErrorActionPreference='Stop'
$officeDir=Split-Path $PSScriptRoot -Parent
$baseDir=(Resolve-Path (Join-Path $officeDir '../../..')).Path
$env:MORPHIQ_ROOT=$baseDir
$env:npm_config_cache=Join-Path $baseDir 'cache/npm'
$env:npm_config_prefix=Join-Path $baseDir 'tools/npm'
$env:PLAYWRIGHT_BROWSERS_PATH=Join-Path $baseDir 'cache/playwright'
$env:CLAUDE_CONFIG_DIR=Join-Path $baseDir 'state/claude'
$env:TEMP=Join-Path $baseDir 'temp'
$env:TMP=$env:TEMP
$stateFile=Join-Path $baseDir 'state/runner.json'
if(Test-Path -LiteralPath $stateFile){
  $state=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
  $running=Get-Process -Id $state.pid -ErrorAction SilentlyContinue
  if($running){if(!$NoBrowser){Start-Process "http://127.0.0.1:$($state.port)"}; Write-Output "Oficina abierta: http://127.0.0.1:$($state.port)"; exit 0}
}
if(!(Test-Path -LiteralPath (Join-Path $officeDir 'dist/web/index.html'))){Push-Location $officeDir;try{npm run build;if($LASTEXITCODE -ne 0){throw 'Build falló'}}finally{Pop-Location}}
$nodePath=(Get-Command node).Source
Start-Process -FilePath $nodePath -ArgumentList @('--import','tsx','apps/runner/main.ts') -WorkingDirectory $officeDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $baseDir 'reports/runner.log') -RedirectStandardError (Join-Path $baseDir 'reports/runner-error.log')
for($i=0;$i -lt 60;$i++){try{$response=Invoke-WebRequest -Uri 'http://127.0.0.1:4310/api/state' -TimeoutSec 1;if($response.StatusCode -eq 200){if(!$NoBrowser){Start-Process 'http://127.0.0.1:4310'};Write-Output 'Oficina abierta: http://127.0.0.1:4310';exit 0}}catch{Start-Sleep -Milliseconds 250}}
throw 'Runner no inició. Revisa reports/runner-error.log.'
