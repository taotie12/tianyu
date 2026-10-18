#!/usr/bin/env python3
"""Build the development APK without writing caches or credentials into the repository."""
import os, pathlib, shutil, subprocess, urllib.parse
repo=pathlib.Path(__file__).resolve().parents[1]
sdk=pathlib.Path(os.environ.get('ANDROID_HOME','/workspace/android-sdk'))
if not (sdk/'platforms/android-36/android.jar').exists():raise SystemExit('Run python scripts/setup-android.py first (JDK 21 required).')
env=os.environ.copy();env.update(GRADLE_USER_HOME='/workspace/.cache/gradle',ANDROID_HOME=str(sdk),ANDROID_USER_HOME='/workspace/.cache/android-user',npm_config_cache='/workspace/.cache/npm')
jdk=next(iter(sorted(pathlib.Path('/workspace/toolchains').glob('jdk-21*'))),None)
if jdk and (jdk/'bin/javac').exists():
    env['JAVA_HOME']=str(jdk);env['PATH']=str(jdk/'bin')+os.pathsep+env['PATH']
if pathlib.Path('/etc/ssl/certs/java/cacerts').exists():
    env['JAVA_TOOL_OPTIONS']=env.get('JAVA_TOOL_OPTIONS','')+' -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts'
cache=pathlib.Path(env['GRADLE_USER_HOME']);cache.mkdir(parents=True,exist_ok=True)
proxy=urllib.parse.urlsplit(env.get('HTTPS_PROXY',env.get('https_proxy','')))
properties=cache/'gradle.properties'
text=properties.read_text() if properties.exists() else ''
keys=('systemProp.https.proxyHost=','systemProp.https.proxyPort=','systemProp.http.proxyHost=','systemProp.http.proxyPort=')
text='\n'.join(line for line in text.splitlines() if not line.startswith(keys))+'\n'
if proxy.hostname:
    if proxy.username or proxy.password:raise SystemExit('Authenticated Java proxy requires supported platform configuration; no credentials will be copied.')
    for protocol in ('https','http'):text+=f'systemProp.{protocol}.proxyHost={proxy.hostname}\nsystemProp.{protocol}.proxyPort={proxy.port or 80}\n'
properties.write_text(text)
(repo/'android/local.properties').write_text('sdk.dir='+str(sdk)+'\n')
for command in (['npm','run','build'],['npx','--no-install','cap','sync','android'],[str(repo/'android/gradlew'),'-p','android',':app:assembleDebug','--no-daemon','--max-workers=4','-Duser.home=/workspace/.cache/java']):
    subprocess.run(command,cwd=repo,env=env,check=True)
release=repo/'releases';release.mkdir(exist_ok=True)
shutil.copy2(repo/'android/app/build/outputs/apk/debug/app-debug.apk',release/'值日-倒班日历-v1.6.apk')
print('APK saved:',release/'值日-倒班日历-v1.6.apk')
