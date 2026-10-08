<#
.SYNOPSIS
  Prints a receipt file straight to a Windows printer — no dialog, no browser.

.DESCRIPTION
  Called by the dashboard's "print receipt" command. It draws the lines with
  GDI+, which is what makes Arabic come out shaped and right-to-left; sending
  raw text to the printer would print it unshaped or reversed.

  Without -PrinterName it uses whatever Windows has set as the default printer.

  Line format (see src/lib/printing/receipt.ts):
    =text              centred and set large — the order number
    ~text              centred
    -                  a rule across the paper
    (empty)            blank line
    label<TAB>val      label on the left, value on the right
    text               one line, aligned to the side its script reads from
    IMG<TAB>mm<TAB>path a PNG (a QR code), centred and scaled to `mm` wide

  QR codes are printed as images rather than as native ESC/POS commands so the
  Arabic body can keep its GDI+ shaping; both share one print job. The receipt
  builder emits a `QR` directive and src/lib/printing/qr-image.ts renders the
  PNG and rewrites it to the `IMG` line above before the file reaches here.

  Two different things are called "direction" here, and they are decided
  separately:

    * How a *string* is laid out. A run of Arabic letters is drawn
      right-to-left so it comes out shaped and in the right order; anything
      else (a street, a phone number, a price) is drawn left-to-right.
      Laying a Latin phone number out RTL printed its groups back to front.

    * Which *column* a label and its value sit in. That is a property of the
      document, not of the individual string, because the prices have to line
      up in one column the whole way down. Receipts print in German (see
      src/lib/printing/queue.ts), so the label takes the left edge and the
      value the right — "Gesamt … 6,50 €". An Arabic dish name inside such a
      row is still shaped right-to-left within its own box; the box does not
      move.

  Nothing is ever trimmed away: a label and a value that will not fit side by
  side are printed on two lines instead, and a long centred line wraps.

.PARAMETER Path
  UTF-8 file holding the lines.

.PARAMETER PrinterName
  Printer to use. Empty means the system default.

.PARAMETER WidthMm
  Paper roll width: 58 or 80. Sets the type size and the margins.

.PARAMETER OutputFile
  Print to a file instead of paper — used to verify the pipeline without
  burning a roll of receipt paper.

.PARAMETER Preview
  Render the receipt to a PNG instead of printing it, through the very same
  drawing code. This is how the layout is checked — on paper you cannot tell a
  clipped line from a short one until the roll is already spent.
#>
param(
  [Parameter(Mandatory = $true)][string] $Path,
  [string] $PrinterName = "",
  [ValidateSet(58, 80)][int] $WidthMm = 58,
  [string] $OutputFile = "",
  [string] $Preview = "",
  [string] $FontName = "Segoe UI"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path -LiteralPath $Path)) { throw "Receipt file not found: $Path" }

$script:lines = [System.IO.File]::ReadAllLines($Path, [System.Text.Encoding]::UTF8)
$script:index = 0

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.DocumentName = "Pizza Day and Night receipt"

if ($PrinterName) { $doc.PrinterSettings.PrinterName = $PrinterName }
# A preview needs no printer at all, which is what makes it usable on a machine
# where the receipt printer is not plugged in yet.
if (-not $Preview -and -not $doc.PrinterSettings.IsValid) {
  throw "Printer not available: $($doc.PrinterSettings.PrinterName)"
}

if ($OutputFile) {
  $doc.PrinterSettings.PrintToFile = $true
  $doc.PrinterSettings.PrintFileName = $OutputFile
}

# 58 mm leaves about 48 mm of print width, so the type has to come down with it.
# Margins are in hundredths of an inch.
if ($WidthMm -eq 58) {
  $bodySize = 7.5
  $margin = 8
} else {
  $bodySize = 9.5
  $margin = 14
}

# The bottom margin is its own, much larger number.
#
# On a thermal printer the cutter sits roughly 15 mm past the print head, so the
# last centimetre and a half of what was printed is still under the blade when
# the paper is cut — which is exactly how the footer came out sliced in half
# lengthwise. Trailing blank lines cannot fix this: they draw no ink, and the
# printer ends the page at the last mark, so the paper never advances past them.
# Reserving the gap as margin is what actually keeps text out of the blade's
# path. 0.75 in ≈ 19 mm, the cutter offset plus a little tolerance.
$bottomMargin = 75

$doc.DefaultPageSettings.Margins =
  New-Object System.Drawing.Printing.Margins($margin, $margin, $margin, $bottomMargin)

$script:font = New-Object System.Drawing.Font($FontName, $bodySize)
$script:bold = New-Object System.Drawing.Font($FontName, ($bodySize + 1), [System.Drawing.FontStyle]::Bold)
# The order number, and nothing else: it is what the kitchen and the driver
# search the slip for, so it is set well above every other line rather than one
# notch up. Scaled from the body size so the 58 mm and 80 mm rolls each get a
# heading in proportion to their own type.
$script:hero = New-Object System.Drawing.Font($FontName, ($bodySize * 1.9), [System.Drawing.FontStyle]::Bold)

function New-Format([bool] $Rtl, [System.Drawing.StringAlignment] $Alignment) {
  $format = New-Object System.Drawing.StringFormat
  if ($Rtl) {
    $format.FormatFlags = [System.Drawing.StringFormatFlags]::DirectionRightToLeft
  }
  $format.Alignment = $Alignment
  return $format
}

$near = [System.Drawing.StringAlignment]::Near
$centre = [System.Drawing.StringAlignment]::Center

$script:rtl       = New-Format $true  $near
$script:ltr       = New-Format $false $near
$script:ltrEnd    = New-Format $false ([System.Drawing.StringAlignment]::Far)
$script:rtlCentre = New-Format $true  $centre
$script:ltrCentre = New-Format $false $centre

# Arabic letters decide the direction of a line; digits and Latin do not.
function Test-Arabic([string] $Text) {
  return $Text -match "\p{IsArabic}"
}

$onPrintPage = {
  param($sender, $e)

  $g = $e.Graphics
  $bounds = $e.MarginBounds
  $width = [double]$bounds.Width
  $lineHeight = $script:font.GetHeight($g)
  $y = [double]$bounds.Top
  $black = [System.Drawing.Brushes]::Black

  # Draws one string into the full width, wrapping if needed, and reports how
  # much vertical space it took.
  function Write-Block([string] $Text, $Font, $Format) {
    $needed = $g.MeasureString($Text, $Font, [int]$width, $Format)
    $height = [Math]::Max([double]$needed.Height, $lineHeight)
    $rect = New-Object System.Drawing.RectangleF($bounds.Left, $y, $width, $height)
    $g.DrawString($Text, $Font, $black, $rect, $Format)
    return $height
  }

  while ($script:index -lt $script:lines.Length) {
    if (($y + $lineHeight) -gt $bounds.Bottom) {
      $e.HasMorePages = $true
      return
    }

    $line = $script:lines[$script:index]

    if ($line -eq "-") {
      $mid = $y + ($lineHeight / 2)
      $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 1)
      $g.DrawLine($pen, $bounds.Left, $mid, $bounds.Right, $mid)
      $pen.Dispose()
      $y += $lineHeight
    }
    elseif ($line -eq "--") {
      # A dashed double rule. The kitchen slip fences its item list with these
      # rather than the solid rule the customer copy uses, so a cook glancing
      # down a spike of tickets can tell the two apart without reading them.
      $dash = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 1)
      $dash.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
      $top = $y + ($lineHeight / 2) - 1.5
      $g.DrawLine($dash, $bounds.Left, $top, $bounds.Right, $top)
      $g.DrawLine($dash, $bounds.Left, $top + 3, $bounds.Right, $top + 3)
      $dash.Dispose()
      $y += $lineHeight
    }
    elseif ($line.StartsWith("=")) {
      # Centred and set large — the order number.
      $text = $line.Substring(1)
      $format = if (Test-Arabic $text) { $script:rtlCentre } else { $script:ltrCentre }
      $y += Write-Block $text $script:hero $format
    }
    elseif ($line.StartsWith("~")) {
      $text = $line.Substring(1)
      $format = if (Test-Arabic $text) { $script:rtlCentre } else { $script:ltrCentre }
      $y += Write-Block $text $script:bold $format
    }
    elseif ($line.StartsWith("IMG`t")) {
      # A pre-rendered image (a QR code), drawn centred and scaled to a width in
      # millimetres. The check comes before the tabbed-row case because this line
      # also contains tabs. Format: IMG<TAB>widthMm<TAB>absolutePath
      $imgParts = $line.Split("`t")
      $imgMm = [double]$imgParts[1]
      $imgPath = $imgParts[2]

      $targetPx = ($imgMm / 25.4) * $g.DpiX
      if ($targetPx -gt $width) { $targetPx = $width }

      $img = [System.Drawing.Image]::FromFile($imgPath)
      try {
        $drawH = $img.Height * ($targetPx / $img.Width)
        # No room left on this page: leave the line for the next one.
        if (($y + $drawH) -gt $bounds.Bottom) {
          $e.HasMorePages = $true
          return
        }
        $x = $bounds.Left + (($width - $targetPx) / 2)
        $rect = New-Object System.Drawing.RectangleF(
          [single]$x, [single]$y, [single]$targetPx, [single]$drawH)

        # Nearest-neighbour keeps the QR modules square and scannable when the
        # printer's DPI differs from the PNG's; restored so text stays smooth.
        $oldMode = $g.InterpolationMode
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $g.DrawImage($img, $rect)
        $g.InterpolationMode = $oldMode

        $y += $drawH + ($lineHeight / 2)
      }
      finally {
        $img.Dispose()
      }
    }
    elseif ($line.Contains("`t")) {
      # "!" marks the row that matters most on a receipt — the total.
      $strong = $line.StartsWith("!")
      $parts = ($(if ($strong) { $line.Substring(1) } else { $line })).Split("`t", 2)
      $label = $parts[0]
      $value = $parts[1]
      $rowFont = if ($strong) { $script:bold } else { $script:font }

      # Each side keeps its own direction: a date carrying "م" is Arabic and
      # must be laid out right-to-left, a price or a phone number must not.
      $labelFormat = if (Test-Arabic $label) { $script:rtl } else { $script:ltr }
      $valueFormat = if (Test-Arabic $value) { $script:rtl } else { $script:ltr }

      $labelWidth = [double]$g.MeasureString($label, $rowFont).Width
      $valueWidth = [double]$g.MeasureString($value, $rowFont).Width
      $rowHeight = [Math]::Max($rowFont.GetHeight($g), $lineHeight)

      if (($labelWidth + $valueWidth + 8) -le $width) {
        # Both fit: label anchored at the left edge, value at the right — the
        # German order, which is the language every receipt prints in. Each is
        # drawn inside a box its own size, so a right-to-left string can shape
        # itself without dragging its column across the paper.
        if ($label) {
          $labelRect = New-Object System.Drawing.RectangleF(
            $bounds.Left, $y, ($labelWidth + 2), $rowHeight)
          $g.DrawString($label, $rowFont, $black, $labelRect, $labelFormat)
        }
        $valueRect = New-Object System.Drawing.RectangleF(
          ($bounds.Right - $valueWidth - 1), $y, ($valueWidth + 2), $rowHeight)
        $g.DrawString($value, $rowFont, $black, $valueRect, $valueFormat)
        $y += $rowHeight
      }
      else {
        # Too tight for one line: the value moves under its label rather than
        # the label being cut short.
        if ($label) { $y += Write-Block $label $rowFont $labelFormat }
        $y += Write-Block $value $rowFont $valueFormat
      }
    }
    elseif ($line.Length -gt 0) {
      # "!" means bold here too, not only on a tabbed row. The kitchen slip has
      # no price column, so its dishes and their notes are full-width lines that
      # still have to stand out — without this they printed with a literal "!"
      # in front of them.
      $strongLine = $line.StartsWith("!")
      $text = if ($strongLine) { $line.Substring(1) } else { $line }
      $lineFont = if ($strongLine) { $script:bold } else { $script:font }
      $format = if (Test-Arabic $text) { $script:rtl } else { $script:ltr }
      $y += Write-Block $text $lineFont $format
    }
    else {
      $y += $lineHeight
    }

    $script:index++
  }

  $e.HasMorePages = $false
}

$doc.add_PrintPage($onPrintPage)

try {
  if ($Preview) {
    # Same handler, same fonts, same margins — only the surface differs.
    $dpi = 96
    $pageWidth = [int](($WidthMm / 25.4) * $dpi)
    $pageHeight = 2000
    $inset = [int](($margin / 100) * $dpi)
    $bottomInset = [int](($bottomMargin / 100) * $dpi)

    $bitmap = New-Object System.Drawing.Bitmap($pageWidth, $pageHeight)
    $bitmap.SetResolution($dpi, $dpi)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $pageBounds = New-Object System.Drawing.Rectangle(0, 0, $pageWidth, $pageHeight)
    # The same asymmetric margins the printed page gets, so a preview cannot
    # show clearance the paper will not have — which is how a clipped footer got
    # past a preview that looked correct.
    $marginBounds = New-Object System.Drawing.Rectangle(
      $inset, $inset, ($pageWidth - (2 * $inset)), ($pageHeight - $inset - $bottomInset))

    $eventArgs = New-Object System.Drawing.Printing.PrintPageEventArgs(
      $graphics, $marginBounds, $pageBounds, $doc.DefaultPageSettings)

    & $onPrintPage $null $eventArgs

    $graphics.Dispose()
    $bitmap.Save($Preview, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()

    Write-Output "preview:$Preview ($WidthMm mm)"
  }
  else {
    $doc.Print()
    Write-Output "printed:$($doc.PrinterSettings.PrinterName) ($WidthMm mm)"
  }
}
finally {
  $doc.Dispose()
  $script:font.Dispose()
  $script:bold.Dispose()
  $script:hero.Dispose()
}
