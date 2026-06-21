# Security

Report vulnerabilities privately to the repository maintainer. Do not publish exploitable details in an issue.

Before exposing an installation to the Internet:

- replace all secrets and credentials in `.env`;
- use an HTTPS reverse proxy;
- restrict PostgreSQL and Redis to the internal network;
- configure the firewall for LiveKit;
- make regular backups and updates;
- do not keep `admin/admin` after the first login.

This project has not been independently audited and should not be considered suitable for high-risk environments without additional security review.
