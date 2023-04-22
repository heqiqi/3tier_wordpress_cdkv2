#!/usr/bin/env bash
set -ex
echo "build template"
cdk synth --path-metadata false --version-reporting false
jq '.Parameters.keypair.Type = "AWS::EC2::KeyPair::KeyName"' cdk.out/CdkTsEc2Stack.template.json  | tee ./temp.json 
mv -v ./temp.json cdk.out/CdkTsEc2Stack.template.json  
