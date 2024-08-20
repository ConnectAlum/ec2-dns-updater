import { DescribeInstancesCommand, EC2Client } from "@aws-sdk/client-ec2";
import { Handler } from "aws-lambda";
import { upsertDNSRecord } from "./cloudflare";
type EventType = {
    detail: {
        "instance-id": string,
        state: string
    }
}
export const handler: Handler = async (event, context) => {
    const { detail: { "instance-id": instanceId, state } } = event as EventType;
    if (!instanceId) {
        console.error("Instance ID is missing");
        return;
    }
    if (!state) {
        console.error("State is missing");
        return;
    }
    if (state !== "running") {
        console.log(`Instance ${instanceId} is not in running state (${state})`);
        return;
    }
    console.log(`Instance ${instanceId} is in running state!`);
    // check the tags of the ec2 instance for `Subdomain`
    try {
        const ec2Client = new EC2Client({});
        const command = new DescribeInstancesCommand({ InstanceIds: [instanceId] });
        const response = await ec2Client.send(command);

        if (response.Reservations && response.Reservations.length > 0) {
            const instance = response.Reservations[0].Instances?.[0];
            if (instance) {
                // Extract tags
                const tags = instance.Tags;
                const subdomainTag = tags?.find(tag => tag.Key === "Subdomain");
                const subdomain = subdomainTag?.Value;
                console.log(`Subdomain tag: ${subdomain}`);
                if (!instance.PublicIpAddress) {
                    console.error("Instance does not have a public IP address!");
                    return;
                }
                if (subdomain) {
                    const subDomains = subdomain.split(",");
                    for (const subdomain of subDomains) {
                        console.log(`Upserting DNS record for ${subdomain} -> ${instance.PublicIpAddress}`);
                        await upsertDNSRecord(subdomain.trim(), instance.PublicIpAddress, instanceId);
                    }
                }
            }
        } else {
            console.error(`No instance found with ID ${instanceId}`);
        }
    } catch (error) {
        console.error("Error retrieving instance details:", error);
    }
    return;
};