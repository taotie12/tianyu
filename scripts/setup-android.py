#!/usr/bin/env python3
"""Install Android build dependencies under /workspace, verifying official checksums."""
import hashlib, os, pathlib, subprocess, sys, urllib.request, zipfile
subprocess.run([sys.executable,str(pathlib.Path(__file__).with_name("setup-jdk.py"))],check=True)
root=pathlib.Path('/workspace/android-sdk')
manager=root/'cmdline-tools/latest/bin/sdkmanager'
if not manager.exists():
    archive=pathlib.Path('/tmp/sanzhi-android-tools.zip')
    url='https://dl.google.com/android/repository/commandlinetools-linux-16111833_latest.zip'
    with urllib.request.urlopen(url,timeout=120) as response,archive.open('wb') as out:
        while chunk:=response.read(1024*1024):out.write(chunk)
    if hashlib.sha1(archive.read_bytes()).hexdigest()!='e025545c62a8e64c7559119566a569fb1dec5f60':
        raise SystemExit('Official Android tools checksum mismatch; installation stopped.')
    target=root/'cmdline-tools';target.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(archive) as bundle:bundle.extractall(target)
    (target/'cmdline-tools').rename(target/'latest')
    for file in (target/'latest/bin').iterdir():file.chmod(0o755)
env=os.environ.copy();env['ANDROID_USER_HOME']='/workspace/.cache/android-user';env['ANDROID_HOME']=str(root)
env['JAVA_HOME']='/workspace/toolchains/jdk-21.0.12.1+1'
env['JAVA_TOOL_OPTIONS']=env.get('JAVA_TOOL_OPTIONS','')+' -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts'
pathlib.Path(env['ANDROID_USER_HOME']).mkdir(parents=True,exist_ok=True)
subprocess.run([str(manager),'--sdk_root='+str(root),'--licenses'],input='y\n'*100,text=True,env=env,check=True)
subprocess.run([str(manager),'--sdk_root='+str(root),'platforms;android-36','build-tools;35.0.0','platform-tools'],env=env,check=True)
