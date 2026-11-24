export type LegalSection = { id: string; title: string; paragraphs: string[] }
export type LegalDocumentContent = {
  type: "terms" | "privacy"
  title: string
  version: string
  effectiveAt: string
  sections: LegalSection[]
}

export const CURRENT_TERMS_VERSION = "1.0"
export const CURRENT_PRIVACY_VERSION = "1.0"
export const PUBLISH_CONFIRMATION_TEXT_VERSION = "1.0"
export const PUBLISH_CONFIRMATION_TEXT = {
  rights: "I confirm that I have the necessary rights and permissions to publish this project and its materials.",
  accuracy: "I confirm that the information is accurate and that I am authorized to publicly share the contributor details provided.",
} as const

export const TERMS: LegalDocumentContent = {
  type: "terms",
  title: "Terms & Conditions",
  version: CURRENT_TERMS_VERSION,
  effectiveAt: "2026-11-15",
  sections: [
    {
      id: "acceptance",
      title: "Acceptance of Terms",
      paragraphs: [
        "Unarchive is an online platform for students and graduates to preserve, showcase, discover, and cite academic capstone projects. These Terms & Conditions govern your use of Unarchive, including browsing public projects, creating an account, and publishing materials.",
        "You must be eligible to form a binding agreement and able to make the representations in these Terms. If you use Unarchive for an institution or team, you confirm that you are authorized to act for that group.",
        "Creating an account, signing in, or using publishing features constitutes acceptance of the current Terms version. We record the version you accepted. Material changes will be posted with a new version and effective date. If a change requires renewed acceptance, we will ask you to accept the new version before you continue to use the affected features.",
        "You are responsible for using Unarchive lawfully, providing accurate information, and respecting other people's rights. If you do not agree to a required version of these Terms, do not use the corresponding features.",
      ],
    },
    {
      id: "accounts",
      title: "User Accounts",
      paragraphs: [
        "You may register with an email address and password, or sign in with Google after an account already exists. Email addresses must be verified before password sign-in is allowed.",
        "Keep your name, email address, and other account details accurate. You are responsible for safeguarding your credentials and for activity that occurs under your account.",
        "Do not impersonate another person, misstate your affiliation, or use another person's account. We may suspend or terminate accounts that are used for abuse, fraud, security harm, or repeated policy violations, or when required by law.",
      ],
    },
    {
      id: "submission",
      title: "Project Submission Terms",
      paragraphs: [
        "Publishing a project makes it publicly accessible. Before publication you must confirm that you have the necessary rights and permissions to publish the project and its materials, that the information is accurate to the best of your knowledge, and that you are authorized to publicly share any contributor details you include.",
        "These confirmations apply to the specific project you submit. They do not prove that every contributor personally clicked a consent box on Unarchive.",
        "Passing an academic defense or submitting work to a university does not automatically give you permission to republish every manuscript, dataset, recording, or other asset on Unarchive. Obtain any required permissions from co-authors, contributors, institutions, or other rights holders before publishing.",
        "Do not submit content that infringes copyright or other intellectual property rights, or that you are not allowed to disclose.",
      ],
    },
    {
      id: "ip",
      title: "Intellectual Property and Ownership",
      paragraphs: [
        "Project creators and other applicable rights holders retain ownership of their intellectual property. Publishing on Unarchive does not transfer copyright to Unarchive.",
        "By publishing, you grant Unarchive a limited, non-exclusive permission to store, reproduce, display, and make the submitted materials publicly accessible for Unarchive's hosting, discovery, attribution, and citation purposes. This permission includes technical operations such as backups, image optimization, and generating previews.",
        "This permission does not by itself allow third parties to commercially reuse, modify, or redistribute your project materials. Visitors may access and cite publicly available project information as described in these Terms and applicable law. Any broader license, such as an open-source or Creative Commons license, must be stated by the rights holder in the project materials.",
        "Licensing language may be updated after legal review. Changes will not retroactively grant Unarchive rights you never authorized.",
      ],
    },
    {
      id: "attribution",
      title: "Academic Attribution",
      paragraphs: [
        "Give appropriate credit to original authors, team members, contributors, relevant institutions, and third-party materials included in a submission.",
        "Listing an institution does not imply that the institution endorses the project or Unarchive. Listing an adviser or other contributor does not automatically make that person an author.",
        "Do not falsely claim authorship, contributor status, or institutional affiliation.",
      ],
    },
    {
      id: "citations",
      title: "Public Access and Academic Citations",
      paragraphs: [
        "Published projects are publicly accessible and may be indexed by search engines. Visitors may share project URLs and cite publicly available project information.",
        "Being listed on Unarchive is not a peer-reviewed academic publication. Citation availability does not grant permission to reproduce protected content beyond applicable law or any license the rights holder provides.",
        "Unarchive may correct, restrict, or remove content when necessary to address legal, privacy, ownership, or policy issues.",
      ],
    },
    {
      id: "prohibited",
      title: "Prohibited Content",
      paragraphs: [
        "Do not publish plagiarized or knowingly misattributed works; copyright-infringing submissions; confidential academic or institutional materials shared without authorization; personal information disclosed without an appropriate legal basis; exposed credentials, API keys, or private repositories; malicious files or intentionally harmful content; or fraudulent project descriptions or fabricated achievements.",
      ],
    },
    {
      id: "moderation",
      title: "Moderation and Removal",
      paragraphs: [
        "Unarchive may review submitted projects, reject or request corrections, temporarily restrict public access, remove content that violates these policies, investigate authorship, privacy, or ownership complaints, and suspend accounts for serious or repeated violations.",
        "Creators, contributors, and rights holders may request review or removal through the Contact / Report Content form or the contact details published with these Terms. We may unpublish or restrict a project, correct contributor attribution, or remove restricted files when justified.",
      ],
    },
    {
      id: "limitation",
      title: "Limitation of Responsibility",
      paragraphs: [
        "Unarchive hosts and helps people discover user-submitted academic projects. Project authors and publishers are responsible for the content they submit and for the permissions they represent they have.",
        "To the extent permitted by applicable law, Unarchive is not responsible for user-submitted content, third-party sites linked from projects, or academic decisions made by institutions or readers. These Terms do not exclude or limit any responsibility that cannot be excluded under applicable law.",
      ],
    },
    {
      id: "contact",
      title: "Contact Information",
      paragraphs: [
        "For policy questions, copyright complaints, project ownership disputes, or content removal requests, use the Contact / Report Content page. If an operator contact email is configured for this deployment, it is also shown on that page.",
      ],
    },
  ],
}

export const PRIVACY: LegalDocumentContent = {
  type: "privacy",
  title: "Privacy Policy",
  version: CURRENT_PRIVACY_VERSION,
  effectiveAt: "2026-11-15",
  sections: [
    {
      id: "collected",
      title: "Information Collected",
      paragraphs: [
        "This policy describes how Unarchive collects, uses, stores, discloses, and protects personal information. It is intended to align with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) and relevant National Privacy Commission guidance.",
        "Account information may include your name, email address, hashed password, email verification status, session tokens, and, if you use Google sign-in, authentication provider identifiers and any profile image supplied by that provider.",
        "Project information may include title, description, abstract, contributor names, institution, project dates, topics, links, uploaded demo images, publication confirmations, and related version history. Proposal messages and any proposal attachments sent through Unarchive are also stored.",
        "Technical information may include necessary session cookies, security and rate-limit records, and limited device or browser information that the application needs to keep the service working and secure. We do not collect Internet Protocol addresses solely to build an audit log of legal acceptances.",
      ],
    },
    {
      id: "purposes",
      title: "Purposes of Data Processing",
      paragraphs: [
        "We process personal information to authenticate and manage accounts; publish, attribute, and display capstone projects; support project discovery, saving, starring, viewing, and citations; receive and review proposals; process moderation, correction, and removal requests; maintain security and prevent abuse; and send necessary service messages such as email verification codes.",
      ],
    },
    {
      id: "basis",
      title: "Lawful Basis for Processing",
      paragraphs: [
        "Not all processing is based on consent. Account creation, authentication, security, and core hosting are processed because they are necessary to provide the service you request.",
        "Publishing a project relies on your decision to make that project public and on the publishing confirmations you give for that project. Optional processing that is not required to provide the service, if introduced later, will be described separately and will not be bundled with unrelated purposes.",
        "Where processing relies on consent, we will identify the purpose, obtain consent before that processing, and provide a way to withdraw it. Withdrawing consent does not automatically undo a project you already published; you may request withdrawal or correction of that project through the contact channels in this policy.",
      ],
    },
    {
      id: "public",
      title: "Publicly Visible Information",
      paragraphs: [
        "Information that can be public after you publish a project includes display name or publisher name, contributor names you list, institution, project title and descriptions, topics, dates, images, and links. Public information may be discovered, indexed, shared, or cited by other people.",
        "Information that remains private by default includes your account email address, authentication identifiers, passwords, session information, internal moderation notes, and publication confirmation records.",
      ],
    },
    {
      id: "contributors",
      title: "Contributor Information",
      paragraphs: [
        "Projects may name multiple authors or contributors. Publishers must confirm they are authorized to share those details. We collect contributor names for attribution and do not automatically collect or display contributor email addresses.",
        "A publisher's confirmation is not a substitute for consent from another individual where that consent is legally required. Contributors may request correction or removal of their information through the Contact / Report Content page.",
      ],
    },
    {
      id: "providers",
      title: "Third-Party Service Providers",
      paragraphs: [
        "Unarchive uses MongoDB to store application data; Better Auth for authentication; Google for optional sign-in; Cloudflare R2 to store project and proposal files; and Resend to deliver transactional email such as verification codes. These providers process data only as needed to operate Unarchive.",
        "Some providers may process data outside the Philippines. We use them to provide the service and apply available contractual and security protections. We do not currently use separate analytics, advertising, or marketing platforms.",
      ],
    },
    {
      id: "retention",
      title: "Data Retention",
      paragraphs: [
        "Account information is kept while the account remains active. Published projects remain public until they are withdrawn, restricted, or otherwise removed. Version history and publication confirmations are kept as records of what was published and which confirmations were made.",
        "Unpublished drafts are not stored as public projects. Deleted or withdrawn projects are removed from public view. Limited records, including security logs, backups, and request-handling records, may be retained for a period needed for security, dispute handling, or legal obligations, then deleted or anonymized when no longer needed.",
        "We do not promise indefinite storage of every file or account.",
      ],
    },
    {
      id: "security",
      title: "Data Security",
      paragraphs: [
        "We use HTTPS, authenticated sessions, access control, hashed passwords, database authorization, and private object storage for uploaded files. Rate limiting and logging help us detect abuse. Backups may be created as part of normal operations.",
        "No method of transmission or storage is completely secure. We work to protect personal information but cannot guarantee absolute security.",
      ],
    },
    {
      id: "rights",
      title: "User Privacy Rights",
      paragraphs: [
        "Subject to applicable law, you may request access to personal information we hold about you, correction of inaccurate information, erasure or blocking where applicable, objection to certain processing, and withdrawal of consent where consent is the basis for processing. You may also have the right to lodge a complaint with the National Privacy Commission.",
        "Use the Contact / Report Content page to make a request. We may need to verify your identity before completing it.",
      ],
    },
    {
      id: "changes",
      title: "Changes to the Privacy Policy",
      paragraphs: [
        `This Privacy Policy is version ${CURRENT_PRIVACY_VERSION} and is effective ${"15 November 2026"}.`,
        "We will post material changes with a new version and effective date. If a change requires fresh consent under applicable law, we will request that consent before using personal information for the new purpose. Prior acceptance is not treated as consent to new, unrelated processing.",
      ],
    },
    {
      id: "privacy-contact",
      title: "Privacy Contact",
      paragraphs: [
        "The operator of this Unarchive deployment is the organization that configured the service. Privacy questions and requests can be submitted through the Contact / Report Content page. If a privacy contact email is configured, it is shown on that page.",
      ],
    },
  ],
}

export function legalDocumentByType(type: "terms" | "privacy") {
  return type === "privacy" ? PRIVACY : TERMS
}
