$ErrorActionPreference = "Stop"

$required = @(
  "DANZSTAK_ANDROID_KEYSTORE",
  "DANZSTAK_ANDROID_STORE_PASSWORD",
  "DANZSTAK_ANDROID_KEY_ALIAS",
  "DANZSTAK_ANDROID_KEY_PASSWORD"
)

foreach ($name in $required) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
    throw "Missing required release-signing environment variable: $name"
  }
}

$keystore = [Environment]::GetEnvironmentVariable("DANZSTAK_ANDROID_KEYSTORE")
if (-not (Test-Path -LiteralPath $keystore -PathType Leaf)) {
  throw "The configured Android keystore does not exist: $keystore"
}

if (-not $env:JAVA_HOME) {
  $bundledJdk = "C:\Users\5star\AppData\Local\Programs\DanzStak-JDK17\jdk-17.0.20.1+1"
  if (Test-Path -LiteralPath $bundledJdk -PathType Container) { $env:JAVA_HOME = $bundledJdk }
}

if (-not $env:ANDROID_HOME) {
  $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path -LiteralPath $defaultSdk -PathType Container) { $env:ANDROID_HOME = $defaultSdk }
}

Push-Location $PSScriptRoot
try {
  & .\gradlew.bat clean lintRelease assembleRelease --console=plain
  if ($LASTEXITCODE -ne 0) { throw "Android release build failed." }

  $apk = Join-Path $PSScriptRoot "app\build\outputs\apk\release\app-release.apk"
  if (-not (Test-Path -LiteralPath $apk -PathType Leaf)) { throw "The signed release APK was not created." }

  $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $apk
  Write-Host "Signed release ready: $apk"
  Write-Host "SHA-256: $($hash.Hash)"
} finally {
  Pop-Location
}
