const resJson = {
  "request_id": "66169c66-aedf-40ca-83b4-8bbf984943a1",
  "data": {
    "domains": [
      {
        "domain": {
          "fulldomain": "on-reply.online",
          "subdomain": "",
          "domain": "on-reply",
          "suffix": "online",
          "dkim_expected": "dkim.smtp2go.net",
          "dkim_selector": "s571172",
          "dkim_verified": true,
          "dkim_status": "Target: dkim.smtp2go.net",
          "dkim_value": "dkim.smtp2go.net",
          "rpath_expected": "return.smtp2go.net",
          "rpath_selector": "em571172",
          "rpath_verified": true,
          "rpath_status": "Target: return.smtp2go.net",
          "rpath_value": "return.smtp2go.net",
          "registrar": "Cloudflare",
          "setup_link": ""
        },
        "trackers": [
          {
            "fulldomain": "link.on-reply.online",
            "subdomain": "link",
            "domain": "on-reply",
            "suffix": "online",
            "cname_expected": "track.smtp2go.net",
            "cname_verified": true,
            "cname_status": "Target: track.smtp2go.net",
            "cname_value": "track.smtp2go.net",
            "enabled": true,
            "ssl_status": "issued: 1781506040"
          }
        ],
        "subaccount_access": {
          "subaccounts": [],
          "future_subaccounts": false
        }
      }
    ]
  }
};

const domainsList = (resJson.data && resJson.data.domains) || resJson.domains || [];
console.log('domainsList length:', domainsList.length);

for (const item of domainsList) {
  let domainName = '';
  if (item && typeof item === 'string') {
    domainName = item;
  } else if (item && typeof item === 'object') {
    domainName = item.domain || item.domain_name || item.domainName || '';
  }

  console.log('After initial extraction:', typeof domainName, domainName);

  if (typeof domainName !== 'string') {
    domainName = String(domainName);
  }

  domainName = domainName.trim();
  console.log('After stringify/trim:', domainName);
  if (!domainName || !domainName.includes('.')) {
    console.log('Skipped!');
    continue;
  }
  console.log('Passed check, would create:', domainName);
}
