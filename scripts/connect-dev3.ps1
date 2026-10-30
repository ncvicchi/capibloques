param(
    [string]$SshConfig = "$env:USERPROFILE\.ssh\capibloques-dev3.conf",
    [int]$LocalPort = 3003,
    [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $SshConfig)) { throw 'Falta el perfil SSH de dev3. Configuralo según docs/DEV3_VM_LOCAL.md.' }
$url = "http://localhost:$LocalPort"
$active = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue
if (-not $active) {
    $logs = Join-Path $env:LOCALAPPDATA 'CapiBloques'
    New-Item -ItemType Directory -Path $logs -Force | Out-Null
    $ssh = (Get-Command ssh.exe).Source
    $arguments = @('-F', "`"$SshConfig`"", '-N', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=20', '-o', 'ServerAliveCountMax=3', '-L', "127.0.0.1:${LocalPort}:127.0.0.1:3003", 'capi-dev3')
    $tunnel = Start-Process -FilePath $ssh -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $logs 'dev3-tunnel.log')
    Start-Sleep -Seconds 1
    if ($tunnel.HasExited) { throw "No se abrió el túnel. Revisá $logs\dev3-tunnel.log." }
}
$response = Invoke-WebRequest "$url/api/health/ready/" -TimeoutSec 20
if ($response.StatusCode -ne 200 -or ($response.Content | ConvertFrom-Json).status -ne 'ok') { throw 'Dev3 todavía no está listo. Ejecutá scripts/dev3.sh status en la VM.' }
Write-Host "DEV3 listo: $url · USB conectado a Windows · HMR activo en la VM"
if (-not $NoBrowser) { Start-Process $url }
