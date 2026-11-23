# Task 38 (owner session, run once): creates the CloudFront signing key for the DanzStak media CDN. Works in Windows
# PowerShell 5 and PowerShell 7, no openssl. The private key goes ONLY into AWS Secrets Manager
# (danzstak/cloudfront/media-signing-key, us-west-1); the two temp files are deleted. Prints the public key id (not a secret)
# for the call-signaling deploy parameter MediaSigningPublicKeyId.  Run: powershell -ExecutionPolicy Bypass -File scripts/setup-media-cdn-key.ps1
$sn = "danzstak/cloudfront/media-signing-key"; $rg = "us-west-1"
function DerLen([int]$n) { if ($n -lt 128) { return ,[byte[]]@($n) } elseif ($n -lt 256) { return ,[byte[]]@(0x81, $n) } else { return ,[byte[]]@(0x82, ($n -shr 8), ($n -band 255)) } }
function Der([byte]$tag, [byte[]]$body) { $out = New-Object System.Collections.Generic.List[byte]; $out.Add($tag); $out.AddRange([byte[]](DerLen $body.Length)); $out.AddRange($body); return ,$out.ToArray() }
function DerInt([byte[]]$b) { $i = 0; while ($i -lt $b.Length - 1 -and $b[$i] -eq 0) { $i++ }; $v = New-Object System.Collections.Generic.List[byte]; if ($b[$i] -ge 0x80) { $v.Add(0) }; $v.AddRange([byte[]]$b[$i..($b.Length - 1)]); return ,(Der 0x02 $v.ToArray()) }
function DerSeq([byte[][]]$parts) { $all = New-Object System.Collections.Generic.List[byte]; foreach ($x in $parts) { $all.AddRange($x) }; return ,(Der 0x30 $all.ToArray()) }
function Pem([string]$label, [byte[]]$der) { $b = [Convert]::ToBase64String($der); $lines = for ($i = 0; $i -lt $b.Length; $i += 64) { $b.Substring($i, [Math]::Min(64, $b.Length - $i)) }; return "-----BEGIN $label-----`n" + ($lines -join "`n") + "`n-----END $label-----`n" }
aws secretsmanager describe-secret --region $rg --secret-id $sn 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { "Key already exists - nothing changed." } else {
  $rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider 2048
  $k = $rsa.ExportParameters($true)
  $privDer = DerSeq @((DerInt @(0)), (DerInt $k.Modulus), (DerInt $k.Exponent), (DerInt $k.D), (DerInt $k.P), (DerInt $k.Q), (DerInt $k.DP), (DerInt $k.DQ), (DerInt $k.InverseQ))
  $rsaPub = DerSeq @((DerInt $k.Modulus), (DerInt $k.Exponent))
  $bits = New-Object System.Collections.Generic.List[byte]; $bits.Add(0); $bits.AddRange($rsaPub)
  $algo = [byte[]]@(0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x01, 0x05, 0x00)
  $pubDer = DerSeq @($algo, (Der 0x03 $bits.ToArray()))
  $pk = Join-Path $env:TEMP "pk-$([guid]::NewGuid()).json"; $sk = Join-Path $env:TEMP "sk-$([guid]::NewGuid()).json"
  try {
    @{ CallerReference = "danzstak-media-$(Get-Date -Format yyyyMMddHHmmss)"; Name = "danzstak-media-signing"; EncodedKey = (Pem "PUBLIC KEY" $pubDer); Comment = "DanzStak media CDN signing" } | ConvertTo-Json -Compress | Out-File -Encoding ascii $pk
    $id = aws cloudfront create-public-key --public-key-config "file://$pk" --query PublicKey.Id --output text
    @{ keyPairId = $id; privateKey = (Pem "RSA PRIVATE KEY" $privDer) } | ConvertTo-Json -Compress | Out-File -Encoding ascii $sk
    aws secretsmanager create-secret --region $rg --name $sn --description "DanzStak media CDN signing key (task 38)" --secret-string "file://$sk" --query Name --output text
    "Public key id: $id"
  } finally { Remove-Item $pk, $sk -Force -ErrorAction SilentlyContinue; $rsa.Dispose() }
}
