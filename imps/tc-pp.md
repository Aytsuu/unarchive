# Unarchive — Terms & Conditions and Privacy Policy Plan

## 1. Overview

Implement Terms & Conditions and a Privacy Policy for Unarchive, an online platform where students and graduates preserve, showcase, discover, and cite academic capstone projects.

The implementation must support:
- Transparent publishing responsibilities.
- Intellectual property and contributor attribution.
- Personal information protection.
- Project-specific publishing confirmations.
- Recording and verification of policy acceptance.
- Content reporting, correction, and removal requests.

The existing "Before you publish" consent section is already implemented and should be preserved.

This phase focuses on integrating legal policies with the existing publishing workflow rather than redesigning the consent interface.

---

## 2. Existing Publishing Consent UI

The following section already exists:

### Before you publish

Your project will be publicly accessible and may be discovered, shared, and cited by others.

- [ ] I confirm that I have the necessary rights and permissions to publish this project and its materials.
- [ ] I confirm that the information is accurate and that I am authorized to publicly share the contributor details provided.

### Implementation Requirements

- Preserve the existing wording and UI.
- Both checkboxes must remain unchecked by default.
- Both checkboxes must be required before publication.
- Validate confirmations on both frontend and backend.
- Do not treat checked boxes as proof that every contributor personally consented.
- Record both confirmations against the specific project being published.
- Reset the confirmations when starting a new publication submission.
- Ensure the Terms & Conditions and Privacy Policy are accessible from this section.

Suggested text below the existing checkboxes:

"By publishing, you agree to Unarchive's Terms & Conditions, including the Project Submission Terms. Learn how we handle personal information in our Privacy Policy."

Both document names should be clickable links.

IMPORTANT:
If the user has not explicitly accepted the applicable Terms & Conditions during signup or another earlier step, obtain and record explicit acceptance before publishing. Do not assume that merely displaying a link establishes agreement.

---

## 3. Terms & Conditions

### Route

/terms

### Purpose

Define the rules and responsibilities governing the use of Unarchive, particularly the publication of academic capstone projects.

### Required Sections

#### 3.1 Acceptance of Terms

Explain that using certain platform features, including publishing projects, requires accepting the Terms & Conditions.

Include:
- Eligibility to use the platform.
- User responsibilities.
- Acceptance of applicable policy versions.
- How changes to the terms will be communicated.

#### 3.2 User Accounts

Describe:
- Account registration and authentication.
- Accuracy of account information.
- Account security responsibilities.
- Restrictions against impersonation.
- Account suspension or termination conditions.

#### 3.3 Project Submission Terms

Define the requirements for submitting and publishing academic capstone projects.

Users must confirm that:
- They have the necessary rights and permissions to publish the submitted materials.
- The content does not violate applicable copyright or intellectual property rights.
- Required permissions from co-authors, contributors, institutions, or other rights holders have been obtained.
- Submitted project information is accurate to the best of their knowledge.
- They are authorized to publicly disclose any contributor information included.

Clarify that passing an academic defense does not automatically establish permission to republish every associated manuscript, dataset, or project asset.

#### 3.4 Intellectual Property and Ownership

Specify that:
- Project creators and applicable rights holders retain ownership of their intellectual property.
- Publishing on Unarchive does not transfer copyright ownership to the platform.
- The publisher grants Unarchive a limited, non-exclusive permission to store, reproduce, display, and make the submitted materials publicly accessible for the platform's stated purposes.
- The permission should cover necessary technical operations such as backups, image optimization, and generating previews.
- The permission must not automatically allow third parties to commercially reuse, modify, or redistribute project materials.
- Any additional licensing, such as an open-source license, must be explicitly selected or documented by the rights holder.

Final licensing language should be legally reviewed.

#### 3.5 Academic Attribution

Require appropriate attribution for:
- Original project authors.
- Team members.
- Contributors.
- Institutions, where relevant.
- Third-party materials included in submissions.

Clarify that:
- Listing an institution does not imply its endorsement.
- Listing an adviser does not necessarily make that person an author.
- Users must not falsely claim authorship or institutional affiliation.

#### 3.6 Public Access and Academic Citations

Explain that:
- Published projects are publicly accessible.
- Projects may be indexed by search engines.
- Visitors may share project URLs and cite publicly available project information.
- Being listed on Unarchive does not constitute peer-reviewed academic publication.
- Citation availability does not grant permission to reproduce protected content beyond applicable law or licenses.
- Unarchive may correct, restrict, or remove content when necessary.

#### 3.7 Prohibited Content

Prohibit:
- Plagiarized or knowingly misattributed works.
- Copyright-infringing submissions.
- Confidential academic or institutional materials shared without authorization.
- Personal information disclosed without an appropriate legal basis.
- Exposed credentials, API keys, or private repositories.
- Malicious files or intentionally harmful content.
- Fraudulent project descriptions or fabricated achievements.

#### 3.8 Moderation and Removal

Reserve the ability to:
- Review submitted projects.
- Reject or request corrections to submissions.
- Temporarily restrict public access.
- Remove content violating platform policies.
- Investigate authorship, privacy, or ownership complaints.
- Suspend accounts for serious or repeated violations.

Provide a process through which creators and rights holders may request review or removal.

#### 3.9 Limitation of Responsibility

Explain the platform's role as a hosting and discovery service.

State the boundaries of Unarchive's responsibility for user-submitted content, subject to applicable law.

Do not claim that terms completely eliminate the platform's legal obligations.

#### 3.10 Contact Information

Provide a working contact channel for:
- Policy questions.
- Copyright complaints.
- Project ownership disputes.
- Content removal requests.

---

## 4. Privacy Policy

### Route

/privacy

### Purpose

Explain how Unarchive collects, processes, stores, uses, discloses, and protects personal information.

The policy should be aligned with applicable Philippine data privacy requirements, including Republic Act No. 10173 and relevant National Privacy Commission guidance.

### Required Sections

#### 4.1 Information Collected

Identify the actual categories collected by the application.

Potential categories include:

Account information:
- Name or username.
- Email address.
- Profile image.
- Authentication provider identifiers.

Project information:
- Project title and description.
- Contributor names.
- Institution and academic program.
- Project completion year.
- Uploaded files and media.
- Repository or demonstration links.

Technical information:
- Necessary session information.
- Security and access logs.
- Relevant device or browser information.

Only describe information actually collected or planned for collection.

#### 4.2 Purposes of Data Processing

Explain that personal information may be processed to:
- Authenticate and manage accounts.
- Publish and attribute capstone projects.
- Display creator profiles.
- Support project discovery and citations.
- Process moderation and removal requests.
- Maintain security and prevent abuse.
- Communicate important service-related updates.

#### 4.3 Lawful Basis for Processing

Identify the appropriate lawful basis for each processing activity.

Do not automatically classify all processing as consent-based.

For processing that relies on consent:
- Explain the specific purpose.
- Obtain consent before the applicable processing.
- Avoid combining unrelated optional purposes.
- Provide a mechanism for withdrawing consent.

Account operations, public project attribution, optional marketing, and other processing activities may require different assessments.

#### 4.4 Publicly Visible Information

Clearly distinguish public data from private account data.

Examples of potentially public information:
- Display name.
- Project author names.
- Academic affiliation.
- Published project descriptions.
- Project images and associated links.

Examples of information that should remain private by default:
- Account email address.
- Authentication identifiers.
- Session information.
- Internal moderation notes.
- Publication confirmation records.

Explain that public information may be discovered, indexed, shared, or cited by third parties.

#### 4.5 Contributor Information

Because projects may have multiple authors, explain how contributor information is handled.

Requirements:
- Publishers must confirm they are authorized to share contributor details.
- Collect only information necessary for attribution.
- Do not automatically expose contributor email addresses.
- Provide a channel for contributors to request correction or removal.
- Establish a lawful basis and appropriate notices for processing contributor information.
- Do not assume the publisher's checkbox replaces consent where consent from another individual is required.

#### 4.6 Third-Party Service Providers

Disclose relevant providers used by Unarchive.

Examples may include:
- Authentication providers.
- Database hosting.
- File storage.
- Application hosting.
- Email delivery.
- Analytics services.

Describe their roles and applicable disclosures, including international transfers where relevant.

Do not list providers that the application does not use.

#### 4.7 Data Retention

Define retention rules for:
- Active account information.
- Published projects.
- Unpublished drafts.
- Deleted projects.
- Submission confirmations.
- Security logs.
- Backup copies.

Do not promise indefinite storage without an established retention and preservation policy.

Explain that certain limited records may be retained where necessary and legally justified.

#### 4.8 Data Security

Describe the security controls actually implemented.

These may include:
- HTTPS.
- Access control.
- Secure authentication.
- Database authorization.
- Private storage for restricted data.
- Appropriate logging and monitoring.
- Backup and recovery procedures.

Avoid guaranteeing absolute security.

#### 4.9 User Privacy Rights

Explain how individuals can request:
- Access to their personal information.
- Correction of inaccurate information.
- Erasure or blocking where applicable.
- Objection to certain processing.
- Withdrawal of consent where consent applies.
- Other rights available under applicable law.

Provide a working request channel.

#### 4.10 Changes to the Privacy Policy

Include:
- The effective date.
- The current policy version.
- How users will be notified of material changes.
- When fresh consent will be requested, if legally required.

#### 4.11 Privacy Contact

Identify the responsible organization or operator and provide a working privacy contact.

Use actual contact details before production release.

---

## 5. Terms Acceptance and Publishing Confirmation

Separate two different actions:

### A. Platform Terms Acceptance

Records that the user accepted the platform's applicable Terms & Conditions.

### B. Project Publishing Confirmation

Records that the user made the two existing declarations for a specific project.

These should not be treated as interchangeable.

### Expected Publishing Workflow

1. User signs in.
2. User creates or edits a capstone project.
3. User navigates to the final publishing step.
4. System displays the existing "Before you publish" section.
5. User can access the Terms & Conditions and Privacy Policy.
6. System verifies acceptance of the current required Terms & Conditions.
7. User checks both publishing confirmations.
8. User submits the project.
9. Backend validates all publishing requirements.
10. Backend records the confirmations and applicable policy versions.
11. Project enters the normal publication or moderation workflow.

If the Terms & Conditions have not yet been accepted, the application must provide a clear acceptance action before proceeding.

The Privacy Policy should be accessible as a notice. Do not use a generic "I agree to the Privacy Policy" checkbox as a substitute for obtaining any specific privacy consent that is actually required.

---

## 6. Database Requirements

The following is a suggested logical schema. Adapt the implementation to the existing database.

### Table: legal_documents

Stores published versions of platform policies.

Fields:
- id
- document_type
- version
- effective_at
- content
- created_at

Possible document types:
- terms
- privacy

### Table: user_policy_acceptances

Stores explicit user acceptance of policy terms.

Fields:
- id
- user_id
- legal_document_id
- document_version
- accepted_at

Optional audit fields:
- acceptance_method
- request_metadata

Privacy policy acknowledgments, if recorded, must be distinguishable from actual consent.

### Table: project_publication_confirmations

Stores confirmations associated with individual project submissions.

Fields:
- id
- project_id
- user_id
- rights_permission_confirmed
- information_and_contributors_confirmed
- terms_version
- confirmation_text_version
- confirmed_at

Requirements:
- Both confirmation fields must be true for publication.
- Save timestamps on the server.
- Associate the record with the authenticated publisher.
- Preserve the exact confirmation wording or its immutable version.
- Do not allow clients to modify confirmation records after submission.
- Record a new confirmation when a new publishing action requires it.

For the MVP, additional personal information such as IP addresses should not be collected solely for audit logging unless there is a justified need and a defined retention policy.

---

## 7. Backend Validation

The backend must not rely exclusively on frontend checkbox states.

Suggested validation:

```typescript
if (!user) {
  throw new Error("Authentication required");
}

if (!hasAcceptedCurrentTerms) {
  throw new Error("Terms acceptance required");
}

if (
  !input.rightsPermissionConfirmed ||
  !input.contributorInformationConfirmed
) {
  throw new Error("Publishing confirmations required");
}

// Validate project ownership and submission permissions.
// Validate project contents and applicable publication rules.
// Save the project submission and confirmation records
// within a database transaction.
```

Additional requirements:
- Validate the authenticated user on the server.
- Prevent users from publishing projects they do not control.
- Do not trust a client-supplied user ID or acceptance timestamp.
- Prevent confirmation records from being fabricated through the API.
- Save the actual accepted policy version rather than trusting a version supplied by the client.
- Ensure project submission and confirmation records remain consistent if a database operation fails.

---

## 8. Frontend Integration

### Public Routes

- `/terms`
- `/privacy`

### Publishing Page

Preserve the current "Before you publish" section.

Add clickable links to:
- Terms & Conditions
- Privacy Policy

Prefer opening legal documents in a new tab or an accessible dialog so that users do not lose their unfinished project submission.

### Footer

Add links to:
- Terms & Conditions
- Privacy Policy
- Contact / Report Content

### User Experience Requirements

- Policies must be readable without signing in.
- Use clear headings and accessible typography.
- Display effective dates and version information.
- Ensure the publish button remains disabled until the two existing confirmations are checked.
- If Terms acceptance is outstanding, require it before publication.
- Display meaningful validation errors.
- Do not preselect publishing confirmations.
- Do not require repeated acceptance of an unchanged Terms version on every visit.
- Record project-specific confirmations each time they are required.

---

## 9. Policy Updates

Support versioned legal documents.

Example:
- Terms v1.0
- Privacy Policy v1.0

When changes occur:

1. Publish a new version.
2. Update its effective date.
3. Preserve previous versions internally.
4. Inform affected users when necessary.
5. Determine whether renewed Terms acceptance or fresh privacy consent is required.
6. Do not silently treat prior acceptance as consent to new, unrelated processing purposes.

Changes should not retroactively grant Unarchive rights that were never authorized.

---

## 10. Content Removal and Privacy Requests

Provide a minimal request-handling process.

Suggested categories:
- Copyright infringement.
- Incorrect authorship.
- Unauthorized contributor information.
- Confidential project materials.
- Privacy or data correction request.
- General policy violation.

Initial MVP requirements:
- A working contact form or support email.
- A request record with status and timestamp.
- Administrator access to review the request.
- Ability to unpublish or restrict project visibility.
- Ability to correct contributor attribution.
- Ability to remove restricted files when justified.
- A process for responding to the requester.

Preserve only the records necessary for the legitimate handling of the request.

---

## 11. Implementation Phases

### Phase 1 — Legal Pages

- [ ] Create `/terms`.
- [ ] Create `/privacy`.
- [ ] Draft the required policy sections.
- [ ] Add effective dates and version numbers.
- [ ] Add footer links.
- [ ] Ensure public accessibility.

### Phase 2 — Publishing Integration

- [ ] Keep the existing two publishing checkboxes.
- [ ] Add Terms & Conditions and Privacy Policy links.
- [ ] Confirm how and when Terms acceptance occurs.
- [ ] Require explicit acceptance if none exists.
- [ ] Validate both confirmations before submission.
- [ ] Add backend validation.

### Phase 3 — Database Integration

- [ ] Add legal document version records.
- [ ] Add user Terms acceptance records.
- [ ] Add project-specific confirmation records.
- [ ] Record server-side timestamps.
- [ ] Save the accepted wording or confirmation version.
- [ ] Protect records against unauthorized modification.

### Phase 4 — Moderation and Privacy

- [ ] Implement a content reporting channel.
- [ ] Support project unpublishing.
- [ ] Support contributor information corrections.
- [ ] Add a basic administrative review workflow.
- [ ] Document retention and deletion procedures.

### Phase 5 — Testing

- [ ] Publishing fails if either confirmation is unchecked.
- [ ] Publishing fails if required Terms acceptance is missing.
- [ ] Backend rejects requests that bypass frontend validation.
- [ ] Valid submissions generate confirmation records.
- [ ] Confirmation records are attached to the correct project and user.
- [ ] Previous policy versions can be identified.
- [ ] Terms and Privacy links work without authentication.
- [ ] Users cannot modify another user's confirmations.
- [ ] Rejected submissions do not produce misleading publication records.
- [ ] Reported projects can be restricted or removed.
- [ ] Contributor correction and removal requests can be processed.

---

## 12. MVP Acceptance Criteria

This implementation is complete when:

1. Terms & Conditions and Privacy Policy are publicly available.
2. Both policies clearly explain Unarchive's actual operations.
3. The existing publishing confirmation UI remains functional.
4. Required Terms acceptance is recorded.
5. Both project-specific confirmations are validated by the backend.
6. Confirmations are associated with the correct user and project.
7. Policy and confirmation versions are traceable.
8. Users can report unauthorized or problematic published content.
9. Administrators can restrict, correct, or remove content.
10. The implementation has been reviewed against applicable legal and privacy requirements.

---

## 13. Scope Restrictions

Do not implement the following during this phase unless already required by the existing application:

- DOI registration.
- Automated copyright verification.
- Blockchain-based ownership records.
- Digital signatures.
- Institutional identity verification.
- AI-powered plagiarism detection.
- Automated legal document generation.
- Complex consent management dashboards.

Focus on legally reviewed policies, transparent publishing requirements, enforceable server-side checks, and basic accountability.

---

## 14. Legal Review Before Production

The initial policy drafts and technical implementation must be reviewed against relevant legal requirements.

In particular, review:
- Philippine Data Privacy Act of 2012.
- National Privacy Commission consent guidelines.
- Philippine Intellectual Property Code.
- Applicable university or institutional publication policies.
- Actual service providers and data handling practices.

Resolve all placeholders, verify the correct lawful basis for personal information processing, and confirm the scope of rights granted by publishers.

This implementation plan is technical guidance and not a substitute for legal advice.

---

## 15. Reference Materials

- Data Privacy Act of 2012:
  https://privacy.gov.ph/data-privacy-act/

- NPC Implementing Rules and Regulations:
  https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/

- NPC Circular No. 2023-04 — Guidelines on Consent:
  https://privacy.gov.ph/wp-content/uploads/2023/11/NPC-Circular-No.-2023-04_Guidelines-on-Consent_07Nov2023.pdf

- NPC — Right to Be Informed:
  https://privacy.gov.ph/the-right-to-be-informed/

- Intellectual Property Code of the Philippines:
  https://lawphil.net/statutes/repacts/ra1997/ra_8293_1997.html