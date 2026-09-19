param(
    [switch]$CheckOnly,
    [switch]$DirectLan,
    [string]$SshConfig = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.ssh/capibloques-dev.conf')
)

$ErrorActionPreference = 'Stop'
$capiRepo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$capiRemoteScript = Join-Path $PSScriptRoot 'deploy-dev-remote.sh'
if (-not (Test-Path -LiteralPath $SshConfig -PathType Leaf)) {
    throw 'Falta la configuración SSH privada. Consultá docs/FASE_0B_DESARROLLO.md.'
}
if (-not (Test-Path -LiteralPath $capiRemoteScript -PathType Leaf)) {
    throw 'Falta el orquestador remoto versionado.'
}

$capiGit = (Get-Command git -CommandType Application -ErrorAction Stop).Source
$capiGh = (Get-Command gh -CommandType Application -ErrorAction Stop).Source
$capiSsh = (Get-Command ssh -CommandType Application -ErrorAction Stop).Source

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

    $capiRuns = & $capiGh run list --commit $capiCommit --workflow 'Verificar CapiBloques' --limit 10 --json status,conclusion,headSha
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar la CI de GitHub.' }
    $capiVerified = @($capiRuns | ConvertFrom-Json | Where-Object {
        $_.headSha -eq $capiCommit -and $_.status -eq 'completed' -and $_.conclusion -eq 'success'
    })
    if ($capiVerified.Count -eq 0) {
        throw "El commit $capiCommit no tiene una CI completa exitosa."
    }

    $capiRemotePath = "${capiCommit}:scripts/deploy-dev-remote.sh"
    $capiMode = if ($CheckOnly) { ' --check-only' } else { '' }
    $capiCommand = "cd /home/capi/capibloques && git fetch --quiet origin main && git cat-file -e '$capiRemotePath' && git show '$capiRemotePath' | sudo bash -s -- --expected-commit '$capiCommit'$capiMode"
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

    Write-Host "DEV objetivo: $capiCommit"
    Write-Host 'SSH y sudo pueden solicitar la contraseña de la VM. No se guarda ni se pasa como argumento.'
    & $capiSsh @capiArgs
    if ($LASTEXITCODE -ne 0) {
        throw "La operación DEV terminó con código $LASTEXITCODE. Ejecutá -CheckOnly al recuperar conectividad; no asumas que la admisión quedó abierta."
    }
}
finally {
    Pop-Location
}
