import { getPostsByAuthor } from "@/lib/requests";

export default async function Sports() {
    const posts = await getPostsByAuthor("Dennis Wekesa");

    return (
        <div className="max-w-7xl mx-auto p-5">
            <h1 className="text-3xl font-bold mb-5">Sports Articles</h1>
            <div className="grid gap-5">
                {posts.map((post) => (
                    <div key={post.id} className="border p-4 rounded-lg"> 
                    <h2 className="text-xl font-bold">
                        <a href={`/post/${post.slug}`}>{post.title}</a>
                    </h2>
                    <p className="text-gray-500">{post.subtitle || "No Subtitle"}</p>
                        </div>
                ))}
            </div>
        </div>
    )
}