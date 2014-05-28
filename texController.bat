
set datetimef=texController_%date:~-4%_%date:~3,2%_%date:~0,2%__%time:~0,2%_%time:~3,2%_%time:~6,2%%.log
echo %datetimef%
node --debug-brk app.js -m MACHINE_TEX -p 6000 -s 8000 -h 192.168.0.201