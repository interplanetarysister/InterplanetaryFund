# Creates a local frontend .env file only. Never enter Supabase service_role or sb_secret.
[CmdletBinding()]
param([string]$RepoRoot = (Get-Location).Path)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Web = Join-Path $RepoRoot 'apps/web'
if(-not (Test-Path $Web)){throw 'Run from InterplanetaryFund repository root.'}
$Path = Join-Path $Web '.env.local'
if(Test-Path $Path){throw 'Existing apps/web/.env.local found. Refusing to overwrite it.'}
$Key = Read-Host 'Supabase PUBLISHABLE key only (never a service key)'
if($Key -notmatch '^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$'){
 throw 'Invalid public/publishable key pattern. This tool never accepts server keys.'
}
@(
 'VITE_SUPABASE_URL=https://ssibsfmtodgximseeqsv.supabase.co',
 "VITE_SUPABASE_PUBLISHABLE_KEY=$Key",
 'VITE_IFUND_WHAT_IF_ENABLED=disabled'
) | Set-Content -Path $Path -Encoding utf8
Write-Host 'Created local apps/web/.env.local. Do not commit the file.'