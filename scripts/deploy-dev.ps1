param(
    [switch]$CheckOnly,
    [switch]$Fast,
    [switch]$Full,
    [switch]$DirectLan,
    [string]$SshConfig = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.ssh/capibloques-dev.conf')
)

$ErrorActionPreference = 'Stop'
if ($Fast -and $Full) { throw 'Elegí -Fast o -Full, no ambos.' }
$capiRepo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$capiRemoteScript = Join-Path $PSScriptRoot 'deploy-dev-remote.sh'
if (-not (Test-Path -LiteralPath $SshConfig -PathType Leaf)) {
    throw 'Falta la configuración SSH privada. Consultá docs/FASE_0B_DESARROLLO.md.'
}
if (-not (Test-Path -LiteralPath $capiRemoteScript -PathType Leaf)) {
    throw 'Falta el orquestador remoto versionado.'
}

$capiGit = Get-Command git -CommandType Application -ErrorAction Stop |
    Select-Object -First 1 -ExpandProperty Source
$capiSsh = Get-Command ssh -CommandType Application -ErrorAction Stop |
    Select-Object -First 1 -ExpandProperty Source

Push-Location $capiRepo
try {
    $capiBranch = (& $capiGit branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $capiBranch -ne 'main') {
        throw 'El despliegue de DEV sólo admite la rama main.'
    }
    if ((& $capiGit status --porcelain)) {
        throw 'El checkout local tiene cambios; commit y push antes de desplegar.'
    }
    & $capiGit fetch --quiet origin main
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar origin/main.' }
    $capiCommit = (& $capiGit rev-parse HEAD).Trim()
    $capiOrigin = (& $capiGit rev-parse origin/main).Trim()
    if ($capiCommit -ne $capiOrigin) {
        throw 'HEAD no coincide con origin/main; falta push o actualización local.'
    }

    $capiMode = if ($Full) { ' --full' } else { ' --fast' }
    if ($CheckOnly) { $capiMode += ' --check-only' }
    # Carga siempre el actualizador desde origin/main. Así también funciona si
    # el checkout remoto todavía conserva una versión vieja del propio script.
    $capiCommand = "cd /home/capi/capibloques && git fetch --quiet origin main && git show origin/main:scripts/update-dev.sh | bash -s --$capiMode"
    $capiArgs = @(
        '-F', (Resolve-Path -LiteralPath $SshConfig).Path,
        '-tt', '-a', '-x',
        '-o', 'StrictHostKeyChecking=yes',
        '-o', 'UpdateHostKeys=no',
        '-o', 'ConnectTimeout=15'
    )
    if ($DirectLan) {
        $capiArgs += @('-o', 'ProxyCommand=none', '-o', 'ProxyJump=none')
    }
    $capiArgs += @('capibloques-dev', $capiCommand)

    if ($Full) {
        Write-Host "DEV objetivo: $capiCommit. Modo completo: esperará la CI de GitHub."
    }
    else {
        Write-Host "DEV objetivo: $capiCommit. Modo directo: actualizará DEV sin esperar GitHub Actions."
    }
    Write-Host 'SSH y sudo pueden solicitar la contraseña de la VM. No se guarda ni se pasa como argumento.'
    & $capiSsh @capiArgs
    if ($LASTEXITCODE -ne 0) {
        throw "La operación DEV terminó con código $LASTEXITCODE. Ejecutá -CheckOnly al recuperar conectividad; no asumas que la admisión quedó abierta."
    }
}
finally {
    Pop-Location
}
