import subprocess,time,runpy
server=subprocess.Popen(['node','node_modules/vite/bin/vite.js','preview','--strictPort','--host','localhost','--port','4278'],cwd='apps/web',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(2)
 if server.poll() is not None: raise RuntimeError("Preview server failed to start on its strict port")
 runpy.run_path('tests/browser/story-auth-preview.py',run_name='__main__')
finally:
 server.terminate();server.wait(timeout=10)
