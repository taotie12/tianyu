#!/usr/bin/env python3
"""Install verified Eclipse Temurin JDK 21 in the writable workspace."""
import hashlib,pathlib,tarfile,urllib.request
root=pathlib.Path('/workspace/toolchains');target=root/'jdk-21.0.12.1+1'
if not (target/'bin/javac').exists():
    url='https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz'
    archive=pathlib.Path('/tmp/sanzhi-jdk21.tar.gz')
    expected='ce79869e1307ed8ee1e2baa86a412b1eb5b75d10a01006d788a6f968bcfaee94'
    if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:
        with urllib.request.urlopen(url,timeout=120) as response,archive.open('wb') as out:
            while chunk:=response.read(1024*1024):out.write(chunk)
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:raise SystemExit('Official Temurin SHA-256 mismatch; installation stopped.')
    root.mkdir(parents=True,exist_ok=True)
    with tarfile.open(archive) as bundle:bundle.extractall(root,filter='data')
print('JDK ready:',target)
