#!/bin/env bash
echo "installing https for wordpress"
sed -i "20i \$_SERVER[\'HTTPS\'] = \'on\';\ndefine(\'FORCE_SSL_LOGIN\', true);\ndefine(\'FORCE_SSL_ADMIN\', true);" /var/www/html/wp-config.php
sed -i "9i add_filter(\'script_loader_src\', \'agnostic_script_loader_src\', 20,2); function agnostic_script_loader_src(\$src, \$handle)\n{return preg_replace(\'\/^(http|https):\/', \'\', \$src);}"  /var/www/html/wp-includes/functions.php
sed -i "11i add_filter(\'style_loader_src\', \'agnostic_style_loader_src\', 20,2); function agnostic_style_loader_src(\$src, \$handle)\n{ return preg_replace(\'\/^(http|https):\/', \'\', \$src); }"  /var/www/html/wp-includes/functions.php
echo "installing https for wordpress end"

echo "installing plugin for wordpress"
for x in `ls | grep -v install`; do mv $x /var/www/html/wp-content/plugins/  ;done
echo "installing plugin for wordpress end"
