import os, signal
me = os.getpid(); n = 0
for pid in filter(str.isdigit, os.listdir('/proc')):
    if int(pid) == me: continue
    try: cmd = open(f'/proc/{pid}/cmdline','rb').read().replace(b'\0', b' ').decode()
    except Exception: continue
    if ('next-server' in cmd or 'fake/server.js' in cmd or 'next start' in cmd) and 'killtest' not in cmd:
        try: os.kill(int(pid), signal.SIGTERM); n += 1
        except Exception: pass
print('stopped', n, 'test processes')
