# Read-only Windows PowerShell preflight. No hosted writes, secret printing or deployment.
[CmdletBinding()]
param([string]$RepoRoot = (Get-Location).Path)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProjectRef = 'ssibsfmtodgximseeqsv'
$ProjectUrl = "https://$ProjectRef.supabase.co"
Write-Host 'iFund What If? Integration Check (READ ONLY)'
Write-Host "Supabase project reference: $ProjectRef"
Write-Host "Supabase URL: $ProjectUrl"
Write-Host 'GitHub repository: interplanetarysister/InterplanetaryFund'
Write-Host 'Cloudflare Pages: interplanetaryfund-migration'
if(-not (Test-Path (Join-Path $RepoRoot 'apps/web'))) {
  Write-Warning 'Run from your canonical InterplanetaryFund repository root.'
}
foreach($program in @('git','node','npm','supabase','wrangler','gh')) {
  $found=Get-Command $program -ErrorAction SilentlyContinue
  if($null -eq $found) { Write-Warning "$program is unavailable in PATH" }
  else { Write-Host "FOUND $program" }
}
$settings=@(
  @{Name='VITE_SUPABASE_URL'; Expected=$ProjectUrl},
  @{Name='VITE_SUPABASE_PUBLISHABLE_KEY'; Expected=$null},
  @{Name='SUPABASE_ACCESS_TOKEN';Expected=$null},
  @{Name='CLOUDFLARE_ACCOUNT_ID';Expected=$null},
  @{Name='CLOUDFLARE_API_TOKEN';Expected=$null},
  @{Name='IFUND_WHAT_IF_ENABLED';Expected='disabled'},
  @{Name='IFUND_WHAT_IF_EXTERNAL_ACTIONS';Expected='disabled'}
)
foreach($setting in $settings){
  $v=[Environment]::GetEnvironmentVariable($setting.Name)
  if([string]::IsNullOrWhiteSpace($v)){Write-Host "UNSET $($setting.Name)"}
  elseif($setting.Expected -and $v -ne $setting.Expected){Write-Warning "CHECK $($setting.Name): unexpected value (hidden)"}
  else {Write-Host "SET $($setting.Name) (hidden)"}
}
if(Get-Command supabase -ErrorAction SilentlyContinue) {
  & supabase --version
  Write-Host 'CLI v3 defaults to local; --remote and confirmation required for hosted changes.'
}
Write-Host 'Read-only preflight complete.'