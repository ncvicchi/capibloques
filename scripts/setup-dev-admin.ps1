param(
    [string]$SshConfig = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.ssh/capibloques-dev.conf')
)
$ErrorActionPreference = 'Stop'
$capiAdminConfig = (Resolve-Path -LiteralPath $SshConfig).Path
Write-Host 'Crear la primera cuenta en DEV. No afecta producción ni modifica el gateway.'
Write-Host 'Cuando lo pida: alias administrador y nombre visible Administrador.'
Write-Host 'Elegí una contraseña propia de al menos 10 caracteres; al escribirla no se muestra.'
Write-Host 'SSH y sudo pueden pedir antes la contraseña de la VM. No es la contraseña de la aplicación.'
$capiAdminCommand = 'test "$(hostname)" = capi-dev && cd /home/capi/capibloques && sudo docker compose --ansi never -f compose.dev.yaml -f compose.backend.dev.yaml exec api python manage.py bootstrap_admin'
& ssh -F $capiAdminConfig -tt -a -x -o StrictHostKeyChecking=yes -o UpdateHostKeys=no capibloques-dev $capiAdminCommand
if ($LASTEXITCODE -ne 0) { throw 'La creación no terminó correctamente. No se reemplaza ningún administrador existente.' }
