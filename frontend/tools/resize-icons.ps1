Add-Type -AssemblyName System.Drawing

$sourcePath = "c:/xampp8/htdocs/Job_Portal_Project/frontend/public/Job Portal.png"
$outputDir = "c:/xampp8/htdocs/Job_Portal_Project/frontend/public"

$img = [System.Drawing.Image]::FromFile($sourcePath)
foreach ($size in 16, 24, 32, 64, 192, 512) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $gfx.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $gfx.DrawImage($img, 0, 0, $size, $size)
    } finally {
        $gfx.Dispose()
    }

    $outputFile = Join-Path $outputDir ("Job Portal-{0}.png" -f $size)
    $bmp.Save($outputFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}
$img.Dispose()
