# Render a .pptx to per-slide PNGs and a PDF using the installed PowerPoint.
#
# The pptx skill's soffice.py wrapper is Linux-only (it opens an AF_UNIX
# socket) and there is no LibreOffice or pdftoppm on this machine. PowerPoint
# COM is actually the better QA path here: it renders with the real Cambria and
# Calibri, so what I inspect is what the judges will see, with no font
# substitution to make overflow checks unreliable.
param(
  [Parameter(Mandatory = $true)][string]$Pptx,
  [string]$OutDir = "render"
)

$ErrorActionPreference = "Stop"
$src = (Resolve-Path $Pptx).Path
$dir = Join-Path (Split-Path $src -Parent) $OutDir
if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
New-Item -ItemType Directory -Path $dir | Out-Null

$pp = New-Object -ComObject PowerPoint.Application
try {
  # msoFalse = 0 for WithWindow keeps it off-screen.
  $pres = $pp.Presentations.Open($src, $true, $false, $false)
  try {
    $pres.Export($dir, "PNG", 1600, 900)
    $pdf = [System.IO.Path]::ChangeExtension($src, ".pdf")
    $pres.SaveAs($pdf, 32)   # ppSaveAsPDF
    "PDF:    $pdf"
  } finally {
    $pres.Close()
  }
} finally {
  $pp.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($pp) | Out-Null
}

Get-ChildItem $dir -Filter *.PNG | Sort-Object Name | ForEach-Object { "IMAGE:  " + $_.FullName }
