import PostList from "@/components/post-list";
import { getPosts } from "@/lib/requests";

export const revalidate = 300;

export default async function Home() {
  const initialPage = await getPosts({ first: 12 });

  return (
    <main className="max-w-7xl w-full px-3 xl:px-0 mx-auto mt-5">
      <PostList initialPage={initialPage} />
    </main>
  );
}
