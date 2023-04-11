import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import {IVpc} from "aws-cdk-lib/aws-ec2";
import {ISecurityGroup} from "aws-cdk-lib/aws-ec2/lib/security-group";

export interface CustomerVpcProps extends cdk.StackProps {
    userVpc: IVpc,
    webSg: ISecurityGroup
}

