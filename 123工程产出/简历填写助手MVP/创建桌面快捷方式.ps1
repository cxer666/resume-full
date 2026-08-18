$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $projectDir "打开简历填写助手.bat"
$icon = Join-Path $projectDir "assets\pencil.ico"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "简历填写助手.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = $projectDir
if (Test-Path -LiteralPath $icon) {
  $shortcut.IconLocation = $icon
} else {
  $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,167"
}
$shortcut.Description = "启动本地简历填写助手"
$shortcut.Save()

Write-Host "已创建桌面快捷方式：$shortcutPath"
