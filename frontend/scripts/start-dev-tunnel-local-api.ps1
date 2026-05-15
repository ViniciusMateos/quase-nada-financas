$ErrorActionPreference = "Stop"

Write-Host "\n[QNF] Procurando o IPv4 local da sua maquina..." -ForegroundColor Cyan

$ipCandidates = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -ne "127.0.0.1" -and
    $_.IPAddress -notlike "169.254*" -and
    $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL|Docker|VirtualBox|VMware|Hyper-V"
  } |
  Sort-Object InterfaceMetric

$ip = $ipCandidates | Select-Object -First 1 -ExpandProperty IPAddress

if (-not $ip) {
  Write-Host "[QNF] Nao consegui detectar o IP automaticamente." -ForegroundColor Yellow
  $ip = Read-Host "Digite o IPv4 da sua maquina Windows. Exemplo: 192.168.0.50"
}

$apiUrl = "http://${ip}:3000/api/v1"
$envPath = Join-Path (Get-Location) ".env.local"

@"
APP_VARIANT=development
EXPO_PUBLIC_API_URL=$apiUrl
"@ | Set-Content -Path $envPath -Encoding UTF8

Write-Host "\n[QNF] .env.local atualizado:" -ForegroundColor Green
Write-Host "APP_VARIANT=development"
Write-Host "EXPO_PUBLIC_API_URL=$apiUrl"

Write-Host "\n[QNF] Antes de abrir o app, confirme que o backend esta rodando em outra janela:" -ForegroundColor Yellow
Write-Host "cd ..\backend"
Write-Host "npm run dev"

Write-Host "\n[QNF] Iniciando Metro com Expo tunnel..." -ForegroundColor Cyan
npx expo start --dev-client --tunnel
