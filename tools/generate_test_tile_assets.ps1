Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

function New-DirectoryIfMissing {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function New-RoundedRectanglePath {
    param(
        [Parameter(Mandatory = $true)]
        [System.Drawing.RectangleF]$Rectangle,
        [Parameter(Mandatory = $true)]
        [single]$Radius
    )

    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $diameter = $Radius * 2
    $arc = [System.Drawing.RectangleF]::new($Rectangle.X, $Rectangle.Y, $diameter, $diameter)

    $path.AddArc($arc, 180, 90)
    $arc.X = $Rectangle.Right - $diameter
    $path.AddArc($arc, 270, 90)
    $arc.Y = $Rectangle.Bottom - $diameter
    $path.AddArc($arc, 0, 90)
    $arc.X = $Rectangle.Left
    $path.AddArc($arc, 90, 90)
    $path.CloseFigure()

    return $path
}

function New-ChineseFont {
    param(
        [Parameter(Mandatory = $true)]
        [single]$Size,
        [System.Drawing.FontStyle]$Style = [System.Drawing.FontStyle]::Regular
    )

    $families = [System.Drawing.FontFamily]::Families
    $preferredNames = @('Microsoft YaHei', 'SimHei', 'Microsoft JhengHei', 'Arial Unicode MS')

    foreach ($name in $preferredNames) {
        $family = $families | Where-Object { $_.Name -eq $name } | Select-Object -First 1
        if ($null -ne $family) {
            return [System.Drawing.Font]::new($family, $Size, $Style, [System.Drawing.GraphicsUnit]::Pixel)
        }
    }

    return [System.Drawing.Font]::new([System.Drawing.FontFamily]::GenericSansSerif, $Size, $Style, [System.Drawing.GraphicsUnit]::Pixel)
}

function Save-TileBackground {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $bitmap = [System.Drawing.Bitmap]::new(256, 320, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $shadowBrush = $null
    $baseBrush = $null
    $topHighlightBrush = $null
    $edgePen = $null
    $innerPen = $null
    $shadowPath = $null
    $basePath = $null

    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear([System.Drawing.Color]::Transparent)

        $shadowRect = [System.Drawing.RectangleF]::new(27, 30, 206, 260)
        $baseRect = [System.Drawing.RectangleF]::new(22, 20, 206, 260)
        $shadowPath = New-RoundedRectanglePath -Rectangle $shadowRect -Radius 28
        $basePath = New-RoundedRectanglePath -Rectangle $baseRect -Radius 28

        $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(72, 0, 0, 0))
        $graphics.FillPath($shadowBrush, $shadowPath)

        $baseBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            $baseRect,
            [System.Drawing.Color]::FromArgb(255, 255, 248, 225),
            [System.Drawing.Color]::FromArgb(255, 223, 207, 170),
            [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
        )
        $graphics.FillPath($baseBrush, $basePath)

        $topHighlightBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(70, 255, 255, 255))
        $graphics.FillEllipse($topHighlightBrush, 48, 34, 150, 46)

        $edgePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(210, 121, 88, 45), 4)
        $graphics.DrawPath($edgePen, $basePath)

        $innerPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(95, 255, 255, 255), 2)
        $graphics.DrawArc($innerPen, 38, 36, 176, 212, 205, 130)

        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        if ($innerPen) { $innerPen.Dispose() }
        if ($edgePen) { $edgePen.Dispose() }
        if ($topHighlightBrush) { $topHighlightBrush.Dispose() }
        if ($baseBrush) { $baseBrush.Dispose() }
        if ($shadowBrush) { $shadowBrush.Dispose() }
        if ($basePath) { $basePath.Dispose() }
        if ($shadowPath) { $shadowPath.Dispose() }
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Draw-CenteredText {
    param(
        [Parameter(Mandatory = $true)]
        [System.Drawing.Graphics]$Graphics,
        [Parameter(Mandatory = $true)]
        [string]$Text,
        [Parameter(Mandatory = $true)]
        [System.Drawing.Font]$Font,
        [Parameter(Mandatory = $true)]
        [System.Drawing.Brush]$Brush,
        [Parameter(Mandatory = $true)]
        [System.Drawing.RectangleF]$Rectangle
    )

    $format = [System.Drawing.StringFormat]::new()
    try {
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $Graphics.DrawString($Text, $Font, $Brush, $Rectangle, $format)
    }
    finally {
        $format.Dispose()
    }
}

function Save-TransparentFace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Draw
    )

    $bitmap = [System.Drawing.Bitmap]::new(256, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear([System.Drawing.Color]::Transparent)
        & $Draw $graphics
        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Save-WanFace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$NumberText
    )

    Save-TransparentFace -Path $Path -Draw {
        param([System.Drawing.Graphics]$graphics)

        $oneFont = New-ChineseFont -Size 50 -Style ([System.Drawing.FontStyle]::Bold)
        $wanFont = New-ChineseFont -Size 62 -Style ([System.Drawing.FontStyle]::Bold)
        $oneBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 42, 38, 32))
        $wanBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 155, 28, 28))

        try {
            $wanText = [string]::Concat([char]0x842C)
            Draw-CenteredText -Graphics $graphics -Text $NumberText -Font $oneFont -Brush $oneBrush -Rectangle ([System.Drawing.RectangleF]::new(56, 56, 144, 52))
            Draw-CenteredText -Graphics $graphics -Text $wanText -Font $wanFont -Brush $wanBrush -Rectangle ([System.Drawing.RectangleF]::new(56, 118, 144, 70))
        }
        finally {
            $wanBrush.Dispose()
            $oneBrush.Dispose()
            $wanFont.Dispose()
            $oneFont.Dispose()
        }
    }
}

function Draw-CircleMark {
    param(
        [Parameter(Mandatory = $true)]
        [System.Drawing.Graphics]$Graphics,
        [Parameter(Mandatory = $true)]
        [single]$CenterX,
        [Parameter(Mandatory = $true)]
        [single]$CenterY,
        [Parameter(Mandatory = $true)]
        [single]$Radius,
        [Parameter(Mandatory = $true)]
        [System.Drawing.Color]$Color
    )

    $brush = [System.Drawing.SolidBrush]::new($Color)
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 245, 238, 220), [Math]::Max(2, $Radius * 0.16))
    try {
        $Graphics.FillEllipse($brush, $CenterX - $Radius, $CenterY - $Radius, $Radius * 2, $Radius * 2)
        $Graphics.DrawEllipse($pen, $CenterX - $Radius * 0.62, $CenterY - $Radius * 0.62, $Radius * 1.24, $Radius * 1.24)
    }
    finally {
        $pen.Dispose()
        $brush.Dispose()
    }
}

function Get-MarkPositions {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Count
    )

    switch ($Count) {
        1 { return @([PSCustomObject]@{ X = 128; Y = 128 }) }
        2 { return @([PSCustomObject]@{ X = 96; Y = 100 }, [PSCustomObject]@{ X = 160; Y = 156 }) }
        3 { return @([PSCustomObject]@{ X = 96; Y = 88 }, [PSCustomObject]@{ X = 128; Y = 128 }, [PSCustomObject]@{ X = 160; Y = 168 }) }
        4 { return @([PSCustomObject]@{ X = 92; Y = 92 }, [PSCustomObject]@{ X = 164; Y = 92 }, [PSCustomObject]@{ X = 92; Y = 164 }, [PSCustomObject]@{ X = 164; Y = 164 }) }
        5 { return @([PSCustomObject]@{ X = 92; Y = 86 }, [PSCustomObject]@{ X = 164; Y = 86 }, [PSCustomObject]@{ X = 128; Y = 128 }, [PSCustomObject]@{ X = 92; Y = 170 }, [PSCustomObject]@{ X = 164; Y = 170 }) }
        default { return @() }
    }
}

function Save-DotFace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [int]$Count
    )

    $colors = @(
        [System.Drawing.Color]::FromArgb(255, 178, 36, 36),
        [System.Drawing.Color]::FromArgb(255, 41, 96, 168),
        [System.Drawing.Color]::FromArgb(255, 38, 132, 77)
    )

    Save-TransparentFace -Path $Path -Draw {
        param([System.Drawing.Graphics]$graphics)

        $positions = @(Get-MarkPositions -Count $Count)
        for ($index = 0; $index -lt $positions.Count; $index += 1) {
            $point = $positions[$index]
            $radius = if ($Count -eq 1) { 38 } else { 24 }
            Draw-CircleMark -Graphics $graphics -CenterX $point.X -CenterY $point.Y -Radius $radius -Color $colors[$index % $colors.Count]
        }
    }
}

function Draw-BambooMark {
    param(
        [Parameter(Mandatory = $true)]
        [System.Drawing.Graphics]$Graphics,
        [Parameter(Mandatory = $true)]
        [single]$CenterX,
        [Parameter(Mandatory = $true)]
        [single]$CenterY,
        [single]$Scale = 1.0
    )

    $stemPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 36, 130, 72), 8 * $Scale)
    $jointPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 24, 96, 54), 3 * $Scale)
    $leafBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 55, 154, 82))
    $capBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 42, 104, 167))

    try {
        $stemPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $stemPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $Graphics.DrawLine($stemPen, $CenterX, $CenterY - 23 * $Scale, $CenterX, $CenterY + 23 * $Scale)
        $Graphics.DrawLine($jointPen, $CenterX - 8 * $Scale, $CenterY - 8 * $Scale, $CenterX + 8 * $Scale, $CenterY - 8 * $Scale)
        $Graphics.DrawLine($jointPen, $CenterX - 8 * $Scale, $CenterY + 8 * $Scale, $CenterX + 8 * $Scale, $CenterY + 8 * $Scale)
        $Graphics.FillEllipse($leafBrush, $CenterX - 18 * $Scale, $CenterY - 27 * $Scale, 14 * $Scale, 18 * $Scale)
        $Graphics.FillEllipse($leafBrush, $CenterX + 4 * $Scale, $CenterY + 9 * $Scale, 14 * $Scale, 18 * $Scale)
        $Graphics.FillEllipse($capBrush, $CenterX - 5 * $Scale, $CenterY - 30 * $Scale, 10 * $Scale, 10 * $Scale)
    }
    finally {
        $capBrush.Dispose()
        $leafBrush.Dispose()
        $jointPen.Dispose()
        $stemPen.Dispose()
    }
}

function Save-BambooFace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [int]$Count
    )

    Save-TransparentFace -Path $Path -Draw {
        param([System.Drawing.Graphics]$graphics)

        $positions = @(Get-MarkPositions -Count $Count)
        for ($index = 0; $index -lt $positions.Count; $index += 1) {
            $point = $positions[$index]
            $scale = if ($Count -eq 1) { 1.25 } else { 0.82 }
            Draw-BambooMark -Graphics $graphics -CenterX $point.X -CenterY $point.Y -Scale $scale
        }
    }
}

function Save-HonorFace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Text,
        [Parameter(Mandatory = $true)]
        [System.Drawing.Color]$Color
    )

    Save-TransparentFace -Path $Path -Draw {
        param([System.Drawing.Graphics]$graphics)

        $font = New-ChineseFont -Size 88 -Style ([System.Drawing.FontStyle]::Bold)
        $brush = [System.Drawing.SolidBrush]::new($Color)

        try {
            Draw-CenteredText -Graphics $graphics -Text $Text -Font $font -Brush $brush -Rectangle ([System.Drawing.RectangleF]::new(54, 54, 148, 148))
        }
        finally {
            $brush.Dispose()
            $font.Dispose()
        }
    }
}

$root = Split-Path -Parent $PSScriptRoot
$backgroundDirectory = Join-Path $root 'assets/resources/tiles/backgrounds'
$facesDirectory = Join-Path $root 'assets/resources/tiles/faces'
$backgroundPath = Join-Path $backgroundDirectory 'tile_bg.png'

New-DirectoryIfMissing -Path $backgroundDirectory
New-DirectoryIfMissing -Path $facesDirectory
Save-TileBackground -Path $backgroundPath

$wanNumbers = @(
    @{ File = 'wan_1.png'; Text = [string]::Concat([char]0x4E00) },
    @{ File = 'wan_2.png'; Text = [string]::Concat([char]0x4E8C) },
    @{ File = 'wan_3.png'; Text = [string]::Concat([char]0x4E09) },
    @{ File = 'wan_4.png'; Text = [string]::Concat([char]0x56DB) },
    @{ File = 'wan_5.png'; Text = [string]::Concat([char]0x4E94) }
)

foreach ($wan in $wanNumbers) {
    Save-WanFace -Path (Join-Path $facesDirectory $wan.File) -NumberText $wan.Text
}

for ($number = 1; $number -le 5; $number += 1) {
    Save-DotFace -Path (Join-Path $facesDirectory "dot_$number.png") -Count $number
    Save-BambooFace -Path (Join-Path $facesDirectory "bam_$number.png") -Count $number
}

Save-HonorFace -Path (Join-Path $facesDirectory 'east.png') -Text ([string]::Concat([char]0x6771)) -Color ([System.Drawing.Color]::FromArgb(255, 42, 38, 32))
Save-HonorFace -Path (Join-Path $facesDirectory 'south.png') -Text ([string]::Concat([char]0x5357)) -Color ([System.Drawing.Color]::FromArgb(255, 42, 38, 32))
Save-HonorFace -Path (Join-Path $facesDirectory 'west.png') -Text ([string]::Concat([char]0x897F)) -Color ([System.Drawing.Color]::FromArgb(255, 42, 38, 32))
Save-HonorFace -Path (Join-Path $facesDirectory 'north.png') -Text ([string]::Concat([char]0x5317)) -Color ([System.Drawing.Color]::FromArgb(255, 42, 38, 32))
Save-HonorFace -Path (Join-Path $facesDirectory 'red.png') -Text ([string]::Concat([char]0x4E2D)) -Color ([System.Drawing.Color]::FromArgb(255, 155, 28, 28))

Write-Host "Generated $backgroundPath"
Write-Host "Generated 20 face PNG files in $facesDirectory"
