import * as cdk from 'aws-cdk-lib';
import {
    Stack,
    StackProps,
    CfnOutput,
    Tags,
    App,
    Fn,
    Duration,
    RemovalPolicy,
} from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { CustomerVpcProps } from './CustomerVpcProps';



export class CdkRdsStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: CustomerVpcProps) {
        super(scope, id, props);
        const vpc = props.userVpc;
        // Create a security group for the RDS cluster
        const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
            vpc,
            allowAllOutbound: true,
        });
        // Add an inbound rule to allow traffic from a specific IP address
        dbSecurityGroup.addIngressRule(
            ec2.Peer.securityGroupId(props.webSg.securityGroupId),
            ec2.Port.tcp(3306),
            'Allow traffic from my IP address'
        );

        const cluster = new rds.DatabaseCluster(this, 'WordPressDatabase', {
            engine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_2_10_3 }),
            credentials: rds.Credentials.fromGeneratedSecret('admin'),
            instanceProps: {
                // optional , defaults to t3.small
                instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.SMALL),
                vpcSubnets: {
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                },
                vpc,
                securityGroups: [dbSecurityGroup],
            },
            defaultDatabaseName: 'wordpress',

        });


    }
}


