$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$compilerPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compilerPath)) {
    throw 'The Windows .NET Framework C# compiler is unavailable. Use Launch-Kineticare.cmd instead.'
}
& $compilerPath /nologo /target:exe ("/out:" + (Join-Path $projectRoot 'Launch-Kineticare.exe')) (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
Write-Output 'Created Launch-Kineticare.exe in the project root.'
