export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  published: string;
  readingTime: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
};

export const blogPosts: BlogPost[] = [
  {
    slug: "turn-one-idea-into-a-content-system",
    title: "Turn One Idea Into a Content System",
    description:
      "A simple publishing workflow for turning one strong idea into structured social posts, emails, scripts and articles without losing the original point of view.",
    published: "2026-06-06",
    readingTime: "4 min read",
    sections: [
      {
        heading: "Start with the source idea",
        body:
          "The strongest content systems begin before generation. Capture the situation, tension, audience and practical lesson behind the idea so every output has something specific to preserve."
      },
      {
        heading: "Choose the right format for each platform",
        body:
          "A LinkedIn post can carry the argument, an Instagram caption can carry the recognition, a short video script can lead with the tension and a blog article can expand the useful detail."
      },
      {
        heading: "Publish from a reusable structure",
        body:
          "Once the core article shape is in place, future posts can be added by creating a new entry in the blog content file with a slug, metadata and article sections."
      }
    ]
  }
];

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}
