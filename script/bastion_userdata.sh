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
sudo mkdir -pv /var/www/html/php_sessions
sudo chown root:apache /var/www/html/php_sessions
sudo chmod 770 -R /var/www/html/php_sessions
sudo mount -t efs -o tls ${EFS_ID}:/ /var/www/html
echo "mount  efs end"
sudo yum install httpd -y
sudo yum install jq -y
sudo systemctl start httpd
sudo systemctl enable httpd

##download wordpress
sudo -s
mkdir -p ~/init
cd ~/init
wget https://wordpress.org/wordpress-6.2.zip
unzip wordpress-6.2.zip
mv -vf wordpress/* /var/www/html/
yes | cp -r -f /var/www/html/wp-config-sample.php /var/www/html/wp-config.php
##end##

AVAIL_ZONE=`curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone`
REGION="`echo \"$AVAIL_ZONE\" | sed -e 's:\([0-9][0-9]*\)[a-z]*\$:\\1:'`"
SECRET_NAME=`aws secretsmanager list-secrets    --query "SecretList[?Tags[?Key=='aws:cloudformation:stack-name' && (Value=='CdkTsEc2Stack')]]" --region ${REGION} | jq '.[0].Name' -r`
SECRET_STR=`aws secretsmanager get-secret-value --secret-id ${SECRET_NAME} --region ${REGION} | jq -r '.SecretString'`
DB_HOST=`echo ${SECRET_STR} | jq -sr  '.[0].host'`
DB_USERNAME=`echo ${SECRET_STR} | jq -sr  '.[0].username'`
DB_PASSWORD=`echo ${SECRET_STR} | jq -sr  '.[0].password'`
DB_DBNAME=`echo ${SECRET_STR} | jq -sr  '.[0].dbname'`

sed -i "s/database_name_here/wordpress/" /var/www/html/wp-config.php
sed -i "s/username_here/${DB_USERNAME}/" /var/www/html/wp-config.php
sed -i "s/password_here/${DB_PASSWORD}/" /var/www/html/wp-config.php
sed -i "s/localhost/${DB_HOST}/" /var/www/html/wp-config.php

sudo systemctl restart httpd

echo "successful init wordpress"
### mysql database server ###
#sudo yum install mariadb-server -y
#sudo systemctl start mariadb
#sudo systemctl enable mariadb
#sudo mysql_secure_installation

