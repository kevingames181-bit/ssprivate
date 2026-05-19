# DATA PROCESSING AGREEMENT (DPA)

**Between SeaScope Alaska (Data Processor) and Customer (Data Controller)**

**Effective Date:** [Date]  
**Last Updated:** February 21, 2026

---

## 1. DEFINITIONS

**1.1 Definitions**

For the purposes of this Data Processing Agreement ("DPA"):

- **"Controller"** means the Customer who determines the purposes and means of processing Personal Data.
- **"Processor"** means SeaScope Alaska, which processes Personal Data on behalf of the Controller.
- **"Personal Data"** means any information relating to an identified or identifiable natural person.
- **"Processing"** means any operation performed on Personal Data, including collection, storage, use, disclosure, or deletion.
- **"Data Subject"** means the individual to whom Personal Data relates.
- **"GDPR"** means the General Data Protection Regulation (EU) 2016/679.
- **"CCPA"** means the California Consumer Privacy Act.
- **"Services"** means the SeaScope Alaska fishery intelligence platform and related services.
- **"Sub-processor"** means any third party engaged by SeaScope Alaska to process Personal Data.

---

## 2. SCOPE AND APPLICABILITY

**2.1 Scope**

This DPA applies to all Processing of Personal Data by SeaScope Alaska on behalf of the Customer in connection with the Services.

**2.2 Data Processing Details**

- **Subject Matter:** Provision of fishery intelligence platform services
- **Duration:** Term of the Service Agreement
- **Nature and Purpose:** Processing necessary to provide analytics, predictions, and reporting services
- **Types of Personal Data:**
  - Account information (name, email, phone)
  - Company/vessel information
  - Location data
  - Usage data and analytics
  - Payment information
  - Communication records
- **Categories of Data Subjects:**
  - Customer employees and authorized users
  - Vessel operators and crew members
  - Fleet managers
  - Government agency personnel

**2.3 Customer Instructions**

SeaScope Alaska shall process Personal Data only on documented instructions from the Customer, including:
- Providing the Services as described in the Service Agreement
- Complying with applicable data protection laws
- Following Customer's reasonable written instructions

---

## 3. PROCESSOR OBLIGATIONS

**3.1 Confidentiality**

SeaScope Alaska shall:
- Ensure that persons authorized to process Personal Data are bound by confidentiality obligations
- Maintain strict confidentiality of all Personal Data
- Not disclose Personal Data to third parties without Customer authorization

**3.2 Security Measures**

SeaScope Alaska implements appropriate technical and organizational measures:

**Technical Measures:**
- AES-256 encryption for data at rest
- TLS 1.3 encryption for data in transit
- Multi-factor authentication (MFA)
- Regular security patches and updates
- Intrusion detection and prevention systems
- Automated backup systems
- Secure API access with rate limiting
- Database encryption and access controls

**Organizational Measures:**
- Security policies and procedures
- Employee security training
- Background checks for personnel
- Access control and authorization procedures
- Incident response plan
- Business continuity and disaster recovery plans
- Regular security audits and assessments
- Vendor security management

**3.3 Sub-processors**

**Current Sub-processors:**

| Sub-processor | Service | Location | Purpose |
|--------------|---------|----------|---------|
| Amazon Web Services (AWS) | Cloud Infrastructure | USA | Hosting and storage |
| Stripe, Inc. | Payment Processing | USA | Payment transactions |
| SendGrid (Twilio) | Email Services | USA | Transactional emails |
| Sentry | Error Monitoring | USA | Application monitoring |
| OpenWeatherMap | Weather Data | UK | Weather information |
| NOAA | Tide Data | USA | Tide information |

**Sub-processor Requirements:**
- SeaScope Alaska shall notify Customer of any intended changes to Sub-processors
- Customer has 30 days to object to new Sub-processors
- All Sub-processors must provide equivalent data protection guarantees
- SeaScope Alaska remains liable for Sub-processor actions

**3.4 Data Subject Rights**

SeaScope Alaska shall assist Customer in responding to Data Subject requests:

- **Right of Access:** Provide access to Personal Data
- **Right to Rectification:** Correct inaccurate Personal Data
- **Right to Erasure:** Delete Personal Data ("right to be forgotten")
- **Right to Restriction:** Limit Processing of Personal Data
- **Right to Data Portability:** Export Personal Data in machine-readable format
- **Right to Object:** Stop Processing for specific purposes
- **Rights Related to Automated Decision-Making:** Provide human review

**Response Time:** Within 10 business days of Customer request

**3.5 Data Breach Notification**

In the event of a Personal Data breach, SeaScope Alaska shall:

1. **Notify Customer within 24 hours** of becoming aware of the breach
2. **Provide detailed information:**
   - Nature of the breach
   - Categories and approximate number of Data Subjects affected
   - Categories and approximate number of Personal Data records affected
   - Likely consequences of the breach
   - Measures taken or proposed to address the breach
3. **Cooperate with Customer** in investigating and remediating the breach
4. **Document all breaches** and make records available to Customer

**3.6 Data Protection Impact Assessment (DPIA)**

SeaScope Alaska shall assist Customer in conducting DPIAs when required, including:
- Providing information about Processing activities
- Describing security measures
- Assessing risks to Data Subjects
- Identifying mitigation measures

**3.7 Audits and Inspections**

Customer has the right to:
- Conduct audits of SeaScope Alaska's Processing activities (maximum once per year)
- Request SOC 2 Type II reports and security certifications
- Inspect security measures and procedures
- Review Sub-processor agreements

**Audit Requirements:**
- 30 days advance written notice
- Reasonable scope and duration
- Non-disruptive to operations
- Confidentiality obligations
- Customer bears audit costs

---

## 4. DATA TRANSFERS

**4.1 International Transfers**

Personal Data may be transferred to and processed in:
- United States (primary data center)
- European Union (backup and CDN)
- Other locations where Sub-processors operate

**4.2 Transfer Mechanisms**

For transfers outside the EEA, SeaScope Alaska relies on:
- **Standard Contractual Clauses (SCCs)** approved by the European Commission
- **Adequacy Decisions** where applicable
- **Binding Corporate Rules** for intra-group transfers
- **Customer Consent** where required

**4.3 Additional Safeguards**

- Encryption of data in transit and at rest
- Access controls and authentication
- Regular security assessments
- Contractual obligations with Sub-processors
- Compliance with local data protection laws

---

## 5. DATA RETENTION AND DELETION

**5.1 Retention Periods**

| Data Type | Retention Period | Legal Basis |
|-----------|-----------------|-------------|
| Account Data | Duration of service + 90 days | Contract performance |
| Usage Analytics | 24 months | Legitimate interest |
| Payment Records | 7 years | Legal obligation (tax) |
| Support Tickets | 3 years | Legitimate interest |
| Audit Logs | 12 months | Legal obligation |
| Backup Data | 30 days | Legitimate interest |

**5.2 Data Deletion**

Upon termination or expiry of Services:
- SeaScope Alaska shall delete or return all Personal Data within 30 days
- Customer may request earlier deletion
- Deletion includes all copies, backups, and archives
- Certification of deletion provided upon request

**5.3 Legal Hold**

Data may be retained longer if:
- Required by applicable law
- Subject to legal proceedings
- Necessary for regulatory compliance
- Requested by law enforcement

---

## 6. CUSTOMER OBLIGATIONS

**6.1 Controller Responsibilities**

Customer shall:
- Comply with all applicable data protection laws
- Provide lawful instructions for Processing
- Obtain necessary consents from Data Subjects
- Maintain accurate and up-to-date Personal Data
- Implement appropriate security measures on Customer side
- Notify SeaScope Alaska of any data protection concerns

**6.2 Data Accuracy**

Customer is responsible for:
- Ensuring accuracy of Personal Data provided
- Updating Personal Data as needed
- Correcting inaccurate Personal Data
- Deleting outdated Personal Data

---

## 7. LIABILITY AND INDEMNIFICATION

**7.1 Liability**

- SeaScope Alaska is liable for damages caused by Processing that violates this DPA
- Liability is limited as set forth in the Service Agreement
- SeaScope Alaska is not liable for Customer's failure to comply with data protection laws

**7.2 Indemnification**

SeaScope Alaska shall indemnify Customer against:
- Claims arising from SeaScope Alaska's breach of this DPA
- Regulatory fines resulting from SeaScope Alaska's non-compliance
- Third-party claims related to SeaScope Alaska's Processing

Customer shall indemnify SeaScope Alaska against:
- Claims arising from Customer's unlawful instructions
- Customer's failure to obtain necessary consents
- Customer's breach of data protection laws

---

## 8. TERM AND TERMINATION

**8.1 Term**

This DPA is effective as of the Effective Date and continues for the duration of the Service Agreement.

**8.2 Termination**

This DPA terminates automatically upon termination of the Service Agreement.

**8.3 Survival**

The following provisions survive termination:
- Data deletion obligations (Section 5)
- Confidentiality obligations (Section 3.1)
- Liability and indemnification (Section 7)
- Audit rights for 12 months post-termination

---

## 9. AMENDMENTS

**9.1 Changes to DPA**

SeaScope Alaska may amend this DPA:
- To comply with changes in data protection laws
- To reflect changes in Processing activities
- To update Sub-processor list

**9.2 Notice**

Customer will be notified of material changes:
- 30 days advance notice via email
- Posted on website with effective date
- Customer may object within 30 days

---

## 10. GOVERNING LAW AND JURISDICTION

**10.1 Governing Law**

This DPA is governed by:
- Laws of the State of Delaware, USA
- GDPR for EU Data Subjects
- CCPA for California residents
- Other applicable data protection laws

**10.2 Dispute Resolution**

Disputes shall be resolved through:
1. Good faith negotiations (30 days)
2. Mediation (if negotiations fail)
3. Arbitration or litigation as per Service Agreement

**10.3 Supervisory Authority**

Data Subjects have the right to lodge complaints with:
- **EU:** Relevant Data Protection Authority
- **USA:** Federal Trade Commission (FTC)
- **California:** California Attorney General

---

## 11. CONTACT INFORMATION

**Data Protection Officer:**

SeaScope Alaska  
Attn: Data Protection Officer  
Email: dpo@getseascope.com  
Phone: +1 (555) 123-4567  
Address: [Company Address]

**EU Representative (if applicable):**

[EU Representative Name]  
Email: eu-rep@getseascope.com  
Address: [EU Address]

---

## 12. SIGNATURES

**CUSTOMER (Data Controller):**

Name: ________________________________  
Title: ________________________________  
Company: ________________________________  
Date: ________________________________  
Signature: ________________________________

**SEASCOPE ALASKA (Data Processor):**

Name: ________________________________  
Title: Chief Executive Officer  
Company: SeaScope Alaska  
Date: ________________________________  
Signature: ________________________________

---

## APPENDIX A: TECHNICAL AND ORGANIZATIONAL MEASURES

### A.1 Access Control

**Physical Access Control:**
- Secure data center facilities with 24/7 monitoring
- Biometric access controls
- Visitor logs and escort requirements
- Surveillance cameras

**Logical Access Control:**
- Role-based access control (RBAC)
- Multi-factor authentication (MFA)
- Strong password policies
- Regular access reviews
- Automatic session timeouts
- Principle of least privilege

### A.2 Data Security

**Encryption:**
- AES-256 encryption at rest
- TLS 1.3 encryption in transit
- End-to-end encryption for sensitive data
- Encrypted backups

**Network Security:**
- Firewalls and intrusion detection
- DDoS protection
- Network segmentation
- VPN for remote access
- Regular vulnerability scans

**Application Security:**
- Secure coding practices
- Regular security testing
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF tokens

### A.3 Data Integrity

- Checksums and hash verification
- Database transaction logs
- Version control
- Regular data validation
- Backup integrity checks

### A.4 Availability and Resilience

- 99.9% uptime SLA
- Redundant systems and failover
- Load balancing
- Automated backups (daily)
- Disaster recovery plan
- Business continuity plan
- Regular backup testing

### A.5 Monitoring and Logging

- 24/7 security monitoring
- Centralized log management
- Audit trails for all data access
- Anomaly detection
- Automated alerting
- Log retention (12 months)

### A.6 Incident Response

- Documented incident response plan
- Incident response team
- 24-hour breach notification
- Forensic analysis capabilities
- Post-incident review process

### A.7 Personnel Security

- Background checks for employees
- Confidentiality agreements
- Security awareness training (annual)
- Role-specific security training
- Access revocation upon termination

### A.8 Vendor Management

- Vendor security assessments
- Contractual security requirements
- Regular vendor audits
- Sub-processor due diligence

---

## APPENDIX B: SUB-PROCESSOR LIST

| Sub-processor | Service | Data Processed | Location | Security Certification |
|--------------|---------|----------------|----------|----------------------|
| Amazon Web Services | Infrastructure | All data types | USA, EU | SOC 2, ISO 27001 |
| Stripe | Payments | Payment data | USA | PCI DSS Level 1 |
| SendGrid | Email | Email addresses | USA | SOC 2 |
| Sentry | Monitoring | Error logs | USA | SOC 2 |
| OpenWeatherMap | Weather | Location data | UK | ISO 27001 |
| Datadog | Monitoring | System logs | USA | SOC 2 |

**Last Updated:** February 21, 2026

---

**This Data Processing Agreement is incorporated into and forms part of the Service Agreement between SeaScope Alaska and Customer.**
