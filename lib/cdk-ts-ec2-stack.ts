import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import {Aws, CfnParameter, Duration} from "aws-cdk-lib";
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import {readFileSync} from 'fs';
import {IVpc, SubnetType, Vpc} from "aws-cdk-lib/aws-ec2";
import {ISecurityGroup} from "aws-cdk-lib/aws-ec2/lib/security-group";
import * as rds from "aws-cdk-lib/aws-rds";

export class CdkTsEc2Stack extends cdk.Stack {

  public readonly myVpc: IVpc;
  public readonly webSG: ISecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // const vpcCidr = new CfnParameter(this, 'cidr', {
    //   description: 'The CIDR block for the VPC',
    //   type: 'String',
    //   default: process.env.CIDR,
    //   allowedPattern: '^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/(1[6-9]|2[0-8]))$', // allowed pattern for the parameter
    //   minLength: 7, // minimum length of the parameter
    //   maxLength: 16, // maximum length of the parameter
    // }).valueAsString // get the value of the parameter as string

    const keypairName = new CfnParameter(this, 'keypair', {
      description: 'The SSH Key pairs for the EC2 Instance',
      type: 'String',
      default: process.env.KEYPAIR || "saptest",
      allowedPattern: '^[0-9|a-z|A-Z]*$', // allowed pattern for the parameter
      minLength: 3, // minimum length of the parameter
      maxLength: 16, // maximum length of the parameter
    }).valueAsString // get the value of the parameter as string

    const instanceSize = new cdk.CfnParameter(this, "instanceType", {
      description: 'The Size for the EC2 Instance',
      type: "String",
      default: "t3.small",
      allowedValues: [
        "t3.small",
        "t3.medium",
        "t3.large",
        "t3.xlarge",
        "t3.2xlarge",
        "c6g.medium",
        "c6g.large",
        "c6g.xlarge",
        "c6g.2xlarge",
        "c6g.4xlarge",
        "c6g.8xlarge",
        "m6g.medium",
        "m6g.large",
        "m6g.xlarge",
        "m6g.2xlarge",
        "m6g.4xlarge",
        "m6g.8xlarge"
      ]
    });

    const dbInstanceSize = new cdk.CfnParameter(this, "dbInstanceType", {
      description: 'The EC2 size for the database Node',
      type: "String",
      default: "t3.small",
      allowedValues: [
        "t3.small",
        "t3.medium",
        "t3.large",
        "t3.xlarge",
        "t3.2xlarge",
        "t4g.small",
        "t4g.medium",
        "t4g.large",
        "t4g.xlarge",
        "t4g.2xlarge",
        "m6g.large",
        "m6g.xlarge",
        "m6g.2xlarge",
        "m6g.4xlarge",
        "m6g.8xlarge",
        "r6g.large",
        "r6g.xlarge",
        "r6g.2xlarge",
        "r6g.4xlarge",
        "r6g.8xlarge"
      ]
    });

    const autoScalingMinCapacity = new CfnParameter(this, 'autoScalingMinCapacity', {
      description: 'Auto Scaling Min Capacity',
      type: 'Number',
      minValue: 1, // minimum value of the parameter
      maxValue: 2, // maximum value of the parameter
      default: 1,
    }).valueAsNumber // get the value of the parameter as number

    const autoScalingMaxCapacity = new CfnParameter(this, 'autoScalingMaxCapacity', {
      description: 'Auto Scaling Max Capacity',
      type: 'Number',
      minValue: 2, // minimum value of the parameter
      maxValue: 8, // maximum value of the parameter
      default: 5,
    }).valueAsNumber // get the value of the parameter as number

    this.templateOptions.metadata = {
      'AWS::CloudFormation::Interface': {
        ParameterGroups: [
          {
            Label: {default: 'EC2 Configuration'},
            Parameters: ['keypair','instanceType']
          },
          {
            Label: {default: 'Database Configuration'},
            Parameters: ['dbInstanceType']
          },
          {
            Label: {default: 'Auto Scaling Group Configuration'},
            Parameters: ['autoScalingMinCapacity','autoScalingMaxCapacity']
          },
          {
            Label: {default: 'System AMI Configuration, Don\'t modify.\n'},
            Parameters: []
          }
        ]
      }
    }


    //
    // console.log('application Port 👉', applicationPort)
    //
    // // parameter of type CommaDelimitedList
    // const applicationDomains = new CfnParameter(this, 'domains', {
    //   description: 'parameter of type CommaDelimitedList',
    //   type: 'CommaDelimitedList',
    // }).valueAsList // get the value of the parameter as list of strings
    const cidrStr = process.env.CIDR || "10.0.0.0/16";
    // console.info("cidr: "+ cidrStr);
    const vpc = new ec2.Vpc(this, 'cdk-web-hosting-vpc', {
      ipAddresses: ec2.IpAddresses.cidr(cidrStr),
      //availabilityZones: ['us-east-2a', 'us-east-2b', 'us-east-2c'],
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [{
        name: 'public',
        cidrMask: 24,
        subnetType: ec2.SubnetType.PUBLIC,
      },
      {
          name: 'private',
          cidrMask: 24,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      {
        name: 'database',
        cidrMask: 24,
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }]
    });

    this.myVpc = vpc;

    const bastionSecurityGroup = new ec2.SecurityGroup(this, 'dev-security-group', {
      vpc,
      allowAllOutbound: true,
    });

    bastionSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22), 'allow ssh access',
    );

    bastionSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80), 'allow web access',
    );
    bastionSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443), 'allow ssl access',
    );

    const serverRole = new iam.Role(this, 'bastion-role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        //iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite')
      ]
    });

    const specificAmi = ec2.MachineImage.genericLinux({
      'us-east-2': 'ami-01b64707e9d9b7350',
    });

    // Use Latest Amazon Linux Image - CPU Type X64
    const ami = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      edition: ec2.AmazonLinuxEdition.STANDARD,
      kernel: ec2.AmazonLinuxKernel.KERNEL5_X,
      cpuType: ec2.AmazonLinuxCpuType.X86_64
    });

    // amzn2-ami-hvm-2.0.20230404.0-x86_64-gp2
    // const specificAmi = new ec2.LookupMachineImage({
    //   name: 'amzn2-ami-hvm-2.0.20230404.0-x86_64-gp2',
    //   owners: ['aws']
    // });

    // create EFS
    const fileSystem = new efs.FileSystem(this, 'ShareEfsFileSystem', {
      vpc: vpc,
      encrypted: true,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_30_DAYS,
      outOfInfrequentAccessPolicy: efs.OutOfInfrequentAccessPolicy.AFTER_1_ACCESS,
      performanceMode: efs.PerformanceMode.MAX_IO,
      throughputMode: efs.ThroughputMode.BURSTING
    });
    // since private subnet,so allow from allowFromAnyIpv4
    //fileSystem.connections.allowFromAnyIpv4(ec2.Port.tcpRange(2048,2049));
    fileSystem.connections.allowDefaultPortFromAnyIpv4();
    // create EFS end

    const bastion = new ec2.Instance(this, 'bastion', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      role: serverRole,
      securityGroup: bastionSecurityGroup,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ami,
      // keyName: process.env.KEY_PAIR_NAME,
      keyName: keypairName,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          mappingEnabled: true,
          volume: ec2.BlockDeviceVolume.ebs(20, {
            deleteOnTermination: true,
            encrypted: true,
            volumeType: ec2.EbsDeviceVolumeType.GP3
          })
        }
      ]
    });
    const userDataScript = readFileSync('./script/bastion_userdata.sh', 'utf8')
        .replace('fs-xxxxxxxxxx',fileSystem.fileSystemId)
        .replace('CdkTsEc2Stack',Aws.STACK_NAME);
    // 👇 add user data to the EC2 instance
    bastion.addUserData(userDataScript);

    fileSystem.connections.allowDefaultPortFrom(bastion);

    // initALB
    const albSecurityGroup = new ec2.SecurityGroup(this, 'alb-security-group', {
      vpc,
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(80), 'allow web access',
    );

    const alb = new elbv2.ApplicationLoadBalancer(this, 'alb', {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
    });

    // Create a CloudFront distribution with the ALB as its origin
    const distribution = new cloudfront.Distribution(this, 'CloudfrontDistribution', {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(alb,{
          connectionAttempts: 3,
          connectionTimeout: Duration.seconds(5),
          readTimeout: Duration.seconds(45),
          keepaliveTimeout: Duration.seconds(45),
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
        cachePolicy:cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022,
      },
    });

    const httpsListener = alb.addListener('HttpsListener', {
      port: 80,
      open: true,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    const workerUserData = ec2.UserData.forLinux();
    const workerUserDataScript = readFileSync('./script/init_nginx.sh', 'utf8')
        .replace('fs-xxxxxxxxxx',fileSystem.fileSystemId);
    workerUserData.addCommands(workerUserDataScript);

    const workerNodeSecurityGroup = new ec2.SecurityGroup(this, 'workerSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });
    workerNodeSecurityGroup.addIngressRule(
        ec2.Peer.securityGroupId(bastionSecurityGroup.securityGroupId),
        ec2.Port.tcp(22), 'allow ssh access',
    );
    workerNodeSecurityGroup.addIngressRule(
        ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId),
        ec2.Port.tcp(80), 'allow web access',
    );

    this.webSG = workerNodeSecurityGroup;

    const asg = new autoscaling.AutoScalingGroup(this, 'WorkerNodeASG', {
      vpc,
      instanceType: new ec2.InstanceType(instanceSize.valueAsString),
      machineImage: ami,
      userData: workerUserData,
      keyName: keypairName,
      minCapacity: autoScalingMinCapacity,
      maxCapacity: autoScalingMaxCapacity,
      securityGroup: workerNodeSecurityGroup,
      vpcSubnets: vpc.selectSubnets({
        subnetType: SubnetType.PRIVATE_WITH_EGRESS
      }),
      /// stickinessCookieDuration: Duration.minutes(120),
    });

    httpsListener.addTargets('defaultTarget', {
      port: 80,
      targets: [asg],
      healthCheck: {
        path: '/',
        unhealthyThresholdCount: 2,
        healthyThresholdCount: 3,
        interval: cdk.Duration.seconds(30),
        healthyHttpCodes: '200,302',
      },
    });

    asg.scaleOnRequestCount('LimitRPSPerMinutes', {
      targetRequestsPerMinute: 600,
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });
    // Add an inbound rule to allow traffic from a specific IP address
    dbSecurityGroup.addIngressRule(
        ec2.Peer.securityGroupId(workerNodeSecurityGroup.securityGroupId),
        ec2.Port.tcp(3306),
        'Allow traffic from worker node security group'
    );

    const dbCluster = new rds.DatabaseCluster(this, 'WordPressDatabase', {
      engine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_2_11_2 }),
      credentials: rds.Credentials.fromGeneratedSecret('admin'),
      instanceProps: {
        // optional , defaults to t3.small
        // instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.SMALL),
        instanceType: new ec2.InstanceType(dbInstanceSize.valueAsString),
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        vpc,
        securityGroups: [dbSecurityGroup],
      },
      defaultDatabaseName: 'wordpress',

    });
    bastion.node.addDependency(dbCluster);
    bastion.node.addDependency(fileSystem);
    asg.node.addDependency(bastion);

    new cdk.CfnOutput(this, 'bastion_Pub_IP', {
      value: `${bastion.instancePublicIp}`,
      description: "public ip of the ec2 instance"
    });

    // new cdk.CfnOutput(this, 'Alb_Url', {
    //   value: `${alb.loadBalancerDnsName}`+"/index.php",
    //   description: "Dns name of alb"
    // });

    new cdk.CfnOutput(this, 'CloudFront_Url', {
      value: distribution.domainName+"/index.php",
    });

    // new cdk.CfnOutput(this, 'Database_Host', {
    //   value: `${dbCluster.clusterEndpoint.hostname}`,
    //   description: "Database endpoint",
    //   exportName: "dbEndpoint"
    // });
  }
}
