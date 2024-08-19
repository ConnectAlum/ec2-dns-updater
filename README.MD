# EC2 DNS Updater

This is a AWS lambda function that will update the DNS records for a given subdomain (defined in the `Subdomain` tag on an EC2 server) to point to the public IP address of an EC2 instance.

## Setup
1. Create a AWS lambda function
2. Set the runtime to `Node.js 20.x`
3. Set the env variables `CF_ZONE_ID` and `CLOUDFLARE_API_TOKEN`
4. Create a EventBridge rule that triggers the lambda function on EC2 instance state change (see below)
5. Run `pnpm install` on this repo to install the dependencies
6. run `pnpm build` to build the lambda function
7. Run `pnpm deploy` to deploy the lambda function to AWS (assuming your lambda function is named `DNS_Updater`)


## EventBridge Rule
### CloudFormation template
```json
{
  "AWSTemplateFormatVersion": "2010-09-09",
  "Description": "CloudFormation template for EventBridge RuleDNSUpdater_Instance_Start",
  "Resources": {
    "Rule0a21bc73": {
      "Type": "AWS::Events::Rule",
      "Properties": {
        "Name": "DNSUpdater_Instance_Start",
        "EventPattern": "{\"source\":[\"aws.ec2\"],\"detail-type\":[\"EC2 Instance State-change Notification\"],\"detail\":{\"state\":[\"running\"]}}",
        "State": "ENABLED",
        "EventBusName": "default",
        "Targets": [{
          "Id": "Id0a53661e-f906-481a-a0e5-ddb594a44468",
          "Arn": {
            "Fn::Sub": "arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:DNS_Updater"
          }
        }]
      }
    }
  },
  "Parameters": {}
}
```

### Event pattern
```json
{
  "source": ["aws.ec2"],
  "detail-type": ["EC2 Instance State-change Notification"],
  "detail": {
    "state": ["running"]
  }
}
```