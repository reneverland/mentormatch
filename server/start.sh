#!/bin/bash
cd /www/wwwroot/intendCoding || exit 1
exec /usr/bin/node /www/wwwroot/intendCoding/server/index.js
