param(
    [ValidateSet('main', 'dev1', 'dev2')][string]$Environment = 'main',
    [ValidateSet('dev1', 'dev2')][string]$Promote,
    [string]$Branch,
    [switch]$CheckOnly,
    [switch]$Fast,
    [switch]$Full,
    [switch]$DirectLan,
    [string]$SshConfig = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.ssh/capibloques-dev.conf')
)

$ErrorActionPreference = 'Stop'
if ($Fast -and $Full) { throw 'Elegí -Fast o -Full, no ambos.' }
if ($Promote -and ($Environment -ne 'main' -or $Branch -or $CheckOnly)) { throw '-Promote no admite -Environment, -Branch ni -CheckOnly.' }
if ($Branch -and ($Environment -eq 'main' -or $CheckOnly -or $Branch -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]*$')) { throw '-Branch requiere -Environment dev1/dev2, nombre de rama válido y no -CheckOnly.' }
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
    if ($LASTEXITCODE -ne 0 -or (-not $Promote -and $Environment -eq 'main' -and $capiBranch -ne 'main')) {
        throw 'Actualizar main requiere checkout main; para una tarea elegí -Environment dev1/dev2 -Branch.'
    }
    if ((& $capiGit status --porcelain)) {
        throw 'El checkout local tiene cambios; commit y push antes de desplegar.'
    }
    $capiReference = if ($Branch) { $Branch } else { $Environment }
    & $capiGit fetch --quiet origin $capiReference
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar origin/main.' }
    $capiCommit = (& $capiGit rev-parse HEAD).Trim()
    $capiOrigin = (& $capiGit rev-parse "origin/$capiReference").Trim()
    if (-not $Promote -and ($Branch -or $Environment -eq 'main') -and $capiCommit -ne $capiOrigin) {
        throw 'HEAD no coincide con la rama remota solicitada; falta push o actualización local.'
    }

    $capiMode = if ($Full) { ' --full' } else { ' --fast' }
    if ($CheckOnly) { $capiMode += ' --check-only' }
    if ($Promote) { $capiMode += " --promote $Promote" }
    else { $capiMode += " --env $Environment" }
    if ($Branch) { $capiMode += " --branch '$Branch' --commit $capiCommit" }
    # El actualizador instalado toma el bloqueo antes de reparar permisos o
    # hacer Git. La instalación inicial del flujo nuevo se hace una sola vez.
    $capiCommand = "/home/capi/.local/bin/capi-dev$capiMode"
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

    if ($Promote) { Write-Host "Promoción explícita de $Promote a main; se validará su revisión instalada en el servidor." }
    else { Write-Host "Ambiente: $Environment. Rama: $capiReference. No integra otros ambientes." }
    if ($Full) { Write-Host 'Modo completo: esperará la CI de GitHub.' }
    else { Write-Host 'Modo directo: sin esperar GitHub Actions.' }
    Write-Host 'SSH y sudo pueden solicitar la contraseña de la VM. No se guarda ni se pasa como argumento.'
    & $capiSsh @capiArgs
    if ($LASTEXITCODE -ne 0) {
        throw "La operación DEV terminó con código $LASTEXITCODE. Ejecutá -CheckOnly al recuperar conectividad; no asumas que la admisión quedó abierta."
    }
}
finally {
    Pop-Location
}
