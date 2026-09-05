param(
    [ValidateRange(1024, 65535)]
    [int]$LocalPort = 3000,
    [string]$SshConfig = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.ssh/capibloques-dev.conf')
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $SshConfig -PathType Leaf)) {
    throw 'Falta la configuración SSH privada. Consultá docs/FASE_0B_DESARROLLO.md; no guardes credenciales en Git.'
}
$capiResolvedConfig = (Resolve-Path -LiteralPath $SshConfig).Path
$capiSsh = (Get-Command ssh -CommandType Application -ErrorAction Stop).Source
$capiSshArgs = @(
    '-F', $capiResolvedConfig,
    '-N', '-T', '-a', '-x',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'UpdateHostKeys=no',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-L', "127.0.0.1:${LocalPort}:127.0.0.1:3000",
    'capibloques-dev'
)

Write-Host "Al conectar SSH, abrí http://localhost:${LocalPort}/ en Chrome o Edge."
Write-Host 'Dejá esta terminal abierta. Ctrl+C cierra sólo el túnel, no el servidor.'
& $capiSsh @capiSshArgs
if ($LASTEXITCODE -ne 0) {
    throw "SSH terminó con código $LASTEXITCODE. Revisá conexión, autenticación y que el puerto local esté libre."
}
