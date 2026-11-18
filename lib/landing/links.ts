import { PROJECT_TOPICS } from "../project-topics.mjs"
import { topicSlug } from "../projects/topic-slug.mjs"

export function landingExploreHref() {
  return "/home"
}

export function landingPublishHref() {
  return "/publish"
}

export function landingGetStartedHref(signedIn: boolean) {
  return signedIn ? "/publish" : "/signup"
}

export function landingAccountLinks(signedIn: boolean) {
  return signedIn
    ? [{ href: "/home", label: "Home" }]
    : [{ href: "/login", label: "Log in" }, { href: "/signup", label: "Get Started" }]
}

export function landingTopicTiles() {
  return PROJECT_TOPICS.map((name) => ({ name, href: `/topics/${topicSlug(name)}` }))
}

export function landingFooterGroups() {
  return [
    {
      title: "Explore",
      links: [
        { href: "/home", label: "Projects" },
        { href: "/#topics", label: "Topics" },
        { href: "/home", label: "Institutions" },
      ],
    },
    {
      title: "Create",
      links: [
        { href: "/publish", label: "Publish a project" },
        { href: "/terms#terms-submission", label: "Project guidelines" },
        { href: "/terms#terms-citations", label: "Citations" },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "/terms", label: "Terms" },
        { href: "/privacy", label: "Privacy" },
        { href: "/terms#terms-submission", label: "Guidelines" },
      ],
    },
  ]
}
