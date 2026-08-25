export type Publication = {
  title: string;
  displayTitle?: string | null;
  favicon?: string | null;
  descriptionSEO?: string | null;
};

export type PostAuthor = {
  name: string;
  profilePicture?: string | null;
};

export type PostNode = {
  id: string;
  title: string;
  subtitle?: string | null;
  slug: string;
  brief?: string | null;
  publishedAt?: string | null;
  coverImage?: { url: string } | null;
  author: PostAuthor;
};

export type PostEdge = {
  node: PostNode;
  cursor: string;
};

export type PageInfo = {
  hasNextPage: boolean;
  endCursor?: string | null;
};

export type PostsPage = {
  edges: PostEdge[];
  pageInfo: PageInfo;
};

export type FullPost = PostNode & {
  content: { html: string };
};

export type GetPublicationResponse = {
  publication: Publication | null;
};

export type GetPostsResponse = {
  publication: {
    posts: {
      edges: PostEdge[];
      pageInfo: PageInfo;
    };
  } | null;
};

export type GetPostBySlugResponse = {
  publication: {
    post: FullPost | null;
  } | null;
};

export type SubscribeToNewsletterResponse = {
  subscribeToNewsletter: {
    status: string;
  };
};
