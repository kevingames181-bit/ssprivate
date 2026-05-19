# SERVICE LEVEL AGREEMENT (SLA)

**SeaScope Alaska - Enterprise Fishery Intelligence Platform**

**Effective Date:** [Date]  
**Last Updated:** February 21, 2026  
**Version:** 1.0

---

## 1. AGREEMENT OVERVIEW

This Service Level Agreement ("SLA") describes the service levels that SeaScope Alaska ("Provider") will provide to Customer for the SeaScope Alaska fishery intelligence platform ("Services").

**1.1 Parties**

- **Provider:** SeaScope Alaska
- **Customer:** [Customer Name]
- **Service:** SeaScope Alaska Platform

**1.2 Agreement Term**

This SLA is effective for the duration of the Service Agreement and will be reviewed annually.

---

## 2. SERVICE AVAILABILITY

**2.1 Uptime Commitment**

| Tier | Monthly Uptime | Downtime/Month | Annual Uptime |
|------|---------------|----------------|---------------|
| Individual | 99.5% | 3.6 hours | 99.5% |
| Fleet | 99.9% | 43 minutes | 99.9% |
| Government | 99.95% | 21 minutes | 99.95% |

**2.2 Uptime Calculation**

```
Uptime % = (Total Minutes - Downtime Minutes) / Total Minutes × 100
```

**2.3 Scheduled Maintenance**

- **Frequency:** Monthly maintenance windows
- **Duration:** Maximum 2 hours
- **Schedule:** Sundays 2:00 AM - 4:00 AM PST
- **Notice:** 7 days advance notice via email and status page
- **Exclusion:** Scheduled maintenance does not count toward downtime

**2.4 Emergency Maintenance**

- **Notice:** Minimum 1 hour advance notice when possible
- **Duration:** As short as reasonably possible
- **Communication:** Real-time updates via status page and email

**2.5 Excluded Downtime**

The following do not count toward downtime:
- Scheduled maintenance (with proper notice)
- Customer's internet connectivity issues
- Customer's equipment or software failures
- Force majeure events (natural disasters, war, terrorism)
- DDoS attacks or other malicious activities
- Customer-requested changes or testing
- Issues caused by Customer's misuse of Services

---

## 3. PERFORMANCE METRICS

**3.1 Response Time**

| Metric | Individual | Fleet | Government |
|--------|-----------|-------|------------|
| Page Load Time | < 3 seconds | < 2 seconds | < 1.5 seconds |
| API Response Time | < 500ms | < 300ms | < 200ms |
| Data Refresh Rate | 15 minutes | 10 minutes | 5 minutes |
| Map Rendering | < 2 seconds | < 1.5 seconds | < 1 second |

**3.2 Data Accuracy**

- **Weather Data:** 95% accuracy (verified against NOAA)
- **Tide Predictions:** 98% accuracy (NOAA certified)
- **Catch Forecasts:** 80%+ accuracy (7-day predictions)
- **Historical Data:** 99.9% accuracy

**3.3 System Capacity**

| Metric | Limit | Notes |
|--------|-------|-------|
| Concurrent Users | 10,000+ | Auto-scaling enabled |
| API Calls/Day | Tier-based | See Section 4 |
| Data Storage | Unlimited | Per user account |
| File Upload Size | 100 MB | Per file |
| Batch Processing | 10,000 records | Per batch |

---

## 4. API RATE LIMITS

**4.1 Rate Limits by Tier**

| Tier | Requests/Minute | Requests/Hour | Requests/Day |
|------|----------------|---------------|--------------|
| Individual | 60 | 1,000 | 10,000 |
| Fleet | 300 | 10,000 | 100,000 |
| Government | 1,000 | 50,000 | Unlimited |

**4.2 Rate Limit Handling**

- **HTTP Status:** 429 Too Many Requests
- **Retry-After Header:** Seconds until reset
- **Burst Allowance:** 2x rate for 10 seconds
- **Upgrade Option:** Contact sales for higher limits

---

## 5. SUPPORT SERVICES

**5.1 Support Channels**

| Channel | Individual | Fleet | Government |
|---------|-----------|-------|------------|
| Email | ✓ | ✓ | ✓ |
| Phone | - | ✓ | ✓ |
| Live Chat | - | ✓ | ✓ |
| Dedicated Account Manager | - | - | ✓ |
| On-site Support | - | - | ✓ (optional) |

**5.2 Support Hours**

| Tier | Hours | Days |
|------|-------|------|
| Individual | 9 AM - 5 PM PST | Monday - Friday |
| Fleet | 6 AM - 10 PM PST | Monday - Sunday |
| Government | 24/7 | All days |

**5.3 Response Times**

**Individual Tier:**

| Priority | First Response | Resolution Target |
|----------|---------------|-------------------|
| Critical | 24 hours | 72 hours |
| High | 48 hours | 5 business days |
| Medium | 72 hours | 10 business days |
| Low | 5 business days | 15 business days |

**Fleet Tier:**

| Priority | First Response | Resolution Target |
|----------|---------------|-------------------|
| Critical | 4 hours | 24 hours |
| High | 8 hours | 48 hours |
| Medium | 24 hours | 5 business days |
| Low | 48 hours | 10 business days |

**Government Tier:**

| Priority | First Response | Resolution Target |
|----------|---------------|-------------------|
| Critical | 1 hour | 4 hours |
| High | 2 hours | 8 hours |
| Medium | 4 hours | 24 hours |
| Low | 8 hours | 48 hours |

**5.4 Priority Definitions**

**Critical (P1):**
- Complete service outage
- Data loss or corruption
- Security breach
- Payment processing failure

**High (P2):**
- Major feature unavailable
- Significant performance degradation
- Multiple users affected
- Workaround not available

**Medium (P3):**
- Minor feature issue
- Single user affected
- Workaround available
- Non-critical functionality

**Low (P4):**
- Cosmetic issues
- Feature requests
- Documentation questions
- General inquiries

---

## 6. DATA MANAGEMENT

**6.1 Backup Schedule**

| Backup Type | Frequency | Retention | Location |
|-------------|-----------|-----------|----------|
| Full Backup | Daily | 30 days | Multi-region |
| Incremental | Hourly | 7 days | Primary region |
| Transaction Logs | Real-time | 7 days | Primary region |
| Archive | Monthly | 7 years | Cold storage |

**6.2 Data Recovery**

**Recovery Time Objective (RTO):**
- Individual: 4 hours
- Fleet: 2 hours
- Government: 1 hour

**Recovery Point Objective (RPO):**
- Individual: 24 hours
- Fleet: 4 hours
- Government: 15 minutes

**6.3 Data Retention**

| Data Type | Retention Period |
|-----------|-----------------|
| Account Data | Duration + 90 days |
| Usage Analytics | 24 months |
| Historical Fishery Data | 10 years |
| Weather/Tide Data | 5 years |
| Audit Logs | 12 months |
| Support Tickets | 3 years |

**6.4 Data Export**

- **Format:** CSV, JSON, Excel, PDF
- **Frequency:** On-demand, unlimited
- **API Access:** Available for Fleet and Government tiers
- **Bulk Export:** Available upon request

---

## 7. SECURITY COMMITMENTS

**7.1 Security Standards**

- **Encryption:** AES-256 (at rest), TLS 1.3 (in transit)
- **Authentication:** Multi-factor authentication (MFA) available
- **Access Control:** Role-based access control (RBAC)
- **Compliance:** SOC 2 Type II, ISO 27001 (in progress)
- **Penetration Testing:** Annual third-party testing
- **Vulnerability Scanning:** Weekly automated scans

**7.2 Security Monitoring**

- **24/7 Monitoring:** Security Operations Center (SOC)
- **Intrusion Detection:** Real-time alerts
- **Log Retention:** 12 months
- **Incident Response:** 24-hour breach notification

**7.3 Data Privacy**

- **GDPR Compliant:** EU data protection
- **CCPA Compliant:** California privacy rights
- **Data Processing Agreement:** Available upon request
- **Privacy Shield:** Certified (if applicable)

---

## 8. CHANGE MANAGEMENT

**8.1 Planned Changes**

- **Notice Period:** 30 days for major changes
- **Communication:** Email, status page, in-app notifications
- **Testing:** Staging environment available
- **Rollback Plan:** Available for all changes

**8.2 Emergency Changes**

- **Notice:** As soon as reasonably possible
- **Communication:** Real-time updates
- **Post-Change Review:** Within 48 hours

**8.3 Feature Updates**

- **Frequency:** Monthly release cycle
- **Beta Access:** Available for Fleet and Government tiers
- **Release Notes:** Published with each release
- **Training:** Provided for major features

---

## 9. MONITORING AND REPORTING

**9.1 Status Page**

- **URL:** status.getseascope.com
- **Updates:** Real-time status
- **History:** 90-day incident history
- **Subscriptions:** Email/SMS notifications

**9.2 Performance Reports**

**Individual Tier:**
- Quarterly uptime reports
- Annual performance summary

**Fleet Tier:**
- Monthly uptime reports
- Quarterly performance reviews
- Usage analytics dashboard

**Government Tier:**
- Weekly uptime reports
- Monthly performance reviews
- Real-time monitoring dashboard
- Custom reporting available

**9.3 Metrics Included**

- System uptime percentage
- Average response times
- API call volumes
- Error rates
- Support ticket statistics
- Security incidents (if any)

---

## 10. SERVICE CREDITS

**10.1 Credit Calculation**

If Provider fails to meet the uptime commitment, Customer is eligible for service credits:

**Individual Tier:**

| Monthly Uptime | Service Credit |
|----------------|----------------|
| < 99.5% but ≥ 99.0% | 10% |
| < 99.0% but ≥ 98.0% | 25% |
| < 98.0% | 50% |

**Fleet Tier:**

| Monthly Uptime | Service Credit |
|----------------|----------------|
| < 99.9% but ≥ 99.5% | 10% |
| < 99.5% but ≥ 99.0% | 25% |
| < 99.0% | 50% |

**Government Tier:**

| Monthly Uptime | Service Credit |
|----------------|----------------|
| < 99.95% but ≥ 99.9% | 10% |
| < 99.9% but ≥ 99.5% | 25% |
| < 99.5% | 50% |

**10.2 Credit Limitations**

- Maximum credit: 50% of monthly subscription fee
- Credits applied to future invoices only (no cash refunds)
- Must be claimed within 30 days of incident
- Excludes downtime from Section 2.5

**10.3 Claiming Credits**

1. Submit claim via email to billing@getseascope.com
2. Include dates and times of downtime
3. Provide evidence of impact
4. Credits processed within 30 days

---

## 11. CUSTOMER RESPONSIBILITIES

**11.1 Customer Obligations**

Customer must:
- Maintain accurate account information
- Use Services in accordance with Terms of Service
- Implement reasonable security measures
- Report issues promptly
- Provide necessary access for support
- Maintain compatible systems and browsers

**11.2 Prohibited Activities**

Customer must not:
- Exceed rate limits without authorization
- Attempt to breach security measures
- Use Services for illegal purposes
- Resell Services without authorization
- Reverse engineer the platform

---

## 12. LIMITATIONS AND EXCLUSIONS

**12.1 Service Limitations**

Provider is not responsible for:
- Third-party API availability (weather, tide data)
- Internet connectivity issues
- Customer's hardware or software failures
- Data accuracy from external sources
- Force majeure events

**12.2 Liability Cap**

Total liability under this SLA is limited to:
- Individual: 3 months subscription fees
- Fleet: 6 months subscription fees
- Government: 12 months subscription fees

---

## 13. SLA REVIEW AND UPDATES

**13.1 Review Schedule**

- Annual review of all metrics
- Quarterly performance assessments
- Customer feedback incorporation

**13.2 Amendments**

- 60 days notice for material changes
- Posted on website and emailed to customers
- Customer may terminate if changes are unacceptable

---

## 14. ESCALATION PROCEDURES

**14.1 Support Escalation**

**Level 1:** Support Team  
- Email: support@getseascope.com
- Response: Per tier SLA

**Level 2:** Technical Lead  
- Escalation: After 2 business days
- Email: technical@getseascope.com

**Level 3:** Engineering Manager  
- Escalation: After 5 business days
- Email: engineering@getseascope.com

**Level 4:** Chief Technology Officer  
- Escalation: Critical issues only
- Email: cto@getseascope.com

**14.2 Account Escalation**

**Level 1:** Account Manager (Fleet/Government)  
**Level 2:** Customer Success Director  
**Level 3:** Chief Customer Officer  
**Level 4:** Chief Executive Officer

---

## 15. TERMINATION

**15.1 Termination for Breach**

Customer may terminate if:
- Provider fails to meet SLA for 3 consecutive months
- Critical security breach occurs
- Provider materially breaches agreement

**15.2 Termination Process**

1. Written notice to Provider
2. 30-day cure period
3. Termination effective if not cured
4. Prorated refund for unused services

---

## 16. CONTACT INFORMATION

**General Support:**  
Email: support@getseascope.com  
Phone: +1 (555) 123-4567  
Hours: Per tier schedule

**Emergency Support (Government Tier):**  
Phone: +1 (555) 123-4568  
Available: 24/7

**Account Management:**  
Email: accounts@getseascope.com  
Phone: +1 (555) 123-4569

**Status Page:**  
https://status.getseascope.com

**Documentation:**  
https://docs.getseascope.com

---

## 17. ACCEPTANCE

By using the Services, Customer acknowledges and agrees to this SLA.

**CUSTOMER:**

Name: ________________________________  
Title: ________________________________  
Company: ________________________________  
Date: ________________________________  
Signature: ________________________________

**SEASCOPE ALASKA:**

Name: ________________________________  
Title: Chief Executive Officer  
Company: SeaScope Alaska  
Date: ________________________________  
Signature: ________________________________

---

## APPENDIX A: INCIDENT SEVERITY MATRIX

| Severity | Impact | Examples | Response Time |
|----------|--------|----------|---------------|
| P1 - Critical | Complete outage | Site down, data loss, security breach | 1-24 hours |
| P2 - High | Major degradation | Key feature broken, multiple users affected | 2-48 hours |
| P3 - Medium | Minor impact | Single feature issue, workaround available | 4-72 hours |
| P4 - Low | Minimal impact | Cosmetic issues, feature requests | 8 hours - 5 days |

---

## APPENDIX B: MAINTENANCE SCHEDULE

**Regular Maintenance:**
- **Day:** Sunday
- **Time:** 2:00 AM - 4:00 AM PST
- **Frequency:** Monthly (first Sunday)
- **Duration:** Maximum 2 hours
- **Notice:** 7 days advance

**Emergency Maintenance:**
- **Notice:** 1 hour minimum (when possible)
- **Communication:** Email + Status Page
- **Duration:** As short as possible

---

**This Service Level Agreement is incorporated into and forms part of the Service Agreement between SeaScope Alaska and Customer.**

**Last Updated:** February 21, 2026  
**Version:** 1.0
