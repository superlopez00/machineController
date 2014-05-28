set datetimef=texController_PODO_%date:~-4%_%date:~3,2%_%date:~0,2%__%time:~0,2%_%time:~3,2%_%time:~6,2%%.log
echo %datetimef%
node app.js --texHost 192.168.0.200 --webPort 8005 --name PODO  > %datetimef% 2>&1
