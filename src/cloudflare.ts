import Cloudflare from "cloudflare";

const cloudflare = new Cloudflare()

export const upsertDNSRecord = async (subDef: string, ip: string, ec2Id: string) => {
  const zoneIdDef = process.env.CF_ZONE_ID;
  if (!zoneIdDef) {
    console.error("CF_ZONE_ID is not set!");
    return;
  }
  let zoneId = zoneIdDef;
  let sub = subDef;
  if (sub.includes(":") && zoneIdDef.includes(":")) {
    // tag:subdomain -> tag diffrentiates between different domains
    const [tag, subdomain] = sub.split(":");
    if (!tag || !subdomain) {
      console.error("Invalid subdomain format, expected tag:subdomain");
      return;
    }
    // get the corresponding zone id: tag:zoneId,tag2:zoneId2
    const zoneIdMap = zoneIdDef.split(",");
    let found = false;
    for (const entry of zoneIdMap) {
      const [tagEntry, zoneIdEntry] = entry.split(":");
      if (tagEntry === tag) {
        zoneId = zoneIdEntry;
        found = true;
        break;
      }
    }
    if (!found) {
      console.error(`Zone ID not found for tag ${tag}`);
      return;
    }
    sub = subdomain;
  }
  console.log(`Upserting DNS record for ${sub} with IP ${ip} (for zone ${zoneId})`);
  const zone = await cloudflare.zones.get({ zone_id: zoneId });
  if (!zone) {
    console.error("Zone not found");
    return;
  }
  const fqdn = `${sub}.${zone.name}`.toLowerCase();
  let existingRecord: Cloudflare.DNS.Records.Record | undefined = undefined;
  for await (const record of cloudflare.dns.records.list({ zone_id: zoneId, type: "A", name: fqdn })) { // auto paginate until we find the record
    if (record.name.toLowerCase() === fqdn) {
      if (record.type !== "A") {
        console.warn(`Found a record for ${fqdn} but it is not an A record (${record.type}), skipping...`);
        continue;
      }
      existingRecord = record;
      break;
    }
    console.log(`Found record for ${record.name} but it does not match ${fqdn}, skipping...`);
  }
  const dateFormatted = new Date().toISOString();
  const defaultComment = `Auto-configured from AWS. Points to ec2 instance ${ec2Id} (${dateFormatted})`;
  if (existingRecord && existingRecord.id) {
    if (existingRecord.content === ip) {
      console.log(`Record for ${fqdn} already exists and is up to date, skipping...`);
      return;
    }
    console.log(`Record for ${fqdn} already exists, updating...`);
    await cloudflare.dns.records.update(existingRecord.id, {
      zone_id: zoneId,
      content: ip,
      name: fqdn,
      type: "A",
      comment: existingRecord.comment ?? defaultComment,
      proxied: existingRecord.proxied,
      ttl: existingRecord.ttl
    })
  } else {
    console.log(`Record for ${fqdn} does not exist, creating...`);
    await cloudflare.dns.records.create({
      zone_id: zoneId,
      content: ip,
      name: fqdn,
      type: "A",
      comment: defaultComment,
      proxied: true,
      ttl: 1
    })
  }
}