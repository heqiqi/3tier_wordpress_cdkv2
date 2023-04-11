#!/bin/bash
sudo yum update -y
#sudo yum install nginx
#amazon-linux-extras enable nginx1
#yum clean metadata
#yum install nginx -y
#systemctl start  nginx.service

sudo amazon-linux-extras install epel -y
sudo yum install -y byobu
sudo yum install -y amazon-efs-utils
sudo yum install -y mysql
EFS_ID=fs-xxxxxxxxxx
echo "mount  efs id: ${EFS_ID}"
sudo mkdir -pv /var/www/html
sudo mount -t efs -o tls ${EFS_ID}:/ /var/www/html
echo "mount  efs end"
sudo yum install httpd -y
sudo yum install jq -y
sudo systemctl start httpd
sudo systemctl enable httpd
#sudo firewall-cmd --permanent --add-service=http
#sudo firewall-cmd --reload

###php 8.1 begin####
#amazon-linux-extras enable  php8.1
#yum install php-cli php-pdo php-fpm php-json php-mysqlnd -y
###end####

sudo amazon-linux-extras enable php8.2 -y
#sudo yum install php php-{pear,cgi,common,curl,mbstring,gd,mysqlnd,gettext,bcmath,json,xml,fpm,intl,zip,imap} -y
sudo yum clean metadata
sudo yum install php-cli php-pdo php-fpm php-json php-mysqlnd -y
sudo yum install php php-{pear,cgi,common,curl,mbstring,gd,mysqlnd,gettext,bcmath,json,xml,fpm,intl,zip,imap} -y
sudo mkdir -pv /var/www/html/php

sed -i "s/\/var\/lib\/php\/session/\/var\/www\/html\/php_sessions/"  /etc/php-fpm.d/www.conf

sudo cat <<EOF > /var/www/html/php/index.php
<?php
  phpinfo();
EOF

sudo systemctl restart httpd
### mysql database server ###
#sudo yum install mariadb-server -y
#sudo systemctl start mariadb
#sudo systemctl enable mariadb
#sudo mysql_secure_installation

