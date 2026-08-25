import { GraphQLClient, gql } from "graphql-request";
import { env } from "./env";
import { getRssPostBySlug, getRssPostsPage } from "./rss";
import {
  FullPost,
  GetPostBySlugResponse,
  GetPostsResponse,
  GetPublicationResponse,
  PostsPage,
  Publication,
  SubscribeToNewsletterResponse,
} from "./types";

const client = new GraphQLClient(env.NEXT_PUBLIC_HASHNODE_ENDPOINT);
const publicationId = env.NEXT_PUBLIC_HASHNODE_PUBLICATION_ID;

/*
 * As of May 2026 Hashnode's GraphQL API requires a paid Pro plan; requests
 * from non-allow-listed publications get redirected to an HTML announcement
 * page. Fall back to empty data instead of failing the whole page/build so
 * the site keeps working (with empty states) until access is restored.
 */
async function safeRequest<T>(
  label: string,
  fallback: T,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Hashnode request "${label}" failed: ${message.slice(0, 200)}`);
    return fallback;
  }
}

const POST_FIELDS = gql`
  fragment PostFields on Post {
    id
    title
    subtitle
    slug
    brief
    publishedAt
    coverImage {
      url
    }
    author {
      name
      profilePicture
    }
  }
`;

export async function getPublication(): Promise<Publication> {
  const query = gql`
    query getPublication($publicationId: ObjectId!) {
      publication(id: $publicationId) {
        title
        displayTitle
        favicon
        descriptionSEO
      }
    }
  `;

  const fallback: Publication = { title: "WorldView", displayTitle: "WorldView" };

  return safeRequest("getPublication", fallback, async () => {
    const response = await client.request<GetPublicationResponse>(query, {
      publicationId,
    });
    return response.publication ?? fallback;
  });
}

export async function getPosts({
  first = 12,
  after = "",
}: {
  first?: number;
  after?: string;
} = {}): Promise<PostsPage> {
  const query = gql`
    ${POST_FIELDS}
    query getPosts($publicationId: ObjectId!, $first: Int!, $after: String) {
      publication(id: $publicationId) {
        posts(first: $first, after: $after) {
          edges {
            node {
              ...PostFields
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `;

  const fallback: PostsPage = {
    edges: [],
    pageInfo: { hasNextPage: false, endCursor: null },
  };

  const page = await safeRequest("getPosts", fallback, async () => {
    const response = await client.request<GetPostsResponse>(query, {
      publicationId,
      first,
      after: after || null,
    });
    return response.publication?.posts ?? fallback;
  });

  // No GraphQL access (paid plan required)? Serve the public RSS feed instead.
  if (page.edges.length === 0 && !after) {
    return getRssPostsPage();
  }

  return page;
}

/*
 * Hashnode's public API can't filter a publication's posts by author name,
 * so fetch a large page and filter here on the server.
 */
export async function getPostsByAuthor(author: string): Promise<PostsPage> {
  const { edges } = await getPosts({ first: 50 });
  const needle = author.toLowerCase();

  return {
    edges: edges.filter((edge) =>
      edge.node.author.name.toLowerCase().includes(needle)
    ),
    pageInfo: { hasNextPage: false, endCursor: null },
  };
}

export async function getPostBySlug(slug: string): Promise<FullPost | null> {
  const query = gql`
    ${POST_FIELDS}
    query getPostBySlug($publicationId: ObjectId!, $slug: String!) {
      publication(id: $publicationId) {
        post(slug: $slug) {
          ...PostFields
          content {
            html
          }
        }
      }
    }
  `;

  const post = await safeRequest("getPostBySlug", null, async () => {
    const response = await client.request<GetPostBySlugResponse>(query, {
      publicationId,
      slug,
    });
    return response.publication?.post ?? null;
  });

  return post ?? getRssPostBySlug(slug);
}

export async function subscribeToNewsletter(email: string) {
  const mutation = gql`
    mutation subscribeToNewsletter($publicationId: ObjectId!, $email: String!) {
      subscribeToNewsletter(
        input: { email: $email, publicationId: $publicationId }
      ) {
        status
      }
    }
  `;

  return client.request<SubscribeToNewsletterResponse>(mutation, {
    publicationId,
    email,
  });
}
