export const config = {
  site: {
    title: "Smile",
    name: "Smile",
    description: "No code, no life.",
    keywords: ["Javaer"],
    url: "https://jialeyu.com",
    baseUrl: "https://jialeyu.com",
    image: "https://jialeyu.com/og-image.png",
    favicon: {
      ico: "/favicon.ico",
      png: "/favicon.png",
      svg: "/favicon.svg",
      appleTouchIcon: "/favicon.png",
    },
    manifest: "/site.webmanifest",
    rss: {
      title: "Nextjs Blog Template",
      description: "Thoughts on Full-stack development, AI",
      feedLinks: {
        rss2: "/rss.xml",
        json: "/feed.json",
        atom: "/atom.xml",
      },
    },
  },
  author: {
    name: "Jiale Yu",
    email: "827359508@qq.com",
    bio: "smile的博客",
  },
  social: {
    github: "https://github.com/smile243",
    x: "",
    xiaohongshu: "",
    wechat: "",
    buyMeACoffee: "",
  },
  giscus: {
    repo: "",
    repoId: "、",
    categoryId: "",
  },
  navigation: {
    main: [
      { 
        title: "推荐文章", 
        href: "/featured",
      },
      { 
        title: "历史文章", 
        href: "/blog",
      },
    ],
  },
  seo: {
    metadataBase: new URL("https://xxx.com"),
    alternates: {
      canonical: './',
    },
    openGraph: {
      type: "website" as const,
      locale: "zh_CN",
    },
    twitter: {
      card: "summary_large_image" as const,
      creator: "@xxx",
    },
  },
};
